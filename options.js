document.addEventListener("DOMContentLoaded", () => {
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const saveButton = document.getElementById("saveButton");
  const statusElement = document.getElementById("status");
  const localModelIndicator = document.getElementById("localModelIndicator");
  const localModelStatus = document.getElementById("localModelStatus");
  const activeModelDisplay = document.getElementById("activeModelDisplay");
  const modelLocalRadio = document.getElementById("modelLocal");
  const modelWebRadio = document.getElementById("modelWeb");

  let isLocalModelAvailable = false;

  // Load current settings and model status
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
    if (response) {
      if (response.targetLanguage) {
        targetLanguageSelect.value = response.targetLanguage;
      }

      // Update the model selection and status displays
      updateModelStatus(
        response.localModelAvailable,
        response.translationModel
      );
    }
  });

  // Update the radio buttons and status displays based on model availability
  function updateModelStatus(localAvailable, activeModel) {
    isLocalModelAvailable = localAvailable;

    // Update the model status indicator
    if (localAvailable) {
      localModelIndicator.classList.add("model-available");
      localModelIndicator.classList.remove("model-unavailable");
      localModelStatus.textContent = "Available";

      // Enable the local model radio button
      modelLocalRadio.disabled = false;
      modelLocalRadio.parentElement.classList.remove("disabled");
    } else {
      localModelIndicator.classList.add("model-unavailable");
      localModelIndicator.classList.remove("model-available");
      localModelStatus.textContent = "Not available on this device";

      // Disable the local model radio button
      modelLocalRadio.disabled = true;
      modelLocalRadio.parentElement.classList.add("disabled");
    }

    // Update the active model radio selection
    if (activeModel === "local") {
      modelLocalRadio.checked = true;
      activeModelDisplay.textContent = "Local Gemini Nano";
    } else {
      modelWebRadio.checked = true;
      activeModelDisplay.textContent = "Web API";
    }
  }

  // Handle when user tries to change the model
  document
    .querySelectorAll('input[name="translationModel"]')
    .forEach((radio) => {
      radio.addEventListener("change", (event) => {
        const selectedModel = event.target.value;

        // Prevent selecting local model if it's not available
        if (selectedModel === "local" && !isLocalModelAvailable) {
          event.preventDefault();
          modelLocalRadio.checked = false;
          modelWebRadio.checked = true;
          alert(
            "Local model is not available on this device. Using web API instead."
          );
          return;
        }
      });
    });

  // Save settings
  saveButton.addEventListener("click", () => {
    const targetLanguage = targetLanguageSelect.value;
    const translationModel = document.querySelector(
      'input[name="translationModel"]:checked'
    ).value;

    // Check if trying to save with local model when it's not available
    if (translationModel === "local" && !isLocalModelAvailable) {
      alert("Cannot select local model as it's not available on your device.");
      modelWebRadio.checked = true;
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "UPDATE_SETTINGS",
        targetLanguage: targetLanguage,
        translationModel: translationModel,
      },
      (response) => {
        if (response && response.success) {
          // Show saved message
          statusElement.style.display = "block";

          // Hide message after 2 seconds
          setTimeout(() => {
            statusElement.style.display = "none";
          }, 2000);
        } else if (response && !response.success) {
          alert(response.error || "Failed to save settings");
        }
      }
    );
  });

  // Listen for model status updates from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "MODEL_STATUS_UPDATE") {
      updateModelStatus(message.localModelAvailable, message.activeModel);
    }
  });
});
