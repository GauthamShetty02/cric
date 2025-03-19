document.addEventListener('DOMContentLoaded', function() {
  const contentDiv = document.getElementById('content');
  const statusDiv = document.getElementById('status');
  const refreshInfoDiv = document.getElementById('refresh-info');
  
  // Set up the refresh notification
  const refreshNotification = document.getElementById('refresh-notification');
  
  // Notify background script that popup is opened
  chrome.runtime.sendMessage({action: 'popupOpened'}, (response) => {
    console.log('Popup opened notification sent');
  });
  
  // Function to format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: true 
    };
    return date.toLocaleDateString('en-US', options);
  }
  
  // Function to create match cards
  function createMatchCard(match) {
    // Create the dynamic ticket URL using event_Group_Code
    const ticketUrl = match.event_Group_Code 
      ? `https://shop.royalchallengers.com/ticket/${match.event_Group_Code}`
      : "https://tickets.royalchallengers.com/";
    
    return `
      <div class="match-card">
        <div class="date-time">${formatDate(match.event_Date)}</div>
        <div class="team-vs">
          <div>${match.team_1}</div>
          <div class="vs">VS</div>
          <div>${match.team_2}</div>
        </div>
        <div class="venue">${match.venue_Name}, ${match.city_Name}</div>
        <a href="${ticketUrl}" class="buy-tickets" target="_blank">
          ${match.event_Button_Text || "BUY TICKETS"}
        </a>
      </div>
    `;
  }
  
  // Function to update status
  function updateStatus(time, status, error, matchCount) {
    let statusText = `Last checked: ${new Date(time).toLocaleTimeString()}`;
    let statusClass = 'status-success';
    
    if (status === 'error') {
      statusText += ` - Error: ${error || 'Unknown error'}`;
      statusClass = 'status-error';
    } else if (matchCount !== undefined) {
      statusText += ` - Found ${matchCount} match${matchCount !== 1 ? 'es' : ''}`;
    }
    
    statusDiv.textContent = statusText;
    statusDiv.className = statusClass;
  }
  
  // Show refresh notification
  function showRefreshNotification() {
    refreshNotification.classList.add('show');
    setTimeout(() => {
      refreshNotification.classList.remove('show');
    }, 3000);
  }
  
  // Get last check status
  chrome.storage.local.get(['lastCheckTime', 'lastCheckStatus', 'lastError', 'matchCount'], function(data) {
    if (data.lastCheckTime) {
      updateStatus(data.lastCheckTime, data.lastCheckStatus, data.lastError, data.matchCount);
    }
  });
  
  // Set refresh info
  refreshInfoDiv.textContent = "Auto-refreshes every 1 minute";
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'dataRefreshed') {
      updateStatus(message.timestamp, 'success', null, message.matchCount);
      showRefreshNotification();
      fetchMatches(); // Reload the matches
    } else if (message.action === 'dataError') {
      updateStatus(message.timestamp, 'error', message.error);
    }
  });
  
  // Function to fetch matches
  function fetchMatches() {
    contentDiv.innerHTML = '<div class="loading">Loading upcoming matches...</div>';
    
    fetch('https://rcbmpapi.ticketgenie.in/ticket/eventlist/O')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        if (data.status === "Success" && data.result && data.result.length > 0) {
          contentDiv.innerHTML = '';
          
          // Sort matches by date (newest first)
          const sortedMatches = data.result.sort((a, b) => {
            return new Date(a.event_Date) - new Date(b.event_Date);
          });
          
          // Create match cards for each event
          sortedMatches.forEach(match => {
            contentDiv.innerHTML += createMatchCard(match);
          });
          
          // Update status
          chrome.storage.local.set({ 
            'lastCheckTime': new Date().toString(), 
            'lastCheckStatus': 'success',
            'matchCount': data.result.length
          });
          
          updateStatus(new Date().toString(), 'success', null, data.result.length);
        } else {
          contentDiv.innerHTML = '<div class="error">No upcoming matches found</div>';
          chrome.storage.local.set({ 'matchCount': 0 });
          updateStatus(new Date().toString(), 'success', null, 0);
        }
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        contentDiv.innerHTML = `<div class="error">Failed to load matches: ${error.message}</div>`;
        
        // Update status
        chrome.storage.local.set({ 
          'lastCheckTime': new Date().toString(), 
          'lastCheckStatus': 'error',
          'lastError': error.message
        });
        
        updateStatus(new Date().toString(), 'error', error.message);
      });
  }
  
  // Initial fetch
  fetchMatches();
  
  // Set up interval to update "last checked" time while popup is open
  const updateTimerInterval = setInterval(() => {
    chrome.storage.local.get(['lastCheckTime', 'lastCheckStatus', 'lastError', 'matchCount'], function(data) {
      if (data.lastCheckTime) {
        updateStatus(data.lastCheckTime, data.lastCheckStatus, data.lastError, data.matchCount);
      }
    });
  }, 10000); // Update every 10 seconds
  
  // Clean up interval when popup closes
  window.addEventListener('beforeunload', () => {
    clearInterval(updateTimerInterval);
  });
    
  // Add manual refresh button handler
  document.getElementById('refresh-button').addEventListener('click', function() {
    // Show loading state
    this.textContent = "Refreshing...";
    this.disabled = true;
    
    // Request refresh from background script
    chrome.runtime.sendMessage({action: 'manualRefresh'}, (response) => {
      if (response && response.status === 'refreshing') {
        // Will be updated via the message listener
      } else {
        // Fallback to direct refresh
        fetchMatches();
      }
      
      // Reset button after a short delay
      setTimeout(() => {
        this.textContent = "Refresh";
        this.disabled = false;
      }, 1000);
    });
  });
});
