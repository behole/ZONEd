class NewsletterGenerator {
  constructor(vectorEngine, ragProcessor, options = {}) {
    this.vectorEngine = vectorEngine;
    this.ragProcessor = ragProcessor;
    this.useOpenAI = options.useOpenAI || false;
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (this.useOpenAI && this.openaiApiKey) {
      const { OpenAI } = require('openai');
      this.openai = new OpenAI({ apiKey: this.openaiApiKey });
    }
  }

  async generateWeeklyNewsletter(options = {}) {
    const {
      timeframe = 'week',
      includeAnalytics = true,
      includeTrends = true,
      includeRecommendations = true,
      format = 'html'
    } = options;

    try {
      // Gather data for the newsletter
      const data = await this.gatherNewsletterData(timeframe);
      
      if (this.useOpenAI && this.openai) {
        return await this.generateOpenAINewsletter(data, options);
      } else {
        return this.generateTemplateNewsletter(data, options);
      }
    } catch (error) {
      console.error('Newsletter generation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async gatherNewsletterData(timeframe) {
    // Get recent content based on timeframe
    const recentContent = await this.vectorEngine.semanticSearch('content', {
      limit: 50
    });

    // Get trending topics (use a generic search to get all content above threshold)
    const trendingContent = await this.vectorEngine.semanticSearch('content', {
      limit: 20
    });

    // Get urgent items
    const urgentContent = await this.vectorEngine.semanticSearch('urgent', {
      limit: 10,
      urgencyFilter: 'high'
    });

    // Analyze patterns
    const analytics = this.analyzeContentPatterns(recentContent.results || []);
    const trends = this.identifyTrends(trendingContent.results || []);
    const insights = this.generateInsights(recentContent.results || []);

    return {
      timeframe,
      recentContent: recentContent.results || [],
      trendingContent: (trendingContent.results || []).length > 0 ? trendingContent.results : recentContent.results || [],
      urgentContent: urgentContent.results || [],
      analytics,
      trends,
      insights,
      generatedAt: new Date().toISOString()
    };
  }

  async generateOpenAINewsletter(data, options) {
    try {
      const systemPrompt = `You are a sophisticated personal intelligence system for a creative designer and intellectual. Your role is to provide genuinely insightful, nuanced recommendations based on their captured content.

Your goal is to create a digest that:
1. Identifies sophisticated patterns and connections in their interests
2. Provides specific, actionable recommendations that go beyond the obvious
3. Makes intelligent cross-references between different concepts
4. Suggests next-level explorations based on their demonstrated interests

For recommendations, AVOID generic suggestions like:
❌ \"Watch more of this show\"
❌ \"Read more about this topic\"
❌ \"Follow this person\"

Instead, provide sophisticated connections like:
✅ \"If you're interested in X, you should explore Y because Z\"
✅ \"This connects to your interest in A through the shared theme of B\"
✅ \"Based on your fascination with C, you might find value in D, which approaches similar ideas from E perspective\"

Style: Intellectually curious, sophisticated, specific
Tone: Thoughtful curator who understands creative and intellectual pursuits`;

      const userPrompt = `Create a personalized weekly newsletter based on this data:

TIMEFRAME: ${data.timeframe}
TOTAL ITEMS CAPTURED: ${data.recentContent.length}

RECENT ACTIVITY SUMMARY:
${this.formatContentForPrompt(data.recentContent.slice(0, 15))}

TRENDING TOPICS (High Importance):
${this.formatContentForPrompt(data.trendingContent.slice(0, 8))}

${data.urgentContent.length > 0 ? `URGENT ITEMS NEEDING ATTENTION:
${this.formatContentForPrompt(data.urgentContent.slice(0, 5))}` : ''}

ANALYTICS:
- Content types: ${JSON.stringify(data.analytics.contentTypes)}
- Average importance: ${data.analytics.averageImportance}/10
- Most active day: ${data.analytics.mostActiveDay || 'N/A'}
- Top domains: ${data.analytics.topDomains?.slice(0, 3).join(', ') || 'N/A'}

PATTERNS & TRENDS:
${data.trends.map(trend => `- ${trend.topic}: ${trend.description}`).join('\n')}

Please create a comprehensive newsletter with these sections:
1. **Executive Summary** - Key intellectual highlights and patterns
2. **What You've Been Thinking About** - Main themes and conceptual threads
3. **Trending in Your Mind** - Topics gaining momentum and importance
4. **Creative Connections** - Unexpected links between your interests
5. **Insights & Patterns** - Sophisticated observations about your thinking
6. **Curated Recommendations** - Specific, intelligent next explorations

For the **Curated Recommendations** section specifically:
- Analyze the content deeply to understand underlying themes
- Make sophisticated connections between different interests
- Suggest specific works, creators, concepts, or experiences
- Explain WHY each recommendation connects to their interests
- Go beyond surface-level suggestions to find meaningful parallels
- Consider creative, intellectual, and design-focused perspectives
- Format as: \"Since you're exploring [X], you might find [Y] valuable because [specific reasoning]\"

Example format for recommendations:
\"Given your interest in Peep Show's uncomfortable social dynamics, you might appreciate Charlie Brooker's early writing for PC Zone magazine, which shares that same incisive, cringe-aware perspective on modern life but applied to technology culture.\"

Create an intellectually stimulating summary that treats the user as a sophisticated thinker.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const newsletterContent = completion.choices[0].message.content;

      return {
        success: true,
        type: 'openai_newsletter',
        content: newsletterContent,
        format: options.format,
        data: data,
        metadata: {
          model: 'gpt-4o',
          tokensUsed: completion.usage?.total_tokens || 0,
          generatedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('OpenAI newsletter generation error:', error);
      // Fallback to template
      return this.generateTemplateNewsletter(data, options);
    }
  }

  generateTemplateNewsletter(data, options) {
    const newsletter = {
      title: `Your Personal Weekly Digest - ${this.formatDate(new Date())}`,
      sections: [
        {
          title: 'Executive Summary',
          content: this.generateExecutiveSummary(data)
        },
        {
          title: 'What You\'ve Been Thinking About',
          content: this.generateThinkingSection(data.recentContent)
        },
        {
          title: 'Trending Topics',
          content: this.generateTrendingSection(data.recentContent)
        },
        {
          title: 'Action Items',
          content: this.generateActionItems(data.urgentContent)
        },
        {
          title: 'Analytics & Insights',
          content: this.generateAnalyticsSection(data.analytics)
        }
      ]
    };

    const formattedContent = this.formatNewsletter(newsletter, options.format);

    return {
      success: true,
      type: 'template_newsletter',
      content: formattedContent,
      format: options.format,
      data: data,
      metadata: {
        generatedAt: new Date().toISOString()
      }
    };
  }

  formatContentForPrompt(content) {
    return content.map((item, index) => {
      return `${index + 1}. [${item.metadata.type.toUpperCase()}] (Importance: ${item.metadata.importanceScore}/10, Submissions: ${item.metadata.submissionCount})
   ${item.document.substring(0, 200)}${item.document.length > 200 ? '...' : ''}`;
    }).join('\n\n');
  }

  analyzeContentPatterns(content) {
    const contentTypes = {};
    const domains = {};
    const dailyActivity = {};
    let totalImportance = 0;

    content.forEach(item => {
      // Content types
      contentTypes[item.metadata.type] = (contentTypes[item.metadata.type] || 0) + 1;
      
      // Domains (for URLs)
      if (item.metadata.domain) {
        domains[item.metadata.domain] = (domains[item.metadata.domain] || 0) + 1;
      }
      
      // Daily activity
      const date = new Date(item.metadata.timestamp).toDateString();
      dailyActivity[date] = (dailyActivity[date] || 0) + 1;
      
      // Importance
      totalImportance += item.metadata.importanceScore || 1;
    });

    const mostActiveDay = Object.entries(dailyActivity)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    const topDomains = Object.entries(domains)
      .sort(([,a], [,b]) => b - a)
      .map(([domain]) => domain);

    return {
      contentTypes,
      topDomains,
      mostActiveDay,
      averageImportance: content.length > 0 ? (totalImportance / content.length).toFixed(1) : 0,
      totalItems: content.length
    };
  }

  identifyTrends(content) {
    const trends = [];
    
    // High velocity items
    const highVelocity = content.filter(item => item.metadata.velocity === 'high');
    if (highVelocity.length > 0) {
      trends.push({
        topic: 'High Velocity Topics',
        description: `${highVelocity.length} topics showing rapid submission patterns`,
        items: highVelocity.slice(0, 3)
      });
    }
    
    // Critical importance items
    const critical = content.filter(item => item.metadata.importanceScore > 7);
    if (critical.length > 0) {
      trends.push({
        topic: 'Critical Focus Areas',
        description: `${critical.length} items with very high importance scores`,
        items: critical.slice(0, 3)
      });
    }
    
    return trends;
  }

  generateInsights(content) {
    const insights = [];
    
    if (content.length === 0) {
      insights.push('No recent activity captured');
      return insights;
    }
    
    const avgImportance = content.reduce((sum, item) => sum + (item.metadata.importanceScore || 1), 0) / content.length;
    
    if (avgImportance > 5) {
      insights.push('High overall importance - you\'re focused on critical topics');
    } else if (avgImportance < 2) {
      insights.push('Lower importance items - might be a good time for exploration');
    }
    
    const urgentCount = content.filter(item => item.metadata.urgencyLevel === 'high').length;
    if (urgentCount > 0) {
      insights.push(`${urgentCount} urgent items need attention`);
    }
    
    const multiSubmission = content.filter(item => item.metadata.submissionCount > 1).length;
    if (multiSubmission > 0) {
      insights.push(`${multiSubmission} topics you've returned to multiple times`);
    }
    
    return insights;
  }

  generateExecutiveSummary(data) {
    const itemCount = data.recentContent.length;
    const urgentCount = data.urgentContent.length;
    const highPriority = data.recentContent.filter(item => item.metadata.importanceScore > 6).length;
    
    let summary = `🎯 **This week you captured ${itemCount} ${itemCount === 1 ? 'item' : 'items'}**. `;
    
    if (highPriority > 0) {
      summary += `${highPriority} ${highPriority === 1 ? 'looks' : 'look'} particularly important. `;
    }
    
    if (urgentCount > 0) {
      summary += `📌 ${urgentCount} ${urgentCount === 1 ? 'item needs' : 'items need'} your attention soon. `;
    } else {
      summary += `✨ Nothing urgent this week - nice and steady! `;
    }
    
    summary += data.trends.length > 0 ? 
      `I noticed some interesting patterns in what you're exploring.` : 
      `You're exploring a nice variety of topics.`;
    
    return summary;
  }

  generateThinkingSection(content) {
    const topItems = content.slice(0, 5);
    if (topItems.length === 0) {
      return 'A quiet week for captures - sometimes that\'s exactly what we need! 😌';
    }
    
    return topItems.map((item, index) => {
      const typeEmoji = item.metadata.type === 'file' ? '📄' : item.metadata.type === 'url' ? '🔗' : '📝';
      const priority = item.metadata.importanceScore > 7 ? '⭐⭐⭐' : item.metadata.importanceScore > 4 ? '⭐⭐' : '⭐';
      const preview = item.document.substring(0, 120);
      
      return `${index + 1}. ${typeEmoji} **${preview}...**\n   ${priority} Priority • ${this.formatRelativeTime(item.metadata.timestamp)}`;
    }).join('\n\n');
  }
  
  formatRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  generateTrendingSection(content) {
    if (!content || content.length === 0) {
      return 'You\'re exploring a nice variety of topics this week! 🌟';
    }
    
    // Sort by importance score and show top items
    const sortedContent = content.sort((a, b) => (b.metadata.importanceScore || 0) - (a.metadata.importanceScore || 0));
    
    return sortedContent.slice(0, 3).map((item, index) => {
      const typeEmoji = item.metadata.type === 'file' ? '📄' : item.metadata.type === 'url' ? '🔗' : '📝';
      const priority = item.metadata.importanceScore > 7 ? '🔥 Hot topic' : item.metadata.importanceScore > 4 ? '📈 Rising interest' : '💡 Worth noting';
      const preview = item.document.substring(0, 100);
      
      return `**${index + 1}. ${typeEmoji} ${priority}**\n   ${preview}...`;
    }).join('\n\n');
  }

  generateActionItems(urgentContent) {
    if (urgentContent.length === 0) {
      return '✅ No urgent action items this week. Great job staying on top of things!';
    }
    
    return urgentContent.map((item, index) => {
      const typeEmoji = item.metadata.type === 'file' ? '📄' : item.metadata.type === 'url' ? '🔗' : '📝';
      const urgencyEmoji = item.metadata.urgencyLevel === 'high' ? '🔴' : '🟡';
      const preview = item.document.substring(0, 100);
      
      return `${index + 1}. ${urgencyEmoji} ${typeEmoji} **${preview}...**\n   Needs attention soon`;
    }).join('\n\n');
  }

  generateAnalyticsSection(analytics) {
    return `
**Content Breakdown**: ${Object.entries(analytics.contentTypes).map(([type, count]) => `${type}: ${count}`).join(', ')}

**Average Importance**: ${analytics.averageImportance}/10

**Most Active Day**: ${analytics.mostActiveDay || 'N/A'}

**Top Domains**: ${analytics.topDomains?.slice(0, 3).join(', ') || 'N/A'}
    `.trim();
  }

  formatNewsletter(newsletter, format) {
    if (format === 'html') {
      return this.formatAsHTML(newsletter);
    } else {
      return this.formatAsMarkdown(newsletter);
    }
  }

  formatAsHTML(newsletter) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${newsletter.title}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; }
        h2 { color: #34495e; margin-top: 30px; }
        .section { margin-bottom: 25px; }
        .highlight { background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; }
    </style>
</head>
<body>
    <h1>${newsletter.title}</h1>
    ${newsletter.sections.map(section => `
        <div class="section">
            <h2>${section.title}</h2>
            <div class="highlight">${section.content.replace(/\n/g, '<br>')}</div>
        </div>
    `).join('')}
    <footer style="margin-top: 40px; text-align: center; color: #7f8c8d;">
        Generated by your Personal AI Assistant
    </footer>
</body>
</html>
    `.trim();
  }

  formatAsMarkdown(newsletter) {
    return `
# ${newsletter.title}

${newsletter.sections.map(section => `
## ${section.title}

${section.content}
`).join('\n')}

---
*Generated by your Personal AI Assistant*
    `.trim();
  }

  formatDate(date) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

module.exports = NewsletterGenerator;