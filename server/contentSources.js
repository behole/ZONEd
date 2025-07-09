const fs = require('fs');
const path = require('path');
const os = require('os');

class ContentSources {
  constructor() {
    this.supportedSources = {
      'chrome_history': this.processChromeHistory.bind(this),
      'safari_history': this.processSafariHistory.bind(this),
      'firefox_history': this.processFirefoxHistory.bind(this),
      'browser_bookmarks': this.processBrowserBookmarks.bind(this),
      'text_files': this.processTextFiles.bind(this),
      'email_export': this.processEmailExport.bind(this)
    };
  }

  async importFromSource(sourceType, options = {}) {
    try {
      if (!this.supportedSources[sourceType]) {
        throw new Error(`Unsupported source type: ${sourceType}`);
      }

      console.log(`Importing from ${sourceType}...`);
      const processor = this.supportedSources[sourceType];
      const results = await processor(options);

      return {
        success: true,
        sourceType,
        imported: results.length,
        items: results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error importing from ${sourceType}:`, error);
      return {
        success: false,
        sourceType,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async processChromeHistory(options = {}) {
    const { limit = 100, daysBack = 7 } = options;
    
    // Chrome history locations by OS
    const historyPaths = {
      darwin: path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/History'),
      win32: path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default/History'),
      linux: path.join(os.homedir(), '.config/google-chrome/Default/History')
    };

    const historyPath = historyPaths[os.platform()];
    
    if (!historyPath || !fs.existsSync(historyPath)) {
      throw new Error('Chrome history file not found. Make sure Chrome is closed and try again.');
    }

    // Note: This is a simplified example. In practice, you'd need to:
    // 1. Copy the History file (it's a SQLite database)
    // 2. Use a SQLite library to query it
    // 3. Handle the fact that Chrome locks the file when running
    
    return [
      {
        type: 'url',
        content: 'https://example.com/article',
        metadata: {
          title: 'Example Article',
          visitTime: new Date().toISOString(),
          source: 'chrome_history',
          visitCount: 1
        }
      }
      // This would contain actual browser history in a real implementation
    ];
  }

  async processSafariHistory(options = {}) {
    const { limit = 100, daysBack = 7 } = options;
    
    const historyPath = path.join(os.homedir(), 'Library/Safari/History.db');
    
    if (!fs.existsSync(historyPath)) {
      throw new Error('Safari history file not found.');
    }

    // Similar to Chrome, this would require SQLite querying
    return [
      {
        type: 'url',
        content: 'https://safari-example.com',
        metadata: {
          title: 'Safari Example',
          visitTime: new Date().toISOString(),
          source: 'safari_history',
          visitCount: 1
        }
      }
    ];
  }

  async processFirefoxHistory(options = {}) {
    const { limit = 100, daysBack = 7 } = options;
    
    // Firefox profile directory
    const profilesPath = {
      darwin: path.join(os.homedir(), 'Library/Application Support/Firefox/Profiles'),
      win32: path.join(os.homedir(), 'AppData/Roaming/Mozilla/Firefox/Profiles'),
      linux: path.join(os.homedir(), '.mozilla/firefox')
    }[os.platform()];

    if (!profilesPath || !fs.existsSync(profilesPath)) {
      throw new Error('Firefox profiles directory not found.');
    }

    // Would need to find the default profile and query places.sqlite
    return [];
  }

  async processBrowserBookmarks(options = {}) {
    const bookmarks = [];
    
    // Chrome bookmarks
    try {
      const chromeBookmarksPath = {
        darwin: path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default/Bookmarks'),
        win32: path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default/Bookmarks'),
        linux: path.join(os.homedir(), '.config/google-chrome/Default/Bookmarks')
      }[os.platform()];

      if (chromeBookmarksPath && fs.existsSync(chromeBookmarksPath)) {
        const bookmarksData = JSON.parse(fs.readFileSync(chromeBookmarksPath, 'utf8'));
        const extracted = this.extractBookmarks(bookmarksData.roots, 'chrome');
        bookmarks.push(...extracted);
      }
    } catch (error) {
      console.warn('Could not read Chrome bookmarks:', error.message);
    }

    // Safari bookmarks
    try {
      const safariBookmarksPath = path.join(os.homedir(), 'Library/Safari/Bookmarks.plist');
      if (fs.existsSync(safariBookmarksPath)) {
        // Would need plist parser for Safari bookmarks
        console.log('Safari bookmarks found but parsing not implemented');
      }
    } catch (error) {
      console.warn('Could not read Safari bookmarks:', error.message);
    }

    return bookmarks;
  }

  extractBookmarks(node, source, folder = '') {
    const bookmarks = [];
    
    if (node.type === 'url') {
      bookmarks.push({
        type: 'url',
        content: node.url,
        metadata: {
          title: node.name,
          folder: folder,
          source: `${source}_bookmarks`,
          dateAdded: node.date_added ? new Date(parseInt(node.date_added) / 1000).toISOString() : new Date().toISOString()
        }
      });
    } else if (node.type === 'folder' && node.children) {
      const currentFolder = folder ? `${folder}/${node.name}` : node.name;
      for (const child of node.children) {
        bookmarks.push(...this.extractBookmarks(child, source, currentFolder));
      }
    }
    
    // Handle root nodes
    if (typeof node === 'object' && !node.type) {
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          bookmarks.push(...this.extractBookmarks(node[key], source, folder));
        }
      }
    }
    
    return bookmarks;
  }

  async processTextFiles(options = {}) {
    const { directory, extensions = ['.txt', '.md', '.note'] } = options;
    
    if (!directory || !fs.existsSync(directory)) {
      throw new Error('Directory not specified or does not exist');
    }

    const textFiles = [];
    const files = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase();
        if (extensions.includes(ext)) {
          try {
            const filePath = path.join(directory, file.name);
            const content = fs.readFileSync(filePath, 'utf8');
            const stats = fs.statSync(filePath);
            
            textFiles.push({
              type: 'file',
              content: file.name,
              extractedText: content,
              metadata: {
                fileName: file.name,
                filePath: filePath,
                fileSize: stats.size,
                fileType: 'text/plain',
                source: 'text_files',
                lastModified: stats.mtime.toISOString(),
                created: stats.birthtime.toISOString()
              }
            });
          } catch (error) {
            console.warn(`Could not read file ${file.name}:`, error.message);
          }
        }
      }
    }
    
    return textFiles;
  }

  async processEmailExport(options = {}) {
    const { filePath, format = 'mbox' } = options;
    
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Email export file not found');
    }

    // This is a simplified example
    // Real implementation would parse MBOX, EML, or other email formats
    const emails = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (format === 'mbox') {
        // Simple MBOX parsing (very basic)
        const messages = content.split(/^From /m);
        
        for (let i = 1; i < messages.length; i++) { // Skip first empty split
          const message = messages[i];
          const lines = message.split('\n');
          
          let subject = '';
          let from = '';
          let date = '';
          let bodyStart = 0;
          
          // Parse headers
          for (let j = 0; j < lines.length; j++) {
            const line = lines[j];
            if (line === '') {
              bodyStart = j + 1;
              break;
            }
            
            if (line.startsWith('Subject: ')) {
              subject = line.substring(9);
            } else if (line.startsWith('From: ')) {
              from = line.substring(6);
            } else if (line.startsWith('Date: ')) {
              date = line.substring(6);
            }
          }
          
          const body = lines.slice(bodyStart).join('\n').trim();
          
          if (subject && body) {
            emails.push({
              type: 'email',
              content: `${subject}\n\n${body.substring(0, 1000)}`, // Limit body length
              metadata: {
                subject,
                from,
                date,
                source: 'email_export',
                bodyLength: body.length
              }
            });
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse email export: ${error.message}`);
    }
    
    return emails;
  }

