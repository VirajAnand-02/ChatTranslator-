document.addEventListener("DOMContentLoaded", () => {
  const translationToggle = document.getElementById("translationToggle");
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const modelNameElement = document.getElementById("modelName");

  // Load saved settings
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (response) {
      translationToggle.checked = response.translationEnabled;

      if (response.targetLanguage) {
        targetLanguageSelect.value = response.targetLanguage;
      }

      // Update model display
      updateModelDisplay(response.translationModel);
    }
  });

  // Helper to update the model display
  function updateModelDisplay(model) {
    if (model === "local") {
      modelNameElement.textContent = "Local Gemini Nano";
    } else {
      modelNameElement.textContent = "Web API";
    }
  }

  // Toggle translation on/off
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

  // Change target language
  targetLanguageSelect.addEventListener("change", () => {
    const language = targetLanguageSelect.value;

    chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      targetLanguage: language,
    });
  });

  // Listen for model status updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MODEL_STATUS_UPDATE") {
      updateModelDisplay(message.activeModel);
    }
  });
});
