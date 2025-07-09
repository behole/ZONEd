class SimpleVectorEngine {
  constructor(options = {}) {
    this.documents = new Map(); // id -> {embedding, document, metadata}
    this.embeddingModel = null;
    this.useOpenAI = options.useOpenAI || false;
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    
    // Initialize the embedding model
    this.initializeEmbedding();
  }

  async initializeEmbedding() {
    try {
      if (this.useOpenAI && this.openaiApiKey) {
        console.log('Using OpenAI embeddings...');
        const { OpenAI } = require('openai');
        this.openai = new OpenAI({ apiKey: this.openaiApiKey });
      } else {
        console.log('Loading local embedding model (this may take a moment)...');
        try {
          const { pipeline } = await import('@xenova/transformers');
          this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
          console.log('Local embedding model loaded successfully!');
        } catch (transformerError) {
          console.warn('Failed to load local embedding model (likely sharp issue):', transformerError.message);
          console.log('Falling back to basic text matching without embeddings...');
          this.embeddingModel = null;
          this.fallbackMode = true;
        }
      }
    } catch (error) {
      console.error('Error initializing embedding model:', error);
      console.log('Continuing without embeddings - using basic text search...');
      this.fallbackMode = true;
    }
  }

  async generateEmbedding(text) {
    try {
      if (this.useOpenAI && this.openai) {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });
        return response.data[0].embedding;
      } else {
        if (this.fallbackMode) {
          // Return a simple hash-based "embedding" for basic functionality
          return this.generateSimpleHash(text);
        }
        if (!this.embeddingModel) {
          await this.initializeEmbedding();
        }
        if (this.fallbackMode) {
          return this.generateSimpleHash(text);
        }
        const output = await this.embeddingModel(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      console.log('Falling back to simple hash...');
      return this.generateSimpleHash(text);
    }
  }

  generateSimpleHash(text) {
    // Simple hash-based "embedding" for fallback
    const words = text.toLowerCase().split(/\s+/).slice(0, 50); // First 50 words
    const hash = new Array(384).fill(0); // Similar size to real embeddings
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const charCode = word.charCodeAt(j);
        hash[(i * 7 + j * 13 + charCode) % 384] += 1;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(hash.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? hash.map(val => val / magnitude) : hash;
  }

  async addContent(contentItem) {
    try {
      const textToEmbed = this.prepareTextForEmbedding(contentItem);
      const embedding = await this.generateEmbedding(textToEmbed);
      const metadata = this.prepareMetadata(contentItem);
      
      this.documents.set(contentItem.id.toString(), {
        embedding,
        document: textToEmbed,
        metadata
      });

      console.log(`Added content to vector store: ${contentItem.id} (importance: ${contentItem.importanceScore})`);
      
      return {
        success: true,
        id: contentItem.id,
        embeddingDimensions: embedding.length,
        textLength: textToEmbed.length
      };
    } catch (error) {
      console.error('Error adding content to vector store:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  prepareTextForEmbedding(contentItem) {
    const textParts = [];
    
    if (contentItem.cleanedContent) {
      textParts.push(contentItem.cleanedContent);
    } else if (contentItem.content) {
      textParts.push(contentItem.content);
    }
    
    if (contentItem.extractedContent) {
      textParts.push(contentItem.extractedContent);
    }
    
    if (contentItem.metadata) {
      if (contentItem.metadata.title) textParts.push(contentItem.metadata.title);
      if (contentItem.metadata.description) textParts.push(contentItem.metadata.description);
    }
    
    if (contentItem.keywords && contentItem.keywords.length > 0) {
      const keywordText = contentItem.keywords.map(k => k.word).join(' ');
      textParts.push(`Keywords: ${keywordText}`);
    }
    
    if (contentItem.contextualTags && contentItem.contextualTags.length > 0) {
      textParts.push(`Context: ${contentItem.contextualTags.join(' ')}`);
    }
    
    return textParts.join('\n\n').trim();
  }

  prepareMetadata(contentItem) {
    return {
      originalId: contentItem.id.toString(),
      type: contentItem.type,
      timestamp: contentItem.timestamp,
      importanceScore: contentItem.importanceScore || 1.0,
      submissionCount: contentItem.submissionCount || 1,
      urgencyLevel: contentItem.urgencyAssessment?.level || 'normal',
      lastSubmission: contentItem.lastSubmission || contentItem.timestamp,
      velocity: contentItem.submissionPatterns?.velocity || 'low',
      trend: contentItem.submissionPatterns?.trend || 'stable',
      wordCount: contentItem.metadata?.wordCount || 0,
      chunkCount: contentItem.metadata?.chunkCount || 1,
      sources: JSON.stringify(contentItem.submissionPatterns?.submissionSources || {}),
      contextualTags: JSON.stringify(contentItem.contextualTags || []),
      domain: contentItem.metadata?.domain || null,
      url: contentItem.metadata?.url || null,
      fileName: contentItem.metadata?.fileName || null,
      fileType: contentItem.metadata?.fileType || null
    };
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async semanticSearch(query, options = {}) {
    try {
      const {
        limit = 10,
        importanceThreshold = 0,
        urgencyFilter = null,
        typeFilter = null,
        timeFilter = null
      } = options;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarities for all documents
      const results = [];
      
      for (const [id, doc] of this.documents) {
        // Apply filters
        if (importanceThreshold > 0 && doc.metadata.importanceScore < importanceThreshold) {
          continue;
        }
        
        if (urgencyFilter && doc.metadata.urgencyLevel !== urgencyFilter) {
          continue;
        }
        
        if (typeFilter && doc.metadata.type !== typeFilter) {
          continue;
        }
        
        if (timeFilter) {
          const now = new Date();
          const itemDate = new Date(doc.metadata.timestamp);
          const hoursAgo = (now - itemDate) / (1000 * 60 * 60);
          
          let shouldInclude = false;
          switch (timeFilter) {
            case 'today':
              shouldInclude = hoursAgo <= 24;
              break;
            case 'week':
              shouldInclude = hoursAgo <= 168;
              break;
            case 'month':
              shouldInclude = hoursAgo <= 720;
              break;
            default:
              shouldInclude = true;
          }
          
          if (!shouldInclude) continue;
        }
        
        // Calculate similarity
        const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
        const distance = 1 - similarity;
        
        // Calculate composite score
        const semanticScore = similarity;
        const importanceScore = doc.metadata.importanceScore || 1.0;
        const urgencyMultiplier = this.getUrgencyMultiplier(doc.metadata.urgencyLevel);
        const recencyMultiplier = this.getRecencyMultiplier(doc.metadata.lastSubmission);
        
        const compositeScore = (
          semanticScore * 0.4 +
          (importanceScore / 10) * 0.3 +
          urgencyMultiplier * 0.2 +
          recencyMultiplier * 0.1
        );
        
        results.push({
          id,
          document: doc.document,
          metadata: doc.metadata,
          scores: {
            composite: compositeScore,
            semantic: semanticScore,
            importance: importanceScore,
            urgency: urgencyMultiplier,
            recency: recencyMultiplier
          },
          distance,
          relevanceReason: this.explainRelevance(doc.metadata, semanticScore)
        });
      }
      
      // Sort by composite score and limit results
      results.sort((a, b) => b.scores.composite - a.scores.composite);
      
      return {
        success: true,
        query,
        results: results.slice(0, limit),
        totalFound: results.length
      };
    } catch (error) {
      console.error('Error in semantic search:', error);
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  getUrgencyMultiplier(urgencyLevel) {
    switch (urgencyLevel) {
      case 'high': return 1.0;
      case 'medium': return 0.7;
      case 'normal': return 0.5;
      default: return 0.5;
    }
  }

  getRecencyMultiplier(lastSubmission) {
    const now = new Date();
    const submissionDate = new Date(lastSubmission);
    const hoursAgo = (now - submissionDate) / (1000 * 60 * 60);
    
    return Math.max(0.1, Math.exp(-hoursAgo / (7 * 24)));
  }

  explainRelevance(metadata, semanticScore) {
    const reasons = [];
    
    if (semanticScore > 0.8) reasons.push('high semantic match');
    if (metadata.importanceScore > 5) reasons.push('high importance');
    if (metadata.urgencyLevel === 'high') reasons.push('marked urgent');
    if (metadata.submissionCount > 2) reasons.push('multiple submissions');
    if (metadata.velocity === 'high') reasons.push('trending topic');
    
    return reasons.length > 0 ? reasons.join(', ') : 'semantic similarity';
  }

  async updateContent(contentItem) {
    try {
      return await this.addContent(contentItem);
    } catch (error) {
      console.error('Error updating content in vector store:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteContent(contentId) {
    try {
      this.documents.delete(contentId.toString());
      return { success: true };
    } catch (error) {
      console.error('Error deleting content from vector store:', error);
      return { success: false, error: error.message };
    }
  }

  async getCollectionStats() {
    try {
      return {
        totalDocuments: this.documents.size,
        collectionName: 'simple_vector_store',
        embeddingModel: this.useOpenAI ? 'OpenAI' : 'Local (all-MiniLM-L6-v2)'
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = SimpleVectorEngine;