  // Browser history import with instructions
  getBrowserImportInstructions() {
    return {
      chrome: {
        steps: [
          '1. Close Google Chrome completely',
          '2. Navigate to chrome://settings/privacy',
          '3. Click "Clear browsing data"',
          '4. Or use the History file directly (requires Chrome to be closed)',
          '5. File location varies by OS - see documentation'
        ],
        note: 'Chrome locks the History database while running'
      },
      safari: {
        steps: [
          '1. Open Safari',
          '2. Go to File > Export Bookmarks (for bookmarks)',
          '3. For history, the History.db file is in ~/Library/Safari/',
          '4. Note: Safari history requires additional permissions on macOS'
        ],
        note: 'May require Full Disk Access permission on macOS'
      },
      firefox: {
        steps: [
          '1. Close Firefox',
          '2. Navigate to about:support to find profile folder',
          '3. Copy places.sqlite file',
          '4. Or use Firefox\'s built-in export features'
        ],
        note: 'Firefox stores data in SQLite databases'
      }
    };
  }

  // Email import instructions
  getEmailImportInstructions() {
    return {
      gmail: {
        steps: [
          '1. Go to Google Takeout (takeout.google.com)',
          '2. Select Mail',
          '3. Choose MBOX format',
          '4. Download and extract the archive',
          '5. Upload the .mbox files'
        ]
      },
      outlook: {
        steps: [
          '1. Open Outlook',
          '2. Go to File > Open & Export > Import/Export',
          '3. Choose "Export to a file"',
          '4. Select "Outlook Data File (.pst)"',
          '5. Convert PST to MBOX using a converter tool'
        ]
      },
      apple_mail: {
        steps: [
          '1. Open Apple Mail',
          '2. Select mailbox to export',
          '3. Go to Mailbox > Export Mailbox',
          '4. Choose location and export',
          '5. This creates .mbox files'
        ]
      }
    };
  }
}

module.exports = ContentSources;