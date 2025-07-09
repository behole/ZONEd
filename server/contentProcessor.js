const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const ImportanceEngine = require('./importanceEngine');

class ContentProcessor {
  constructor() {
    this.supportedTypes = {
      'application/pdf': this.extractFromPDF,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': this.extractFromDocx,
      'application/msword': this.extractFromDoc,
      'text/plain': this.extractFromText,
      'image/jpeg': this.extractFromImage,
      'image/png': this.extractFromImage,
      'image/gif': this.extractFromImage,
      'image/webp': this.extractFromImage
    };
    this.importanceEngine = new ImportanceEngine();
  }

  async processFile(filePath, mimeType, originalName) {
    try {
      console.log(`Processing file: ${originalName} (${mimeType})`);
      
      if (!this.supportedTypes[mimeType]) {
        return {
          success: false,
          error: `Unsupported file type: ${mimeType}`,
          extractedText: '',
          metadata: { originalName, mimeType }
        };
      }

      const extractor = this.supportedTypes[mimeType].bind(this);
      const result = await extractor(filePath, originalName);
      
      return {
        success: true,
        extractedText: result.text || '',
        metadata: {
          originalName,
          mimeType,
          wordCount: result.text ? result.text.split(/\s+/).filter(w => w.length > 0).length : 0,
          charCount: result.text ? result.text.length : 0,
          ...result.metadata
        }
      };
    } catch (error) {
      console.error(`Error processing file ${originalName}:`, error);
      return {
        success: false,
        error: error.message,
        extractedText: '',
        metadata: { originalName, mimeType }
      };
    }
  }

