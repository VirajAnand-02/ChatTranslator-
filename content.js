// Configuration
let translationEnabled = true;
let processedMessages = new Set();
let observerActive = false;

// Initialize the extension
function initialize() {
  // Check settings first
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    translationEnabled = response.translationEnabled;

    if (translationEnabled) {
      setupMutationObserver();
      // Process existing messages
      processExistingMessages();
    }
  });

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETTINGS_UPDATED") {
      translationEnabled = message.translationEnabled;

      if (translationEnabled && !observerActive) {
        setupMutationObserver();
        processExistingMessages();
      } else if (!translationEnabled && observerActive) {
        disconnectObserver();
      }

      sendResponse({ success: true });
      return true;
    }
  });
}

// Setup mutation observer to detect new messages
function setupMutationObserver() {
  if (observerActive) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Look for new message bubbles
        checkForNewMessages();
      }
    }
  });

  // Target the chat container - WhatsApp Web specific
  const chatContainer = document.querySelector("#main div.copyable-area");
  if (chatContainer) {
    observer.observe(chatContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observerActive = true;
  } else {
    // Try again if the chat container isn't available yet
    setTimeout(setupMutationObserver, 1000);
  }

  return observer;
}

// Disconnect the observer when translation is disabled
function disconnectObserver() {
  if (window.messageObserver) {
    window.messageObserver.disconnect();
    observerActive = false;
  }
}

// Process any existing messages on the page
function processExistingMessages() {
  const messageBubbles = document.querySelectorAll(
    "div.message-in, div.message-out"
  );
  messageBubbles.forEach(processChatBubble);
}

// Check for new messages
function checkForNewMessages() {
  const messageBubbles = document.querySelectorAll(
    "div.message-in, div.message-out"
  );

  // Process only new bubbles
  messageBubbles.forEach((bubble) => {
    if (!processedMessages.has(getMessageId(bubble))) {
      processChatBubble(bubble);
    }
  });
}

// Get a unique ID for a message bubble
function getMessageId(bubble) {
  // Try to get a data-id attribute which might exist
  const id = bubble.getAttribute("data-id");
  if (id) return id;

  // Fallback: Create a hash from the content and timestamp
  const content = bubble.textContent || "";
  const timestamp =
    bubble
      .querySelector("span.copyable-text")
      ?.getAttribute("data-pre-plain-text") || "";
  return `${content.length}_${timestamp}_${content.substring(0, 20)}`;
}

// Process a chat bubble for translation
function processChatBubble(bubble) {
  if (!translationEnabled) return;

  const messageId = getMessageId(bubble);
  if (processedMessages.has(messageId)) return;

  // Mark as processed to avoid double-processing
  processedMessages.add(messageId);

  // Find the text content in the bubble
  const textElement = bubble.querySelector("span.selectable-text");
  if (!textElement || !textElement.textContent.trim()) return;

  // Skip messages that might already be translated (simple heuristic)
  if (textElement.parentElement.querySelector(".translation-overlay")) return;

  const originalText = textElement.textContent.trim();

  // Request translation
  chrome.runtime.sendMessage(
    { type: "TRANSLATE", text: originalText },
    (response) => {
      if (response && response.success && response.translatedText) {
        // Add the translation
        appendTranslation(textElement, response.translatedText, originalText);
      }
    }
  );
}

// Append the translation to the message
function appendTranslation(element, translatedText, originalText) {
  // Skip if they're the same or if translation failed
  if (
    translatedText === originalText ||
    translatedText.includes("Failed to translate")
  )
    return;

  // Create translation overlay
  const translationEl = document.createElement("div");
  translationEl.className = "translation-overlay";
  translationEl.style.fontSize = "0.9em";
  translationEl.style.fontStyle = "italic";
  translationEl.style.marginTop = "4px";
  translationEl.style.color = "#a8a8a8";
  translationEl.textContent = translatedText;

  // Append after the message text
  const messageContainer = element.closest(".copyable-text");
  if (messageContainer) {
    messageContainer.parentElement.appendChild(translationEl);
  }
}

// Start the extension
window.addEventListener("load", initialize);
// Also run on DOM content loaded in case WhatsApp uses SPA navigation
document.addEventListener("DOMContentLoaded", initialize);
// Additional initialization for cases where the page is already loaded
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  initialize();
}
