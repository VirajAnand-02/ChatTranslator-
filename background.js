let translationEnabled = true;
let targetLanguage = "en"; // Default target language
let translationModel = "local"; // Default to local model
let translator_session = null;
let localModelAvailable = false;
let vertexConfig = null; // Store Vertex AI configuration

const systemPrompt = `You are a translation assistant specializing in informal, natural chat text. Your job is to translate text while maintaining:
Casual Tone: Keep slang, idioms, and conversational style.
Accuracy: Preserve the original meaning and nuances.style.
Natural Flow: Make it sound like a native speaker wrote it.
Context Awareness: Adapt to cultural differences. wrote it.
Conciseness: No extra commentary—just a direct translation.
Conciseness: No extra commentary—just a direct translation.
ignore filler words
ignore filler words
Output must be JSON string only dont do markdown formatting:
Output must be JSON string only dont do markdown formatting:
{
  "translatedText": "translated text",
  "failed": "true / false"lated text",
} "failed": "true / false"
`;

// Initialize settings from storage
chrome.storage.local.get(
  ["translationEnabled", "targetLanguage", "translationModel", "vertexConfig"],
  (result) => {
    translationEnabled =
      result.translationEnabled !== undefined
        ? result.translationEnabled
        : true;
    targetLanguage = result.targetLanguage || "en";
    translationModel = result.translationModel || "local";
    vertexConfig = result.vertexConfig || null;
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
  // First try initializing local model
  try {
    translator_session = await ai.languageModel.create({
      systemPrompt: systemPrompt,
    });
    localModelAvailable = true;
    console.log("Local Gemini Nano model initialized successfully");
  } catch (error) {
    console.log("Local model not available:", error);
    localModelAvailable = false;
  }
  // No need to initialize Google GenAI, we'll use direct API calls

  // Update model selection based on availability
  if (!localModelAvailable && translationModel === "local") {
    translationModel = "web";
    chrome.storage.local.set({ translationModel: "web" });
    console.log(
      "Switched to web API translation due to local model unavailability"
    );
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
    if (message.vertexConfig && translationModel === "vertex") {
      vertexConfig = message.vertexConfig;
      chrome.storage.local.set({ vertexConfig });
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
      vertexConfig,
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

  if (message.type === "SUMMARIZE_CONVERSATION") {
    summarizeConversation(message.conversation)
      .then((summary) => {
        chrome.runtime.sendMessage({
          type: "SUMMARY_RESULT",
          summary: summary,
        });
      })
      .catch((error) => {
        console.error("Summarization error:", error);
        chrome.runtime.sendMessage({
          type: "SUMMARY_RESULT",
          summary: "Failed to generate summary: " + error.message,
        });
      });
    return true;
  }

  if (message.type === "TRANSLATE_AND_SEND") {
    // Custom language can be provided or use default
    const useTargetLang = message.targetLanguage || targetLanguage;

    translateText(message.text, useTargetLang)
      .then((translatedText) => {
        // Send the translated text to the active tab for injection
        chrome.tabs.query(
          { active: true, currentWindow: true },
          function (tabs) {
            if (tabs && tabs[0]) {
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  type: "INJECT_TRANSLATED_TEXT",
                  translatedText: translatedText,
                },
                function (response) {
                  if (response && response.success) {
                    sendResponse({ success: true });
                  } else {
                    sendResponse({
                      success: false,
                      error: response
                        ? response.error
                        : "Failed to inject text",
                    });
                  }
                }
              );
            } else {
              sendResponse({
                success: false,
                error: "No active tab found",
              });
            }
          }
        );
      })
      .catch((error) => {
        console.error("Translation error:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Required for async response
  }
});

async function translateText(text, targetLang) {
  try {
    // Debug log to track translation flow
    console.log(
      `Translating text (${text.length} chars) to ${targetLang}. Models: Local=${localModelAvailable}`
    );

    // Check which model to use
    if (translationModel === "local" && localModelAvailable) {
      return await translateWithLocalModel(text, targetLang);
    } else if (translationModel === "vertex") {
      return await translateWithVertexAI(text, targetLang);
    } else {
      // Default to Gemini API
      return await translateWithGeminiAPI(text, targetLang);
    }
  } catch (error) {
    console.error("Translation error:", error);
    // Always return something, even if translation fails
    return `[${targetLang}] ${text}`;
  }
}

async function translateWithLocalModel(text, targetLang) {
  try {
    // Using Gemini Nano model for translation
    if (!translator_session) {
      throw new Error("Local model not initialized");
    }

    const response = await translator_session.prompt(
      JSON.stringify({
        text: text,
        targetLanguage: targetLang,
      })
    );

    // Use the shared parsing function instead of inline parsing
    return parseModelResponse(response.text);
  } catch (error) {
    console.error("Local translation error:", error);
    // Try direct Gemini API if local model fails
    console.log("Falling back to Gemini API for this translation");
    return translateWithGeminiAPI(text, targetLang);
  }
}

// New function to translate using direct Gemini API
async function translateWithGeminiAPI(text, targetLang) {
  // Gemini API key (same as the one used previously)
  const API_KEY = "AIzaSyD1ZDwTDuyBN9PN6UeuLa67NwIiLyK79Cs";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_KEY}`;

  try {
    console.log(`Using Gemini API to translate to ${targetLang}`);

    // Create prompt for translation

    const prompt = `Translate this text to ${targetLang}. Provide ONLY the translated text without any explanations or additional text: "${text}"`;

    // Prepare the request body
    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        topP: 0.8,
        topK: 40,
      },
    };

    // Make the API request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Gemini API responded with status: ${response.status}`);
    }

    // Parse the JSON response
    const data = await response.json();

    // Extract the translation from the response
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      const rawResponse = data.candidates[0].content.parts[0].text.trim();

      // Debug log
      console.log(
        "Gemini API raw response:",
        rawResponse.substring(0, 100) + (rawResponse.length > 100 ? "..." : "")
      );

      // Use the shared parsing function
      return parseModelResponse(rawResponse);
    } else {
      throw new Error("Invalid response format from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API translation error:", error);
    // Fall back to web API
    console.log("Falling back to web API for this translation");
    return await translateWithWebAPI(text, targetLang);
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

// New function to translate using Vertex AI
async function translateWithVertexAI(text, targetLang) {
  try {
    if (!vertexConfig) {
      throw new Error("Vertex AI configuration is missing");
    }

    const projectId = vertexConfig.projectId;
    const locationId = vertexConfig.location;
    const apiEndpoint = vertexConfig.apiEndpoint;
    const modelId = vertexConfig.modelId;
    const accessToken = vertexConfig.accessToken;

    if (!projectId || !locationId || !apiEndpoint || !modelId) {
      throw new Error("Incomplete Vertex AI configuration");
    }

    console.log(`Using Vertex AI to translate to ${targetLang}`);

    // Create request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Translate this text to ${targetLang}: "${text}"`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
      generationConfig: {
        responseModalities: ["TEXT"],
        temperature: 0.4,
        maxOutputTokens: 800,
        topP: 0.8,
        topK: 32,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "OFF",
        },
      ],
    };

    // Get access token if not provided
    let token = accessToken;
    if (!token) {
      // Fall back to Gemini API if no token
      return await translateWithGeminiAPI(text, targetLang);
    }

    // Make the API request
    const apiUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${locationId}/publishers/google/models/${modelId}:generateContent`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Vertex AI API responded with status: ${response.status}`
      );
    }

    // Parse the response
    const responseData = await response.json();

    // Extract the translation from the response
    if (
      responseData.candidates &&
      responseData.candidates[0] &&
      responseData.candidates[0].content &&
      responseData.candidates[0].content.parts &&
      responseData.candidates[0].content.parts[0]
    ) {
      const rawResponse =
        responseData.candidates[0].content.parts[0].text.trim();
      return parseModelResponse(rawResponse);
    } else {
      throw new Error("Invalid response format from Vertex AI");
    }
  } catch (error) {
    console.error("Vertex AI translation error:", error);
    // Fall back to Gemini API
    console.log("Falling back to Gemini API for this translation");
    return await translateWithGeminiAPI(text, targetLang);
  }
}

