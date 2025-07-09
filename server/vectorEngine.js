const { ChromaClient } = require('chromadb');

class VectorEngine {
  constructor(options = {}) {
    // Use default ChromaDB client (will use embedded mode)
    this.chromaClient = new ChromaClient();
    this.collectionName = options.collectionName || 'personal_data';
    this.collection = null;
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
        // Use dynamic import for ES module
        const { pipeline } = await import('@xenova/transformers');
        this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Local embedding model loaded successfully!');
      }
    } catch (error) {
      console.error('Error initializing embedding model:', error);
      throw error;
    }
  }

  async initializeCollection() {
    try {
      // Try to get existing collection
      try {
        this.collection = await this.chromaClient.getCollection({ 
          name: this.collectionName,
          embeddingFunction: { generate: this.generateEmbedding.bind(this) }
        });
        console.log(`Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        // Create new collection if it doesn't exist
        this.collection = await this.chromaClient.createCollection({ 
          name: this.collectionName,
          metadata: { 
            description: 'Personal data with importance-weighted semantic search',
            created: new Date().toISOString()
          },
          embeddingFunction: { generate: this.generateEmbedding.bind(this) }
        });
        console.log(`Created new collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Error initializing collection:', error);
      throw error;
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
        // Use local model
        if (!this.embeddingModel) {
          await this.initializeEmbedding();
        }
        const output = await this.embeddingModel(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      }
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  async addContent(contentItem) {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }

      // Prepare text for embedding (combine all relevant text)
      const textToEmbed = this.prepareTextForEmbedding(contentItem);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(textToEmbed);
      
      // Prepare metadata with importance weighting
      const metadata = this.prepareMetadata(contentItem);
      
      // Add to vector database
      await this.collection.add({
        ids: [contentItem.id.toString()],
        embeddings: [embedding],
        documents: [textToEmbed],
        metadatas: [metadata]
      });

      console.log(`Added content to vector DB: ${contentItem.id} (importance: ${contentItem.importanceScore})`);
      
      return {
        success: true,
        id: contentItem.id,
        embeddingDimensions: embedding.length,
        textLength: textToEmbed.length
      };
    } catch (error) {
      console.error('Error adding content to vector DB:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  prepareTextForEmbedding(contentItem) {
    // Combine all text content for better semantic search
    const textParts = [];
    
    // Primary content
    if (contentItem.cleanedContent) {
      textParts.push(contentItem.cleanedContent);
    } else if (contentItem.content) {
      textParts.push(contentItem.content);
    }
    
    // Extracted content (for URLs)
    if (contentItem.extractedContent) {
      textParts.push(contentItem.extractedContent);
    }
    
    // Metadata text
    if (contentItem.metadata) {
      if (contentItem.metadata.title) textParts.push(contentItem.metadata.title);
      if (contentItem.metadata.description) textParts.push(contentItem.metadata.description);
    }
    
    // Keywords as context
    if (contentItem.keywords && contentItem.keywords.length > 0) {
      const keywordText = contentItem.keywords.map(k => k.word).join(' ');
      textParts.push(`Keywords: ${keywordText}`);
    }
    
    // Contextual tags
    if (contentItem.contextualTags && contentItem.contextualTags.length > 0) {
      textParts.push(`Context: ${contentItem.contextualTags.join(' ')}`);
    }
    
    return textParts.join('\n\n').trim();
  }

  prepareMetadata(contentItem) {
    return {
      // Core identifiers
      originalId: contentItem.id.toString(),
      type: contentItem.type,
      timestamp: contentItem.timestamp,
      
      // Importance metrics (crucial for ranking)
      importanceScore: contentItem.importanceScore || 1.0,
      submissionCount: contentItem.submissionCount || 1,
      urgencyLevel: contentItem.urgencyAssessment?.level || 'normal',
      
      // Temporal data
      lastSubmission: contentItem.lastSubmission || contentItem.timestamp,
      velocity: contentItem.submissionPatterns?.velocity || 'low',
      trend: contentItem.submissionPatterns?.trend || 'stable',
      
      // Content metadata
      wordCount: contentItem.metadata?.wordCount || 0,
      chunkCount: contentItem.metadata?.chunkCount || 1,
      
      // Source information
      sources: JSON.stringify(contentItem.submissionPatterns?.submissionSources || {}),
      
      // Tags for filtering
      contextualTags: JSON.stringify(contentItem.contextualTags || []),
      
      // URL-specific metadata
      domain: contentItem.metadata?.domain || null,
      url: contentItem.metadata?.url || null,
      
      // File-specific metadata
      fileName: contentItem.metadata?.fileName || null,
      fileType: contentItem.metadata?.fileType || null
    };
  }

  async semanticSearch(query, options = {}) {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }

      const {
        limit = 10,
        importanceThreshold = 0,
        urgencyFilter = null, // 'high', 'medium', 'normal'
        typeFilter = null, // 'text', 'url', 'file'
        timeFilter = null, // 'today', 'week', 'month'
        includeMetadata = true
      } = options;

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build where clause for filtering
      const whereClause = this.buildWhereClause({
        importanceThreshold,
        urgencyFilter,
        typeFilter,
        timeFilter
      });

      // Perform semantic search
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit * 2, // Get more results for post-processing
        where: whereClause,
        include: ['documents', 'metadatas', 'distances']
      });

      // Post-process results with importance weighting
      const processedResults = this.processSearchResults(results, query, options);
      
      return {
        success: true,
        query,
        results: processedResults.slice(0, limit),
        totalFound: results.ids[0]?.length || 0,
        searchOptions: options
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

  buildWhereClause(filters) {
    const conditions = {};
    
    if (filters.importanceThreshold > 0) {
      conditions.importanceScore = { '$gte': filters.importanceThreshold };
    }
    
    if (filters.urgencyFilter) {
      conditions.urgencyLevel = { '$eq': filters.urgencyFilter };
    }
    
    if (filters.typeFilter) {
      conditions.type = { '$eq': filters.typeFilter };
    }
    
    if (filters.timeFilter) {
      const now = new Date();
      let cutoffDate;
      
      switch (filters.timeFilter) {
        case 'today':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (cutoffDate) {
        conditions.timestamp = { '$gte': cutoffDate.toISOString() };
      }
    }
    
    return Object.keys(conditions).length > 0 ? conditions : undefined;
  }

  processSearchResults(results, query, options) {
    if (!results.ids[0] || results.ids[0].length === 0) {
      return [];
    }

    const processedResults = [];
    
    for (let i = 0; i < results.ids[0].length; i++) {
      const metadata = results.metadatas[0][i];
      const document = results.documents[0][i];
      const distance = results.distances[0][i];
      
      // Calculate composite relevance score
      const semanticScore = 1 - distance; // Convert distance to similarity
      const importanceScore = metadata.importanceScore || 1.0;
      const urgencyMultiplier = this.getUrgencyMultiplier(metadata.urgencyLevel);
      const recencyMultiplier = this.getRecencyMultiplier(metadata.lastSubmission);
      
      // Weighted final score
      const compositeScore = (
        semanticScore * 0.4 +           // 40% semantic similarity
        (importanceScore / 10) * 0.3 +  // 30% importance (normalized)
        urgencyMultiplier * 0.2 +       // 20% urgency
        recencyMultiplier * 0.1         // 10% recency
      );
      
      processedResults.push({
        id: results.ids[0][i],
        document,
        metadata,
        scores: {
          composite: compositeScore,
          semantic: semanticScore,
          importance: importanceScore,
          urgency: urgencyMultiplier,
          recency: recencyMultiplier
        },
        distance,
        relevanceReason: this.explainRelevance(metadata, semanticScore)
      });
    }
    
    // Sort by composite score
    return processedResults.sort((a, b) => b.scores.composite - a.scores.composite);
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
    
    // Decay over 7 days
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
      // Remove old version
      await this.collection.delete({ ids: [contentItem.id.toString()] });
      
      // Add updated version
      return await this.addContent(contentItem);
    } catch (error) {
      console.error('Error updating content in vector DB:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteContent(contentId) {
    try {
      await this.collection.delete({ ids: [contentId.toString()] });
      return { success: true };
    } catch (error) {
      console.error('Error deleting content from vector DB:', error);
      return { success: false, error: error.message };
    }
  }

  async getCollectionStats() {
    try {
      if (!this.collection) {
        await this.initializeCollection();
      }
      
      const count = await this.collection.count();
      return {
        totalDocuments: count,
        collectionName: this.collectionName,
        embeddingModel: this.useOpenAI ? 'OpenAI' : 'Local (all-MiniLM-L6-v2)'
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return { error: error.message };
    }
  }
}

module.exports = VectorEngine;