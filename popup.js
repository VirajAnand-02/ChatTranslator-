document.addEventListener("DOMContentLoaded", () => {
  const translationToggle = document.getElementById("translationToggle");
  const targetLanguageSelect = document.getElementById("targetLanguage");

  // Load saved settings
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (response) {
      translationToggle.checked = response.translationEnabled;

      if (response.targetLanguage) {
        targetLanguageSelect.value = response.targetLanguage;
      }
    }
  });

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
});
