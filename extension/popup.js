// ZONEd Browser Extension Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved configuration
  const config = await chrome.storage.sync.get(['zonedUrl', 'zonedToken']);
  document.getElementById('zonedUrl').value = config.zonedUrl || 'http://localhost:3001';
  document.getElementById('zonedToken').value = config.zonedToken || '';
  
  // Save current page
  document.getElementById('savePage').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => ({
          title: document.title,
          url: window.location.href,
          text: document.body.innerText,
          html: document.documentElement.outerHTML
        })
      });
      
      await saveToZoned({
        type: 'page',
        content: result.result.html,
        text: result.result.text,
        title: result.result.title,
        source_url: result.result.url
      });
      
      showStatus('Page saved successfully!', 'success');
    } catch (error) {
      showStatus('Failed to save page: ' + error.message, 'error');
    }
  });
  
  // Save selected text
  document.getElementById('saveSelection').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });
      
      const selectedText = result.result;
      if (!selectedText) {
        showStatus('No text selected', 'error');
        return;
      }
      
      await saveToZoned({
        type: 'text',
        content: selectedText,
        title: `Selection from ${tab.title}`,
        source_url: tab.url
      });
      
      showStatus('Selected text saved!', 'success');
    } catch (error) {
      showStatus('Failed to save selection: ' + error.message, 'error');
    }
  });
  
  // Open ZONEd dashboard
  document.getElementById('openZoned').addEventListener('click', async () => {
    const config = await chrome.storage.sync.get(['zonedUrl']);
    const url = config.zonedUrl || 'http://localhost:3001';
    chrome.tabs.create({ url });
  });
  
  // Search ZONEd
  document.getElementById('searchZoned').addEventListener('click', async () => {
    const query = prompt('Search ZONEd:');
    if (query) {
      const config = await chrome.storage.sync.get(['zonedUrl']);
      const url = config.zonedUrl || 'http://localhost:3001';
      chrome.tabs.create({ url: `${url}?search=${encodeURIComponent(query)}` });
    }
  });
  
  // Save configuration
  document.getElementById('saveConfig').addEventListener('click', async () => {
    const zonedUrl = document.getElementById('zonedUrl').value;
    const zonedToken = document.getElementById('zonedToken').value;
    
    await chrome.storage.sync.set({ zonedUrl, zonedToken });
    showStatus('Configuration saved!', 'success');
  });
});

async function saveToZoned(data) {
  const config = await chrome.storage.sync.get(['zonedUrl', 'zonedToken']);
  const url = config.zonedUrl || 'http://localhost:3001';
  
  const response = await fetch(`${url}/api/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.zonedToken && { 'Authorization': `Bearer ${config.zonedToken}` })
    },
    body: JSON.stringify({ items: [data] })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 3000);
}
