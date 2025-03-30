document.addEventListener("DOMContentLoaded", () => {
  const translationToggle = document.getElementById("translationToggle");
  const mainTargetLanguageSelect =
    document.getElementById("mainTargetLanguage");
  const translateInputLanguageSelect = document.getElementById(
    "translateInputLanguage"
  );
  const summarizeButton = document.getElementById("summarizeButton");
  const summarizeStatus = document.getElementById("summarizeStatus");
  const stopSummarizing = document.getElementById("stopSummarizing");
  const summaryContainer = document.getElementById("summaryContainer");
  const summaryText = document.getElementById("summaryText");
  const copySummary = document.getElementById("copySummary");
  // This element doesn't exist in popup.html
  const modelNameElement = document.getElementById("modelName");

  // Track summarization state
  let isSummarizing = false;

  // Load saved settings
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (response) {
      // Set translation toggle if it exists
      if (translationToggle) {
        translationToggle.checked = response.translationEnabled;
      }

      // Set target language for the main settings dropdown
      if (response.targetLanguage && mainTargetLanguageSelect) {
        mainTargetLanguageSelect.value = response.targetLanguage;
      }

      // Load the input translation dropdown from its own storage key
      chrome.storage.local.get(["inputTranslationLanguage"], (result) => {
        if (result.inputTranslationLanguage && translateInputLanguageSelect) {
          translateInputLanguageSelect.value = result.inputTranslationLanguage;
        } else if (response.targetLanguage && translateInputLanguageSelect) {
          // Fall back to global language if no specific input language is saved
          translateInputLanguageSelect.value = response.targetLanguage;
        }
      });

      // Only update model display if response.translationModel exists
      if (response.translationModel) {
        updateModelDisplay(response.translationModel);
      }
    }
  });

  // Helper to update the model display - Fix the null reference error
  function updateModelDisplay(model) {
    // Add null check to prevent error when modelNameElement doesn't exist
    if (modelNameElement) {
      if (model === "local") {
        modelNameElement.textContent = "Local Gemini Nano";
      } else {
        modelNameElement.textContent = "Web API";
      }
    }
  }

  // Toggle translation on/off
  if (translationToggle) {
    translationToggle.addEventListener("change", () => {
      const isEnabled = translationToggle.checked;

      chrome.runtime.sendMessage(
        {
          type: "UPDATE_SETTINGS",
          translationEnabled: isEnabled,
        },
        () => {
          // Notify content script of the change
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: "SETTINGS_UPDATED",
                translationEnabled: isEnabled,
              });
            }
          });
        }
      );
    });
  }

  // Change target language (main dropdown) - controls global default
  if (mainTargetLanguageSelect) {
    mainTargetLanguageSelect.addEventListener("change", () => {
      const language = mainTargetLanguageSelect.value;

      // Update stored settings for the global target language
      chrome.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        targetLanguage: language,
      });

      console.log("Global default language updated to: " + language);
    });
  }

  // The translate input dropdown is independent but saves its state
  if (translateInputLanguageSelect) {
    translateInputLanguageSelect.addEventListener("change", () => {
      const language = translateInputLanguageSelect.value;
      // Save the input-specific language preference
      chrome.storage.local.set({ inputTranslationLanguage: language });
      console.log("Input translation language saved as: " + language);
    });
  }

  // Summarize button click handler
  if (summarizeButton) {
    summarizeButton.addEventListener("click", () => {
      // Toggle summarization state
      isSummarizing = !isSummarizing;

      if (isSummarizing) {
        // Start recording messages
        summarizeButton.textContent = "Cancel Summarization";
        summarizeStatus.style.display = "block";
        summaryContainer.style.display = "none";

        // Send message to content script to start recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "START_SUMMARIZING",
            });
          }
        });
      } else {
        // Cancel summarization
        summarizeButton.textContent = "Summarize Chat";
        summarizeStatus.style.display = "none";

        // Send message to content script to cancel recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "CANCEL_SUMMARIZING",
            });
          }
        });
      }
    });
  }

  // Stop summarizing and generate summary
  if (stopSummarizing) {
    stopSummarizing.addEventListener("click", (e) => {
      e.preventDefault();

      // Reset UI
      summarizeButton.textContent = "Summarize Chat";
      summarizeStatus.style.display = "none";
      isSummarizing = false;

      // Show loading indicator
      summaryContainer.style.display = "block";
      summaryText.textContent = "Generating summary...";

      // Send message to content script to finish recording and generate summary
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "FINISH_SUMMARIZING",
          });
        }
      });
    });
  }

  // Copy summary button
  if (copySummary) {
    copySummary.addEventListener("click", () => {
      if (summaryText.textContent) {
        navigator.clipboard
          .writeText(summaryText.textContent)
          .then(() => {
            // Provide feedback that copy was successful
            const originalText = copySummary.textContent;
            copySummary.textContent = "Copied!";
            setTimeout(() => {
              copySummary.textContent = originalText;
            }, 1500);
          })
          .catch((err) => {
            console.error("Failed to copy summary: ", err);
          });
      }
    });
  }

  // Listen for summary result from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SUMMARY_RESULT") {
      // Display the summary
      summaryContainer.style.display = "block";
      summaryText.textContent = message.summary;
    }
  });

  // Listen for model status updates - Add null check here too
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MODEL_STATUS_UPDATE" && modelNameElement) {
      updateModelDisplay(message.activeModel);
    }

    if (message.type === "SUMMARY_RESULT") {
      // Display the summary
      summaryContainer.style.display = "block";
      summaryText.textContent = message.summary;
    }
  });

  // Listen for summary results from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Popup received message:", message);

    if (message.type === "SUMMARY_RESULT") {
      console.log("Received SUMMARY_RESULT:", message);

      // Display the summary
      document.getElementById("summaryContainer").style.display = "block";
      document.getElementById("summaryText").textContent = message.summary;

      // Hide recording status
      document.getElementById("summarizeStatus").style.display = "none";

      sendResponse({ success: true });
      return true;
    }
  });

  // Handle stop summarizing click
  document.getElementById("stopSummarizing").addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Stop summarizing clicked");

    // Hide recording status and show "Generating summary..." message
    document.getElementById("summarizeStatus").style.display = "none";

    // Show loading message in summary container
    document.getElementById("summaryContainer").style.display = "block";
    document.getElementById("summaryText").textContent =
      "Generating summary...";

    // Send message to content script to finish recording and generate summary
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "FINISH_SUMMARIZING" },
        (response) => {
          console.log("Received response from FINISH_SUMMARIZING:", response);
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending FINISH_SUMMARIZING message:",
              chrome.runtime.lastError
            );
            document.getElementById("summaryText").textContent =
              "Error: " + chrome.runtime.lastError.message;
          }
        }
      );
    });
  });

  // Initialize UI elements
  const inputTextArea = document.getElementById("inputText");
  const translateButton = document.getElementById("translateButton");
  const copyButton = document.getElementById("copyButton");
  const statusDiv = document.getElementById("status");

  // Load saved language preference
  chrome.storage.local.get(
    ["targetLanguage", "inputTranslationLanguage"],
    function (result) {
      // Set the main global language dropdown
      if (result.targetLanguage && mainTargetLanguageSelect) {
        mainTargetLanguageSelect.value = result.targetLanguage;
      }

      // Set the input-specific language dropdown with its own preference
      if (result.inputTranslationLanguage && translateInputLanguageSelect) {
        translateInputLanguageSelect.value = result.inputTranslationLanguage;
      } else if (result.targetLanguage && translateInputLanguageSelect) {
        // If no input-specific language is saved, use the global one
        translateInputLanguageSelect.value = result.targetLanguage;
      }
    }
  );

  // Translate only button
  translateButton.addEventListener("click", function () {
    const text = inputTextArea.value.trim();
    const targetLang = translateInputLanguageSelect.value;

    if (!text) {
      setStatus("Please enter text to translate", "error");
      return;
    }

    setStatus("Translating...", "info");

    // Don't update the global setting, just use this language for this translation
    translateInputLanguageSelect.dataset.userSelected = "true";

    // Request translation from background script
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE",
        text: text,
        targetLanguage: targetLang,
      },
      function (response) {
        if (response && response.success) {
          inputTextArea.value = response.translatedText;
          setStatus("Translation complete", "success");
        } else {
          setStatus(
            "Translation failed: " +
              (response ? response.error : "Unknown error"),
            "error"
          );
        }
      }
    );
  });

  // Replace send button with copy to clipboard functionality
  copyButton.addEventListener("click", function () {
    const text = inputTextArea.value.trim();
    const targetLang = translateInputLanguageSelect.value;

    if (!text) {
      setStatus("Please enter text to translate", "error");
      return;
    }

    setStatus("Translating...", "info");

    // Save the input-specific language preference
    chrome.storage.local.set({ inputTranslationLanguage: targetLang });

    // Request translation from background script
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE",
        text: text,
        targetLanguage: targetLang,
      },
      function (response) {
        if (response && response.success) {
          // Copy the translated text to clipboard
          navigator.clipboard
            .writeText(response.translatedText)
            .then(() => {
              setStatus("Translation copied to clipboard", "success");
              // Provide visual feedback
              copyButton.textContent = "Copied!";
              setTimeout(() => {
                copyButton.textContent = "Copy to Clipboard";
              }, 1500);
            })
            .catch((err) => {
              setStatus("Failed to copy: " + err.message, "error");
            });
        } else {
          setStatus(
            "Translation failed: " +
              (response ? response.error : "Unknown error"),
            "error"
          );
        }
      }
    );
  });

  // Helper to set status with appropriate styling
  function setStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = "";
    statusDiv.classList.add(type || "info");
  }
});
