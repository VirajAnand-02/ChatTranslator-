// This is a simple loader script that loads the main background script
// This avoids the ES modules issue with service workers

// Import the main script via importScripts
importScripts("background.js");

// Log that the loader script has initialized
console.log("Background loader script initialized");
