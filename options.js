document.addEventListener("DOMContentLoaded", () => {
  const targetLanguageSelect = document.getElementById("targetLanguage");
  const saveButton = document.getElementById("saveButton");
  const statusElement = document.getElementById("status");
  const localModelIndicator = document.getElementById("localModelIndicator");
  const localModelStatus = document.getElementById("localModelStatus");
  const activeModelDisplay = document.getElementById("activeModelDisplay");
  const modelLocalRadio = document.getElementById("modelLocal");
  const modelGeminiRadio = document.getElementById("modelGemini");
  const modelVertexRadio = document.getElementById("modelVertex");
  const vertexConfigSection = document.getElementById("vertexConfigSection");

  // Vertex AI config fields
  const vertexProjectId = document.getElementById("vertexProjectId");
  const vertexLocation = document.getElementById("vertexLocation");
  const vertexApiEndpoint = document.getElementById("vertexApiEndpoint");
  const vertexModelId = document.getElementById("vertexModelId");
  const vertexAccessToken = document.getElementById("vertexAccessToken");

  let isLocalModelAvailable = false;

  // Show/hide Vertex AI configuration when switching models
  document
    .querySelectorAll('input[name="translationModel"]')
    .forEach((radio) => {
      radio.addEventListener("change", (event) => {
        const selectedModel = event.target.value;

        // Show Vertex AI config only when Vertex AI is selected
        if (selectedModel === "vertex") {
          vertexConfigSection.style.display = "block";
        } else {
          vertexConfigSection.style.display = "none";
        }
      });
    });

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

      // Load Vertex AI settings if they exist
      if (response.vertexConfig) {
        vertexProjectId.value = response.vertexConfig.projectId || "";
        vertexLocation.value = response.vertexConfig.location || "";
        vertexApiEndpoint.value = response.vertexConfig.apiEndpoint || "";
        vertexModelId.value = response.vertexConfig.modelId || "";
        vertexAccessToken.value = response.vertexConfig.accessToken || "";
      }
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
    } else if (activeModel === "vertex") {
      modelVertexRadio.checked = true;
      activeModelDisplay.textContent = "Vertex AI API";
      vertexConfigSection.style.display = "block";
    } else {
      modelGeminiRadio.checked = true;
      activeModelDisplay.textContent = "Gemini API";
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
          modelGeminiRadio.checked = true;
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
      modelGeminiRadio.checked = true;
      return;
    }

    // Gather Vertex AI settings if that model is selected
    let vertexConfig = null;
    if (translationModel === "vertex") {
      vertexConfig = {
        projectId: vertexProjectId.value,
        location: vertexLocation.value,
        apiEndpoint: vertexApiEndpoint.value,
        modelId: vertexModelId.value,
        accessToken: vertexAccessToken.value,
      };

      // Validate required Vertex AI settings
      if (
        !vertexConfig.projectId ||
        !vertexConfig.location ||
        !vertexConfig.apiEndpoint ||
        !vertexConfig.modelId
      ) {
        alert("Please fill in all required Vertex AI settings.");
        return;
      }
    }

    chrome.runtime.sendMessage(
      {
        type: "UPDATE_SETTINGS",
        targetLanguage: targetLanguage,
        translationModel: translationModel,
        vertexConfig: vertexConfig,
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