/**
 * Parse model response and handle various formats including markdown
 * @param {string} responseText - Raw text from model response
 * @returns {string} - Extracted translated text
 */
function parseModelResponse(responseText) {
  if (!responseText) {
    console.error("Empty response received");
    return "Failed to translate";
  }

  // Clean the response text
  let cleanedText = responseText.trim();

  // Check for markdown code blocks (```json ... ```)
  const markdownMatch = cleanedText.match(/```json([^`]+)```/);
  if (markdownMatch) {
    cleanedText = markdownMatch[1].trim();
  }

  // Parse the response
  try {
    const result = JSON.parse(cleanedText);
    if (result.failed === "true") {
      throw new Error("Translation failed");
    }
    return result.translatedText;
  } catch (parseError) {
    console.error("Failed to parse model response:", parseError);
    return cleanedText; // Fallback to raw response
  }
}

// New function to summarize using Vertex AI
async function summarizeWithVertexAI(conversation) {
  try {
    if (!vertexConfig) {
      throw new Error("Vertex AI configuration is missing");
    }

    const projectId = vertexConfig.projectId;
    const locationId = vertexConfig.location;
    const apiEndpoint = vertexConfig.apiEndpoint;
    const modelId = vertexConfig.modelId;
    const accessToken = vertexConfig.accessToken;

    if (!projectId || !locationId || !apiEndpoint || !modelId) {
      throw new Error("Incomplete Vertex AI configuration");
    }

    console.log("Using Vertex AI for summarization");

    // System instruction for summarization
    const summarySystemInstruction = `You are a chat summarization expert. Your task is to create clear, concise summaries of conversations while preserving the key information and insights. Focus on:
    - The main topics and themes
    - Any decisions or conclusions reached
    - Action items or follow-ups needed
    - Keep your summary well-structured and easily scannable.`;

    // Create request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Please provide a concise but comprehensive summary of the following conversation, highlighting the main topics discussed, any decisions made, and action items:
              
${conversation}

Summary:`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: summarySystemInstruction,
          },
        ],
      },
      generationConfig: {
        responseModalities: ["TEXT"],
        temperature: 0.4,
        maxOutputTokens: 800,
        topP: 0.8,
        topK: 32,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "OFF",
        },
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "OFF",
        },
      ],
    };

    // Get access token if not provided
    let token = accessToken;
    if (!token) {
      // Fall back to Gemini API if no token
      return await summarizeWithGeminiAPI(conversation);
    }

    // Make the API request
    const apiUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${locationId}/publishers/google/models/${modelId}:generateContent`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Vertex AI API responded with status: ${response.status}`
      );
    }

    // Parse the response
    const responseData = await response.json();

    // Extract the summary from the response
    if (
      responseData.candidates &&
      responseData.candidates[0] &&
      responseData.candidates[0].content &&
      responseData.candidates[0].content.parts &&
      responseData.candidates[0].content.parts[0]
    ) {
      return responseData.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("Invalid response format from Vertex AI");
    }
  } catch (error) {
    console.error("Vertex AI summarization error:", error);
    // Fall back to Gemini API
    return await summarizeWithGeminiAPI(conversation);
  }
}
