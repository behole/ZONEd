
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const cheerio = require('cheerio');
const ContentProcessor = require('./contentProcessor');
const SimpleVectorEngine = require('./simpleVectorEngine');
const RAGProcessor = require('./ragProcessor');
const NewsletterGenerator = require('./newsletterGenerator');
const ContentSources = require('./contentSources');
const Database = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const contentProcessor = new ContentProcessor();

// Initialize database
const database = new Database();

// Log database status after a brief delay to allow initialization
setTimeout(() => {
  console.log('📊 Final Database Status:');
  console.log('- Using PostgreSQL:', database.isPostgres);
  console.log('- Pool connected:', !!database.pool);
  if (!database.isPostgres) {
    console.log('⚠️ WARNING: Using JSON file storage - data will not persist between deployments!');
  }
}, 2000);


// Initialize Vector and RAG engines
const useOpenAI = process.env.USE_OPENAI === 'true' && process.env.OPENAI_API_KEY;

const vectorEngine = new SimpleVectorEngine({
  useOpenAI: useOpenAI,
  openaiApiKey: process.env.OPENAI_API_KEY
});

const ragProcessor = new RAGProcessor(vectorEngine, {
  useOpenAI: useOpenAI,
  openaiApiKey: process.env.OPENAI_API_KEY
});

const newsletterGenerator = new NewsletterGenerator(vectorEngine, ragProcessor, {
  useOpenAI: useOpenAI,
  openaiApiKey: process.env.OPENAI_API_KEY
});

const contentSources = new ContentSources();

console.log(`Using ${useOpenAI ? 'OpenAI' : 'local'} models for embeddings and responses`);

