document.addEventListener("DOMContentLoaded", function () {
  // Add click event listener to the Get Started button
  document
    .getElementById("getStartedBtn")
    .addEventListener("click", function () {
      // Navigate to the get started page
      window.location.href = "getStarted.html";
    });
});
