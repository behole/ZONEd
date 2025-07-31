class ImportanceEngine {
  constructor() {
    // Time decay constants for importance calculation
    this.DECAY_HALF_LIFE_HOURS = 24; // Importance halves every 24 hours
    this.MAX_IMPORTANCE_SCORE = 10.0;
    this.BASE_IMPORTANCE = 1.0;
  }

  /**
   * Calculate importance score based on submission frequency and recency
   * Emphasizes what's "on your mind" through repeated submissions
   * @param {Array} submissions - Array of submission objects with timestamps
   * @returns {number} Importance score (1.0 to 10.0)
   */
  calculateImportanceScore(submissions) {
    if (!submissions || submissions.length === 0) {
      return this.BASE_IMPORTANCE;
    }

    const now = new Date();
    let totalScore = 0;

    // Each submission contributes to importance with time decay
    submissions.forEach(submission => {
      const submissionTime = new Date(submission.timestamp);
      const hoursAgo = (now - submissionTime) / (1000 * 60 * 60);
      
      // Exponential decay: score = base * (0.5 ^ (hours / half_life))
      const timeDecayFactor = Math.pow(0.5, hoursAgo / this.DECAY_HALF_LIFE_HOURS);
      const submissionScore = this.BASE_IMPORTANCE * timeDecayFactor;
      
      totalScore += submissionScore;
    });

    // Enhanced frequency multiplier: aggressive scaling for resubmissions
    // This better reflects what's "on your mind"
    const submissionCount = submissions.length;
    let frequencyMultiplier;
    
    if (submissionCount === 1) {
      frequencyMultiplier = 1.0; // Baseline
    } else if (submissionCount === 2) {
      frequencyMultiplier = 2.0; // Strong boost for first resubmission
    } else if (submissionCount === 3) {
      frequencyMultiplier = 3.2; // Clear pattern emerging
    } else if (submissionCount <= 5) {
      frequencyMultiplier = 1.5 + (submissionCount * 0.8); // Strong scaling
    } else {
      frequencyMultiplier = 6.0 + Math.log(submissionCount - 4) * 0.5; // Diminishing returns after 5
    }
    
    totalScore *= frequencyMultiplier;

    // Velocity bonus: recent clustering shows active interest
    const velocityBonus = this.calculateVelocityBonus(submissions);
    totalScore += velocityBonus;

    // Recency boost: recent resubmissions show current interest
    const recencyBoost = this.calculateRecencyBoost(submissions);
    totalScore += recencyBoost;

    // Cap at maximum importance
    return Math.min(totalScore, this.MAX_IMPORTANCE_SCORE);
  }

  /**
   * Calculate velocity bonus for clustered submissions
   * @param {Array} submissions 
   * @returns {number} Velocity bonus score
   */
  calculateVelocityBonus(submissions) {
    if (submissions.length < 2) return 0;

    const now = new Date();
    const recentSubmissions = submissions.filter(sub => {
      const hoursAgo = (now - new Date(sub.timestamp)) / (1000 * 60 * 60);
      return hoursAgo <= 24; // Last 24 hours
    });

    if (recentSubmissions.length < 2) return 0;

    // More submissions in recent period = higher velocity bonus
    const velocityScore = (recentSubmissions.length - 1) * 0.8; // Increased from 0.5
    return Math.min(velocityScore, 3.0); // Increased cap from 2.0
  }

  /**
   * Calculate recency boost for recent resubmissions
   * @param {Array} submissions 
   * @returns {number} Recency boost score
   */
  calculateRecencyBoost(submissions) {
    if (submissions.length < 2) return 0;

    const now = new Date();
    const mostRecent = new Date(submissions[0].timestamp);
    const hoursAgo = (now - mostRecent) / (1000 * 60 * 60);
    
    // Strong boost for very recent resubmissions
    if (hoursAgo <= 1) return 1.5; // Within last hour
    if (hoursAgo <= 6) return 1.0; // Within last 6 hours  
    if (hoursAgo <= 24) return 0.5; // Within last day
    
    return 0;
  }

  /**
   * Analyze submission patterns to extract insights
   * @param {Array} submissions 
   * @returns {Object} Analysis results
   */
  analyzeSubmissionPatterns(submissions) {
    if (!submissions || submissions.length === 0) {
      return {
        velocity: 'none',
        trend: 'stable',
        peakPeriods: [],
        submissionSources: {}
      };
    }

    const now = new Date();
    
    // Analyze submission velocity
    const last24h = submissions.filter(sub => 
      (now - new Date(sub.timestamp)) / (1000 * 60 * 60) <= 24
    ).length;
    
    const last7d = submissions.filter(sub => 
      (now - new Date(sub.timestamp)) / (1000 * 60 * 60 * 24) <= 7
    ).length;

    let velocity = 'low';
    if (last24h >= 3) velocity = 'high';
    else if (last24h >= 2 || last7d >= 5) velocity = 'medium';

    // Analyze trend (comparing recent vs older submissions)
    const midpoint = Math.floor(submissions.length / 2);
    const recentHalf = submissions.slice(0, midpoint);
    const olderHalf = submissions.slice(midpoint);
    
    const recentAvgInterval = this.calculateAverageInterval(recentHalf);
    const olderAvgInterval = this.calculateAverageInterval(olderHalf);
    
    let trend = 'stable';
    if (recentAvgInterval < olderAvgInterval * 0.7) trend = 'increasing';
    else if (recentAvgInterval > olderAvgInterval * 1.3) trend = 'decreasing';

    // Count submission sources
    const submissionSources = {};
    submissions.forEach(sub => {
      const source = sub.source || 'unknown';
      submissionSources[source] = (submissionSources[source] || 0) + 1;
    });

    return {
      velocity,
      trend,
      submissionSources,
      totalSubmissions: submissions.length,
      timeSpan: this.calculateTimeSpan(submissions)
    };
  }

  /**
   * Calculate average time interval between submissions
   * @param {Array} submissions 
   * @returns {number} Average hours between submissions
   */
  calculateAverageInterval(submissions) {
    if (submissions.length < 2) return Infinity;

    const intervals = [];
    for (let i = 1; i < submissions.length; i++) {
      const current = new Date(submissions[i-1].timestamp);
      const previous = new Date(submissions[i].timestamp);
      const intervalHours = (current - previous) / (1000 * 60 * 60);
      intervals.push(intervalHours);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Calculate time span from first to last submission
   * @param {Array} submissions 
   * @returns {Object} Time span information
   */
  calculateTimeSpan(submissions) {
    if (submissions.length === 0) return { hours: 0, days: 0 };

    const timestamps = submissions.map(sub => new Date(sub.timestamp));
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    
    const totalHours = (latest - earliest) / (1000 * 60 * 60);
    
    return {
      hours: Math.round(totalHours * 100) / 100,
      days: Math.round((totalHours / 24) * 100) / 100,
      earliest: earliest.toISOString(),
      latest: latest.toISOString()
    };
  }

  /**
   * Determine if content should be considered "trending" or urgent
   * @param {number} importanceScore 
   * @param {Object} patterns 
   * @returns {Object} Urgency assessment
   */
  assessUrgency(importanceScore, patterns) {
    let urgencyLevel = 'normal';
    let reasons = [];

    if (importanceScore >= 7.0) {
      urgencyLevel = 'high';
      reasons.push('high_importance_score');
    } else if (importanceScore >= 4.0) {
      urgencyLevel = 'medium';
      reasons.push('elevated_importance');
    }

    if (patterns.velocity === 'high') {
      urgencyLevel = urgencyLevel === 'normal' ? 'medium' : 'high';
      reasons.push('high_submission_velocity');
    }

    if (patterns.trend === 'increasing') {
      reasons.push('increasing_attention');
    }

    return {
      level: urgencyLevel,
      reasons,
      shouldPrioritize: urgencyLevel !== 'normal'
    };
  }

  /**
   * Generate contextual tags based on submission patterns
   * @param {Object} patterns 
   * @param {number} importanceScore 
   * @returns {Array} Array of contextual tags
   */
  generateContextualTags(patterns, importanceScore) {
    const tags = [];

    // Research depth indicators
    const sourceCount = Object.keys(patterns.submissionSources).length;
    if (sourceCount >= 3) tags.push('researched thoroughly');
    else if (sourceCount === 1) tags.push('new discovery');

    // Timing patterns that matter
    if (patterns.timeSpan.hours <= 1) tags.push('quick find');
    else if (patterns.timeSpan.days <= 1) tags.push('daily focus');
    else if (patterns.timeSpan.days <= 7) tags.push('weekly interest');

    // Engagement patterns
    if (patterns.totalSubmissions >= 5) tags.push('keeps coming back');
    else if (patterns.totalSubmissions >= 3) tags.push('building interest');
    else if (patterns.totalSubmissions === 1) tags.push('first time');

    // Interest evolution
    if (patterns.trend === 'increasing') tags.push('growing interest');
    else if (patterns.trend === 'decreasing') tags.push('cooling down');

    // Natural engagement patterns
    if (patterns.velocity === 'high') tags.push('active topic');
    else if (patterns.velocity === 'medium') tags.push('steady interest');

    return tags.slice(0, 3); // Limit to 3 most relevant tags
  }
}

module.exports = ImportanceEngine;