document.addEventListener("DOMContentLoaded", () => {
  const translationToggle = document.getElementById("translationToggle");
  const targetLanguageSelect = document.getElementById("targetLanguage");
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

      // Set target language if it exists
      if (targetLanguageSelect && response.targetLanguage) {
        targetLanguageSelect.value = response.targetLanguage;
      }

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

  // Change target language
  if (targetLanguageSelect) {
    targetLanguageSelect.addEventListener("change", () => {
      const language = targetLanguageSelect.value;

      chrome.runtime.sendMessage({
        type: "UPDATE_SETTINGS",
        targetLanguage: language,
      });
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
});
