document.addEventListener("DOMContentLoaded", function () {
  // Load saved settings
  chrome.storage.sync.get(
    {
      targetLanguage: "en",
      translationModel: "web", // Default to web API if not set
      vertexProjectId: "",
      vertexLocation: "us-central1",
      vertexApiEndpoint: "us-central1-aiplatform.googleapis.com",
      vertexModelId: "gemini-1.0-pro",
      vertexAccessToken: "",
    },
    function (items) {
      // Set the language dropdown
      document.getElementById("targetLanguage").value = items.targetLanguage;

      // Set the correct radio button based on saved model preference
      const modelType = items.translationModel;
      if (modelType === "local") {
        document.getElementById("modelLocal").checked = true;
      } else if (modelType === "vertex") {
        document.getElementById("modelVertex").checked = true;
        document.getElementById("vertexConfigSection").style.display = "block";
      } else {
        document.getElementById("modelWeb").checked = true;
      }

      // Fill in Vertex AI settings if saved
      document.getElementById("vertexProjectId").value = items.vertexProjectId;
      document.getElementById("vertexLocation").value = items.vertexLocation;
      document.getElementById("vertexApiEndpoint").value =
        items.vertexApiEndpoint;
      document.getElementById("vertexModelId").value = items.vertexModelId;
      document.getElementById("vertexAccessToken").value =
        items.vertexAccessToken;

      // Check if local model is available
      checkLocalModelAvailability();
    }
  );

  // Show/hide Vertex configuration when Vertex AI option is selected
  document
    .getElementById("modelVertex")
    .addEventListener("change", function () {
      document.getElementById("vertexConfigSection").style.display = "block";
    });

  document.getElementById("modelWeb").addEventListener("change", function () {
    document.getElementById("vertexConfigSection").style.display = "none";
  });

  document.getElementById("modelLocal").addEventListener("change", function () {
    document.getElementById("vertexConfigSection").style.display = "none";
  });

  // Save settings when the save button is clicked
  document.getElementById("saveButton").addEventListener("click", saveOptions);
});

function checkLocalModelAvailability() {
  // Check if the Gemini API is available (mock implementation)
  const isLocalModelAvailable =
    "chrome" in window && "generativeLanguageModels" in chrome;
  const localModelStatus = document.getElementById("localModelStatus");
  const activeModelDisplay = document.getElementById("activeModelDisplay");

  if (isLocalModelAvailable) {
    localModelStatus.textContent = "Available";
    localModelStatus.style.color = "#4ade80"; // green
  } else {
    localModelStatus.textContent = "Not available on this device";
    localModelStatus.style.color = "#f87171"; // red

    // If local model is selected but not available, switch to web API
    if (document.getElementById("modelLocal").checked) {
      document.getElementById("modelWeb").checked = true;
      activeModelDisplay.textContent = "Web API (fallback)";
    }
  }

  // Update active model display
  if (document.getElementById("modelLocal").checked) {
    activeModelDisplay.textContent = "Local Gemini Nano";
  } else if (document.getElementById("modelVertex").checked) {
    activeModelDisplay.textContent = "Vertex AI";
  } else {
    activeModelDisplay.textContent = "Web API";
  }
}

function saveOptions() {
  // Get selected model
  let selectedModel = "web";
  if (document.getElementById("modelLocal").checked) {
    selectedModel = "local";
  } else if (document.getElementById("modelVertex").checked) {
    selectedModel = "vertex";
  }

  // Save settings to chrome.storage
  chrome.storage.sync.set(
    {
      targetLanguage: document.getElementById("targetLanguage").value,
      translationModel: selectedModel,
      vertexProjectId: document.getElementById("vertexProjectId").value,
      vertexLocation: document.getElementById("vertexLocation").value,
      vertexApiEndpoint: document.getElementById("vertexApiEndpoint").value,
      vertexModelId: document.getElementById("vertexModelId").value,
      vertexAccessToken: document.getElementById("vertexAccessToken").value,
    },
    function () {
      // Show saved message
      const status = document.getElementById("status");
      status.style.display = "block";
      setTimeout(function () {
        status.style.display = "none";
      }, 2000);
    }
  );
}
