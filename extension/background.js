// ZONEd Browser Extension Background Script

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu items
  chrome.contextMenus.create({
    id: "save-to-zoned",
    title: "Save to ZONEd",
    contexts: ["selection", "page", "link", "image"]
  });
  
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save selected text",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const zonedAPI = await getZonedConfig();
  
  try {
    if (info.menuItemId === "save-selection" && info.selectionText) {
      await saveToZoned({
        type: 'text',
        content: info.selectionText,
        source_url: tab.url,
        title: tab.title
      }, zonedAPI);
    } else if (info.menuItemId === "save-to-zoned") {
      if (info.linkUrl) {
        await saveToZoned({
          type: 'url',
          content: info.linkUrl,
          source_url: tab.url,
          title: tab.title
        }, zonedAPI);
      } else if (info.srcUrl) {
        await saveToZoned({
          type: 'image',
          content: info.srcUrl,
          source_url: tab.url,
          title: tab.title
        }, zonedAPI);
      } else {
        // Save full page
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: capturePageContent
        });
      }
    }
  } catch (error) {
    console.error('Failed to save to ZONEd:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'ZONEd Extension',
      message: 'Failed to save content. Check your ZONEd server connection.'
    });
  }
});

async function getZonedConfig() {
  const result = await chrome.storage.sync.get(['zonedUrl', 'zonedToken']);
  return {
    url: result.zonedUrl || 'http://localhost:3001',
    token: result.zonedToken
  };
}

async function saveToZoned(data, config) {
  const response = await fetch(`${config.url}/api/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.token && { 'Authorization': `Bearer ${config.token}` })
    },
    body: JSON.stringify({ items: [data] })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'ZONEd Extension',
    message: 'Content saved successfully!'
  });
}

function capturePageContent() {
  const content = {
    type: 'page',
    content: document.documentElement.outerHTML,
    text: document.body.innerText,
    title: document.title,
    url: window.location.href
  };
  
  chrome.runtime.sendMessage({ action: 'savePageContent', data: content });
}

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'savePageContent') {
    const zonedAPI = await getZonedConfig();
    await saveToZoned(message.data, zonedAPI);
  }
});