// Configure CORS for production, iOS sharing, and browser extensions
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'chrome-extension://*', 'moz-extension://*'].filter(Boolean) 
    : ['http://localhost:5173', 'chrome-extension://*', 'moz-extension://*'],
  credentials: true,
  // Allow iOS share requests and browser extensions
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware for API authentication
const authenticate = (req, res, next) => {
  const token = process.env.ZONED_API_TOKEN;
  if (!token) {
    // No token set, allow all requests
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const providedToken = authHeader.split(' ')[1];
  if (providedToken !== token) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  next();
};


// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from client build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Legacy functions for backward compatibility during transition
async function readDB() {
  const content = await database.getAllContent();
  const notes = await database.getAllNotes();
  return { content, notes };
}

async function writeDB(data) {
  // This function is now handled by individual database operations
  // Keeping for compatibility but operations should use database.insertContent() directly
  console.log('writeDB called - operations should use database.insertContent() directly');
}

// Extract metadata from URL with enhanced content filtering
async function extractUrlMetadata(url) {
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements FIRST before any content extraction
    $('script, style, noscript, iframe, embed, object, applet').remove();
    $('nav, header, footer, aside, .nav, .navigation, .navbar, .header, .footer, .sidebar').remove();
    $('[class*="ad"], [id*="ad"], [class*="advertisement"], [id*="advertisement"]').remove();
    $('[class*="banner"], [id*="banner"], [class*="popup"], [id*="popup"]').remove();
    $('[class*="cookie"], [id*="cookie"], [class*="gdpr"], [id*="gdpr"]').remove();
    $('[class*="social"], [id*="social"], [class*="share"], [id*="share"]').remove();
    $('[class*="comment"], [id*="comment"], [class*="disqus"], [id*="disqus"]').remove();
    $('[class*="related"], [id*="related"], [class*="recommend"], [id*="recommend"]').remove();
    $('[class*="tag-manager"], [id*="tag-manager"], [data-gtm]').remove();
    $('.gtm, #gtm, [class*="gtm"], [id*="gtm"]').remove();
    
    // Smart content extraction - prioritize semantic HTML and common content patterns
    let mainContent = '';
    let contentSource = '';
    
    // Enhanced content selectors with priority order
    const contentSelectors = [
      // Semantic HTML first (highest priority)
      'article[role="main"]',
      'main article',
      'article',
      'main',
      '[role="main"]',
      
      // JSON-LD structured data extraction
      'script[type="application/ld+json"]',
      
      // Modern content containers
      '.post-content, .entry-content, .article-content',
      '.content-body, .article-body, .post-body',
      '.story-body, .story-content',
      '.text-content, .main-content',
      '.article__content, .post__content',
      
      // Platform-specific selectors (updated for 2025)
      '.notion-page-content',
      '.medium-content, .postArticle-content',
      '.wp-content, .entry',
      '.markdown-body',
      '.rst-content',
      '.doc-content',
      '.substack-post-content',
      '.ghost-content',
      '.cms-content',
      
      // Modern framework selectors
      '[data-content="main"]',
      '[data-role="content"]',
      '.prose, .prose-lg',
      '.rich-text, .formatted-text',
      
      // Generic fallbacks
      '#content, .content',
      '#main, .main',
      '.container .row .col',
      '.page-content'
    ];
    
    // Try JSON-LD structured data first
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonData = JSON.parse($(el).html());
        if (jsonData['@type'] === 'Article' && jsonData.articleBody) {
          mainContent = jsonData.articleBody;
          contentSource = 'JSON-LD structured data';
          console.log(`📄 Extracted content from JSON-LD (${mainContent.length} chars)`);
          return false; // Break out of each loop
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    });
    
    // If no JSON-LD content, try CSS selectors
    if (!mainContent) {
      for (const selector of contentSelectors) {
        if (selector.includes('json')) continue; // Skip JSON selector in CSS loop
        
        const elements = $(selector);
        if (elements.length > 0) {
          // Get text from all matching elements
          let candidateText = '';
          elements.each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > candidateText.length) {
              candidateText = text;
            }
          });
          
          if (candidateText.length > 300) { // Require substantial content
            mainContent = candidateText;
            contentSource = selector;
            console.log(`📄 Extracted content using selector: ${selector} (${candidateText.length} chars)`);
            break;
          }
        }
      }
    }
    
    // Enhanced fallback with better cleaning
    if (!mainContent || mainContent.length < 200) {
      console.log('📄 Using enhanced fallback extraction');
      
      // Remove more unwanted elements for fallback
      $('button, input, select, textarea, form').remove();
      $('.btn, .button, .link, .menu-item').remove();
      $('[class*="meta"], [class*="date"], [class*="author"], [class*="byline"]').remove();
      
      // Try to get meaningful paragraphs
      const paragraphs = $('p').map((i, el) => $(el).text().trim()).get();
      const meaningfulParagraphs = paragraphs.filter(p => p.length > 50 && !p.match(/^(click|subscribe|follow|share|like)/i));
      
      if (meaningfulParagraphs.length > 0) {
        mainContent = meaningfulParagraphs.join('\n\n');
        contentSource = 'paragraph extraction';
      } else {
        // Last resort - clean body text
        mainContent = $('body').text().trim();
        contentSource = 'body fallback';
      }
    }
    
    // Enhanced content cleaning
    mainContent = mainContent
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .replace(/^[\s\n]+|[\s\n]+$/g, '')  // Trim
      .replace(/(\w)\s+(\w)/g, '$1 $2')  // Fix word spacing
      .replace(/[^\w\s\.\,\!\?\;\:\-\(\)\[\]\"\']/g, ' ')  // Remove special chars but keep punctuation
      .replace(/\s{2,}/g, ' ')  // Final whitespace cleanup
      .substring(0, 3000); // Increase limit for better content
    
    // Filter out common junk patterns
    const junkPatterns = [
      /^(accept|allow|enable|disable|click|tap|subscribe|follow|share|like|comment)/i,
      /google tag manager/i,
      /this website uses cookies/i,
      /privacy policy|terms of service/i,
      /advertisement|sponsored content/i
    ];
    
    const contentLines = mainContent.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 20 && !junkPatterns.some(pattern => pattern.test(trimmed));
    });
    
    mainContent = contentLines.join('\n').trim();
    
    // Extract enhanced metadata with modern standards
    const title = $('title').text().trim() || 
                 $('meta[property="og:title"]').attr('content') || 
                 $('meta[name="twitter:title"]').attr('content') ||
                 $('meta[property="article:title"]').attr('content') ||
                 $('h1').first().text().trim() || 
                 'No title';
                 
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') ||
                       $('meta[property="article:description"]').attr('content') ||
                       $('.excerpt, .summary').first().text().trim().substring(0, 200) ||
                       '';
    
    const author = $('meta[name="author"]').attr('content') || 
                  $('meta[property="article:author"]').attr('content') ||
                  $('meta[name="twitter:creator"]').attr('content') ||
                  $('[rel="author"]').text().trim() || 
                  $('.author, .byline, .writer').first().text().trim() || 
                  '';
    
    const publishDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('meta[property="article:modified_time"]').attr('content') ||
                       $('meta[name="publish_date"]').attr('content') ||
                       $('time[datetime]').attr('datetime') || 
                       $('time[pubdate]').attr('pubdate') ||
                       $('.date, .published, .timestamp').first().text().trim() || 
                       '';
    
    const keywords = $('meta[name="keywords"]').attr('content') || 
                    $('meta[property="article:tag"]').attr('content') ||
                    $('.tags, .categories').text().trim() ||
                    '';
    
    // Extract additional modern metadata
    const siteName = $('meta[property="og:site_name"]').attr('content') || 
                    $('meta[name="application-name"]').attr('content') ||
                    new URL(url).hostname;
    
    const imageUrl = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('link[rel="apple-touch-icon"]').attr('href') ||
                    '';
    
    const contentType = $('meta[property="og:type"]').attr('content') || 'article';
    const locale = $('meta[property="og:locale"]').attr('content') || 'en_US';
    
    console.log(`📊 Content extraction summary:
    - Source: ${contentSource}
    - Title: ${title.substring(0, 50)}...
    - Content length: ${mainContent.length} chars
    - Author: ${author}
    - Domain: ${new URL(url).hostname}`);
    
    return {
      title: title.substring(0, 200),
      description: description.substring(0, 500),
      content: mainContent,
      url: url,
      domain: new URL(url).hostname,
      author: author.substring(0, 100),
      publishDate: publishDate,
      keywords: keywords.substring(0, 300),
      contentSource: contentSource,
      extractionQuality: mainContent.length > 500 ? 'high' : mainContent.length > 200 ? 'medium' : 'low',
      
      // Enhanced metadata
      siteName: siteName,
      imageUrl: imageUrl,
      contentType: contentType,
      locale: locale,
      wordCount: mainContent.split(/\s+/).filter(w => w.length > 0).length,
      readingTimeMinutes: Math.ceil(mainContent.split(/\s+/).filter(w => w.length > 0).length / 250),
      
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error extracting URL metadata:', error.message);
    console.log('🔄 Attempting graceful fallback for URL:', url);
    
    // Determine error type for better handling
    let errorType = 'unknown';
    let fallbackContent = '';
    let fallbackTitle = 'Shared URL';
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorType = 'network';
      fallbackContent = `Unable to access this URL due to network restrictions. The link has been saved for future reference.`;
    } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      errorType = 'timeout';
      fallbackContent = `This website took too long to respond, but the URL has been saved. You can try accessing it directly later.`;
    } else if (error.response?.status === 403 || error.response?.status === 401) {
      errorType = 'access_denied';
      fallbackContent = `This website blocks automated access, but the URL has been saved for your reference.`;
    } else if (error.response?.status === 404) {
      errorType = 'not_found';
      fallbackContent = `This page was not found (404), but the URL has been saved in case it becomes available later.`;
    } else if (error.response?.status >= 500) {
      errorType = 'server_error';
      fallbackContent = `The website is experiencing issues, but the URL has been saved for later access.`;
    } else {
      fallbackContent = `Unable to extract content from this URL, but it has been saved for your reference.`;
    }
    
    // Try to extract domain and create a meaningful title
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      fallbackTitle = `Content from ${domain}`;
      
      // Add path info if meaningful
      if (urlObj.pathname && urlObj.pathname !== '/') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart && !lastPart.includes('.')) {
            fallbackTitle += ` - ${lastPart.replace(/-/g, ' ').replace(/_/g, ' ')}`;
          }
        }
      }
    } catch (urlError) {
      console.warn('Could not parse URL for fallback title:', urlError.message);
    }
    
    // Create a meaningful fallback response
    const fallbackResponse = {
      title: fallbackTitle,
      description: `Saved URL with ${errorType} error - content extraction failed but link preserved`,
      content: `${fallbackContent}\n\nOriginal URL: ${url}\nSaved on: ${new Date().toLocaleString()}`,
      url: url,
      domain: new URL(url).hostname.replace('www.', ''),
      timestamp: new Date().toISOString(),
      error: error.message,
      errorType: errorType,
      extractionQuality: 'failed_with_fallback',
      
      // Add helpful metadata for failed extractions
      fallbackData: {
        canRetry: ['timeout', 'server_error', 'network'].includes(errorType),
        userAction: errorType === 'access_denied' ? 'Visit URL directly in browser' : 
                   errorType === 'not_found' ? 'Check if URL is correct' :
                   'Try again later',
        preservedForLater: true
      }
    };
    
    console.log(`✅ Created fallback content for ${errorType} error:`, fallbackResponse.title);
    return fallbackResponse;
  }
}

