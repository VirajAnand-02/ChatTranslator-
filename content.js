// Configuration
let translationEnabled = true;
let processedMessages = new Set();
let observerActive = false;
let currentChatId = null;
let chatChangeObserver = null;

// Initialize the extension
function initialize() {
  // Check settings first
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    translationEnabled = response.translationEnabled;

    if (translationEnabled) {
      setupMutationObserver();
      setupChatChangeDetection();
      // Initial processing happens after chat detection is set up
    }
  });

  // Listen for settings changes
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETTINGS_UPDATED") {
      translationEnabled = message.translationEnabled;

      if (translationEnabled && !observerActive) {
        setupMutationObserver();
        setupChatChangeDetection();
      } else if (!translationEnabled && observerActive) {
        disconnectObservers();
      }

      sendResponse({ success: true });
      return true;
    }
  });
}

// Setup improved chat change detection for WhatsApp Web SPA
function setupChatChangeDetection() {
  // First attempt to find the chat panel
  detectChatPanel();

  // Create an observer for the entire app container to detect when the chat panel appears
  const appContainer = document.getElementById("app") || document.body;

  // If we already have an observer, disconnect it
  if (chatChangeObserver) {
    chatChangeObserver.disconnect();
  }

  // Create a new observer
  chatChangeObserver = new MutationObserver((mutations) => {
    // Check if we can find the chat panel now
    if (!document.querySelector("#main")) {
      detectChatPanel();
    }

    // Check if the chat header has changed
    const chatHeader =
      document.querySelector("header") ||
      document.querySelector('[data-testid="conversation-header"]') ||
      document.querySelector("._ap1_"); // Using class from provided HTML

    if (chatHeader) {
      const newChatId = getChatId(chatHeader);
      if (newChatId && newChatId !== currentChatId) {
        console.log(`Chat changed: ${currentChatId} -> ${newChatId}`);
        currentChatId = newChatId;
        handleChatChange();
      }
    }
  });

  // Start observing with a configuration to watch the entire DOM tree
  chatChangeObserver.observe(appContainer, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  // Also check periodically for chat changes
  setInterval(checkForChatChange, 1000);
}

// Function to detect when a chat panel appears
function detectChatPanel() {
  const chatPanel =
    document.querySelector("#main") ||
    document.querySelector(".two") ||
    document.querySelector("._ap1_"); // Using class from provided HTML

  if (chatPanel) {
    console.log("Chat panel detected, processing messages");
    // Get the current chat ID
    const chatHeader =
      document.querySelector("header") ||
      document.querySelector('[data-testid="conversation-header"]');

    if (chatHeader) {
      currentChatId = getChatId(chatHeader);
      console.log("Initial chat ID:", currentChatId);
    }

    // Process existing messages
    processExistingMessages();
  }
}

// Periodically check if the chat has changed
function checkForChatChange() {
  if (!translationEnabled) return;

  const chatHeader =
    document.querySelector("header") ||
    document.querySelector('[data-testid="conversation-header"]') ||
    document.querySelector("._ap1_"); // Using class from provided HTML

  if (chatHeader) {
    const newChatId = getChatId(chatHeader);
    if (newChatId && newChatId !== currentChatId) {
      console.log(
        `Chat changed (interval check): ${currentChatId} -> ${newChatId}`
      );
      currentChatId = newChatId;
      handleChatChange();
    }
  }
}

// Get a unique identifier for the current chat
function getChatId(header) {
  if (!header) return null;

  // First try to get from URL (most reliable)
  const urlMatch = location.href.match(/\/chat\/([^?#]+)/);
  if (urlMatch && urlMatch[1]) return urlMatch[1];

  // Then try to get from the header content
  const titleElement =
    header.querySelector("[title]") ||
    header.querySelector(".x1iyjqo2") || // Using class from provided HTML
    header.querySelector("span");

  if (titleElement) {
    // Get the title attribute or inner text
    const title =
      titleElement.getAttribute("title") || titleElement.textContent;
    if (title) return title.trim();
  }

  // Last resort: use a hash of the header's innerHTML
  return (
    String(header.innerHTML.length) + "_" + header.innerHTML.substring(0, 50)
  );
}

// Handle when user switches to a different chat
function handleChatChange() {
  console.log("Handling chat change - clearing processed messages");
  // Clear the processed messages cache
  processedMessages.clear();

  // Wait a short time for the new chat to fully load
  setTimeout(() => {
    console.log("Processing messages in new chat");
    processExistingMessages();
  }, 500);
}

// Setup mutation observer to detect new messages
function setupMutationObserver() {
  if (observerActive) return;

  const observer = new MutationObserver((mutations) => {
    let shouldCheckMessages = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        shouldCheckMessages = true;
        break;
      }
    }

    if (shouldCheckMessages) {
      // Debounce the check to avoid excessive processing
      clearTimeout(window.messageCheckTimeout);
      window.messageCheckTimeout = setTimeout(checkForNewMessages, 100);
    }
  });

  // Store the observer in the window object so we can disconnect it later
  window.messageObserver = observer;

  // Find the right target to observe
  findAndObserveMessageContainer(observer);
}

// Find the message container and start observing it
function findAndObserveMessageContainer(observer) {
  // Try different selectors that might contain messages
  const selectors = [
    "#main div.copyable-area",
    ".message-list",
    ".two",
    "#main",
  ];

  let container = null;
  for (const selector of selectors) {
    container = document.querySelector(selector);
    if (container) break;
  }

  if (container) {
    console.log("Found message container, setting up observer");
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    observerActive = true;

    // Process existing messages now that we have found the container
    processExistingMessages();
  } else {
    // Try again if the chat container isn't available yet
    console.log("Message container not found, retrying in 1 second");
    setTimeout(() => findAndObserveMessageContainer(observer), 1000);
  }
}

// Disconnect all observers
function disconnectObservers() {
  if (window.messageObserver) {
    window.messageObserver.disconnect();
    observerActive = false;
  }

  if (chatChangeObserver) {
    chatChangeObserver.disconnect();
  }
}

// Process any existing messages on the page
function processExistingMessages() {
  // Try multiple selectors that might match message bubbles - more comprehensive selectors
  const selectors = [
    "div.message-in, div.message-out",
    ".message",
    "[role=row]",
    ".x1iyjqo2", // Using class from provided HTML
    // Additional selectors to catch more message types
    "div[data-id]",
    ".copyable-text",
    ".selectable-text",
    ".message-container",
  ];

  let messageBubbles = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Found messages using selector: ${selector}`);
      messageBubbles = elements;
      break;
    }
  }

  console.log(`Found ${messageBubbles.length} existing messages to process`);
  messageBubbles.forEach(processChatBubble);
}

// Check for new messages
function checkForNewMessages() {
  // Use same comprehensive selectors as processExistingMessages
  const selectors = [
    "div.message-in, div.message-out",
    ".message",
    "[role=row]",
    ".x1iyjqo2", // Using class from provided HTML
    "div[data-id]",
    ".copyable-text",
    ".selectable-text",
    ".message-container",
  ];

  let messageBubbles = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      messageBubbles = elements;
      break;
    }
  }

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
  const id = bubble.getAttribute("data-id") || bubble.getAttribute("id");
  if (id) return id;

  // Try to get a timestamp if it exists
  const timestamp =
    bubble
      .querySelector("[data-pre-plain-text]")
      ?.getAttribute("data-pre-plain-text") ||
    bubble.querySelector("._ak8i")?.textContent; // Using class from provided HTML

  // Get the text content
  const content = bubble.textContent || "";

  // Create a unique hash based on content and position
  const position = Array.from(bubble.parentNode.children).indexOf(bubble);
  return `${position}_${timestamp || ""}_${content.length}_${content.substring(
    0,
    20
  )}`;
}

// Process a chat bubble for translation with improved handling of complex messages
function processChatBubble(bubble) {
  if (!translationEnabled) return;

  const messageId = getMessageId(bubble);
  if (processedMessages.has(messageId)) return;

  // Mark as processed to avoid double-processing
  processedMessages.add(messageId);

  // Find the text content in the bubble - improved version
  const textElement =
    bubble.querySelector("span.selectable-text.copyable-text") ||
    bubble.querySelector("span._ao3e.selectable-text.copyable-text") || // Specific to example
    bubble.querySelector(".x1iyjqo2") ||
    findTextElement(bubble);

  if (!textElement || !textElement.textContent.trim()) {
    console.log("Skipping message: No text content found");
    return;
  }

  // Get the text content for analysis
  let originalText = textElement.textContent.trim();

  // Skip messages that are just sender names or mentions (start with @ or are likely just metadata)
  if (isSenderNameOrMention(originalText, textElement)) {
    console.log("Skipping message: Contains only sender name or mention");
    return;
  }

  // Skip messages that might already be translated
  if (bubble.querySelector(".translation-overlay")) {
    console.log("Skipping message: Already has translation overlay");
    return;
  }

  // Log details for debugging
  console.log(
    "Processing message: ",
    originalText.substring(0, 30) + (originalText.length > 30 ? "..." : ""),
    "Element:",
    textElement.className
  );

  // Request translation
  chrome.runtime.sendMessage(
    { type: "TRANSLATE", text: originalText },
    (response) => {
      if (response && response.success && response.translatedText) {
        // Add the translation
        appendTranslation(textElement, response.translatedText, originalText);
      } else {
        console.log(
          "Translation failed for message: ",
          originalText.substring(0, 30)
        );
      }
    }
  );
}

// Check if text is just a sender name or mention (not actual message content)
function isSenderNameOrMention(text, element) {
  // Check if it's just a mention (starts with @ symbol)
  if (text.startsWith("@") && !text.includes(" ")) {
    return true;
  }

  // Check if it's just a sender name pattern (@name + emoji or just plain name)
  if (text.startsWith("@") && (text.length < 20 || /^@[\w\s~.]+$/.test(text))) {
    return true;
  }

  // Check if the element has classes that typically indicate sender information
  // Fix: Ensure className is properly converted to a string before using includes
  const className =
    typeof element.className === "string"
      ? element.className
      : String(element.className || "");

  if (
    className.indexOf("data-jid") !== -1 ||
    className.indexOf("data-display") !== -1 ||
    element.getAttribute("data-jid") ||
    element.getAttribute("aria-label")?.includes("Maybe")
  ) {
    return true;
  }

  // If parent/ancestor elements contain specific attributes related to sender info
  const parent = element.closest(
    '[data-jid], [data-display], [aria-label*="Maybe"]'
  );
  if (parent && parent !== element) {
    return true;
  }

  // Look for emoji-only content with no substantial text
  if (
    element.querySelectorAll("img.emoji").length > 0 &&
    text.replace(/\s+/g, "").length < 3
  ) {
    return true;
  }

  // Check for specific patterns in WhatsApp that indicate this is just metadata
  if (
    text.includes("@c.us") ||
    text.includes("919") ||
    text.match(/^\s*@[\w~.]+\s*$/)
  ) {
    return true;
  }

  return false;
}

// Check if the message contains media elements
function checkForMediaContent(bubble) {
  // Check for images
  const hasImage =
    bubble.querySelector("img") ||
    bubble.querySelector('[data-testid="image-thumb"]') ||
    bubble.querySelector('[data-icon="document-refreshed-thin"]') ||
    bubble.querySelector('[data-icon="image"]');

  // Check for videos
  const hasVideo =
    bubble.querySelector("video") ||
    bubble.querySelector('[data-testid="video-thumb"]') ||
    bubble.querySelector('[data-icon="video"]');

  // Check for audio
  const hasAudio =
    bubble.querySelector("audio") ||
    bubble.querySelector('[data-icon="audio"]') ||
    bubble.querySelector('[data-testid="audio-player"]');

  // Check for documents or other files
  const hasDocument =
    bubble.querySelector('[data-icon="document"]') ||
    bubble.querySelector('[data-testid="document-thumb"]');

  return hasImage || hasVideo || hasAudio || hasDocument;
}

// Find the text element within a complex message bubble (improved version)
function findTextElement(bubble) {
  // First check for the direct WhatsApp text elements that include mentions and emojis
  const mainTextElement = bubble.querySelector(
    "span.selectable-text.copyable-text"
  );
  if (mainTextElement) {
    return mainTextElement;
  }

  // Next, try looking for the specific structure in the example
  const complexTextElement = bubble.querySelector(
    "span._ao3e.selectable-text.copyable-text"
  );
  if (complexTextElement) {
    return complexTextElement;
  }

  // Check if this is a media message with a caption
  const captionSelectors = [
    ".caption",
    '[data-testid="caption"]',
    "figcaption",
    ".media-caption",
  ];

  for (const selector of captionSelectors) {
    const caption = bubble.querySelector(selector);
    if (caption && caption.textContent.trim()) {
      return caption;
    }
  }

  // Look for standard WhatsApp message content elements - improved based on the example
  const contentSelectors = [
    "span.selectable-text",
    ".copyable-text span",
    ".selectable-text",
    "span._ao3e", // Added from example
    "[dir=ltr]",
    "[dir=auto]",
    ".x1iyjqo2",
  ];

  for (const selector of contentSelectors) {
    const elements = bubble.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent.trim();
      // Skip very short texts, likely timestamps or status indicators
      // But allow texts with emojis (which might appear short as text but have images)
      if (
        (text.length > 5 || el.querySelectorAll("img.emoji").length > 0) &&
        (!el.querySelector("*") ||
          el.childNodes.length === 1 ||
          el.querySelectorAll("img.emoji").length > 0)
      ) {
        return el;
      }
    }
  }

  // Fallback: Look for any element with substantial text content
  const allElements = bubble.querySelectorAll("*");
  for (const el of allElements) {
    const text = el.textContent.trim();
    // Also consider elements with emojis as valid text elements
    if (
      (text.length > 5 || el.querySelectorAll("img.emoji").length > 0) &&
      (!el.querySelector("*") || el.querySelectorAll("img.emoji").length > 0)
    ) {
      return el;
    }
  }

  return null;
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
  translationEl.style.padding = "2px 8px";
  translationEl.style.borderLeft = "3px solid #2196f3";
  translationEl.textContent = translatedText;

  // Try to find the right parent to append to
  const messageContainer =
    element.closest(".copyable-text") ||
    element.closest("[role=row]") ||
    element.closest(".x78zum5") || // Using class from provided HTML
    element.parentElement;

  if (messageContainer) {
    messageContainer.appendChild(translationEl);
  } else {
    // If can't find a proper container, append after the element itself
    element.parentElement.insertBefore(translationEl, element.nextSibling);
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
