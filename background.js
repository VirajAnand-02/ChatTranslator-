let translationEnabled = true;
let targetLanguage = "en"; // Default target language
let translationModel = "local"; // Default to local model
let translator_session = null;
let localModelAvailable = false;

// Initialize settings from storage
chrome.storage.local.get(
  ["translationEnabled", "targetLanguage", "translationModel"],
  (result) => {
    translationEnabled =
      result.translationEnabled !== undefined
        ? result.translationEnabled
        : true;
    targetLanguage = result.targetLanguage || "en";
    translationModel = result.translationModel || "local";
  }
);

// Extension installation or update event
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed or updated:", details.reason);

  // Set default settings on first install
  if (details.reason === "install") {
    chrome.storage.local.set({
      translationEnabled: true,
      targetLanguage: "en",
      translationModel: "local", // Default to local model
    });
    console.log("Default settings initialized");
  }

  // You can perform different actions based on update vs install
  if (details.reason === "update") {
    console.log("Extension updated from version:", details.previousVersion);
    // Migrate settings or show update notification if needed
  }
});

// Browser startup event
chrome.runtime.onStartup.addListener(async () => {
  console.log("Browser started - initializing extension");

  // Try to initialize local model
  try {
    translator_session = await ai.languageModel.create({
      systemPrompt: `You are a translation assistant whose sole responsibility is to translate natural, informal chat text into the specified target language. When performing translations, ensure that:
  
      Tone & Style: The casual, conversational tone and informal nuances (including slang, idioms, and colloquial expressions) of the source text are maintained in the translation.
      Accuracy: The meaning of the original text is preserved exactly. Ensure that all subtleties and implied meanings are accurately conveyed
      Natural Flow: The translated text reads naturally as if it were originally written in the target language. Avoid overly formal or stilted language.
      Context Awareness: Be mindful of cultural nuances and context so that the translated text is both accurate and relatable to native speakers of the target language.
      Conciseness: Translate directly without adding any extra commentary or unnecessary embellishments.
  
      When given a piece of natural, informal chat text along with a target language, provide an accurate and idiomatic translation that reflects how a native speaker would express the same sentiment in everyday conversation.
  
      input will be in json:
      {
        text: "text to translate",
        targetLanguage: "en | english"
      }
  
      Output must be in the following json format:
      {
        translatedText: "translated text",
        failed: "true / false"
      }
      `,
    });
    localModelAvailable = true;

    // If local model is preferred and available, use it
    if (translationModel === "local") {
      console.log("Using local Gemini Nano model for translation");
    } else {
      console.log(
        "Local model available but using web API as per user preference"
      );
    }
  } catch (error) {
    console.log("Local model not available:", error);
    localModelAvailable = false;

    // If local model was preferred but is not available, switch to web API
    if (translationModel === "local") {
      translationModel = "web";
      chrome.storage.local.set({ translationModel: "web" });
      console.log(
        "Switched to web API translation due to local model unavailability"
      );
    }
  }

  // Notify any open options pages about model availability
  chrome.runtime.sendMessage({
    type: "MODEL_STATUS_UPDATE",
    localModelAvailable: localModelAvailable,
    activeModel: translationModel,
  });
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

    if (message.hasOwnProperty("translationModel")) {
      // Only allow changing to local model if it's available
      if (message.translationModel === "local" && !localModelAvailable) {
        sendResponse({
          success: false,
          error: "Local model not available on this device",
        });
        return true;
      }

      translationModel = message.translationModel;
      chrome.storage.local.set({ translationModel });
    }

    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_SETTINGS") {
    sendResponse({
      translationEnabled,
      targetLanguage,
      translationModel,
      localModelAvailable,
    });
    return true;
  }

  if (message.type === "GET_MODEL_STATUS") {
    sendResponse({
      localModelAvailable,
      activeModel: translationModel,
    });
    return true;
  }
});

async function translateText(text, targetLang) {
  // return `[${targetLang}] ${text}`; // temp Only for while debugging and development
  try {
    if (translationModel === "local" && localModelAvailable) {
      return await translateWithLocalModel(text, targetLang);
    } else {
      return `[${targetLang}] ${text}`; // temp Only for while debugging and development
      return await translateWithWebAPI(text, targetLang);
    }
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Failed to translate text");
  }
}

async function translateWithLocalModel(text, targetLang) {
  try {
    // Using Gemini Nano model for translation
    if (!translator_session) {
      throw new Error("Local model not initialized");
    }

    const response = await translator_session.sendMessage({
      text: JSON.stringify({
        text: text,
        targetLanguage: targetLang,
      }),
    });

    // Parse the response
    try {
      const result = JSON.parse(response.text);
      if (result.failed === "true") {
        throw new Error("Translation failed");
      }
      return result.translatedText;
    } catch (parseError) {
      console.error("Failed to parse model response:", parseError);
      return response.text; // Fallback to raw response
    }
  } catch (error) {
    console.error("Local translation error:", error);
    // Fallback to web API if local translation fails
    console.log("Falling back to web API for this translation");
    return `[${targetLang}] ${text}`; // temp Only for while debugging and development
    return translateWithWebAPI(text, targetLang);
  }
}

async function translateWithWebAPI(text, targetLang) {
  try {
    // Simple demonstration with a freely available translation API
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        text
      )}&langpair=auto|${targetLang}`
    );

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData) {
      return data.responseData.translatedText;
    } else {
      throw new Error(data.responseMessage || "Translation failed");
    }
  } catch (error) {
    console.error("Web API translation error:", error);
    throw new Error("Web API translation failed: " + error.message);
  }
}
