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

  // Initialize any other UI elements
  const translationToggle = document.getElementById("translationToggle");
  if (translationToggle) {
    // Make sure the toggle is properly initialized (if needed)
    translationToggle.checked = true; // Default to enabled
  }

  // Log completion
  console.log("Popup initialization completed successfully");
});