// Process different content types with enhanced deduplication
async function processContentItem(item, existingContent = []) {
  const baseItem = {
    id: Math.floor(Date.now() + Math.random() * 1000),
    type: item.type,
    timestamp: new Date().toISOString(),
    processed: true
  };

  let processedContent;
  let fingerprint;

  switch (item.type) {
    case 'text':
      const cleanedText = contentProcessor.cleanContent(item.content);
      const chunks = contentProcessor.chunkContent(cleanedText);
      const keywords = contentProcessor.extractKeywords(cleanedText);
      const summary = await contentProcessor.generateSummary(cleanedText, 'text', item.metadata?.title || '');
      fingerprint = contentProcessor.generateFingerprint(cleanedText);
      
      processedContent = {
        ...baseItem,
        content: item.content,
        cleanedContent: cleanedText,
        summary: summary,
        chunks: chunks,
        keywords: keywords,
        fingerprint: fingerprint,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(w => w.length > 0).length,
          charCount: cleanedText.length,
          chunkCount: chunks.length,
          hasSummary: true
        }
      };
      break;

    case 'url':
      const urlMetadata = await extractUrlMetadata(item.content);
      const urlCleanedContent = contentProcessor.cleanContent(urlMetadata.content);
      const urlChunks = contentProcessor.chunkContent(urlCleanedContent);
      const urlKeywords = contentProcessor.extractKeywords(urlCleanedContent);
      const urlSummary = await contentProcessor.generateSummary(urlCleanedContent, 'article', urlMetadata.title || '');
      fingerprint = contentProcessor.generateFingerprint(urlCleanedContent);
      
      processedContent = {
        ...baseItem,
        content: item.content,
        extractedContent: urlMetadata.content,
        cleanedContent: urlCleanedContent,
        summary: urlSummary,
        chunks: urlChunks,
        keywords: urlKeywords,
        fingerprint: fingerprint,
        metadata: {
          ...item.metadata,
          ...urlMetadata,
          chunkCount: urlChunks.length,
          hasSummary: urlCleanedContent.length > 0
        }
      };
      break;

    case 'file':
      processedContent = {
        ...baseItem,
        content: item.content,
        fingerprint: contentProcessor.generateFingerprint(item.content),
        metadata: {
          ...item.metadata,
          status: 'pending_file_processing',
          note: 'File needs to be uploaded via /api/upload endpoint for text extraction'
        }
      };
      fingerprint = processedContent.fingerprint;
      break;

    default:
      processedContent = {
        ...baseItem,
        content: item.content,
        fingerprint: contentProcessor.generateFingerprint(item.content || ''),
        metadata: item.metadata || {}
      };
      fingerprint = processedContent.fingerprint;
  }

  // Check for existing content with same fingerprint
  const existingItem = contentProcessor.findExistingContent(existingContent, fingerprint);
  
  if (existingItem) {
    // Merge with existing content (boost importance)
    console.log(`Found duplicate content (fingerprint: ${fingerprint}), merging submissions...`);
    return {
      ...contentProcessor.mergeSubmissions(existingItem, {
        source: 'content_api',
        type: item.type,
        metadata: item.metadata
      }),
      isDuplicate: true,
      originalId: existingItem.id
    };
  } else {
    // Create new content with importance tracking
    return contentProcessor.createContentWithImportance(processedContent, {
      source: 'content_api',
      type: item.type,
      metadata: item.metadata
    });
  }
}

