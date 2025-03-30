document.addEventListener("DOMContentLoaded", function () {
  // Initialize dropdown behavior if needed
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const forwardIcon = document.getElementById("forward");

  if (targetLanguageSelect && forwardIcon) {
    // Add any special dropdown behavior if needed
    forwardIcon.addEventListener("click", function () {
      targetLanguageSelect.click(); // Trigger the dropdown when forward icon is clicked
    });
  }

  // Initialize translation toggle with current state
  const translationToggle = document.getElementById("translationToggle");
  if (translationToggle) {
    // Get state from storage to ensure consistency
    chrome.storage.local.get(["translationEnabled"], (result) => {
      if (result.hasOwnProperty("translationEnabled")) {
        translationToggle.checked = result.translationEnabled;
        console.log(
          "Translation toggle initialized to:",
          result.translationEnabled
        );
      } else {
        // Default to enabled if not set
        translationToggle.checked = true;
        console.log("Translation toggle defaulted to enabled");
      }
    });
  }

  // Log completion
  console.log("Popup initialization completed successfully");
});
