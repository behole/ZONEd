import { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button, Spinner, Alert, ProgressBar } from 'react-bootstrap';
import SafeNumericDisplay from './SafeNumericDisplay';

interface ContentItem {
  id: string;
  type: 'text' | 'url' | 'file';
  content: string;
  summary?: string;
  timestamp: string;
  importanceScore: number;
  submissionCount: number;
  contextualTags: string[];
  metadata: any;
  urgencyAssessment?: {
    level: 'low' | 'medium' | 'high';
  };
}

interface DashboardStats {
  totalItems: number;
  recentItems: number;
  highImportanceItems: number;
  urgentItems: number;
  visualContent: number;
  contentBreakdown: {
    text: number;
    url: number;
    file: number;
  };
  trendingTopics: Array<{
    topic: string;
    count: number;
  }>;
}

function ContentDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentContent, setRecentContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null); // Clear previous errors
      console.log('🔄 Loading dashboard data...');
      console.log('🌐 Current URL:', window.location.href);
      console.log('📡 Fetching from:', '/api/content');

      const response = await fetch('/api/content', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Failed to load content: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📊 Raw API Data received:', data);
      console.log('📊 Data structure:', {
        hasContent: !!data.content,
        contentType: typeof data.content,
        contentLength: data.content?.length,
        hasNotes: !!data.notes,
        notesLength: data.notes?.length,
        dataKeys: Object.keys(data)
      });

      const allContent = data.content || [];
      console.log('📋 Content items found:', allContent.length);

      if (allContent.length > 0) {
        console.log('📋 Sample content item:', allContent[0]);
        console.log('📋 All content IDs:', allContent.map(item => item.id));
      }

      // Calculate dashboard statistics
      const dashboardStats = calculateStats(allContent);
      console.log('📈 Dashboard stats calculated:', dashboardStats);
      setStats(dashboardStats);

      // Get recent content (last 10 items)
      const recent = allContent
        .sort((a: ContentItem, b: ContentItem) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);
      console.log('⏰ Recent content:', recent.length);
      console.log('⏰ Recent content items:', recent.map(item => ({ id: item.id, type: item.type, timestamp: item.timestamp })));
      setRecentContent(recent);

      console.log('✅ Dashboard data loading completed successfully');

    } catch (err) {
      console.error('❌ Dashboard loading error:', err);
      console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      console.log('🏁 Dashboard loading finished (loading state set to false)');
    }
  };

  const calculateStats = (content: ContentItem[]): DashboardStats => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentItems = content.filter(item => new Date(item.timestamp) > oneDayAgo).length;
    const highImportanceItems = content.filter(item => (item.importanceScore || 1) > 5).length;
    const urgentItems = content.filter(item => item.urgencyAssessment?.level === 'high').length;

    const contentBreakdown = content.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, { text: 0, url: 0, file: 0 });

    // Count visual content
    const visualContent = content.filter(item => 
      item.metadata?.imageType || 
      item.metadata?.visualElements || 
      item.metadata?.colorPalette ||
      (item.mimetype && item.mimetype.startsWith('image/'))
    ).length;

    // Extract trending topics from contextual tags
    const topicCounts: { [key: string]: number } = {};
    content.forEach(item => {
      if (item.contextualTags) {
        item.contextualTags.forEach(tag => {
          topicCounts[tag] = (topicCounts[tag] || 0) + 1;
        });
      }
    });

    const trendingTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));

    return {
      totalItems: content.length,
      recentItems,
      highImportanceItems,
      urgentItems,
      visualContent,
      contentBreakdown,
      trendingTopics
    };
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'file': return '📄';
      case 'url': return '🔗';
      case 'text': return '📝';
      default: return '📋';
    }
  };

  const getImportanceColor = (score: number) => {
    if (score >= 7) return 'success';
    if (score >= 4) return 'warning';
    return 'secondary';
  };

  const getImportanceLabel = (score: number) => {
    if (score >= 8) return '🔥 Must Read';
    if (score >= 6) return '✨ Important';
    if (score >= 4) return '👀 Worth Noting';
    if (score >= 2) return '📌 Flagged';
    return '📋 Captured';
  };

  const generateSmartSummary = (item: ContentItem) => {
    // For URLs, show title and brief description
    if (item.type === 'url' && item.title) {
      const domain = item.url ? new URL(item.url).hostname.replace('www.', '') : '';
      return `${item.title}${domain ? ` (from ${domain})` : ''}`;
    }
    
    // For files, show filename and type info
    if (item.type === 'file' && item.originalName) {
      const description = item.content ? 
        item.content.substring(0, 100) + (item.content.length > 100 ? '...' : '') :
        'File uploaded for analysis';
      return `${item.originalName} - ${description}`;
    }
    
    // For text content, extract key sentences
    if (item.content) {
      const sentences = item.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      if (sentences.length >= 2) {
        return sentences.slice(0, 2).join('. ').trim() + '.';
      } else if (sentences.length === 1) {
        return sentences[0].trim() + '.';
      } else {
        return item.content.substring(0, 150) + (item.content.length > 150 ? '...' : '');
      }
    }
    
    return 'Content captured for analysis';
  };

  const getUrgencyColor = (level?: string) => {
    switch (level) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading dashboard...</span>
        </Spinner>
        <p className="mt-2">Loading your content insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Dashboard Error</Alert.Heading>
        <p>{error}</p>
        <Button variant="outline-danger" onClick={loadDashboardData}>
          Try Again
        </Button>
      </Alert>
    );
  }

  if (!stats) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>🧠 Intelligence Dashboard</h2>
          <div className="d-flex gap-2">
            <Button variant="outline-primary" size="sm" onClick={loadDashboardData}>
              🔄 Refresh
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => {
                console.log('🔍 Debug: Opening browser console...');
                console.log('Current stats:', stats);
                console.log('Current content:', recentContent);
                alert('Check browser console (F12) for debug info');
              }}
            >
              🐛 Debug
            </Button>
          </div>
        </div>
        <Alert variant="info">
          <Alert.Heading>🚀 Welcome to Your Intelligence Dashboard!</Alert.Heading>
          <p>Your dashboard will show insights once you add some content.</p>
          <div className="d-flex gap-2">
            <Button variant="primary" href="/">
              ➕ Add Your First Content
            </Button>
            <Button variant="outline-secondary" onClick={loadDashboardData}>
              🔄 Check Again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>🧠 Intelligence Dashboard</h2>
        <Button variant="outline-primary" size="sm" onClick={loadDashboardData}>
          🔄 Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <Row className="mb-4">
        <Col lg={3} md={6}>
          <Card className="text-center h-100">
            <Card.Body>
              <h3 className="text-primary">{stats.totalItems}</h3>
              <p className="mb-0">Total Items</p>
              <small className="text-muted">Your knowledge base</small>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="text-center h-100">
            <Card.Body>
              <h3 className="text-success">{stats.recentItems}</h3>
              <p className="mb-0">Added Today</p>
              <small className="text-muted">Fresh insights</small>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="text-center h-100">
            <Card.Body>
              <h3 className="text-info">{stats.visualContent}</h3>
              <p className="mb-0">Visual Content</p>
              <small className="text-muted">Images & designs</small>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="text-center h-100">
            <Card.Body>
              <h3 className="text-warning">{stats.highImportanceItems}</h3>
              <p className="mb-0">High Priority</p>
              <small className="text-muted">Important content</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Content Breakdown */}
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <strong>📊 Content Breakdown</strong>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>📝 Text Notes</span>
                  <Badge bg="primary">{stats.contentBreakdown.text}</Badge>
                </div>
                <ProgressBar
                  now={(stats.contentBreakdown.text / stats.totalItems) * 100}
                  variant="primary"
                  className="mb-2"
                />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>🔗 URLs & Links</span>
                  <Badge bg="info">{stats.contentBreakdown.url}</Badge>
                </div>
                <ProgressBar
                  now={(stats.contentBreakdown.url / stats.totalItems) * 100}
                  variant="info"
                  className="mb-2"
                />
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span>📄 Files & Documents</span>
                  <Badge bg="success">{stats.contentBreakdown.file}</Badge>
                </div>
                <ProgressBar
                  now={(stats.contentBreakdown.file / stats.totalItems) * 100}
                  variant="success"
                  className="mb-2"
                />
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Trending Topics */}
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <strong>🔥 Trending in Your Mind</strong>
            </Card.Header>
            <Card.Body>
              {stats.trendingTopics.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {stats.trendingTopics.map((topic, index) => (
                    <Badge
                      key={topic.topic}
                      bg={index < 3 ? 'primary' : 'secondary'}
                      className="d-flex align-items-center gap-1"
                    >
                      #{topic.topic}
                      <span className="badge bg-light text-dark ms-1">{topic.count}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">Add more content to see trending topics</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Content */}
      <Card>
        <Card.Header>
          <strong>⏰ Recent Activity</strong>
        </Card.Header>
        <Card.Body>
          {recentContent.length > 0 ? (
            <div className="row">
              {recentContent.map((item) => (
                <div key={item.id} className="col-md-6 mb-3">
                  <Card className="h-100 shadow-sm">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex gap-2">
                          <Badge bg="outline-primary">
                            {getContentTypeIcon(item.type)} {item.type}
                          </Badge>
                          <Badge bg={getImportanceColor(item.importanceScore || 1)}>
                            {getImportanceLabel(item.importanceScore || 1)}
                          </Badge>
                          {item.urgencyAssessment?.level === 'high' && (
                            <Badge bg="danger">🔴 Urgent</Badge>
                          )}
                        </div>
                        <small className="text-muted">
                          {formatRelativeTime(item.timestamp)}
                        </small>
                      </div>

                      {/* Content Summary */}
                      <div className="mb-3">
                        {item.summary ? (
                          <p className="mb-0" style={{ 
                            lineHeight: '1.4',
                            color: '#495057'
                          }}>
                            {item.summary}
                          </p>
                        ) : (
                          <p className="mb-0" style={{ 
                            lineHeight: '1.4',
                            color: '#495057'
                          }}>
                            {generateSmartSummary(item)}
                          </p>
                        )}
                      </div>

                      {item.submissionCount > 1 && (
                        <small className="text-info">
                          🔄 Revisited {item.submissionCount} times
                        </small>
                      )}

                      {item.contextualTags && item.contextualTags.length > 0 && (
                        <div className="mt-2">
                          {item.contextualTags.slice(0, 3).map(tag => (
                            <Badge key={tag} bg="light" text="dark" className="me-1">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted mb-0">No recent content found</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default ContentDashboard;