# WhatsApp Translator

A powerful Chrome extension that enhances WhatsApp Web with real-time message translation and chat summarization capabilities.

## Features

### Translation
- **Real-time Message Translation**: Automatically translates incoming and outgoing messages in WhatsApp Web
- **Multiple Translation Models**: 
  - Local Gemini Nano (offline capability)
  - Gemini API (cloud-based)
  - Vertex AI (Google Cloud, enterprise-grade)
- **Language Support**: Translate to/from multiple languages including English, Spanish, French, German, Chinese, and more
- **Smart Translation Cache**: Improves performance by storing previous translations

### Summarization
- **Chat Summarization**: Generate concise summaries of conversations
- **Message Recording**: Select which messages to include in summaries
- **Visual Indicators**: Clear marking of which messages are being recorded

### User Experience
- **Easy Toggle**: Quick enable/disable of translation functionality
- **Custom Translation**: Translate and send specific messages directly from the extension
- **Copy to Clipboard**: One-click copying of translations and summaries

## Installation

1. Download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The WhatsApp Translator icon should appear in your browser toolbar

## Usage

### Translation

1. Open WhatsApp Web at https://web.whatsapp.com/
2. Messages will be automatically translated based on your settings
3. Translations appear directly under the original messages

### Message Translation & Sending

1. Click the extension icon to open the popup
2. Type your message in the "Text to Translate" box
3. Select your desired input and output languages
4. Click "Translate Only" to translate without sending
5. Click "Copy to Clipboard" to copy the translation

### Chat Summarization

1. Click the extension icon to open the popup
2. Click "Summarize Chat" to begin recording messages
3. Browse through chat messages you want to include
4. Click "Finish & Summarize" to generate a summary
5. View and copy the generated summary

## Configuration

Access the configuration page by clicking "Advanced Options" in the popup or right-clicking the extension icon and selecting "Options".

### Translation Settings

- **Default Target Language**: Choose your preferred language for translations
- **Translation Model**: Select between Local Gemini Nano, Gemini API, or Vertex AI
- **Vertex AI Configuration**: Configure your Google Cloud Vertex AI settings if using that model

### Cache Management

- View translation cache statistics
- Clear the cache to free up space
- Export the cache database for backup or analysis

## Translation Models

### Local Gemini Nano
- Works offline
- Fastest response time
- Available only on devices that support Chrome's Gemini Nano

### Gemini API
- Works on all devices
- Requires internet connection
- Good balance of speed and quality

### Vertex AI
- Enterprise-grade translation quality
- Requires Google Cloud setup
- Most customizable options

## Privacy and Data

- Local translations stay on your device
- API translations are sent to Google's servers
- The extension does not store your conversation data except in the local translation cache

## Requirements

- Google Chrome browser (version 121 or later recommended)
- For local model: A device that supports Gemini Nano
- For Vertex AI: Google Cloud account and appropriate setup

## License

This project is licensed under the MIT License - see the LICENSE file for details.