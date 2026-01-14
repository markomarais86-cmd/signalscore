// LaunchPulse Chrome Extension - Background Service Worker

// Install event
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("LaunchPulse extension installed");
  }
});

// Handle any background tasks here if needed in the future
// For now, the extension works primarily through popup.js and content.js
