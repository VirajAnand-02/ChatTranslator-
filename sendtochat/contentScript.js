/**
 * Sends a text message to the currently open chat in WhatsApp Web
 * @param {string} text - The text message to send
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
function sendTextToCurrentChat(text) {
    return new Promise((resolve, reject) => {
        // Function to be injected into the page
        const injectedFunction = (textToSend) => {
            return new Promise(async (resolve) => {
                try {
                    // Get the currently open chat
                    const getCurrentChat = () => {
                        let chat = window.Store.Chat.getActive();
                        if (!chat) {
                            const chatModels =
                                window.Store.Chat.getModelsArray();
                            if (chatModels.length > 0) return chatModels[0];
                            return null;
                        }
                        return chat;
                    };

                    const chat = getCurrentChat();
                    if (!chat) {
                        resolve({
                            success: false,
                            error: "No chat is currently open",
                        });
                        return;
                    }

                    // Prepare the message options
                    const options = {};

                    // Send the message
                    const message =
                        await window.Store.SendMessage.addAndSendMsgToChat(
                            chat,
                            {
                                body: textToSend,
                                type: "chat",
                                sender: window.Store.User.getMaybeMeUser(),
                                t: parseInt(new Date().getTime() / 1000),
                                from: window.Store.User.getMaybeMeUser(),
                                self: "out",
                                ack: 0,
                                isNewMsg: true,
                                local: true,
                            }
                        );

                    resolve({
                        success: true,
                        messageId: message.id._serialized,
                    });
                } catch (error) {
                    resolve({ success: false, error: error.toString() });
                }
            });
        };

        // Convert the function to a string and inject it
        const injectedCode = `(${injectedFunction.toString()})(${JSON.stringify(
            text
        )})`;

        // Create a script element to inject our code
        const script = document.createElement("script");
        script.textContent = injectedCode;

        // Handle the result through a custom event
        const eventName = `whatsapp_send_result_${Date.now()}`;
        script.textContent = `
            (async () => {
                const result = await (${injectedFunction.toString()})(${JSON.stringify(
            text
        )});
                window.dispatchEvent(new CustomEvent('${eventName}', { detail: result }));
            })();
        `;

        // Listen for the result event
        window.addEventListener(
            eventName,
            function handler(event) {
                window.removeEventListener(eventName, handler);
                document.head.removeChild(script);

                if (event.detail.success) {
                    resolve(event.detail.messageId);
                } else {
                    reject(new Error(event.detail.error));
                }
            },
            { once: true }
        );

        // Inject the script
        document.head.appendChild(script);
    });
}

// Listen for messages from the extension popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendMessage" && request.text) {
        sendTextToCurrentChat(request.text)
            .then((result) => sendResponse({ success: true, result }))
            .catch((error) =>
                sendResponse({ success: false, error: error.toString() })
            );
        return true; // Indicates we'll send response asynchronously
    }
});

// Export the function for direct use if needed
window.sendTextToCurrentChat = sendTextToCurrentChat;
