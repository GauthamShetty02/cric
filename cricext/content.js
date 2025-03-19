// Notify background script that content script is loaded
chrome.runtime.sendMessage({
    action: 'contentScriptLoaded',
    url: window.location.href
  }, (response) => {
    // Optional: Log response from background script
    if (response && response.status === 'registered') {
      console.log('Content script registered with background script');
    }
  });
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showTabNotification') {
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'rcb-match-notification';
      
      // Set the notification content
      notification.innerHTML = `
        <div class="rcb-notification-content">
          <div class="rcb-notification-title">${message.title}</div>
          <div class="rcb-notification-message">${message.message}</div>
        </div>
        <div class="rcb-notification-close">×</div>
      `;
      
      // Apply styles
      const styles = `
        .rcb-match-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: #ffffff;
          border-left: 4px solid #D50000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          padding: 12px;
          z-index: 9999;
          max-width: 300px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          font-family: Arial, sans-serif;
          animation: rcb-notification-slide-in 0.3s forwards;
        }
        .rcb-notification-title {
          font-weight: bold;
          margin-bottom: 4px;
          color: #D50000;
        }
        .rcb-notification-message {
          font-size: 13px;
          color: #333;
        }
        .rcb-notification-close {
          cursor: pointer;
          font-size: 20px;
          color: #999;
          margin-left: 8px;
          height: 20px;
          line-height: 16px;
        }
        .rcb-notification-close:hover {
          color: #D50000;
        }
        @keyframes rcb-notification-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes rcb-notification-slide-out {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .rcb-notification-hide {
          animation: rcb-notification-slide-out 0.3s forwards;
        }
      `;
      
      // Ensure we don't add duplicate styles
      if (!document.getElementById('rcb-notification-styles')) {
        // Add styles to page
        const styleElement = document.createElement('style');
        styleElement.id = 'rcb-notification-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
      }
      
      // Add notification to page
      document.body.appendChild(notification);
      
      // Add click event to close button
      const closeButton = notification.querySelector('.rcb-notification-close');
      closeButton.addEventListener('click', () => {
        notification.classList.add('rcb-notification-hide');
        setTimeout(() => {
          notification.remove();
        }, 300);
      });
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.classList.add('rcb-notification-hide');
          setTimeout(() => {
            if (document.body.contains(notification)) {
              notification.remove();
            }
          }, 300);
        }
      }, 5000);
      
      // Send response to acknowledge receipt
      sendResponse({received: true});
    }
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  });
  
  console.log('RCB Match Tracker content script loaded and ready for notifications');
