
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
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
      // Semantic HTML first
      'article[role="main"]',
      'main article',
      'article',
      'main',
      '[role="main"]',
      
      // Common content containers
      '.post-content, .entry-content, .article-content',
      '.content-body, .article-body, .post-body',
      '.story-body, .story-content',
      '.text-content, .main-content',
      
      // Platform-specific selectors
      '.notion-page-content',
      '.medium-content, .postArticle-content',
      '.wp-content, .entry',
      '.markdown-body',
      '.rst-content',
      '.doc-content',
      
      // Generic fallbacks
      '#content, .content',
      '#main, .main',
      '.container .row .col',
      '.page-content'
    ];
    
    // Try each selector group
    for (const selector of contentSelectors) {
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
    
    // Extract enhanced metadata
    const title = $('title').text().trim() || 
                 $('meta[property="og:title"]').attr('content') || 
                 $('h1').first().text().trim() || 
                 'No title';
                 
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') || 
                       '';
    
    const author = $('meta[name="author"]').attr('content') || 
                  $('[rel="author"]').text().trim() || 
                  $('.author').first().text().trim() || 
                  '';
    
    const publishDate = $('meta[property="article:published_time"]').attr('content') || 
                       $('time[datetime]').attr('datetime') || 
                       $('.date').first().text().trim() || 
                       '';
    
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    
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
      author: author,
      publishDate: publishDate,
      keywords: keywords,
      contentSource: contentSource,
      extractionQuality: mainContent.length > 500 ? 'high' : mainContent.length > 200 ? 'medium' : 'low',
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
      fingerprint = contentProcessor.generateFingerprint(cleanedText);
      
      processedContent = {
        ...baseItem,
        content: item.content,
        cleanedContent: cleanedText,
        chunks: chunks,
        keywords: keywords,
        fingerprint: fingerprint,
        metadata: {
          wordCount: cleanedText.split(/\s+/).filter(w => w.length > 0).length,
          charCount: cleanedText.length,
          chunkCount: chunks.length
        }
      };
      break;

    case 'url':
      const urlMetadata = await extractUrlMetadata(item.content);
      const urlCleanedContent = contentProcessor.cleanContent(urlMetadata.content);
      const urlChunks = contentProcessor.chunkContent(urlCleanedContent);
      const urlKeywords = contentProcessor.extractKeywords(urlCleanedContent);
      fingerprint = contentProcessor.generateFingerprint(urlCleanedContent);
      
      processedContent = {
        ...baseItem,
        content: item.content,
        extractedContent: urlMetadata.content,
        cleanedContent: urlCleanedContent,
        chunks: urlChunks,
        keywords: urlKeywords,
        fingerprint: fingerprint,
        metadata: {
          ...item.metadata,
          ...urlMetadata,
          chunkCount: urlChunks.length
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
app.post('/api/notes', (req, res) => {
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
app.post('/api/content', async (req, res) => {
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
app.post('/api/upload', upload.array('files'), async (req, res) => {
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
        extractedText: extractionResult.extractedText,
        processingSuccess: extractionResult.success,
        processingError: extractionResult.error,
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
    
    const db = readDB();
    db.content = db.content || [];
    db.content.push(...processedFiles);
    writeDB(db);
    
    // Add processed files to vector database
    const vectorResults = [];
    for (const file of processedFiles) {
      if (file.processingSuccess && file.extractedText) {
        try {
          const vectorResult = await vectorEngine.addContent(file);
          vectorResults.push(vectorResult);
        } catch (error) {
          console.error('Error adding file to vector DB:', error);
          vectorResults.push({ success: false, error: error.message, id: file.id });
        }
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

// RAG Query endpoint - the main intelligent search
app.post('/api/rag/query', async (req, res) => {
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
app.post('/api/vector/search', async (req, res) => {
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
app.post('/api/vector/sync', async (req, res) => {
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
app.post('/api/newsletter/generate', async (req, res) => {
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

app.post('/api/sources/:sourceType/import', async (req, res) => {
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

app.post('/api/cleanup/execute', async (req, res) => {
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

// Dedicated iOS share endpoint - bulletproof and simple (GET and POST)
app.all('/ios-share', async (req, res) => {
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
    
    // Extract parameters from both GET (query) and POST (body)
    const params = req.method === 'POST' ? req.body : req.query;
    
    const extractedData = {
      text: params.text || params.t || params.content || '',
      url: params.url || params.u || params.link || '',
      title: params.title || params.name || params.subject || '',
      source: params.source || 'ios_shortcut'
    };
    
    console.log('📋 Extracted data:', extractedData);
    
    // Validate we have some content
    const hasContent = extractedData.text || extractedData.url || extractedData.title;
    
    if (!hasContent) {
      console.log('❌ No content provided');
      return res.status(400).json({
        success: false,
        error: 'No content provided',
        message: 'Please provide text, url, or title parameter',
        receivedParams: Object.keys(req.query),
        expectedParams: ['text', 'url', 'title', 't', 'u', 'content', 'link', 'name']
      });
    }
    
    // Determine content type and primary content
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
    
    // Create simplified content item
    const contentItem = {
      type: contentType,
      content: primaryContent,
      metadata: {
        title: extractedData.title || (contentType === 'url' ? 'Shared URL' : 'Shared Text'),
        sharedVia: 'ios_shortcut',
        shareMethod: 'ios_dedicated_endpoint',
        originalText: extractedData.text,
        originalUrl: extractedData.url,
        shareTimestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent']
      }
    };
    
    console.log('🔄 Processing content...');
    
    // Get existing content for deduplication
    const existingContent = await database.getAllContent();
    
    // Process the content with timeout protection
    const processed = await Promise.race([
      processContentItem(contentItem, existingContent),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout after 10 seconds')), 10000)
      )
    ]);
    
    console.log('✅ Content processed');
    
    // Save to database with simple retry
    try {
      await database.insertContent(processed);
      console.log('✅ Saved to database');
    } catch (dbError) {
      console.error('❌ Database save failed:', dbError.message);
      // Try once more
      await new Promise(resolve => setTimeout(resolve, 500));
      await database.insertContent(processed);
      console.log('✅ Saved to database (retry)');
    }
    
    // Add to vector database (non-blocking, don't wait)
    vectorEngine.addContent(processed)
      .then(() => console.log('✅ Vectorized'))
      .catch(err => console.warn('⚠️ Vector failed (non-critical):', err.message));
    
    // Return immediate success response
    const response = {
      success: true,
      message: 'Content shared successfully to ZONEd!',
      contentType: contentType,
      itemsProcessed: 1,
      timestamp: new Date().toISOString(),
      id: processed.id
    };
    
    console.log('✅ iOS share complete');
    return res.json(response);
    
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

// Ultra-reliable iOS share handler - bulletproof version
app.get('/share', async (req, res) => {
  // Set headers immediately for iOS compatibility
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  try {
    console.log('=== iOS SHARE REQUEST (GET) ===');
    console.log('Query params:', req.query);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('User-Agent:', req.headers['user-agent']);
    
    const { text, url, title, source } = req.query;
    
    // Enhanced parameter extraction - handle various iOS shortcut formats
    const extractedData = {
      text: text || req.query.t || req.query.content,
      url: url || req.query.u || req.query.link,
      title: title || req.query.title || req.query.name,
      source: source || 'ios_shortcut'
    };
    
    console.log('Extracted share data:', extractedData);
    
    if (extractedData.text || extractedData.url || extractedData.title) {
      console.log('✅ Valid share content found');
      
      // Determine content type more intelligently
      let contentType = 'text';
      let primaryContent = extractedData.text || extractedData.title || '';
      
      if (extractedData.url) {
        contentType = 'url';
        primaryContent = extractedData.url;
        
        // Validate URL format
        try {
          new URL(extractedData.url);
          console.log('✅ Valid URL format detected');
        } catch (urlError) {
          console.log('⚠️ Invalid URL format, treating as text');
          contentType = 'text';
          primaryContent = [extractedData.title, extractedData.text, extractedData.url].filter(Boolean).join('\n');
        }
      }
      
      const existingContent = await database.getAllContent();
      console.log('📊 Current DB content count:', existingContent.length);
      
      // Create content item with enhanced metadata
      const contentItem = {
        type: contentType,
        content: primaryContent,
        metadata: {
          title: extractedData.title || (contentType === 'url' ? 'Shared URL' : 'Shared Text'),
          sharedVia: extractedData.source,
          shareMethod: 'ios_get_request',
          originalText: extractedData.text,
          originalUrl: extractedData.url,
          shareTimestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          // Enhanced context for better processing
          shareContext: {
            hasText: !!extractedData.text,
            hasUrl: !!extractedData.url,
            hasTitle: !!extractedData.title,
            contentLength: primaryContent.length
          }
        }
      };
      
      console.log('🔄 Processing shared item...');
      
      // Use enhanced processing with timeout protection
      const processed = await Promise.race([
        processContentItem(contentItem, existingContent),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), 15000)
        )
      ]);
      
      console.log('✅ Content processed successfully');
      
      // Save to database with retry logic
      let saveAttempts = 0;
      const maxSaveAttempts = 3;
      
      while (saveAttempts < maxSaveAttempts) {
        try {
          await database.insertContent(processed);
          console.log('✅ Shared item saved to database');
          break;
        } catch (saveError) {
          saveAttempts++;
          console.warn(`⚠️ Database save attempt ${saveAttempts} failed:`, saveError.message);
          if (saveAttempts >= maxSaveAttempts) {
            throw saveError;
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Add to vector database (non-blocking)
      vectorEngine.addContent(processed)
        .then(() => console.log('✅ Shared content vectorized successfully'))
        .catch(vectorError => console.warn('⚠️ Vector processing failed (non-critical):', vectorError.message));
      
      console.log('=== SHARE SUCCESS ===');
      
      // Enhanced success response with better iOS compatibility
      const successUrl = `/share-success?items=1&type=${contentType}&source=${extractedData.source}`;
      
      // For iOS shortcuts, provide both redirect and JSON response
      if (req.headers['user-agent']?.includes('Shortcuts') || req.query.format === 'json') {
        res.json({
          success: true,
          message: 'Content shared successfully',
          contentType: contentType,
          itemsProcessed: 1,
          redirectUrl: successUrl
        });
      } else {
        res.redirect(successUrl);
      }
      
    } else {
      console.log('❌ No valid share content provided');
      console.log('Available query params:', Object.keys(req.query));
      
      // Provide helpful error information
      const errorUrl = `/share-error?reason=no_content&params=${encodeURIComponent(JSON.stringify(Object.keys(req.query)))}`;
      
      if (req.headers['user-agent']?.includes('Shortcuts') || req.query.format === 'json') {
        res.status(400).json({
          success: false,
          error: 'No valid content provided',
          availableParams: Object.keys(req.query),
          expectedParams: ['text', 'url', 'title', 't', 'u', 'content', 'link'],
          redirectUrl: errorUrl
        });
      } else {
        res.redirect(errorUrl);
      }
    }
  } catch (error) {
    console.error('❌ Share processing error:', error);
    console.error('Error stack:', error.stack);
    
    const errorUrl = `/share-error?reason=processing_error&message=${encodeURIComponent(error.message)}`;
    
    if (req.headers['user-agent']?.includes('Shortcuts') || req.query.format === 'json') {
      res.status(500).json({
        success: false,
        error: 'Processing failed',
        details: error.message,
        redirectUrl: errorUrl
      });
    } else {
      res.redirect(errorUrl);
    }
  }
});

// Share handler endpoint for PWA Web Share Target API
app.post('/share', upload.array('files'), async (req, res) => {
  try {
    console.log('Received share request:', req.body);
    console.log('Shared files:', req.files);
    
    const { title, text, url } = req.body;
    const sharedFiles = req.files || [];
    
    const existingContent = await database.getAllContent();
    const processedItems = [];
    
    // Process shared text/URL content
    if (text || url || title) {
      const contentText = [title, text, url].filter(Boolean).join('\n');
      const contentItem = {
        type: url ? 'url' : 'text',
        content: url || contentText
      };
      
      // Process the content item
      const processed = await processContentItem(contentItem, existingContent);
      
      // Add share-specific metadata after processing
      processed.metadata = {
        ...processed.metadata,
        title: title || 'Shared content',
        sharedVia: 'ios_share_sheet',
        originalText: text,
        originalUrl: url
      };
      
      await database.insertContent(processed);
      processedItems.push(processed);
      
      // Add to vector database
      try {
        await vectorEngine.addContent(processed);
      } catch (vectorError) {
        console.warn('Failed to vectorize shared content:', vectorError);
      }
    }
    
    // Process shared files
    for (const file of sharedFiles) {
      console.log(`Processing shared file: ${file.originalname}`);
      
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
          sharedVia: 'ios_share_sheet',
          uploadPath: file.path,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          processingSuccess: extractionResult.success,
          processingError: extractionResult.error
        }
      };
      
      // Process the file item using the same function as other content
      const processed = await processContentItem(fileItem, existingContent);
      await database.insertContent(processed);
      processedItems.push(processed);
      
      // Add to vector database if text extraction succeeded
      if (extractionResult.success && extractionResult.extractedText) {
        try {
          await vectorEngine.addContent(processed);
        } catch (vectorError) {
          console.warn('Failed to vectorize shared file:', vectorError);
        }
      }
    }
    
    // Redirect to share success page
    res.redirect(`/share-success?items=${processedItems.length}`);
    
  } catch (error) {
    console.error('POST Share processing error:', error);
    console.error('Error stack:', error.stack);
    res.redirect('/share-error');
  }
});

// Auto-load existing content on startup
async function initializeVectorDatabase() {
  try {
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
  
  // Initialize vector DB in background (non-blocking)
  setImmediate(() => {
    console.log(`📊 Database: ${database.isPostgres ? 'PostgreSQL' : 'JSON file'}`);
    
    // Delayed vector DB initialization (optional, won't crash server)
    setTimeout(() => {
      if (typeof initializeVectorDatabase === 'function') {
        initializeVectorDatabase().catch(error => {
          console.warn('⚠️ Vector database initialization failed (non-critical):', error.message);
        });
      }
    }, 10000); // Longer delay to ensure server is stable
  });
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
