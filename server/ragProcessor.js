class RAGProcessor {
  constructor(vectorEngine, options = {}) {
    this.vectorEngine = vectorEngine;
    this.useOpenAI = options.useOpenAI || false;
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (this.useOpenAI && this.openaiApiKey) {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({ apiKey: this.openaiApiKey });
    }
  }

  async processQuery(query, options = {}) {
    try {
      // Analyze the query to understand intent
      const queryAnalysis = this.analyzeQuery(query);
      
      // Adjust search parameters based on query intent
      const searchOptions = this.buildSearchOptions(queryAnalysis, options);
      
      // Perform semantic search
      const searchResults = await this.vectorEngine.semanticSearch(query, searchOptions);
      
      if (!searchResults.success) {
        return {
          success: false,
          error: searchResults.error,
          query
        };
      }
      
      // Generate response based on query type
      const response = await this.generateResponse(query, queryAnalysis, searchResults.results);
      
      return {
        success: true,
        query,
        queryAnalysis,
        searchResults: searchResults.results,
        response,
        metadata: {
          totalFound: searchResults.totalFound,
          searchOptions: searchOptions,
          processingTime: Date.now()
        }
      };
    } catch (error) {
      console.error('Error in RAG processing:', error);
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  analyzeQuery(query) {
    const lowerQuery = query.toLowerCase();
    
    // Detect query intent patterns
    const intents = {
      temporal: this.detectTemporalIntent(lowerQuery),
      analytical: this.detectAnalyticalIntent(lowerQuery),
      urgency: this.detectUrgencyIntent(lowerQuery),
      content_type: this.detectContentTypeIntent(lowerQuery),
      trend: this.detectTrendIntent(lowerQuery)
    };
    
    // Extract time references
    const timeContext = this.extractTimeContext(lowerQuery);
    
    // Extract content type preferences
    const contentTypes = this.extractContentTypes(lowerQuery);
    
    // Determine primary intent
    const primaryIntent = this.determinePrimaryIntent(intents);
    
    return {
      originalQuery: query,
      primaryIntent,
      intents,
      timeContext,
      contentTypes,
      isQuestion: lowerQuery.includes('?') || lowerQuery.startsWith('what') || lowerQuery.startsWith('how') || lowerQuery.startsWith('when') || lowerQuery.startsWith('where') || lowerQuery.startsWith('why'),
      needsAggregation: this.needsAggregation(lowerQuery),
      needsSummary: this.needsSummary(lowerQuery)
    };
  }

  detectTemporalIntent(query) {
    const temporalKeywords = [
      'lately', 'recently', 'today', 'yesterday', 'this week', 'last week',
      'this month', 'last month', 'trending', 'current', 'now', 'urgent'
    ];
    
    return temporalKeywords.some(keyword => query.includes(keyword));
  }

  detectAnalyticalIntent(query) {
    const analyticalKeywords = [
      'analyze', 'summary', 'trends', 'patterns', 'insights', 'overview',
      'breakdown', 'statistics', 'most', 'least', 'frequently', 'often'
    ];
    
    return analyticalKeywords.some(keyword => query.includes(keyword));
  }

  detectUrgencyIntent(query) {
    const urgencyKeywords = [
      'urgent', 'important', 'priority', 'critical', 'asap', 'immediately',
      'deadline', 'due', 'reminder', 'alert'
    ];
    
    return urgencyKeywords.some(keyword => query.includes(keyword));
  }

  detectContentTypeIntent(query) {
    const typeKeywords = {
      files: ['file', 'document', 'pdf', 'image', 'photo'],
      urls: ['link', 'website', 'url', 'article', 'page'],
      notes: ['note', 'text', 'thought', 'idea', 'memo']
    };
    
    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        return type;
      }
    }
    
    return null;
  }

  detectTrendIntent(query) {
    const trendKeywords = [
      'thinking about', 'focused on', 'working on', 'interested in',
      'trending', 'popular', 'frequent', 'repeated', 'multiple times'
    ];
    
    return trendKeywords.some(keyword => query.includes(keyword));
  }

  extractTimeContext(query) {
    const timePatterns = {
      today: /\b(today|this day)\b/i,
      yesterday: /\b(yesterday)\b/i,
      thisWeek: /\b(this week|past week)\b/i,
      lastWeek: /\b(last week)\b/i,
      thisMonth: /\b(this month|past month)\b/i,
      recently: /\b(recently|lately|recent)\b/i
    };
    
    for (const [period, pattern] of Object.entries(timePatterns)) {
      if (pattern.test(query)) {
        return period;
      }
    }
    
    return null;
  }

  extractContentTypes(query) {
    const types = [];
    
    if (/\b(file|document|pdf|image|photo)\b/i.test(query)) types.push('file');
    if (/\b(link|website|url|article|page)\b/i.test(query)) types.push('url');
    if (/\b(note|text|thought|idea|memo)\b/i.test(query)) types.push('text');
    
    return types;
  }

  determinePrimaryIntent(intents) {
    if (intents.urgency) return 'urgency';
    if (intents.temporal) return 'temporal';
    if (intents.trend) return 'trend';
    if (intents.analytical) return 'analytical';
    if (intents.content_type) return 'content_type';
    
    return 'semantic';
  }

  needsAggregation(query) {
    const aggregationKeywords = [
      'how many', 'count', 'total', 'sum', 'average', 'most', 'least',
      'all', 'everything', 'list', 'show me'
    ];
    
    return aggregationKeywords.some(keyword => query.includes(keyword));
  }

  needsSummary(query) {
    const summaryKeywords = [
      'summary', 'summarize', 'overview', 'brief', 'digest', 'newsletter',
      'report', 'update', 'what happened', 'catch up'
    ];
    
    return summaryKeywords.some(keyword => query.includes(keyword));
  }

  buildSearchOptions(queryAnalysis, baseOptions = {}) {
    const options = { ...baseOptions };
    
    // Adjust limit based on query intent
    if (queryAnalysis.needsAggregation) {
      options.limit = Math.max(options.limit || 10, 20);
    }
    
    // Set importance threshold for trending queries
    if (queryAnalysis.intents.trend || queryAnalysis.primaryIntent === 'trend') {
      options.importanceThreshold = 2.0;
    }
    
    // Filter by urgency
    if (queryAnalysis.intents.urgency) {
      options.urgencyFilter = 'high';
    }
    
    // Filter by content type
    if (queryAnalysis.contentTypes.length === 1) {
      options.typeFilter = queryAnalysis.contentTypes[0];
    }
    
    // Set time filter
    if (queryAnalysis.timeContext) {
      switch (queryAnalysis.timeContext) {
        case 'today':
          options.timeFilter = 'today';
          break;
        case 'thisWeek':
        case 'recently':
          options.timeFilter = 'week';
          break;
        case 'thisMonth':
          options.timeFilter = 'month';
          break;
      }
    }
    
    return options;
  }

  async generateResponse(query, queryAnalysis, searchResults) {
    if (searchResults.length === 0) {
      return {
        type: 'no_results',
        message: "I couldn't find any content matching your query. Try rephrasing or using different keywords.",
        suggestions: this.generateSearchSuggestions(queryAnalysis)
      };
    }
    
    // If OpenAI is available, generate enhanced responses
    if (this.useOpenAI && this.openai) {
      return await this.generateOpenAIResponse(query, queryAnalysis, searchResults);
    }
    
    // Fallback to template-based responses
    switch (queryAnalysis.primaryIntent) {
      case 'temporal':
        return this.generateTemporalResponse(query, searchResults, queryAnalysis);
      
      case 'trend':
        return this.generateTrendResponse(query, searchResults, queryAnalysis);
      
      case 'urgency':
        return this.generateUrgencyResponse(query, searchResults, queryAnalysis);
      
      case 'analytical':
        return this.generateAnalyticalResponse(query, searchResults, queryAnalysis);
      
      default:
        return this.generateSemanticResponse(query, searchResults, queryAnalysis);
    }
  }

  async generateOpenAIResponse(query, queryAnalysis, searchResults) {
    try {
      // Prepare context from search results
      const context = this.prepareContextForOpenAI(searchResults);
      const insights = this.generateInsights(searchResults);
      
      const systemPrompt = `You are a personal AI assistant analyzing someone's captured content (notes, URLs, files). 
Your role is to provide insightful, personalized responses based on their data patterns.

Key capabilities:
- Understand temporal patterns and trends in their thinking
- Identify what's important based on submission frequency and recency
- Provide actionable insights and recommendations
- Be conversational but informative

Context about the query:
- Primary intent: ${queryAnalysis.primaryIntent}
- Time context: ${queryAnalysis.timeContext || 'none'}
- Content types: ${queryAnalysis.contentTypes.join(', ') || 'all'}
- Needs aggregation: ${queryAnalysis.needsAggregation}
- Needs summary: ${queryAnalysis.needsSummary}

Current insights:
- Total relevant items: ${searchResults.length}
- High importance items: ${searchResults.filter(r => r.metadata.importanceScore > 5).length}
- Urgent items: ${searchResults.filter(r => r.metadata.urgencyLevel === 'high').length}
- Trending topics: ${insights.trendingTopics.map(t => t.topic).join(', ')}`;

      const userPrompt = `Query: "${query}"

Relevant content from their personal data:
${context}

Please provide a helpful, personalized response that:
1. Directly answers their query
2. Highlights the most important/relevant findings
3. Identifies patterns or trends if applicable
4. Offers actionable insights or recommendations
5. Keeps a conversational, supportive tone

Focus on what matters most to them based on importance scores and submission patterns.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7
      });

      return {
        type: 'openai_enhanced',
        message: completion.choices[0].message.content,
        items: searchResults.slice(0, 5),
        insights: insights,
        metadata: {
          model: 'gpt-4o-mini',
          tokensUsed: completion.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      console.error('OpenAI response generation error:', error);
      // Fallback to template-based response
      return this.generateSemanticResponse(query, searchResults, queryAnalysis);
    }
  }

  prepareContextForOpenAI(searchResults) {
    return searchResults.slice(0, 10).map((result, index) => {
      const metadata = result.metadata;
      const content = result.document.substring(0, 300);
      
      return `[${index + 1}] (Importance: ${metadata.importanceScore}/10, Urgency: ${metadata.urgencyLevel}, Submissions: ${metadata.submissionCount})
Type: ${metadata.type}
Content: ${content}${content.length >= 300 ? '...' : ''}
Tags: ${JSON.parse(metadata.contextualTags || '[]').join(', ')}
---`;
    }).join('\n');
  }

  generateInsights(searchResults) {
    const insights = {
      totalItems: searchResults.length,
      averageImportance: this.calculateAverageImportance(searchResults),
      urgentItems: searchResults.filter(r => r.metadata.urgencyLevel === 'high').length,
      trendingTopics: this.extractTrendingTopics(searchResults),
      contentBreakdown: this.analyzeContentBreakdown(searchResults),
      temporalPatterns: this.analyzeTemporalPatterns(searchResults)
    };
    
    return insights;
  }

  generateTemporalResponse(query, results, analysis) {
    const timeContext = analysis.timeContext || 'recently';
    const highImportanceItems = results.filter(r => r.metadata.importanceScore > 3);
    
    return {
      type: 'temporal',
      message: `Here's what you've been ${timeContext === 'recently' ? 'focusing on lately' : `working on ${timeContext}`}:`,
      items: results.slice(0, 5),
      insights: {
        totalItems: results.length,
        highImportance: highImportanceItems.length,
        trendingTopics: this.extractTrendingTopics(results),
        timeframe: timeContext
      }
    };
  }

  generateTrendResponse(query, results, analysis) {
    const trendingItems = results.filter(r => 
      r.metadata.velocity === 'high' || r.metadata.importanceScore > 4
    );
    
    return {
      type: 'trend',
      message: "Here are the topics you've been thinking about most:",
      items: trendingItems.slice(0, 5),
      insights: {
        totalTrending: trendingItems.length,
        averageImportance: this.calculateAverageImportance(trendingItems),
        topKeywords: this.extractTopKeywords(results)
      }
    };
  }

  generateUrgencyResponse(query, results, analysis) {
    const urgentItems = results.filter(r => r.metadata.urgencyLevel === 'high');
    
    return {
      type: 'urgency',
      message: "Here are your high-priority items:",
      items: urgentItems.slice(0, 5),
      insights: {
        totalUrgent: urgentItems.length,
        needsAttention: urgentItems.length > 0,
        recommendations: urgentItems.length > 0 ? 
          ['Review these urgent items', 'Consider taking action soon'] :
          ['No urgent items found', 'You seem to be on top of things!']
      }
    };
  }

  generateAnalyticalResponse(query, results, analysis) {
    return {
      type: 'analytical',
      message: "Here's an analysis of your content:",
      items: results.slice(0, 3),
      insights: {
        totalItems: results.length,
        contentBreakdown: this.analyzeContentBreakdown(results),
        importanceDistribution: this.analyzeImportanceDistribution(results),
        temporalPatterns: this.analyzeTemporalPatterns(results),
        topSources: this.analyzeTopSources(results)
      }
    };
  }

  generateSemanticResponse(query, results, analysis) {
    return {
      type: 'semantic',
      message: `Found ${results.length} items related to your query:`,
      items: results.slice(0, 5),
      insights: {
        bestMatch: results[0],
        averageRelevance: this.calculateAverageRelevance(results),
        relatedTopics: this.extractRelatedTopics(results)
      }
    };
  }

  // Helper methods for insights
  extractTrendingTopics(results) {
    const topics = {};
    results.forEach(result => {
      if (result.metadata.contextualTags) {
        const tags = JSON.parse(result.metadata.contextualTags);
        tags.forEach(tag => {
          topics[tag] = (topics[tag] || 0) + 1;
        });
      }
    });
    
    return Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));
  }

  calculateAverageImportance(results) {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + (r.metadata.importanceScore || 1), 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  extractTopKeywords(results) {
    const keywords = {};
    results.forEach(result => {
      // This would need to be extracted from the original content
      // For now, we'll use a placeholder
    });
    return [];
  }

  analyzeContentBreakdown(results) {
    const breakdown = { text: 0, url: 0, file: 0 };
    results.forEach(result => {
      breakdown[result.metadata.type] = (breakdown[result.metadata.type] || 0) + 1;
    });
    return breakdown;
  }

  analyzeImportanceDistribution(results) {
    const distribution = { low: 0, medium: 0, high: 0 };
    results.forEach(result => {
      const importance = result.metadata.importanceScore || 1;
      if (importance < 2) distribution.low++;
      else if (importance < 5) distribution.medium++;
      else distribution.high++;
    });
    return distribution;
  }

  analyzeTemporalPatterns(results) {
    const now = new Date();
    const patterns = { today: 0, thisWeek: 0, older: 0 };
    
    results.forEach(result => {
      const itemDate = new Date(result.metadata.timestamp);
      const hoursAgo = (now - itemDate) / (1000 * 60 * 60);
      
      if (hoursAgo <= 24) patterns.today++;
      else if (hoursAgo <= 168) patterns.thisWeek++;
      else patterns.older++;
    });
    
    return patterns;
  }

  analyzeTopSources(results) {
    const sources = {};
    results.forEach(result => {
      if (result.metadata.sources) {
        const sourcesData = JSON.parse(result.metadata.sources);
        Object.keys(sourcesData).forEach(source => {
          sources[source] = (sources[source] || 0) + sourcesData[source];
        });
      }
    });
    
    return Object.entries(sources)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([source, count]) => ({ source, count }));
  }

  calculateAverageRelevance(results) {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + r.scores.semantic, 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  extractRelatedTopics(results) {
    // Extract related topics from contextual tags
    const topics = new Set();
    results.slice(0, 3).forEach(result => {
      if (result.metadata.contextualTags) {
        const tags = JSON.parse(result.metadata.contextualTags);
        tags.forEach(tag => topics.add(tag));
      }
    });
    return Array.from(topics).slice(0, 5);
  }

  generateSearchSuggestions(queryAnalysis) {
    const suggestions = [];
    
    if (queryAnalysis.intents.temporal) {
      suggestions.push('Try: \"what did I work on this week?\"');
    }
    
    if (queryAnalysis.intents.urgency) {
      suggestions.push('Try: \"show me important items\"');
    }
    
    suggestions.push('Try: \"what am I thinking about lately?\"');
    suggestions.push('Try: \"show me trending topics\"');
    
    return suggestions;
  }
}

module.exports = RAGProcessor;