// Legacy notes endpoint
app.post('/api/notes', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    const db = readDB();
    const newNote = {
      id: Date.now(),
      content,
      timestamp: new Date().toISOString()
    };
    db.notes.push(newNote);
    writeDB(db);
    res.json({ success: true, note: newNote });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// New content processing endpoint with enhanced deduplication
app.post('/api/content', authenticate, async (req, res) => {
  try {
    console.log('Processing content request:', req.body);
    const { items } = req.body;
    const existingContent = await database.getAllContent();
    console.log('Current DB state - content items:', existingContent.length);
    
    const processedItems = [];
    const duplicateItems = [];
    const newItems = [];
    
    for (const item of items) {
      try {
        console.log('Processing item:', item);
        const processed = await processContentItem(item, existingContent);
        console.log('Processed result:', processed);
        
        // Save to database
        await database.insertContent(processed);
        
        if (processed.isDuplicate) {
          duplicateItems.push(processed);
        } else {
          newItems.push(processed);
          console.log('Added new item to DB');
        }
        
        processedItems.push(processed);
      } catch (error) {
        console.error('Error processing item:', error);
        const errorItem = {
          ...item,
          id: Math.floor(Date.now() + Math.random() * 1000),
          timestamp: new Date().toISOString(),
          processed: false,
          error: error.message
        };
        
        // Save error item to database too
        await database.insertContent(errorItem);
        processedItems.push(errorItem);
        newItems.push(errorItem);
      }
    }
    
    console.log('Database operations completed');
    
    // Add processed items to vector database
    const vectorResults = [];
    for (const item of processedItems) {
      if (item.processed && !item.error) {
        try {
          const vectorResult = await vectorEngine.addContent(item);
          vectorResults.push(vectorResult);
        } catch (error) {
          console.error('Error adding to vector DB:', error);
          vectorResults.push({ success: false, error: error.message, id: item.id });
        }
      }
    }
    
    res.json({ 
      success: true, 
      processed: processedItems.length,
      new: newItems.length,
      duplicates: duplicateItems.length,
      items: processedItems,
      vectorResults: vectorResults,
      summary: {
        newContent: newItems.length,
        boostedContent: duplicateItems.length,
        totalImportanceBoosts: duplicateItems.reduce((sum, item) => sum + (item.submissionCount - 1), 0),
        vectorized: vectorResults.filter(r => r.success).length
      }
    });
  } catch (error) {
    console.error('Content processing error:', error);
    res.status(500).json({ error: 'Failed to process content' });
  }
});

// File upload endpoint with content processing
app.post('/api/upload', authenticate, upload.array('files'), async (req, res) => {
  try {
    const processedFiles = [];
    
    for (const file of req.files) {
      console.log(`Processing uploaded file: ${file.originalname}`);
      
      // Extract text content from file
      const extractionResult = await contentProcessor.processFile(
        file.path, 
        file.mimetype, 
        file.originalname
      );
      
      let processedFile = {
        id: Math.floor(Date.now() + Math.random() * 1000),
        type: 'file',
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        timestamp: new Date().toISOString(),
        content: extractionResult.extractedText || `Uploaded file: ${file.originalname}`,
        extractedText: extractionResult.extractedText,
        processingSuccess: extractionResult.success,
        processingError: extractionResult.error,
        importanceScore: 1, // Default importance
        submissionCount: 1,
        contextualTags: [],
        metadata: {
          ...extractionResult.metadata,
          uploadPath: file.path
        }
      };

      // If text extraction was successful, process the content further
      if (extractionResult.success && extractionResult.extractedText) {
        const cleanedText = contentProcessor.cleanContent(extractionResult.extractedText);
        const chunks = contentProcessor.chunkContent(cleanedText);
        const keywords = contentProcessor.extractKeywords(cleanedText);
        const fingerprint = contentProcessor.generateFingerprint(cleanedText);
        
        processedFile = {
          ...processedFile,
          cleanedContent: cleanedText,
          chunks: chunks,
          keywords: keywords,
          fingerprint: fingerprint,
          metadata: {
            ...processedFile.metadata,
            chunkCount: chunks.length,
            keywordCount: keywords.length
          }
        };
      }
      
      processedFiles.push(processedFile);
    }
    
    // Save files to database using modern database system
    const vectorResults = [];
    for (const file of processedFiles) {
      try {
        // Insert into database
        await database.insertContent(file);
        console.log(`✓ Saved to database: ${file.originalName}`);
        
        // Add to vector database if processing was successful
        if (file.processingSuccess && file.extractedText) {
          try {
            const vectorResult = await vectorEngine.addContent(file);
            vectorResults.push(vectorResult);
            console.log(`✓ Vectorized: ${file.originalName}`);
          } catch (error) {
            console.error('Error adding file to vector DB:', error);
            vectorResults.push({ success: false, error: error.message, id: file.id });
          }
        }
      } catch (error) {
        console.error(`Error saving file to database: ${file.originalName}`, error);
      }
    }
    
    res.json({ 
      success: true, 
      files: processedFiles,
      processed: processedFiles.filter(f => f.processingSuccess).length,
      failed: processedFiles.filter(f => !f.processingSuccess).length,
      vectorResults: vectorResults,
      summary: {
        vectorized: vectorResults.filter(r => r.success).length
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload and process files' });
  }
});

// Query endpoint (updated to search both notes and content)
app.get('/api/query', (req, res) => {
  try {
    const { q } = req.query;
    const db = readDB();
    
    // Search legacy notes
    const filteredNotes = (db.notes || []).filter(note => 
      note.content.toLowerCase().includes(q.toLowerCase())
    );
    
    // Search new content
    const filteredContent = (db.content || []).filter(item => {
      const searchText = [
        item.content,
        item.extractedContent,
        item.metadata?.title,
        item.metadata?.description
      ].filter(Boolean).join(' ').toLowerCase();
      
      return searchText.includes(q.toLowerCase());
    });
    
    res.json({ 
      notes: filteredNotes,
      content: filteredContent,
      total: filteredNotes.length + filteredContent.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to query content' });
  }
});

// Get all content endpoint
app.get('/api/content', async (req, res) => {
  try {
    const content = await database.getAllContent();
    const notes = await database.getAllNotes();
    res.json({ 
      content: content || [],
      notes: notes || []
    });
  } catch (error) {
    console.error('Error retrieving content:', error);
    res.status(500).json({ error: 'Failed to retrieve content' });
  }
});

// Delete content item endpoint
app.delete('/api/content/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Content ID is required' });
    }
    
    console.log(`🗑️ Deleting content item: ${id}`);
    
    // Delete from database
    if (database.isPostgres) {
      const result = await database.pool.query('DELETE FROM content WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Content item not found' });
      }
    } else {
      // JSON file fallback
      const db = database.readJSONDB();
      const originalLength = db.content.length;
      db.content = db.content.filter(item => item.id !== id);
      
      if (db.content.length === originalLength) {
        return res.status(404).json({ error: 'Content item not found' });
      }
      
      database.writeJSONDB(db);
    }
    
    // Also remove from vector database if it exists
    try {
      await vectorEngine.removeFromCollection(id);
      console.log(`✅ Removed item ${id} from vector database`);
    } catch (vectorError) {
      console.warn(`⚠️ Could not remove item ${id} from vector database:`, vectorError.message);
      // Don't fail the whole operation if vector removal fails
    }
    
    console.log(`✅ Successfully deleted content item: ${id}`);
    res.json({ success: true, message: 'Content item deleted successfully' });
    
  } catch (error) {
    console.error('❌ Error deleting content:', error);
    res.status(500).json({ error: 'Failed to delete content item' });
  }
});

