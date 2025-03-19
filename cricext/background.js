// Set up the alarm when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    // Create an alarm that fires every 10 minutes
    chrome.alarms.create('checkMatches', { periodInMinutes: 1 });
    
    // Initial check on install
    checkMatches();
  });
  
  // Listen for the alarm
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkMatches') {
      checkMatches();
    }
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
          // Check if there's exactly one result
          if (data.result && data.result.length === 1) {
            const match = data.result[0];
            showNotification(
              'Upcoming RCB Match!',
              `${match.team_1} vs ${match.team_2} on ${new Date(match.event_Date).toLocaleDateString()} at ${match.venue_Name}`
            );
            
            // Store the match data
            chrome.storage.local.set({ 'lastMatch': match });
          }
          
          // Store the last successful check time
          chrome.storage.local.set({ 'lastCheckTime': new Date().toString(), 'lastCheckStatus': 'success' });
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