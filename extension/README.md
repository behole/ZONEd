# ZONEd Browser Extension

A browser extension that allows you to capture web content directly to your ZONEd personal data dropzone.

## Features

- 🌐 **Right-click context menu** to save selected text, links, images, or entire pages
- 📄 **One-click page saving** via floating button or popup
- ✂️ **Text selection capture** with automatic highlight detection
- 🔍 **Quick search** your ZONEd data from any webpage
- ⚙️ **Configurable server URL** to connect to your ZONEd instance

## Installation

### Development (Chrome/Edge)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension/` directory
4. The ZONEd extension icon should appear in your toolbar

### Development (Firefox)

1. Open Firefox and go to `about:debugging`
2. Click "This Firefox" 
3. Click "Load Temporary Add-on"
4. Select any file in the `extension/` directory

## Configuration

1. Click the ZONEd extension icon in your toolbar
2. Configure your ZONEd server URL (default: `http://localhost:3001`)
3. Optionally add an API token if your server requires authentication
4. Click "Save Settings"

## Usage

### Quick Save Options

- **Floating Button**: Click the floating 📥 button that appears on any webpage
- **Extension Popup**: Click the ZONEd icon in your toolbar
- **Right-click Menu**: Right-click on text, links, images, or anywhere on the page

### What You Can Save

- **Selected Text**: Highlight text and use the popup save button or right-click menu
- **Full Pages**: Save entire web pages with all content and formatting
- **URLs/Links**: Save links for later processing by ZONEd
- **Images**: Right-click on images to save them to ZONEd

### Search Integration

- Use the "Search ZONEd" button to quickly search your personal data
- Opens your ZONEd dashboard with the search query pre-filled

## API Integration

The extension communicates with your ZONEd server using the `/api/content` endpoint. Content is sent in this format:

```json
{
  "type": "text|url|page|image",
  "content": "...",
  "title": "...",
  "source_url": "...",
  "text": "..." // for pages only
}
```

## Security

- No data is stored locally except for configuration
- All content is sent directly to your configured ZONEd server
- Optional API token support for authenticated instances
- Content scripts run in isolated context to prevent conflicts

## Development

To modify the extension:

1. Edit files in the `extension/` directory
2. Reload the extension in `chrome://extensions/`
3. Test on various websites to ensure compatibility

### Key Files

- `manifest.json` - Extension configuration and permissions
- `background.js` - Service worker for context menus and API calls
- `content.js` - Injected script for page interaction
- `popup.html/js` - Extension popup interface

## Compatibility

- Chrome 88+ (Manifest V3)
- Firefox 89+ (with some V3 compatibility)
- Edge 88+
- Safari (with modifications for Safari Web Extensions)

## Troubleshooting

- **Connection issues**: Check your ZONEd server URL in settings
- **Permission errors**: Ensure the extension has access to the current tab
- **Content not saving**: Check browser console for API errors
- **CORS issues**: Your ZONEd server may need to allow extension origins
