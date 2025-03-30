// Configuration
let translationEnabled = true;
let processedMessages = new Set();
let observerActive = false;
let currentChatId = null;
let chatChangeObserver = null;

// Add variables for summarization
let isSummarizing = false;
let recordedMessages = [];
let floatingSummarizeBtn = null;

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

    // Handle summarization commands
    if (message.type === "START_SUMMARIZING") {
      startSummarizing();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === "CANCEL_SUMMARIZING") {
      cancelSummarizing();
      sendResponse({ success: true });
      return true;
    }

    if (message.type === "FINISH_SUMMARIZING") {
      finishSummarizing();
      sendResponse({ success: true });
      return true;
    }
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === "INJECT_TRANSLATED_TEXT") {
    try {
      injectTextIntoChatBox(message.translatedText);
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error injecting text:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// Function to inject text into the WhatsApp chat input
function injectTextIntoChatBox(text) {
  try {
    // Use the exact XPath to find the input paragraph element
    const inputParagraph = document.evaluate(
      "/html/body/div[1]/div/div/div[3]/div/div[4]/div/footer/div[1]/div/span/div/div[2]/div/div[3]/div[1]/p",
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;

    if (!inputParagraph) {
      console.log(
        "Chat input paragraph not found using XPath, trying alternative selectors"
      );

      // Fallback to other selectors if XPath doesn't work
      const chatInput =
        document.querySelector(
          'div[contenteditable="true"][role="textbox"][data-lexical-editor="true"]'
        ) || document.querySelector('[data-tab="10"][role="textbox"]');

      if (!chatInput) {
        throw new Error("Chat input not found. Are you on WhatsApp Web?");
      }

      // Focus the input
      chatInput.focus();

      // Create the exact structure WhatsApp expects
      const pElement = document.createElement("p");
      pElement.className = "selectable-text copyable-text x15bjb6t x1n2onr6";
      pElement.dir = "ltr";
      pElement.style.textIndent = "0px";
      pElement.style.marginTop = "0px";
      pElement.style.marginBottom = "0px";

      const spanElement = document.createElement("span");
      spanElement.className = "selectable-text copyable-text xkrh14z";
      spanElement.setAttribute("data-lexical-text", "true");
      spanElement.textContent = text;

      pElement.appendChild(spanElement);

      // Clear and replace content
      chatInput.innerHTML = "";
      chatInput.appendChild(pElement);

      // Trigger input event
      chatInput.dispatchEvent(new Event("input", { bubbles: true }));
      console.log("Text injected using fallback method");
      return true;
    }

    console.log("Found chat input using exact XPath");

    // Get the span within the paragraph
    let spanElement = inputParagraph.querySelector(
      'span.selectable-text.copyable-text[data-lexical-text="true"]'
    );

    // If the span doesn't exist, create it with the right structure
    if (!spanElement) {
      console.log("Creating new span element with proper structure");

      // Clear paragraph content first
      inputParagraph.innerHTML = "";

      // Create span with proper attributes
      spanElement = document.createElement("span");
      spanElement.className = "selectable-text copyable-text xkrh14z";
      spanElement.setAttribute("data-lexical-text", "true");
      inputParagraph.appendChild(spanElement);
    }

    // Set the text content of the span
    spanElement.textContent = text;

    // Focus the paragraph to place cursor at the right position
    inputParagraph.focus();

    // Trigger input event for WhatsApp to recognize the change
    const inputEvent = new Event("input", { bubbles: true, cancelable: true });
    inputParagraph.dispatchEvent(inputEvent);

    console.log("Text successfully injected into chat input");
    return true;
  } catch (error) {
    console.error("Error injecting text:", error);

    // Last resort fallback - try to find any editable element and insert the text
    try {
      const editableElements = document.querySelectorAll(
        '[contenteditable="true"]'
      );
      if (editableElements.length > 0) {
        const lastEditable = editableElements[editableElements.length - 1];
        lastEditable.textContent = text;
        lastEditable.dispatchEvent(new Event("input", { bubbles: true }));
        console.log("Text inserted using last-resort method");
        return true;
      }
    } catch (fallbackError) {
      console.error("Fallback insertion also failed:", fallbackError);
    }

    throw error;
  }
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

  // NEW: Also clear the translated messages tracking
  translatedMessages.clear();

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

// Process any existing messages on the page - improved to catch more messages
function processExistingMessages() {
  // Update selectors to include the specific class patterns from examples
  const selectors = [
    // Exact match for the message container in provided examples
    "div.x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8",

    // Original selectors
    "div.message-in, div.message-out",
    ".message",
    "[role=row]",
    ".x1iyjqo2",
    "._ap1_",
    "div.focusable-list-item",
    "div[tabindex='-1'].focusable-list-item",
    "div.message-container",
    "div[data-id]",
    ".copyable-text",
    ".selectable-text",
  ];

  // Find the main message container first
  const messageContainer =
    document.querySelector("#main") || document.querySelector(".two");

  if (!messageContainer) {
    console.log("Main message container not found");
    return;
  }

  // Get all possible message bubbles within the container
  let messageBubbles = [];
  for (const selector of selectors) {
    const elements = messageContainer.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(
        `Found ${elements.length} messages using selector: ${selector}`
      );
      messageBubbles = Array.from(elements);
      break;
    }
  }

  // If we didn't find messages with specific selectors, try a more general approach
  if (messageBubbles.length === 0) {
    // Look for elements that have text content and might be messages
    const allElements = messageContainer.querySelectorAll("*");
    messageBubbles = Array.from(allElements).filter((el) => {
      const text = el.textContent?.trim();
      return text && text.length > 10 && !el.querySelector("*");
    });
    console.log(
      `Found ${messageBubbles.length} possible messages using content heuristic`
    );
  }

  console.log(`Processing ${messageBubbles.length} existing messages`);
  messageBubbles.forEach(processChatBubble);
}

// Check for new messages
function checkForNewMessages() {
  // Add the specific class pattern from examples
  const selectors = [
    "div.x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8",
    // ...existing selectors...
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
  if (!translationEnabled && !isSummarizing) return;

  const messageId = getMessageId(bubble);
  if (processedMessages.has(messageId)) return;

  // Mark as processed to avoid double-processing
  processedMessages.add(messageId);

  // Record message for summarization if in summarizing mode
  if (isSummarizing) {
    recordMessageForSummary(bubble);
  }

  // Check if this is a document/file message without caption
  if (isDocumentWithoutCaption(bubble)) {
    console.log("Skipping document/file without caption");
    return;
  }

  // Find the text content in the bubble - improved version with better real message detection
  const textElement = findActualMessageText(bubble);

  // Skip if no valid text element or content is found
  if (
    !textElement ||
    !textElement.textContent ||
    !textElement.textContent.trim()
  ) {
    console.log("Skipping message: No text content found");
    return;
  }

  // NEW: Check if this element or message has already been translated
  if (
    textElement.classList.contains("whatsapp-translated") ||
    bubble.querySelector(".translation-overlay") ||
    messageWasTranslated(messageId)
  ) {
    console.log("Skipping message: Already translated");
    return;
  }

  // Get the text content for analysis
  let originalText = textElement.textContent.trim();

  // Skip if text is too short (likely not a real message)
  if (originalText.length < 2) {
    console.log("Skipping message: Text too short to be meaningful");
    return;
  }

  // Skip WhatsApp UI elements, logos, and file names
  if (
    isWhatsAppUIElement(textElement, originalText) ||
    isFileNameElement(textElement, originalText)
  ) {
    console.log("Skipping WhatsApp UI element or filename:", originalText);
    return;
  }

  // Skip messages that are just sender names or mentions
  try {
    if (isSenderNameOrMention(originalText, textElement)) {
      console.log("Skipping message: Contains only sender name or mention");
      return;
    }
  } catch (error) {
    console.error("Error checking sender name:", error);
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
    "Element type:",
    textElement.tagName
  );

  // Request translation
  chrome.runtime.sendMessage(
    { type: "TRANSLATE", text: originalText },
    (response) => {
      if (response && response.success && response.translatedText) {
        // Add the translation
        appendTranslation(
          textElement,
          response.translatedText,
          originalText,
          messageId
        );
      } else {
        console.log(
          "Translation failed for message: ",
          originalText.substring(0, 30)
        );
      }
    }
  );
}

// NEW: Create a Set to track message IDs that have been translated
const translatedMessages = new Set();

// NEW: Function to check if a message was already translated
function messageWasTranslated(messageId) {
  return translatedMessages.has(messageId);
}

// Append the translation to the message
function appendTranslation(element, translatedText, originalText, messageId) {
  // Skip if they're the same or if translation failed
  if (
    translatedText === originalText ||
    translatedText.includes("Failed to translate")
  )
    return;

  // NEW: Skip if this element already has a translation overlay as a sibling
  const parentElement = element.parentElement;
  if (parentElement) {
    const existingOverlays = parentElement.querySelectorAll(
      ".translation-overlay"
    );
    if (existingOverlays.length > 0) {
      console.log("Translation overlay already exists, skipping");
      return;
    }
  }

  // NEW: Skip if the message was already translated (belt and suspenders approach)
  if (messageWasTranslated(messageId)) {
    console.log("Message already translated (tracked in Set), skipping");
    return;
  }

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

    // NEW: Mark the element and messageId as translated
    element.classList.add("whatsapp-translated");
    translatedMessages.add(messageId);

    console.log("Translation added successfully");
  } else {
    // If can't find a proper container, append after the element itself
    element.parentElement.insertBefore(translationEl, element.nextSibling);

    // NEW: Mark the element and messageId as translated
    element.classList.add("whatsapp-translated");
    translatedMessages.add(messageId);

    console.log("Translation added successfully (fallback method)");
  }
}

// Find the actual message text, avoiding file names and UI elements
function findActualMessageText(bubble) {
  // First, explicitly look for the pattern from the provided examples
  const exactMatch =
    bubble.querySelector(
      "span._ao3e.selectable-text.copyable-text > span.selectable-text"
    ) ||
    bubble.querySelector("span._ao3e.selectable-text.copyable-text > span") ||
    bubble.querySelector("span[dir='ltr']._ao3e.selectable-text.copyable-text");

  if (exactMatch && exactMatch.textContent && exactMatch.textContent.trim()) {
    console.log(
      "Found message with exact match pattern:",
      exactMatch.textContent.trim()
    );
    return exactMatch.parentElement; // Return the parent span that contains both text and translation
  }

  // Then check other patterns from examples
  const aoElement = bubble.querySelector(
    "span._ao3e.selectable-text.copyable-text"
  );
  if (aoElement && aoElement.textContent && aoElement.textContent.trim()) {
    console.log(
      "Found message with _ao3e class:",
      aoElement.textContent.trim()
    );
    return aoElement;
  }

  // Then check other message containers
  const messageContainers = [
    // Main message containers
    bubble.querySelector("span.selectable-text.copyable-text:not([title])"),
    bubble.querySelector("div.copyable-text span.selectable-text:not([title])"),
    // Handle multiline messages
    bubble.querySelector(".copyable-area .message-text"),

    // Handle message captions for media
    bubble.querySelector(".caption"),
    bubble.querySelector('[data-testid="caption"]'),
  ];

  // Use the first valid text container found
  for (const container of messageContainers) {
    if (container && container.textContent && container.textContent.trim()) {
      return container;
    }
  }

  // More general fallback methods
  return (
    bubble.querySelector("span.selectable-text.copyable-text") ||
    bubble.querySelector("span._ao3e.selectable-text.copyable-text") ||
    bubble.querySelector(".x1iyjqo2") ||
    findTextElement(bubble)
  );
}

// Check if an element is a file name element and not actual message content
function isFileNameElement(element, text) {
  if (!element || !text) return false;

  try {
    // Check if it's inside a document container
    const isInDocumentContainer =
      !!element.closest('[data-icon="document"]') ||
      !!element.closest('[data-icon="document-refreshed-thin"]');

    // Check for document file extensions
    const hasFileExtension =
      /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|jpg|jpeg|png|gif)$/i.test(
        text
      );

    // Check if it's near document icons
    const hasNearbyDocumentIcon =
      !!element.parentElement?.querySelector('[data-icon="document"]') ||
      !!element.parentElement?.querySelector(
        '[data-icon="document-refreshed-thin"]'
      );

    // Check if it's in an element that has document-related classes
    const documentClassPattern = /(document|file|attachment)/i;
    const elementClasses =
      typeof element.className === "string" ? element.className : "";
    const parentClasses = element.parentElement
      ? typeof element.parentElement.className === "string"
        ? element.parentElement.className
        : ""
      : "";

    const hasDocumentClass =
      documentClassPattern.test(elementClasses) ||
      documentClassPattern.test(parentClasses);

    // If it has multiple indicators of being a filename, skip it
    return (
      (isInDocumentContainer && (hasFileExtension || hasNearbyDocumentIcon)) ||
      (hasFileExtension && hasNearbyDocumentIcon) ||
      (hasDocumentClass &&
        (isInDocumentContainer || hasFileExtension || hasNearbyDocumentIcon))
    );
  } catch (error) {
    console.error("Error checking if element is filename:", error);
    return false;
  }
}

// Check if this is a document/file message without any text caption
function isDocumentWithoutCaption(bubble) {
  try {
    // Check for document indicators
    const hasDocument =
      !!bubble.querySelector('[data-icon="document"]') ||
      !!bubble.querySelector('[data-icon="document-refreshed-thin"]') ||
      !!bubble.querySelector('[data-testid="document-thumb"]');

    // Check if there is a caption
    const hasCaption =
      !!bubble.querySelector(".caption") ||
      !!bubble.querySelector('[data-testid="caption"]');

    // If it has document indicators but no caption, it's a document without caption
    return hasDocument && !hasCaption;
  } catch (error) {
    console.error("Error checking for document without caption:", error);
    return false;
  }
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
function appendTranslation(element, translatedText, originalText, messageId) {
  // Skip if they're the same or if translation failed
  if (
    translatedText === originalText ||
    translatedText.includes("Failed to translate")
  )
    return;

  // NEW: Skip if this element already has a translation overlay as a sibling
  const parentElement = element.parentElement;
  if (parentElement) {
    const existingOverlays = parentElement.querySelectorAll(
      ".translation-overlay"
    );
    if (existingOverlays.length > 0) {
      console.log("Translation overlay already exists, skipping");
      return;
    }
  }

  // NEW: Skip if the message was already translated (belt and suspenders approach)
  if (messageWasTranslated(messageId)) {
    console.log("Message already translated (tracked in Set), skipping");
    return;
  }

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

    // NEW: Mark the element and messageId as translated
    element.classList.add("whatsapp-translated");
    translatedMessages.add(messageId);

    console.log("Translation added successfully");
  } else {
    // If can't find a proper container, append after the element itself
    element.parentElement.insertBefore(translationEl, element.nextSibling);

    // NEW: Mark the element and messageId as translated
    element.classList.add("whatsapp-translated");
    translatedMessages.add(messageId);

    console.log("Translation added successfully (fallback method)");
  }
}

// Function to identify WhatsApp UI elements that should not be translated
function isWhatsAppUIElement(element, text) {
  // Skip elements that are clearly part of WhatsApp's UI
  if (!element || !text) return false;

  // Don't mark _ao3e elements as UI elements
  try {
    if (element.classList && element.classList.contains("_ao3e")) {
      return false;
    }
  } catch (e) {
    // Ignore errors in classList check
  }

  try {
    // Check element title attribute for WhatsApp UI indicators
    const title = element.getAttribute("title") || "";
    if (
      title.includes("wordmark") ||
      title.includes("wa-") ||
      title.includes("WhatsApp") ||
      title === "wa-wordmark-refreshed"
    ) {
      return true;
    }

    // Check for specific WhatsApp UI text content
    if (
      text === "WhatsApp" ||
      text === "WA" ||
      text.includes("WhatsApp Web") ||
      text.includes("wa-wordmark")
    ) {
      return true;
    }

    // Check if element is part of the WhatsApp header or UI elements
    if (
      element.closest("header") ||
      element.closest('[data-testid="conversation-header"]') ||
      element.closest("#side") ||
      element.closest(".app-wrapper-web")
    ) {
      // Only consider it a UI element if it's short text in the header areas
      if (text.length < 20) {
        return true;
      }
    }

    // Check if the element or its parent has typical WhatsApp UI classes
    const parentClasses = element.parentElement
      ? element.parentElement.className || ""
      : "";
    const elementClasses =
      typeof element.className === "string" ? element.className : "";

    const uiClassIndicators = [
      "app",
      "header",
      "title",
      "wordmark",
      "_3xTHG",
      "_1BjNO",
      "_16cDG",
      "landing-header",
      "landing-wrapper",
      "_3AjBo",
      "_25u6T",
    ];

    for (const indicator of uiClassIndicators) {
      if (
        (typeof parentClasses === "string" &&
          parentClasses.indexOf(indicator) !== -1) ||
        (typeof elementClasses === "string" &&
          elementClasses.indexOf(indicator) !== -1)
      ) {
        return true;
      }
    }

    // Check for SVG elements (icons) or icon containers
    if (
      element.tagName === "SVG" ||
      element.tagName === "PATH" ||
      element.querySelector("svg") ||
      element.closest("svg")
    ) {
      return true;
    }
  } catch (error) {
    console.error("Error checking for WhatsApp UI element:", error);
    return false;
  }

  return false;
}

// Check if text is just a sender name or mention (not actual message content)
function isSenderNameOrMention(text, element) {
  // If element is not provided or invalid, we can't check it
  if (!element || !element.nodeType) return false;

  // Skip if element has the "_ao3e" class - these are usually actual messages
  // and not sender names, even if they start with @ symbol
  try {
    if (element.classList && element.classList.contains("_ao3e")) {
      console.log("Element has _ao3e class, not treating as sender name");
      return false;
    }
  } catch (e) {
    // Ignore errors in classList check
  }

  // Check if it's just a mention (starts with @ symbol)
  if (text.startsWith("@") && !text.includes(" ")) {
    return true;
  }

  // Check if it's just a sender name pattern (@name + emoji or just plain name)
  if (text.startsWith("@") && (text.length < 20 || /^@[\w\s~.]+$/.test(text))) {
    return true;
  }

  // Safely check className - handle all possible types
  let classNameStr = "";
  try {
    if (typeof element.className === "string") {
      classNameStr = element.className;
    } else if (
      element.className &&
      typeof element.className.baseVal === "string"
    ) {
      // SVG elements have className.baseVal
      classNameStr = element.className.baseVal;
    } else if (
      element.className &&
      typeof element.className.value === "string"
    ) {
      // Some elements might have className.value
      classNameStr = element.className.value;
    } else if (element.className && element.className.toString) {
      // If it's an object with toString, use that
      classNameStr = element.className.toString();
    } else if (element.getAttribute && element.getAttribute("class")) {
      // Fallback to getAttribute("class")
      classNameStr = element.getAttribute("class");
    } else {
      // Final fallback - empty string
      classNameStr = "";
    }
  } catch (e) {
    console.error("Error getting className:", e);
    classNameStr = "";
  }

  // Check for sender info indicators in class or attributes
  if (
    classNameStr.indexOf("data-jid") !== -1 ||
    classNameStr.indexOf("data-display") !== -1 ||
    element.getAttribute("data-jid") ||
    (element.getAttribute("aria-label") &&
      element.getAttribute("aria-label").indexOf("Maybe") !== -1)
  ) {
    return true;
  }

  // If parent/ancestor elements contain specific attributes related to sender info
  try {
    const parent = element.closest(
      '[data-jid], [data-display], [aria-label*="Maybe"]'
    );
    if (parent && parent !== element) {
      return true;
    }
  } catch (e) {
    console.error("Error checking parent elements:", e);
  }

  // Look for emoji-only content with no substantial text
  try {
    if (
      element.querySelectorAll("img.emoji").length > 0 &&
      text.replace(/\s+/g, "").length < 3
    ) {
      return true;
    }
  } catch (e) {
    console.error("Error checking emoji content:", e);
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

// Start recording messages for summarization
function startSummarizing() {
  isSummarizing = true;
  recordedMessages = [];

  // Process all existing messages immediately
  processExistingMessagesForSummary();

  // Create floating button
  createFloatingSummarizeButton();

  console.log("Started recording messages for summarization");
}

// New function to specifically process existing messages for summarization
function processExistingMessagesForSummary() {
  console.log("Processing existing messages for summary");

  // Use multiple selectors to find all possible message elements
  const selectors = [
    // Add exact selector for the message container example provided by user
    "div.x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8",

    // More specific selectors for message content
    "[data-pre-plain-text]",
    "div._ahy1.copyable-text",
    "span._ao3e.selectable-text.copyable-text",
    "div._akbu",

    // Standard WhatsApp message containers
    ".message-in, .message-out",
    // Class based selectors
    "div.focusable-list-item",
    // Using the known patterns from WhatsApp Web
    "div[tabindex='-1']:not([data-id='false'])",
  ];

  // Try each selector until we find messages
  let messages = [];
  for (const selector of selectors) {
    const foundMessages = document.querySelectorAll(selector);
    if (foundMessages && foundMessages.length > 0) {
      console.log(
        `Found ${foundMessages.length} messages with selector: ${selector}`
      );
      messages = Array.from(foundMessages);
      break;
    }
  }

  // If no messages found with specific selectors, try the broader container approach
  if (messages.length === 0) {
    // Get the main chat container
    const chatContainer =
      document.querySelector("#main .copyable-area") ||
      document.querySelector("#main") ||
      document.querySelector(".two");

    if (chatContainer) {
      // First try exact selectors within the container
      const containerSelectors = [
        "div.x9f619.x1hx0egp.x1yrsyyn.x1sxyh0.xwib8y2.xohu8s8",
        "[data-pre-plain-text]",
        "div._ahy1.copyable-text",
      ];

      for (const selector of containerSelectors) {
        const foundMessages = chatContainer.querySelectorAll(selector);
        if (foundMessages && foundMessages.length > 0) {
          console.log(
            `Found ${foundMessages.length} messages with container selector: ${selector}`
          );
          messages = Array.from(foundMessages);
          break;
        }
      }
    }
  }

  console.log(
    `Processing ${messages.length} existing messages for summarization`
  );

  // Process each message found
  messages.forEach((message) => {
    recordMessageForSummary(message);
    markMessageAsRecorded(message);
  });

  console.log(`Successfully recorded ${recordedMessages.length} messages`);
}

// Helper function to check if element is a valid message for summarization
function isValidMessageForSummary(element) {
  // Skip if it's a WhatsApp UI element
  if (isWhatsAppUIElement(element, element.textContent)) {
    return false;
  }

  // Skip very small elements
  if (element.textContent?.trim().length < 3) {
    return false;
  }

  // Skip elements that are likely not messages
  if (
    element.tagName === "BUTTON" ||
    element.tagName === "INPUT" ||
    element.tagName === "SVG" ||
    element.getAttribute("role") === "button"
  ) {
    return false;
  }

  // Check for message content
  const hasText = !!findActualMessageText(element);

  return hasText;
}

// Function to mark a message as recorded with a checkmark
function markMessageAsRecorded(messageElement) {
  // Add visual class for highlighting
  messageElement.classList.add("recording-message");

  // Try to find the best target for adding the checkmark
  const potentialTargets = [
    // Look for the exact selectors from the example
    messageElement.querySelector("span._ao3e.selectable-text.copyable-text"),
    messageElement.querySelector("span.selectable-text.copyable-text"),
    messageElement.querySelector("span._ao3e"),
    messageElement.querySelector("div._akbu"),

    // Or find any element with copyable-text class
    messageElement.querySelector(".copyable-text"),

    // If nothing else works, use the message element itself
    messageElement,
  ];

  // Use the first valid target
  let textContainer = null;
  for (const target of potentialTargets) {
    if (target) {
      textContainer = target;
      break;
    }
  }

  // Only add checkmark if it doesn't already exist
  if (
    textContainer &&
    !messageElement.querySelector(".message-recorded-indicator")
  ) {
    const indicator = document.createElement("span");
    indicator.className = "message-recorded-indicator";
    indicator.textContent = " ✅";
    indicator.title = "This message is being recorded for summarization";

    // Add to the container
    textContainer.appendChild(indicator);

    console.log("Added checkmark to recorded message");
  }
}

// Record message for summarization - improved version to handle the specific structure
function recordMessageForSummary(bubble) {
  // Get the pre-plain-text attribute which contains sender and time info
  const prePlainTextElement = bubble.querySelector("[data-pre-plain-text]");
  const prePlainText = prePlainTextElement
    ? prePlainTextElement.getAttribute("data-pre-plain-text")
    : "";

  // Look for message text in various locations
  const textElements = [
    // Exact match for the structure in the example
    bubble.querySelector("span._ao3e.selectable-text.copyable-text > span"),
    bubble.querySelector("span._ao3e.selectable-text.copyable-text"),
    bubble.querySelector("span._ao3e"),

    // General WhatsApp selectors
    bubble.querySelector(".selectable-text.copyable-text"),
    findActualMessageText(bubble),
  ];

  // Use the first non-empty text element
  let messageElement = null;
  let messageText = "";

  for (const el of textElements) {
    if (el && el.textContent?.trim()) {
      // Skip if this is just a translation overlay
      if (el.classList.contains("translation-overlay")) continue;

      // Get text content, excluding any translation overlay
      const overlay = el.querySelector(".translation-overlay");
      if (overlay) {
        // Temporarily remove overlay to get clean text
        const parent = overlay.parentNode;
        parent.removeChild(overlay);
        messageText = el.textContent.trim();
        // Re-add the overlay
        parent.appendChild(overlay);
      } else {
        messageText = el.textContent.trim();
      }

      if (messageText) {
        messageElement = el;
        break;
      }
    }
  }

  if (!messageText) {
    console.log("Could not find message text, skipping");
    return;
  }

  // Parse pre-plain-text to get time and sender
  let messageTime = "Unknown";
  let senderName = "Unknown";

  if (prePlainText) {
    // Extract time from format like "[12:11 AM, 3/30/2025]"
    const timeMatch = prePlainText.match(/\[(.*?)(?:,|\])/);
    if (timeMatch && timeMatch[1]) {
      messageTime = timeMatch[1].trim();
    }

    // Extract sender name from format like "[time, date] Name:"
    const nameMatch = prePlainText.match(/\]([^:]+):/);
    if (nameMatch && nameMatch[1]) {
      senderName = nameMatch[1].trim();
    }
  } else {
    // Try alternate methods to get time
    const timeElement =
      bubble.querySelector(".x1c4vz4f.x2lah0s") ||
      bubble.querySelector(".x1rg5ohu.x16dsc37") ||
      bubble.querySelector("[aria-hidden='true'] span");

    if (timeElement) {
      messageTime = timeElement.textContent.trim();
    } else {
      // Use current time as fallback
      const now = new Date();
      messageTime = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Try to determine if it's an outgoing message
    const isOutgoing =
      bubble.classList.contains("message-out") ||
      bubble.classList.contains("outgoing") ||
      bubble.getAttribute("data-is-outgoing") === "true";

    if (isOutgoing) {
      senderName = "You";
    } else {
      // Try to find sender name from other elements
      const senderElement =
        bubble.querySelector("._ahxt") ||
        bubble.querySelector("span._ahxt.x1ypdohk.xt0b8zv._ao3e");

      if (senderElement) {
        senderName = senderElement.textContent.trim();
      }
    }
  }

  // Add to recordedMessages
  recordedMessages.push({
    time: messageTime,
    sender: senderName,
    text: messageText,
  });

  console.log(
    `Recorded message from ${senderName}: ${messageText.substring(0, 30)}...`
  );

  // Update count on button
  updateMessageCount();
}

// Cancel summarization
function cancelSummarizing() {
  isSummarizing = false;
  recordedMessages = [];

  // Remove message highlights and blue check indicators
  document.querySelectorAll(".recording-message").forEach((el) => {
    el.classList.remove("recording-message");
    const checkIndicator = el.querySelector(".blue-check-indicator");
    if (checkIndicator) {
      checkIndicator.remove();
    }
  });

  // Remove floating button
  removeFloatingSummarizeButton();

  console.log("Cancelled message recording");
}

// Finish summarization and generate summary - improved with debugging
function finishSummarizing() {
  console.log("Starting finishSummarizing function");
  console.log("Number of recorded messages:", recordedMessages.length);
  console.log("Recorded messages:", JSON.stringify(recordedMessages, null, 2));

  if (recordedMessages.length === 0) {
    console.log("No messages were recorded, sending failure message");
    chrome.runtime.sendMessage({
      type: "SUMMARY_RESULT",
      summary:
        "No messages were recorded. Try again and make sure to view some messages while recording.",
    });

    cancelSummarizing();
    return;
  }

  // Remove floating button
  removeFloatingSummarizeButton();

  // Create conversation text
  const conversation = formatConversation(recordedMessages);
  console.log("Formatted conversation:", conversation);

  // Send to background script for summarization
  console.log("Sending SUMMARIZE_CONVERSATION message to background script");
  chrome.runtime.sendMessage(
    {
      type: "SUMMARIZE_CONVERSATION",
      conversation: conversation,
    },
    (response) => {
      console.log("Received response from SUMMARIZE_CONVERSATION:", response);
      if (chrome.runtime.lastError) {
        console.error(
          "Error in SUMMARIZE_CONVERSATION:",
          chrome.runtime.lastError
        );
      }
    }
  );

  // Reset state
  isSummarizing = false;

  // Remove message highlights with a slight delay
  setTimeout(() => {
    document.querySelectorAll(".recording-message").forEach((el) => {
      el.classList.remove("recording-message");
      const checkIndicator = el.querySelector(".blue-check-indicator");
      if (checkIndicator) {
        checkIndicator.remove();
      }

      // Also remove message-recorded-indicator
      const recordingIndicator = el.querySelector(
        ".message-recorded-indicator"
      );
      if (recordingIndicator) {
        recordingIndicator.remove();
      }
    });
  }, 1000);

  console.log("Finished finishSummarizing function");
}

// Format recorded messages into a conversation - add debugging
function formatConversation(messages) {
  console.log("Formatting conversation from", messages.length, "messages");
  let formattedText = "";

  messages.forEach((msg, index) => {
    console.log(`Message ${index}:`, msg);
    formattedText += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
  });

  console.log("Formatted conversation result:", formattedText);
  return formattedText;
}

// Create floating summarize button
function createFloatingSummarizeButton() {
  if (floatingSummarizeBtn) return;

  floatingSummarizeBtn = document.createElement("button");
  floatingSummarizeBtn.className = "floating-summarize-btn";
  floatingSummarizeBtn.innerHTML = `Finish & Summarize <span class="count">0</span>`;

  floatingSummarizeBtn.addEventListener("click", finishSummarizing);

  document.body.appendChild(floatingSummarizeBtn);

  updateMessageCount();
}

// Remove floating summarize button
function removeFloatingSummarizeButton() {
  if (floatingSummarizeBtn) {
    floatingSummarizeBtn.remove();
    floatingSummarizeBtn = null;
  }
}

// Update message count on the floating button
function updateMessageCount() {
  if (floatingSummarizeBtn) {
    const countEl = floatingSummarizeBtn.querySelector(".count");
    if (countEl) {
      countEl.textContent = recordedMessages.length.toString();
    }
  }
}

// Record message for summarization
function recordMessageForSummary(bubble) {
  // Find the message container - try multiple approaches to get the message text
  let messageElement = findActualMessageText(bubble);

  // If findActualMessageText didn't work, try direct approach for the example structure
  if (
    !messageElement ||
    !messageElement.textContent ||
    !messageElement.textContent.trim()
  ) {
    const directContentSpan = bubble.querySelector(
      "span._ao3e span.selectable-text"
    );
    if (
      directContentSpan &&
      directContentSpan.textContent &&
      directContentSpan.textContent.trim()
    ) {
      messageElement = directContentSpan.parentElement;
    }
  }

  if (
    !messageElement ||
    !messageElement.textContent ||
    !messageElement.textContent.trim()
  ) {
    return;
  }

  // Find the actual text, skipping any translation overlay that might already exist
  let messageText = "";
  const firstChildSpan = messageElement.querySelector("span");
  if (firstChildSpan && firstChildSpan.textContent) {
    messageText = firstChildSpan.textContent.trim();
  } else {
    // Strip any translation overlay content
    const translationOverlay = messageElement.querySelector(
      ".translation-overlay"
    );
    if (translationOverlay) {
      translationOverlay.remove();
      messageText = messageElement.textContent.trim();
      // Re-add the translation overlay
      messageElement.appendChild(translationOverlay);
    } else {
      messageText = messageElement.textContent.trim();
    }
  }

  // Get time from the message element or use current time
  let messageTime = "";
  const timeElement =
    bubble.querySelector(".x1c4vz4f.x2lah0s") ||
    bubble.querySelector("[aria-hidden='true'] span") ||
    bubble.querySelector(".x1rg5ohu.x16dsc37");

  if (timeElement) {
    messageTime = timeElement.textContent.trim();
  } else {
    // Use current time as fallback
    const now = new Date();
    messageTime = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Get sender name
  let senderName = "Unknown";
  const senderElement =
    bubble.querySelector("._ahxt") ||
    bubble.querySelector("[dir='auto'][class*='_ao3e']");

  if (senderElement) {
    senderName = senderElement.textContent.trim();
  } else if (bubble.classList.contains("message-out")) {
    senderName = "You";
  }

  // Add to recorded messages
  recordedMessages.push({
    time: messageTime,
    sender: senderName,
    text: messageText,
  });

  // Mark the bubble as being recorded
  bubble.classList.add("recording-message");

  // Add blue check indicator if it doesn't already exist
  if (!bubble.querySelector(".blue-check-indicator")) {
    const checkIndicator = document.createElement("div");
    checkIndicator.className = "blue-check-indicator";

    // Position it properly in the message bubble structure
    const bestContainer = bubble.querySelector("._akbu") || bubble;
    bestContainer.appendChild(checkIndicator);
  }

  // Update count on button
  updateMessageCount();

  console.log(
    `Recorded message from ${senderName}: ${messageText.substring(0, 30)}...`
  );
}

// Function to mark messages that are being recorded for summarization
function markRecordedMessage(messageElement) {
  // Only add marker if it doesn't already exist
  if (!messageElement.querySelector(".message-recorded-indicator")) {
    const indicator = document.createElement("span");
    indicator.className = "message-recorded-indicator";
    indicator.textContent = " ✅";
    indicator.title = "This message is being recorded for summarization";

    // Find the message text container and append the indicator
    const textContainer = messageElement.querySelector("div.copyable-text");
    if (textContainer) {
      textContainer.appendChild(indicator);
    }
  }
}

// Function to start recording messages for summarization
function startRecordingMessages() {
  // Set up a mutation observer to detect new messages
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if added nodes contain messages
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const messages = node.querySelectorAll(".message-in, .message-out");
            messages.forEach((message) => {
              // Add to collection of messages to summarize
              collectMessageForSummary(message);
              // Add visual indicator
              markRecordedMessage(message);
            });
          }
        });
      }
    });
  });

  // Start observing the chat container
  const chatContainer = document.querySelector("#main div.copyable-area");
  if (chatContainer) {
    observer.observe(chatContainer, { childList: true, subtree: true });
  }

  // Also mark existing messages in the current view
  const existingMessages = document.querySelectorAll(
    ".message-in, .message-out"
  );
  existingMessages.forEach((message) => {
    collectMessageForSummary(message);
    markRecordedMessage(message);
  });

  return observer;
}

// Function to collect message content for summarization
function collectMessageForSummary(messageElement) {
  // Extract message text, sender, timestamp, etc.
  // Add to collection for summarization
  // ...existing code for message collection...
}

// Listen for messages from popup to start/stop recording
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startSummarizing") {
    const observer = startRecordingMessages();
    // Store the observer to stop it later
    window.messageObserver = observer;
    sendResponse({ success: true });
  } else if (request.action === "stopSummarizing") {
    // Stop the observer if it exists
    if (window.messageObserver) {
      window.messageObserver.disconnect();
    }
    // Generate and return summary
    // ...existing code for summary generation...
  }
  // ...existing code...
});

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