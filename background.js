let translationCache;
// We'll load this dynamically in the runtime events

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

// Add system prompt for summarization
const summarySystemPrompt = `You are a conversation summarization assistant specialized in analyzing WhatsApp chats.
Your goal is to provide concise, structured summaries of conversations that capture:
1. Key topics and main discussion points
2. Important decisions, agreements, or action items
3. Time-sensitive information like deadlines or scheduled events
4. Questions that need answers or follow-ups

Format your summary in a clean, readable structure with appropriate headings.
Be factual and objective - include only what was actually discussed.
Avoid adding your own commentary or suggestions.
Focus on extracting what would be most valuable for someone who needs to quickly understand what happened in the conversation.

Output must be plain text with appropriate line breaks and structure.`;

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
chrome.runtime.onInstalled.addListener(async (details) => {
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

  // Schedule periodic cache cleanup
  if (details.reason === "install" || details.reason === "update") {
    chrome.alarms.create("cacheCleanup", {
      periodInMinutes: 60 * 24, // Once per day
    });
  }

  // Initialize the cache manager
  try {
    const cacheManagerModule = await import("./cache-manager.js");
    translationCache = cacheManagerModule.default;
    console.log("Translation cache initialized on install/update");
  } catch (error) {
    console.error("Failed to initialize translation cache:", error);
  }
});

// Handle alarms for maintenance tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cacheCleanup") {
    translationCache.cleanupCache();
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

  // Create an alarm for periodic cache cleanup if it doesn't exist
  chrome.alarms.get("cacheCleanup", (alarm) => {
    if (!alarm) {
      chrome.alarms.create("cacheCleanup", {
        periodInMinutes: 60 * 24, // Once per day
      });
    }
  });

  // Initialize the cache manager
  try {
    const cacheManagerModule = await import("./cache-manager.js");
    translationCache = cacheManagerModule.default;
    console.log("Translation cache initialized successfully");
  } catch (error) {
    console.error("Failed to initialize translation cache:", error);
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TRANSLATE") {
    if (!translationEnabled) {
      sendResponse({ success: false, error: "Translation is disabled" });
      return true;
    }

    // Use the language specified in the request, or fall back to the default
    const useTargetLang = message.targetLanguage || targetLanguage;

    translateText(message.text, useTargetLang)
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

    // If target language changes, trigger a cache cleanup for optimization
    if (
      message.hasOwnProperty("targetLanguage") &&
      message.targetLanguage !== targetLanguage
    ) {
      // Schedule a cleanup for the old language cache
      setTimeout(() => {
        translationCache.cleanupCache();
      }, 5000);
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

  // Handle summarize conversation request
  if (message.type === "SUMMARIZE_CONVERSATION") {
    console.log("Background received SUMMARIZE_CONVERSATION request:", message);

    // Extract the conversation text
    const conversation = message.conversation;
    console.log("Conversation to summarize:", conversation);

    // Generate summary using an API or local processing
    generateSummary(conversation)
      .then((summary) => {
        console.log("Generated summary:", summary);

        // Send the summary back to the popup
        chrome.runtime.sendMessage({
          type: "SUMMARY_RESULT",
          summary: summary,
        });

        // Also send response directly
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error generating summary:", error);

        // Send error message back to popup
        chrome.runtime.sendMessage({
          type: "SUMMARY_RESULT",
          summary: "Error generating summary: " + error.message,
        });

        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we will send a response asynchronously
    return true;
  }

  // Add handler for cache management
  if (message.type === "MANAGE_CACHE") {
    if (message.action === "clear") {
      translationCache
        .clearLanguageCache(message.targetLang)
        .then((result) => sendResponse(result))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error.message,
          })
        );
      return true; // Async response
    } else if (message.action === "save") {
      translationCache.saveDatabase();
      sendResponse({ success: true });
      return true;
    }
  }
});

// Update summarizeConversation to choose the appropriate method based on model
async function summarizeConversation(conversation) {
  console.log("Starting conversation summarization");

  try {
    // Based on model settings, choose the appropriate summarization method
    if (translationModel === "local" && localModelAvailable) {
      console.log("Using Local Gemini model for summarization");
      return await summarizeWithLocalModel(conversation);
    } else if (translationModel === "vertex" && vertexConfig) {
      console.log("Using Vertex AI for summarization");
      return await summarizeWithVertexAI(conversation);
    } else {
      console.log("Using Gemini API for summarization");
      return await summarizeWithGeminiAPI(conversation);
    }
  } catch (error) {
    console.error("Summarization error:", error);
    // Fallback to basic summary if AI summarization fails
    console.log("Falling back to basic summary generation");
    return await generateBasicSummary(conversation);
  }
}

