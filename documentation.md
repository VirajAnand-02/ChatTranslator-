# WhatsApp Translator - Technical Documentation

## Architecture Overview

The WhatsApp Translator extension is built using the Chrome Extension architecture with the following components:

1. **Background Script**: Handles API calls, model selection, and core translation/summarization logic
2. **Content Script**: Injects into WhatsApp Web to modify the DOM and handle message translation
3. **Popup Interface**: Provides user controls for translation and summarization
4. **Options Page**: Allows configuration of the extension settings
5. **Cache System**: Manages translation caching using SQLite

## Component Details

### Background Script (background.js)

The background script serves as the core of the extension, handling:

- Translation API requests to various models
- Summarization processing
- Settings management
- Communication between components

Key functions:
- `translateText()`: Routes translation requests to the appropriate model
- `summarizeConversation()`: Manages summarization requests
- Various model-specific translation functions (local, API, Vertex)

### Content Script (content.js)

The content script injects into WhatsApp Web and manages:

- DOM monitoring for new messages
- Translation injection into the UI
- Message recording for summarization
- Chat interface modifications

Key functions:
- `processChatBubble()`: Processes individual messages for translation
- `findActualMessageText()`: Extracts proper text content from complex message structures
- `appendTranslation()`: Adds translations to the UI
- `recordMessageForSummary()`: Records messages for summarization

### Translation Models

The extension supports three translation models:

1. **Local Gemini Nano**:
   - Uses Chrome's built-in AI capabilities
   - Works offline
   - Fastest response time

2. **Gemini API**:
   - Cloud-based translation
   - More powerful than local model
   - Works on all devices

3. **Vertex AI**:
   - Enterprise-grade translation
   - Requires Google Cloud setup
   - Most customizable

## Data Flow

1. User opens WhatsApp Web
2. Content script injects and monitors for messages
3. When a new message is detected:
   - Content script extracts the text
   - Background script is called for translation
   - Translation is inserted back into the UI

For summarization:
1. User initiates summarization from popup
2. Content script begins recording messages
3. User browses messages to include
4. When completed, content script sends messages to background script
5. Background script generates summary using selected model
6. Summary is displayed in the popup

## API Usage

### Gemini API

Uses Google's Gemini API for translation with the following parameters:
- Temperature: 0.9
- Top-P: 0.8
- Max output tokens: 800

### Vertex AI

Uses Google Cloud's Vertex AI with customizable parameters:
- Project ID
- Location
- API Endpoint
- Model ID
- Access Token

## Development Notes

### Adding New Languages

To add a new language, update the language options in:
- `popup.html`
- `options.html`

### Adding New Translation Models

To add a new translation model:
1. Create a new translation function in `background.js`
2. Add the model to the model selection in `options.html`
3. Update the model selection logic in `background.js`

### Testing

Manual testing workflow:
1. Test basic translation functionality
2. Test with different languages
3. Test with different models
4. Test cache functionality
5. Test summarization with various conversation lengths

## Troubleshooting

Common issues:

1. **Local model unavailable**: Chrome's Gemini Nano may not be available on all devices
2. **Translation fails**: Check network connection and API keys
3. **UI elements not found**: WhatsApp Web structure changes may require selector updates

## Future Improvements

Potential enhancements:
1. Add support for more messaging platforms
2. Implement custom translation models
3. Add conversation analysis features
4. Add message caching
5. Add more customization options