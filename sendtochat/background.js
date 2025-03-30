// Background script for WhatsApp Web message sender extension

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage") {
        // Forward the message to the content script of the WhatsApp Web tab
        chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
            if (tabs.length === 0) {
                sendResponse({
                    success: false,
                    error: "WhatsApp Web is not open",
                });
                return;
            }

            // Forward the message to the content script
            chrome.tabs.sendMessage(tabs[0].id, request, (response) => {
                sendResponse(response);
            });
        });
        return true; // Indicates we'll send response asynchronously
    }
});
