document.addEventListener("DOMContentLoaded", () => {
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const saveButton = document.getElementById("saveButton");
  const statusElement = document.getElementById("status");

  // Load current settings
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (response && response.targetLanguage) {
      targetLanguageSelect.value = response.targetLanguage;
    }
  });

  // Save settings
  saveButton.addEventListener("click", () => {
    const targetLanguage = targetLanguageSelect.value;

    chrome.runtime.sendMessage(
      {
        type: "UPDATE_SETTINGS",
        targetLanguage: targetLanguage,
      },
      () => {
        // Show saved message
        statusElement.style.display = "block";

        // Hide message after 2 seconds
        setTimeout(() => {
          statusElement.style.display = "none";
        }, 2000);
      }
    );
  });
});
