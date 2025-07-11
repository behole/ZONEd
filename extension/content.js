// ZONEd Browser Extension Content Script

// Create floating save button for quick access
let zonedButton = null;

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initZonedExtension);
} else {
  initZonedExtension();
}

function initZonedExtension() {
  createFloatingButton();
  setupTextSelection();
}

function createFloatingButton() {
  if (zonedButton) return;
  
  zonedButton = document.createElement('div');
  zonedButton.id = 'zoned-floating-button';
  zonedButton.innerHTML = '📥';
  zonedButton.title = 'Save to ZONEd';
  zonedButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: #007acc;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 20px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
    opacity: 0.8;
  `;
  
  zonedButton.addEventListener('mouseenter', () => {
    zonedButton.style.opacity = '1';
    zonedButton.style.transform = 'scale(1.1)';
  });
  
  zonedButton.addEventListener('mouseleave', () => {
    zonedButton.style.opacity = '0.8';
    zonedButton.style.transform = 'scale(1)';
  });
  
  zonedButton.addEventListener('click', showQuickMenu);
  
  document.body.appendChild(zonedButton);
}

function setupTextSelection() {
  let selectionMenu = null;
  
  document.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selectedText.length > 10) {
      if (selectionMenu) selectionMenu.remove();
      
      selectionMenu = document.createElement('div');
      selectionMenu.innerHTML = '💾 Save to ZONEd';
      selectionMenu.style.cssText = `
        position: absolute;
        background: #007acc;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        z-index: 10001;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        white-space: nowrap;
      `;
      
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      selectionMenu.style.left = `${rect.left + window.scrollX}px`;
      selectionMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
      
      selectionMenu.addEventListener('click', () => {
        saveSelectedText(selectedText);
        selectionMenu.remove();
        selection.removeAllRanges();
      });
      
      document.body.appendChild(selectionMenu);
      
      setTimeout(() => {
        if (selectionMenu && selectionMenu.parentNode) {
          selectionMenu.remove();
        }
      }, 5000);
    } else if (selectionMenu) {
      selectionMenu.remove();
    }
  });
}

function showQuickMenu() {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    min-width: 200px;
  `;
  
  const options = [
    { text: '📄 Save full page', action: () => saveCurrentPage() },
    { text: '🔗 Save page URL', action: () => savePageUrl() },
    { text: '📝 Save selection', action: () => saveSelection() },
    { text: '🔍 Search ZONEd', action: () => openSearch() }
  ];
  
  options.forEach(option => {
    const item = document.createElement('div');
    item.textContent = option.text;
    item.style.cssText = `
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    `;
    item.addEventListener('mouseenter', () => item.style.background = '#f5f5f5');
    item.addEventListener('mouseleave', () => item.style.background = 'white');
    item.addEventListener('click', () => {
      option.action();
      menu.remove();
    });
    menu.appendChild(item);
  });
  
  document.body.appendChild(menu);
  
  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 100);
}

function saveCurrentPage() {
  chrome.runtime.sendMessage({
    action: 'savePageContent',
    data: {
      type: 'page',
      content: document.documentElement.outerHTML,
      text: document.body.innerText,
      title: document.title,
      url: window.location.href
    }
  });
  showNotification('Page saved to ZONEd!');
}

function savePageUrl() {
  chrome.runtime.sendMessage({
    action: 'savePageContent',
    data: {
      type: 'url',
      content: window.location.href,
      title: document.title,
      url: window.location.href
    }
  });
  showNotification('URL saved to ZONEd!');
}

function saveSelection() {
  const selectedText = window.getSelection().toString().trim();
  if (!selectedText) {
    showNotification('No text selected!', 'error');
    return;
  }
  saveSelectedText(selectedText);
}

function saveSelectedText(text) {
  chrome.runtime.sendMessage({
    action: 'savePageContent',
    data: {
      type: 'text',
      content: text,
      title: `Selection from ${document.title}`,
      source_url: window.location.href
    }
  });
  showNotification('Text saved to ZONEd!');
}

function openSearch() {
  const query = prompt('Search your ZONEd data:');
  if (query) {
    chrome.runtime.sendMessage({ action: 'openSearch', query });
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#dc3545' : '#28a745'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10002;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}
