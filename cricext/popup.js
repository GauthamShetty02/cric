document.addEventListener('DOMContentLoaded', function() {
  const contentDiv = document.getElementById('content');
  const statusDiv = document.getElementById('status');
  
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
    return `
      <div class="match-card">
        <div class="date-time">${formatDate(match.event_Date)}</div>
        <div class="team-vs">
          <div>${match.team_1}</div>
          <div class="vs">VS</div>
          <div>${match.team_2}</div>
        </div>
        <div class="venue">${match.venue_Name}, ${match.city_Name}</div>
        <a href="https://tickets.royalchallengers.com/" class="buy-tickets" target="_blank">
          ${match.event_Button_Text || "BUY TICKETS"}
        </a>
      </div>
    `;
  }
  
  // Get last check status
  chrome.storage.local.get(['lastCheckTime', 'lastCheckStatus', 'lastError'], function(data) {
    if (data.lastCheckTime) {
      let statusText = `Last checked: ${new Date(data.lastCheckTime).toLocaleTimeString()}`;
      let statusClass = 'status-success';
      
      if (data.lastCheckStatus === 'error') {
        statusText += ` - Error: ${data.lastError || 'Unknown error'}`;
        statusClass = 'status-error';
      }
      
      statusDiv.textContent = statusText;
      statusDiv.className = statusClass;
    }
  });
  
  // Fetch data from API
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
          'lastCheckStatus': 'success'
        });
        
        // Show notification if there's exactly one match
        if (data.result.length === 1) {
          // Update the badge
          chrome.action.setBadgeText({text: "1"});
          chrome.action.setBadgeBackgroundColor({color: "#D50000"});
        } else {
          chrome.action.setBadgeText({text: ""});
        }
      } else {
        contentDiv.innerHTML = '<div class="error">No upcoming matches found</div>';
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
    });
    
  // Add manual refresh button handler
  document.getElementById('refresh-button').addEventListener('click', function() {
    location.reload();
  });
});