// RAG Query endpoint - the main intelligent search
app.post('/api/rag/query', authenticate, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
    }
    
    console.log(`Processing RAG query: "${query}"`);
    
    const result = await ragProcessor.processQuery(query, options);
    
    res.json(result);
  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({ 
      error: 'Failed to process RAG query',
      details: error.message 
    });
  }
});

// Semantic search endpoint (lower-level access)
app.post('/api/vector/search', authenticate, async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        error: 'Query is required and must be a string' 
      });
    }
    
    const result = await vectorEngine.semanticSearch(query, options);
    
    res.json(result);
  } catch (error) {
    console.error('Vector search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform vector search',
      details: error.message 
    });
  }
});

// Vector database stats
app.get('/api/vector/stats', async (req, res) => {
  try {
    const stats = await vectorEngine.getCollectionStats();
    res.json(stats);
  } catch (error) {
    console.error('Vector stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get vector database stats',
      details: error.message 
    });
  }
});

// Sync existing content to vector database
app.post('/api/vector/sync', authenticate, async (req, res) => {
  try {
    const db = readDB();
    const allContent = [...(db.content || []), ...(db.notes || [])];
    
    const results = [];
    let synced = 0;
    let failed = 0;
    
    for (const item of allContent) {
      try {
        // Convert legacy notes to new format if needed
        const contentItem = item.content ? item : {
          ...item,
          id: item.id || Math.floor(Date.now() + Math.random() * 1000),
          type: 'text',
          cleanedContent: item.content,
          importanceScore: 1.0,
          submissionCount: 1,
          contextualTags: []
        };
        
        const result = await vectorEngine.addContent(contentItem);
        results.push(result);
        
        if (result.success) synced++;
        else failed++;
      } catch (error) {
        console.error('Error syncing item:', error);
        results.push({ success: false, error: error.message, id: item.id });
        failed++;
      }
    }
    
    res.json({
      success: true,
      totalItems: allContent.length,
      synced,
      failed,
      results
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync content to vector database',
      details: error.message 
    });
  }
});

// Newsletter generation endpoints
app.post('/api/newsletter/generate', authenticate, async (req, res) => {
  try {
    const { 
      timeframe = 'week',
      format = 'html',
      includeAnalytics = true,
      includeTrends = true,
      includeRecommendations = true
    } = req.body;
    
    console.log(`Generating ${timeframe} newsletter in ${format} format...`);
    
    const newsletter = await newsletterGenerator.generateWeeklyNewsletter({
      timeframe,
      format,
      includeAnalytics,
      includeTrends,
      includeRecommendations
    });
    
    res.json(newsletter);
  } catch (error) {
    console.error('Newsletter generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate newsletter',
      details: error.message 
    });
  }
});

// Quick newsletter preview
app.get('/api/newsletter/preview', async (req, res) => {
  try {
    const newsletter = await newsletterGenerator.generateWeeklyNewsletter({
      timeframe: 'week',
      format: 'html'
    });
    
    if (newsletter.success) {
      res.setHeader('Content-Type', 'text/html');
      res.send(newsletter.content);
    } else {
      res.status(500).json(newsletter);
    }
  } catch (error) {
    console.error('Newsletter preview error:', error);
    res.status(500).json({ 
      error: 'Failed to generate newsletter preview',
      details: error.message 
    });
  }
});