// Function to summarize using local Gemini model
async function summarizeWithLocalModel(conversation) {
  try {
    // Check if local model is available
    if (!translator_session) {
      throw new Error("Local model not initialized");
    }

    console.log("Using local Gemini model for summarization");

    // Create a summarization prompt
    const summarizationPrompt = `Please provide a concise summary of this conversation:
      
${conversation}

Focus on the main topics, any decisions made, and action items.`;

    // Use the local model for summarization
    const response = await translator_session.prompt(summarizationPrompt, {
      systemPrompt: summarySystemPrompt,
    });

    if (!response || !response.text) {
      throw new Error("Empty response from local model");
    }

    return response.text.trim();
  } catch (error) {
    console.error("Local model summarization error:", error);
    // Fall back to Gemini API
    console.log("Falling back to Gemini API for summarization");
    return await summarizeWithGeminiAPI(conversation);
  }
}

// Function to summarize using Gemini API
async function summarizeWithGeminiAPI(conversation) {
  // Gemini API key (same as the one used for translation)
  const API_KEY = "AIzaSyD1ZDwTDuyBN9PN6UeuLa67NwIiLyK79Cs";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${API_KEY}`;

  try {
    console.log("Using Gemini API for summarization");

    // Create prompt for summarization
    const prompt = `Please provide a concise summary of this conversation:
      
${conversation}

Focus on the main topics, any decisions made, and action items.`;

    // Prepare the request body
    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: summarySystemPrompt,
          },
        ],
      },
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 800,
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

    // Extract the summary from the response
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("Invalid response format from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API summarization error:", error);
    // Fall back to web API
    console.log("Falling back to web API for summarization");
    return await summarizeWithWebAPI(conversation);
  }
}

// Function to summarize using a web API
async function summarizeWithWebAPI(conversation) {
  try {
    // Since there's no free, reliable summarization API available like there is for translation,
    // we'll fall back to our basic summary generator
    console.log(
      "No appropriate web API available for summarization, using basic summary"
    );
    return await generateBasicSummary(conversation);
  } catch (error) {
    console.error("Web API summarization error:", error);
    return "Could not generate summary: " + error.message;
  }
}

// Enhanced version of Vertex AI summarization with improved prompt
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

    // Create request body
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Please provide a concise but comprehensive summary of the following WhatsApp conversation, highlighting the main topics discussed, any decisions made, and action items:
              
${conversation}

Summary:`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: summarySystemPrompt,
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

// Rename the original generateSummary function to be more descriptive
async function generateBasicSummary(conversation) {
  console.log("Generating basic statistical summary");

  try {
    // Split the conversation into lines
    const lines = conversation.split("\n").filter((line) => line.trim());

    // Count messages per participant
    const participants = {};
    let totalMessages = 0;

    for (const line of lines) {
      const match = line.match(/\[.*?\] (.*?):/);
      if (match && match[1]) {
        const participant = match[1].trim();
        participants[participant] = (participants[participant] || 0) + 1;
        totalMessages++;
      }
    }

    // Create summary text
    let summary = `Conversation Summary (${totalMessages} messages)\n\n`;
    summary += "Participants:\n";

    for (const [name, count] of Object.entries(participants)) {
      const percentage = ((count / totalMessages) * 100).toFixed(1);
      summary += `- ${name}: ${count} messages (${percentage}%)\n`;
    }

    summary += "\nHighlights:\n";

    // Add a few sample messages (up to 3)
    const sampleCount = Math.min(3, lines.length);
    for (let i = 0; i < sampleCount; i++) {
      const randomIndex = Math.floor(Math.random() * lines.length);
      summary += `- ${lines[randomIndex]}\n`;
    }

    console.log("Generated basic summary");
    return summary;
  } catch (error) {
    console.error("Error in generateBasicSummary:", error);
    return "Failed to generate summary due to an error: " + error.message;
  }
}

// For compatibility, keep the original function name with updated implementation
async function generateSummary(conversation) {
  // Now uses the AI-based summarization by default
  return await summarizeConversation(conversation);
}

async function translateText(text, targetLang) {
  try {
    // Debug log to track translation flow
    console.log(
      `Translating text (${text.length} chars) to ${targetLang}. Models: Local=${localModelAvailable}`
    );

    // Check cache first
    const cacheResult = await translationCache.checkCache(text, targetLang);

    if (cacheResult.found) {
      console.log("Cache hit! Using cached translation");
      return cacheResult.translatedText;
    }

    console.log("Cache miss. Performing translation...");

    // Proceed with translation
    let translatedText;
    let modelUsed;

    // Check which model to use
    if (translationModel === "local" && localModelAvailable) {
      translatedText = await translateWithLocalModel(text, targetLang);
      modelUsed = "local";
    } else if (translationModel === "vertex") {
      translatedText = await translateWithVertexAI(text, targetLang);
      modelUsed = "vertex";
    } else {
      // Default to Gemini API
      translatedText = await translateWithGeminiAPI(text, targetLang);
      modelUsed = "gemini";
    }

    // Update cache with the new translation
    translationCache
      .updateCache(text, translatedText, targetLang, modelUsed)
      .catch((err) =>
        console.error("Failed to update translation cache:", err)
      );

    return translatedText;
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
