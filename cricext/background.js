// Set up the alarm when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Create an alarm that fires every 1 minute
  chrome.alarms.create('checkMatches', { periodInMinutes: 1 });
  
  // Set dataRefreshed to false on install to ensure first check is treated as new
  chrome.storage.local.set({ 'dataRefreshed': false });
  
  // Initial check on install
  checkMatches();
});

// Listen for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkMatches') {
    checkMatches();
  }
});

// Track active tabs for notifications
let activeTabIds = [];

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptLoaded') {
    // Add the tab to our active tabs list
    if (sender.tab && sender.tab.id) {
      if (!activeTabIds.includes(sender.tab.id)) {
        activeTabIds.push(sender.tab.id);
      }
    }
    sendResponse({status: 'registered'});
  } else if (request.action === 'manualRefresh') {
    checkMatches();
    sendResponse({status: 'refreshing'});
  } else if (request.action === 'popupOpened') {
    sendResponse({status: 'acknowledged'});
  }
  return true;
});

// Track when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabIds = activeTabIds.filter(id => id !== tabId);
});

// Function to check matches
function checkMatches() {
  fetch('https://rcbmpapi.ticketgenie.in/ticket/eventlist/O')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      
      if (data.status === "Success") {
        // Get previous match count to compare
        chrome.storage.local.get(['matchCount', 'dataRefreshed'], function(result) {
          const previousCount = result.matchCount || 0;
          const currentCount = data.result ? data.result.length : 0;
          const dataWasRefreshed = result.dataRefreshed || false;
          
          // Store the new match count immediately
          chrome.storage.local.set({ 
            'lastCheckTime': new Date().toString(), 
            'lastCheckStatus': 'success',
            'matchCount': currentCount,
            'dataRefreshed': true
          });
          
          // Check if data has actually changed
          const hasNewData = currentCount !== previousCount || !dataWasRefreshed;
          
          // Always broadcast the refresh to any open popup
          chrome.runtime.sendMessage({
            action: 'dataRefreshed',
            timestamp: new Date().toString(),
            matchCount: currentCount
          });

        
          
          if (hasNewData) {
            // Show data refresh notification
            showNotification(
              'RCB Match Tracker',
              `Found ${currentCount} match${currentCount !== 1 ? 'es' : ''} for Royal Challengers Bengaluru.`
            );
            
            // Notify all tabs about the refresh
            notifyAllTabs(
              'RCB Match Tracker',
              `Data refreshed - Found ${currentCount} match${currentCount !== 1 ? 'es' : ''} for Royal Challengers Bengaluru.`
            );
          }
          
          // Check if there's exactly one result
          if (data.result && data.result.length === 1) {
            const match = data.result[0];
            
            // Store the match data
            chrome.storage.local.set({ 'lastMatch': match });
            
            // Update the badge
            chrome.action.setBadgeText({text: "1"});
            chrome.action.setBadgeBackgroundColor({color: "#D50000"});
          } else if (data.result && data.result.length > 1) {
            // Show count if more than one match
            chrome.action.setBadgeText({text: currentCount.toString()});
            chrome.action.setBadgeBackgroundColor({color: "#D50000"});
          } else {
            // Clear the badge if there are no matches
            chrome.action.setBadgeText({text: ""});
          }
        });
      } else {
        throw new Error('API returned unsuccessful status');
      }
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      
      // Show notification for failure
      showNotification(
        'RCB Match Tracker Error',
        `Failed to fetch match data: ${error.message}`
      );
      
      // Store the error
      chrome.storage.local.set({ 
        'lastCheckTime': new Date().toString(), 
        'lastCheckStatus': 'error',
        'lastError': error.message
      });
      
      // Broadcast the error to any open popup
      chrome.runtime.sendMessage({
        action: 'dataError',
        timestamp: new Date().toString(),
        error: error.message
      });
    });
}

// Function to show notifications
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Function to notify all tabs about data refresh
function notifyAllTabs(title, message) {
  chrome.tabs.query({active: true}, function(tabs) {
    tabs.forEach(function(tab) {
      // Only send to normal web pages, not to chrome:// urls or extension pages
      if (tab.url && tab.url.startsWith('http')) {
        chrome.tabs.sendMessage(
          tab.id, 
          {
            action: 'showTabNotification',
            title: title,
            message: message
          }, 
          function(response) {
            // Check for any error in sending message
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.log('Could not send message to tab:', tab.id, lastError.message);
            }
          }
        );
      }
    });
  });
}

// Run a check immediately when the service worker starts
checkMatches();