// Content Sources endpoints
app.get('/api/sources/available', (req, res) => {
  try {
    res.json({
      success: true,
      sources: [
        {
          id: 'chrome_history',
          name: 'Chrome Browser History',
          description: 'Import browsing history from Google Chrome',
          requiresSetup: true
        },
        {
          id: 'safari_history',
          name: 'Safari Browser History',
          description: 'Import browsing history from Safari',
          requiresSetup: true
        },
        {
          id: 'firefox_history',
          name: 'Firefox Browser History',
          description: 'Import browsing history from Firefox',
          requiresSetup: true
        },
        {
          id: 'browser_bookmarks',
          name: 'Browser Bookmarks',
          description: 'Import bookmarks from various browsers',
          requiresSetup: false
        },
        {
          id: 'text_files',
          name: 'Text Files',
          description: 'Import content from text files in a directory',
          requiresSetup: true
        },
        {
          id: 'email_export',
          name: 'Email Export',
          description: 'Import emails from MBOX or other export formats',
          requiresSetup: true
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get available sources',
      details: error.message 
    });
  }
});

app.get('/api/sources/:sourceType/instructions', (req, res) => {
  try {
    const { sourceType } = req.params;
    
    let instructions;
    if (sourceType.includes('browser') || ['chrome_history', 'safari_history', 'firefox_history'].includes(sourceType)) {
      instructions = contentSources.getBrowserImportInstructions();
    } else if (sourceType === 'email_export') {
      instructions = contentSources.getEmailImportInstructions();
    } else {
      instructions = {
        [sourceType]: {
          steps: ['Instructions not available for this source type'],
          note: 'Please refer to documentation'
        }
      };
    }
    
    res.json({
      success: true,
      sourceType,
      instructions
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get instructions',
      details: error.message 
    });
  }
});

app.post('/api/sources/:sourceType/import', authenticate, async (req, res) => {
  try {
    const { sourceType } = req.params;
    const options = req.body;
    
    console.log(`Importing from ${sourceType} with options:`, options);
    
    const result = await contentSources.importFromSource(sourceType, options);
    
    if (result.success && result.items.length > 0) {
      // Process and add imported items to the main content system
      const db = readDB();
      const processedItems = [];
      
      for (const item of result.items) {
        try {
          // Convert imported item to our content format
          const contentItem = {
            id: Math.floor(Date.now() + Math.random() * 1000),
            type: item.type,
            content: item.content,
            extractedText: item.extractedText,
            timestamp: new Date().toISOString(),
            metadata: {
              ...item.metadata,
              importedFrom: sourceType,
              importedAt: new Date().toISOString()
            },
            importanceScore: 1.0,
            submissionCount: 1,
            contextualTags: ['imported', sourceType.replace('_', '-')]
          };
          
          // Add to database
          db.content = db.content || [];
          db.content.push(contentItem);
          
          // Add to vector store
          try {
            const vectorResult = await vectorEngine.addContent(contentItem);
            contentItem.vectorized = vectorResult.success;
          } catch (vectorError) {
            console.warn('Failed to vectorize imported item:', vectorError);
            contentItem.vectorized = false;
          }
          
          processedItems.push(contentItem);
        } catch (itemError) {
          console.error('Error processing imported item:', itemError);
        }
      }
      
      writeDB(db);
      
      res.json({
        success: true,
        sourceType,
        imported: processedItems.length,
        vectorized: processedItems.filter(item => item.vectorized).length,
        items: processedItems.slice(0, 10), // Return first 10 for preview
        totalItems: processedItems.length
      });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Failed to import from source',
      details: error.message,
      sourceType: req.params.sourceType
    });
  }
});

// Regenerate summary for a specific content item
app.post('/api/content/:id/regenerate-summary', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Regenerating summary for content ID: ${id}`);
    
    // Convert ID to appropriate type (string for JSON, number for some DBs)
    const contentId = database.isPostgres ? id : id.toString();
    
    const content = await database.getContentById(contentId);
    console.log('📄 Found content:', content ? 'Yes' : 'No');
    
    if (!content) {
      console.log('❌ Content not found for ID:', contentId);
      return res.status(404).json({ error: 'Content not found' });
    }

    // Extract text content for summary generation
    let textContent = content.extractedContent || content.cleanedContent || content.content;
    console.log('📝 Content analysis:');
    console.log('  - extractedContent length:', content.extractedContent ? content.extractedContent.length : 0);
    console.log('  - cleanedContent length:', content.cleanedContent ? content.cleanedContent.length : 0);
    console.log('  - content length:', content.content ? content.content.length : 0);
    console.log('  - selected textContent preview:', textContent ? textContent.substring(0, 100) + '...' : 'none');
    
    if (!textContent || textContent.trim().length < 10) {
      console.log('❌ Insufficient text content');
      return res.status(400).json({ error: 'No text content available for summary generation' });
    }

    // For URL content, if we only have the URL, try to re-extract content
    if (content.type === 'url' && textContent === content.content) {
      console.log('🔄 URL content appears to be just the URL, attempting re-extraction...');
      try {
        const urlMetadata = await extractUrlMetadata(content.content);
        if (urlMetadata.content && urlMetadata.content.length > 100) {
          textContent = contentProcessor.cleanContent(urlMetadata.content);
          console.log('✅ Re-extracted content length:', textContent.length);
          
          // Update the database with the extracted content for future use
          const updatedContent = {
            ...content,
            extractedContent: urlMetadata.content,
            cleanedContent: textContent,
            metadata: {
              ...content.metadata,
              ...urlMetadata,
              contentReExtracted: new Date().toISOString()
            }
          };
          await database.updateContent(contentId, updatedContent);
          console.log('💾 Updated content with re-extracted data');
        } else {
          console.log('❌ Re-extraction failed or returned insufficient content');
        }
      } catch (extractError) {
        console.log('❌ Re-extraction error:', extractError.message);
        // Continue with original content
      }
    }

    console.log('🤖 Generating summary with OpenAI...');
    
    // Generate new summary
    const summary = await contentProcessor.generateSummary(
      textContent, 
      content.type, 
      content.metadata?.title || ''
    );
    
    console.log('✅ Summary generated:', summary ? summary.substring(0, 50) + '...' : 'null');

    // Update the content with new summary
    const updatedContent = {
      ...content,
      summary: summary,
      metadata: {
        ...content.metadata,
        hasSummary: true,
        summaryRegeneratedAt: new Date().toISOString()
      }
    };

    console.log('💾 Updating content in database...');
    await database.updateContent(contentId, updatedContent);
    console.log('✅ Content updated successfully');

    res.json({
      success: true,
      id: contentId,
      summary: summary,
      regeneratedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error regenerating summary:', error);
    res.status(500).json({ 
      error: 'Failed to regenerate summary',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Debug endpoint to check what's in the database
app.get('/api/debug/content', async (req, res) => {
  try {
    const allContent = await database.getAllContent();
    const allNotes = await database.getAllNotes();
    
    const response = {
      totalContent: allContent.length,
      totalNotes: allNotes.length,
      recentContent: allContent.slice(-5).map(item => ({
        id: item.id,
        type: item.type,
        content: item.content?.substring(0, 100) || 'No content',
        timestamp: item.timestamp,
        metadata: item.metadata
      })),
      allContentIds: allContent.map(item => item.id)
    };
    
    console.log('Debug response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Database cleanup endpoints
app.get('/api/cleanup/preview', async (req, res) => {
  try {
    const DatabaseCleanup = require('./cleanup-database');
    const cleanup = new DatabaseCleanup();
    
    const categories = await cleanup.analyzeContent();
    
    const summary = {
      total: categories.valuable.length + categories.test.length + categories.trash.length + categories.questionable.length,
      valuable: categories.valuable.length,
      test: categories.test.length,
      trash: categories.trash.length,
      questionable: categories.questionable.length,
      toDelete: categories.test.length + categories.trash.length,
      categories: {
        valuable: categories.valuable.map(item => ({
          id: item.id,
          type: item.type,
          content: item.content?.substring(0, 100) || 'No content',
          timestamp: item.timestamp,
          importanceScore: item.importanceScore
        })),
        test: categories.test.map(item => ({
          id: item.id,
          type: item.type,
          content: item.content?.substring(0, 100) || 'No content',
          reason: 'Test content detected'
        })),
        trash: categories.trash.map(item => ({
          id: item.id,
          type: item.type,
          content: item.content?.substring(0, 100) || 'No content',
          reason: 'Trash content detected'
        })),
        questionable: categories.questionable.map(item => ({
          id: item.id,
          type: item.type,
          content: item.content?.substring(0, 100) || 'No content',
          reason: 'Questionable content - needs review'
        }))
      }
    };
    
    await cleanup.close();
    res.json(summary);
  } catch (error) {
    console.error('Cleanup preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cleanup/execute', authenticate, async (req, res) => {
  try {
    const { deleteTest = true, deleteTrash = true, deleteQuestionable = false } = req.body;
    
    const DatabaseCleanup = require('./cleanup-database');
    const cleanup = new DatabaseCleanup();
    
    const categories = await cleanup.analyzeContent();
    const deletedCount = await cleanup.performCleanup(categories, {
      deleteTest,
      deleteTrash,
      deleteQuestionable
    });
    
    const finalContent = await database.getAllContent();
    
    await cleanup.close();
    
    res.json({
      success: true,
      deletedCount,
      remainingCount: finalContent.length,
      summary: `Deleted ${deletedCount} items. ${finalContent.length} items remaining.`
    });
  } catch (error) {
    console.error('Cleanup execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Consolidated iOS share endpoint - handles all sharing scenarios
app.all(['/ios-share', '/share'], upload.array('files'), async (req, res) => {
  // Set headers immediately for maximum iOS compatibility
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  });

  try {
    console.log('📱 iOS SHARE REQUEST');
    console.log('Query params:', req.query);
    console.log('Raw query string:', req.url);
    console.log('User-Agent:', req.headers['user-agent']);
    
    // Debug: Log each parameter individually
    console.log('Individual params:');
    console.log('- content:', req.query.content);
    console.log('- url:', req.query.url);
    console.log('- text:', req.query.text);
    console.log('- title:', req.query.title);
    
    // Enhanced parameter extraction - handle GET query, POST body, and files
    const queryParams = req.query || {};
    const bodyParams = req.body || {};
    const files = req.files || [];
    
    console.log('📄 Files received:', files.length);
    
    // Comprehensive parameter extraction with multiple fallbacks
    const extractedData = {
      text: queryParams.text || bodyParams.text || queryParams.t || bodyParams.t || 
            queryParams.content || bodyParams.content || '',
      url: queryParams.url || bodyParams.url || queryParams.u || bodyParams.u || 
           queryParams.link || bodyParams.link || '',
      title: queryParams.title || bodyParams.title || queryParams.name || bodyParams.name || 
             queryParams.subject || bodyParams.subject || '',
      source: queryParams.source || bodyParams.source || 'ios_consolidated'
    };
    
    console.log('📋 Extracted data:', extractedData);
    
    // Validate we have some content (text, URL, title, or files)
    const hasTextContent = extractedData.text || extractedData.url || extractedData.title;
    const hasFiles = files && files.length > 0;
    
    if (!hasTextContent && !hasFiles) {
      console.log('❌ No content provided');
      const allParams = { ...queryParams, ...bodyParams };
      return res.status(400).json({
        success: false,
        error: 'No content provided',
        message: 'Please provide text, url, title parameter, or files',
        receivedParams: Object.keys(allParams),
        receivedFiles: files.length,
        expectedParams: ['text', 'url', 'title', 't', 'u', 'content', 'link', 'name']
      });
    }
    
    const existingContent = await database.getAllContent();
    const processedItems = [];
    
    // Process text/URL content if present
    if (hasTextContent) {
      let contentType = 'text';
      let primaryContent = extractedData.text || extractedData.title;
      
      if (extractedData.url) {
        contentType = 'url';
        primaryContent = extractedData.url;
        
        // Quick URL validation
        try {
          new URL(extractedData.url);
          console.log('✅ Valid URL detected');
        } catch {
          console.log('⚠️ Invalid URL, treating as text');
          contentType = 'text';
          primaryContent = [extractedData.title, extractedData.text, extractedData.url].filter(Boolean).join(' ');
        }
      }
    
      // Create content item for text/URL
      const contentItem = {
        type: contentType,
        content: primaryContent,
        metadata: {
          title: extractedData.title || (contentType === 'url' ? 'Shared URL' : 'Shared Text'),
          sharedVia: extractedData.source,
          shareMethod: 'ios_consolidated_endpoint',
          originalText: extractedData.text,
          originalUrl: extractedData.url,
          shareTimestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent']
        }
      };
    
      console.log('🔄 Processing text content...');
      
      // Process the content with timeout protection
      const processed = await Promise.race([
        processContentItem(contentItem, existingContent),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout after 15 seconds')), 15000)
        )
      ]);
      
      console.log('✅ Text content processed');
      
      // Save to database with retry
      await database.insertContent(processed);
      processedItems.push(processed);
      
      // Add to vector database (non-blocking)
      vectorEngine.addContent(processed)
        .then(() => console.log('✅ Text content vectorized'))
        .catch(err => console.warn('⚠️ Vector failed (non-critical):', err.message));
    }
    
    // Process files if present
    for (const file of files) {
      console.log(`📄 Processing file: ${file.originalname}`);
      
      const extractionResult = await contentProcessor.processFile(
        file.path, 
        file.mimetype, 
        file.originalname
      );
      
      const fileItem = {
        type: 'file',
        content: extractionResult.extractedText || file.originalname,
        metadata: {
          ...extractionResult.metadata,
          sharedVia: extractedData.source,
          shareMethod: 'ios_consolidated_endpoint',
          uploadPath: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          processingSuccess: extractionResult.success,
          processingError: extractionResult.error,
          shareTimestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent']
        }
      };
      
      const processedFile = await processContentItem(fileItem, existingContent);
      await database.insertContent(processedFile);
      processedItems.push(processedFile);
      
      // Add to vector database if text extraction succeeded
      if (extractionResult.success && extractionResult.extractedText) {
        vectorEngine.addContent(processedFile)
          .then(() => console.log(`✅ File ${file.originalname} vectorized`))
          .catch(err => console.warn(`⚠️ File vectorization failed: ${err.message}`));
      }
    }
    
    // Return success response
    const response = {
      success: true,
      message: 'Content shared successfully to ZONEd!',
      itemsProcessed: processedItems.length,
      timestamp: new Date().toISOString(),
      items: processedItems.map(item => ({
        id: item.id,
        type: item.type,
        title: item.metadata?.title || 'Untitled'
      }))
    };
    
    console.log(`✅ iOS share complete - ${processedItems.length} items processed`);
    
    // Handle different response formats
    if (req.headers['user-agent']?.includes('Shortcuts') || req.query.format === 'json') {
      return res.json(response);
    } else {
      const successUrl = `/share-success?items=${processedItems.length}`;
      return res.redirect(successUrl);
    }
    
  } catch (error) {
    console.error('❌ iOS share error:', error);
    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Note: Duplicate iOS sharing endpoints removed - now handled by consolidated endpoint above

// Auto-load existing content on startup
async function initializeVectorDatabase() {
  try {
    // Skip vector initialization in production to prevent deployment timeouts
    if (process.env.NODE_ENV === 'production') {
      console.log('⚡ Skipping vector initialization in production - will initialize lazily');
      return;
    }
    
    console.log('Initializing vector database with existing content...');
    
    // Add delay to ensure tables are fully created
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const content = await database.getAllContent();
    const notes = await database.getAllNotes();
    const allContent = [...content, ...notes];
    
    if (allContent.length > 0) {
      console.log(`Found ${allContent.length} items to vectorize`);
      
      // Process a few key items to get started
      const keyItems = allContent.slice(0, 5); // Just first 5 items to avoid crashes
      
      for (const item of keyItems) {
        try {
          let contentItem;
          if (item.content && !item.type) {
            // Legacy content from notes array
            contentItem = {
              ...item,
              id: item.id || Math.floor(Date.now() + Math.random() * 1000),
              type: 'text',
              cleanedContent: item.content,
              submissionCount: 1,
              contextualTags: []
            };
          } else {
            // Modern content with proper structure
            contentItem = item;
          }
          
          // Calculate proper importance score if not already set
          if (!contentItem.importanceScore) {
            const submissions = [{ timestamp: contentItem.timestamp }];
            const ImportanceEngine = require('./importanceEngine');
            const importanceEngine = new ImportanceEngine();
            contentItem.importanceScore = importanceEngine.calculateImportanceScore(submissions);
          }
          
          await vectorEngine.addContent(contentItem);
          console.log(`✓ Vectorized: ${contentItem.id} (importance: ${contentItem.importanceScore})`);
        } catch (error) {
          console.log(`✗ Failed to vectorize: ${item.id}`);
        }
      }
      
      console.log('Vector database initialized with existing content');
    }
  } catch (error) {
    console.log('Could not initialize vector database:', error.message);
    console.log('This is normal for a fresh database - vector content will be added as new items are submitted');
  }
}

// Handle React routing, return all requests to React app (must be last)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/share')) {
      res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
    }
  });
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await database.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  await database.close();
  process.exit(0);
});

// Start server with minimal initialization to prevent timeouts
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database: ${database.isPostgres ? 'PostgreSQL' : 'JSON file'}`);
  
  // Only initialize vector DB in development
  if (process.env.NODE_ENV !== 'production') {
    setImmediate(() => {
      if (typeof initializeVectorDatabase === 'function') {
        initializeVectorDatabase().catch(error => {
          console.warn('⚠️ Vector database initialization failed (non-critical):', error.message);
        });
      }
    });
  } else {
    console.log('⚡ Production mode: Vector database will initialize lazily');
  }
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
