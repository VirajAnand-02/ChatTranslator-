document.addEventListener("DOMContentLoaded", function () {
  // Check if "getStartedBtn" exists before adding event listener
  const getStartedBtn = document.getElementById("getStartedBtn");

  if (getStartedBtn) {
    getStartedBtn.addEventListener("click", function () {
      // Navigate to the get started page
      window.location.href = "getStarted.html";
    });
  }

  // Additional initialization if needed
  console.log("Popup initialization completed");
});