  async extractFromPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info
      }
    };
  }

  async extractFromDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    
    return {
      text: result.value,
      metadata: {
        messages: result.messages
      }
    };
  }

  async extractFromDoc(filePath) {
    // For older .doc files, mammoth can still try
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        text: result.value,
        metadata: {
          messages: result.messages,
          note: 'Legacy DOC format - extraction may be incomplete'
        }
      };
    } catch (error) {
      return {
        text: '',
        metadata: {
          error: 'Could not extract from legacy DOC format',
          suggestion: 'Consider converting to DOCX format'
        }
      };
    }
  }

  async extractFromText(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    
    return {
      text: text,
      metadata: {
        encoding: 'utf8'
      }
    };
  }

  async extractFromImage(filePath) {
    try {
      // First, optimize image for OCR
      const optimizedBuffer = await sharp(filePath)
        .resize(null, 1000, { withoutEnlargement: true })
        .greyscale()
        .normalize()
        .toBuffer();

      // Perform OCR
      const { data: { text, confidence } } = await Tesseract.recognize(optimizedBuffer, 'eng', {
        logger: m => console.log(`OCR Progress: ${m.status} ${m.progress || ''}`)
      });

      return {
        text: text.trim(),
        metadata: {
          ocrConfidence: confidence,
          method: 'tesseract',
          note: confidence < 50 ? 'Low confidence OCR - text may be inaccurate' : 'OCR completed'
        }
      };
    } catch (error) {
      console.error('OCR Error:', error);
      return {
        text: '',
        metadata: {
          error: 'OCR failed',
          note: 'Could not extract text from image'
        }
      };
    }
  }

  // Content chunking for vector storage
  chunkContent(text, options = {}) {
    const {
      maxChunkSize = 1000,
      overlap = 200,
      preserveParagraphs = true
    } = options;

    if (!text || text.length <= maxChunkSize) {
      return [{ text, index: 0 }];
    }

    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      let chunkEnd = Math.min(currentPosition + maxChunkSize, text.length);
      
      // Try to break at sentence or paragraph boundaries
      if (preserveParagraphs && chunkEnd < text.length) {
        const nearbyNewline = text.lastIndexOf('\n\n', chunkEnd);
        const nearbySentence = text.lastIndexOf('. ', chunkEnd);
        
        if (nearbyNewline > currentPosition + maxChunkSize * 0.5) {
          chunkEnd = nearbyNewline + 2;
        } else if (nearbySentence > currentPosition + maxChunkSize * 0.5) {
          chunkEnd = nearbySentence + 2;
        }
      }

      const chunk = text.slice(currentPosition, chunkEnd).trim();
      if (chunk.length > 0) {
        chunks.push({
          text: chunk,
          index: chunks.length,
          startPos: currentPosition,
          endPos: chunkEnd
        });
      }

      // Move position forward with overlap
      currentPosition = Math.max(chunkEnd - overlap, currentPosition + 1);
    }

    return chunks;
  }

  // Content cleaning and normalization
  cleanContent(text) {
    if (!text) return '';

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Normalize quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Remove excessive punctuation
      .replace(/\.{3,}/g, '...')
      .replace(/!{2,}/g, '!')
      .replace(/\?{2,}/g, '?')
      .trim();
  }

  // Generate content fingerprint for deduplication
  generateFingerprint(text) {
    if (!text) return '';
    
    // Simple content fingerprint based on normalized text
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  // Extract keywords and tags
  extractKeywords(text, limit = 10) {
    if (!text) return [];

    // Simple keyword extraction (can be enhanced with NLP libraries)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Sort by frequency and return top keywords
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }

  isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must'
    ]);
    return stopWords.has(word);
  }

  /**
   * Find existing content by fingerprint for deduplication
   * @param {Array} existingContent - Array of existing content items
   * @param {string} fingerprint - Content fingerprint to search for
   * @returns {Object|null} Existing content item or null
   */
  findExistingContent(existingContent, fingerprint) {
    return existingContent.find(item => item.fingerprint === fingerprint) || null;
  }

  /**
   * Merge new submission with existing content
   * @param {Object} existingItem - Existing content item
   * @param {Object} newSubmission - New submission data
   * @returns {Object} Updated content item
   */
  mergeSubmissions(existingItem, newSubmission) {
    // Add new submission to the submissions array
    const submissions = existingItem.submissions || [
      {
        timestamp: existingItem.timestamp,
        source: existingItem.source || 'unknown',
        type: existingItem.type
      }
    ];

    submissions.push({
      timestamp: new Date().toISOString(),
      source: newSubmission.source || 'unknown',
      type: newSubmission.type,
      metadata: newSubmission.metadata || {}
    });

    // Sort submissions by timestamp (newest first)
    submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Calculate new importance score
    const importanceScore = this.importanceEngine.calculateImportanceScore(submissions);
    const patterns = this.importanceEngine.analyzeSubmissionPatterns(submissions);
    const urgency = this.importanceEngine.assessUrgency(importanceScore, patterns);
    const contextualTags = this.importanceEngine.generateContextualTags(patterns, importanceScore);

    // Update the existing item
    return {
      ...existingItem,
      submissions,
      importanceScore,
      submissionPatterns: patterns,
      urgencyAssessment: urgency,
      contextualTags,
      lastSubmission: submissions[0].timestamp,
      submissionCount: submissions.length,
      // Update timestamp to most recent submission
      timestamp: submissions[0].timestamp
    };
  }

  /**
   * Create initial content item with importance tracking
   * @param {Object} processedContent - Processed content data
   * @param {Object} submissionInfo - Information about this submission
   * @returns {Object} Content item with importance tracking
   */
  createContentWithImportance(processedContent, submissionInfo) {
    const submissions = [{
      timestamp: new Date().toISOString(),
      source: submissionInfo.source || 'unknown',
      type: submissionInfo.type,
      metadata: submissionInfo.metadata || {}
    }];

    const importanceScore = this.importanceEngine.calculateImportanceScore(submissions);
    const patterns = this.importanceEngine.analyzeSubmissionPatterns(submissions);
    const urgency = this.importanceEngine.assessUrgency(importanceScore, patterns);
    const contextualTags = this.importanceEngine.generateContextualTags(patterns, importanceScore);

    return {
      ...processedContent,
      submissions,
      importanceScore,
      submissionPatterns: patterns,
      urgencyAssessment: urgency,
      contextualTags,
      lastSubmission: submissions[0].timestamp,
      submissionCount: 1
    };
  }
}

module.exports = ContentProcessor;