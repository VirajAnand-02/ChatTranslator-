let translationEnabled = true;
let targetLanguage = "en"; // Default target language

// Initialize settings from storage
chrome.storage.local.get(["translationEnabled", "targetLanguage"], (result) => {
  translationEnabled =
    result.translationEnabled !== undefined ? result.translationEnabled : true;
  targetLanguage = result.targetLanguage || "en";
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRANSLATE") {
    if (!translationEnabled) {
      sendResponse({ success: false, error: "Translation is disabled" });
      return true;
    }

    translateText(message.text, targetLanguage)
      .then((translatedText) => {
        sendResponse({ success: true, translatedText });
      })
      .catch((error) => {
        console.error("Translation error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Required for async response
  }

  if (message.type === "UPDATE_SETTINGS") {
    if (message.hasOwnProperty("translationEnabled")) {
      translationEnabled = message.translationEnabled;
      chrome.storage.local.set({ translationEnabled });
    }

    if (message.hasOwnProperty("targetLanguage")) {
      targetLanguage = message.targetLanguage;
      chrome.storage.local.set({ targetLanguage });
    }

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    sendResponse({
      translationEnabled,
      targetLanguage,
    });
    return true;
  }
});

async function translateText(text, targetLang) {
  try {
    // Using Gemini Nano model for translation
    // In a real implementation, this would use the Chrome ML API

    // This is a placeholder for the Gemini Nano translation API
    // For now, we'll simulate a translation with a simple function

    // In a real implementation, you would use:
    // const model = await chrome.ml.getModel('gemini-nano');
    // const result = await model.translate(text, { targetLanguage: targetLang });
    // return result.translatedText;

    // Simulated translation (replace with actual implementation)
    return `[${targetLang}] ${text}`;
  } catch (error) {
    console.error("Translation API error:", error);
    throw new Error("Failed to translate text");
  }
}
