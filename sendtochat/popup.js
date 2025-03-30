document.addEventListener("DOMContentLoaded", function () {
    const messageText = document.getElementById("messageText");
    const sendButton = document.getElementById("sendButton");
    const statusDiv = document.getElementById("status");

    sendButton.addEventListener("click", function () {
        const text = messageText.value.trim();
        if (!text) {
            statusDiv.textContent = "Please enter a message";
            return;
        }

        statusDiv.textContent = "Sending message...";

        chrome.runtime.sendMessage(
            {
                action: "sendMessage",
                text: text,
            },
            function (response) {
                if (response && response.success) {
                    statusDiv.textContent = "Message sent successfully!";
                    messageText.value = "";
                } else {
                    statusDiv.textContent =
                        "Error: " +
                        (response?.error || "Failed to send message");
                }
            }
        );
    });
});
