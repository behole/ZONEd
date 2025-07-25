import { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Button, Alert, Spinner } from 'react-bootstrap';

interface VisualContent {
  id: string;
  metadata: {
    imageType?: string;
    dimensions?: string;
    visualElements?: string[];
    colorPalette?: string[];
    styleCharacteristics?: string[];
    designInsights?: string[];
  };
  timestamp: string;
  importanceScore: number;
}

interface DesignStats {
  totalVisualContent: number;
  commonElements: Array<{ element: string; count: number }>;
  colorTrends: Array<{ color: string; count: number }>;
  stylePatterns: Array<{ style: string; count: number }>;
  recentVisualContent: VisualContent[];
}

function DesignInsightsDashboard() {
  const [designStats, setDesignStats] = useState<DesignStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDesignData();
  }, []);

  const loadDesignData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/content');
      if (!response.ok) {
        throw new Error('Failed to load content');
      }

      const data = await response.json();
      const allContent = data.content || [];
      
      // Filter for visual content only
      const visualContent = allContent.filter((item: any) => 
        item.metadata?.imageType || 
        item.metadata?.visualElements || 
        item.metadata?.colorPalette
      );

      const stats = analyzeDesignContent(visualContent);
      setDesignStats(stats);

    } catch (err) {
      console.error('Design dashboard error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeDesignContent = (visualContent: any[]): DesignStats => {
    const elementCounts: { [key: string]: number } = {};
    const colorCounts: { [key: string]: number } = {};
    const styleCounts: { [key: string]: number } = {};

    visualContent.forEach(item => {
      // Count visual elements
      if (item.metadata?.visualElements) {
        item.metadata.visualElements.forEach((element: string) => {
          elementCounts[element] = (elementCounts[element] || 0) + 1;
        });
      }

      // Count colors
      if (item.metadata?.colorPalette) {
        item.metadata.colorPalette.forEach((color: string) => {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
      }

      // Count styles
      if (item.metadata?.styleCharacteristics) {
        item.metadata.styleCharacteristics.forEach((style: string) => {
          styleCounts[style] = (styleCounts[style] || 0) + 1;
        });
      }
    });

    // Sort and get top items
    const commonElements = Object.entries(elementCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([element, count]) => ({ element, count }));

    const colorTrends = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([color, count]) => ({ color, count }));

    const stylePatterns = Object.entries(styleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([style, count]) => ({ style, count }));

    // Get recent visual content
    const recentVisualContent = visualContent
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);

    return {
      totalVisualContent: visualContent.length,
      commonElements,
      colorTrends,
      stylePatterns,
      recentVisualContent
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

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading design insights...</span>
        </Spinner>
        <p className="mt-2">Analyzing your visual content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Design Insights Error</Alert.Heading>
        <p>{error}</p>
        <Button variant="outline-danger" onClick={loadDesignData}>
          Try Again
        </Button>
      </Alert>
    );
  }

  if (!designStats || designStats.totalVisualContent === 0) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>🎨 Design Insights</h2>
          <Button variant="outline-primary" size="sm" onClick={loadDesignData}>
            🔄 Refresh
          </Button>
        </div>
        <Alert variant="info">
          <Alert.Heading>🎨 Ready for Visual Content!</Alert.Heading>
          <p>Upload images, screenshots, or visual content to see design insights and patterns.</p>
          <Button variant="primary" href="/">
            ➕ Add Visual Content
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>🎨 Design Insights</h2>
        <Button variant="outline-primary" size="sm" onClick={loadDesignData}>
          🔄 Refresh
        </Button>
      </div>

      {/* Visual Content Overview */}
      <Row className="mb-4">
        <Col md={12}>
          <Card className="text-center">
            <Card.Body>
              <h3 className="text-primary">{designStats.totalVisualContent}</h3>
              <p className="mb-0">Visual Content Items</p>
              <small className="text-muted">Images, designs, and visual references</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Common Visual Elements */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header>
              <strong>🔍 Common Elements</strong>
            </Card.Header>
            <Card.Body>
              {designStats.commonElements.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {designStats.commonElements.map((item, index) => (
                    <Badge
                      key={item.element}
                      bg={index < 3 ? 'primary' : 'secondary'}
                      className="d-flex align-items-center gap-1"
                    >
                      {item.element}
                      <span className="badge bg-light text-dark ms-1">{item.count}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">No visual elements detected yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Color Trends */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header>
              <strong>🎨 Color Trends</strong>
            </Card.Header>
            <Card.Body>
              {designStats.colorTrends.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {designStats.colorTrends.map((item, index) => (
                    <Badge
                      key={item.color}
                      bg={index < 3 ? 'info' : 'light'}
                      text={index < 3 ? 'white' : 'dark'}
                      className="d-flex align-items-center gap-1"
                    >
                      {item.color}
                      <span className={`badge ${index < 3 ? 'bg-light text-dark' : 'bg-secondary'} ms-1`}>
                        {item.count}
                      </span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">No color patterns detected yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Style Patterns */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header>
              <strong>✨ Style Patterns</strong>
            </Card.Header>
            <Card.Body>
              {designStats.stylePatterns.length > 0 ? (
                <div className="d-flex flex-wrap gap-2">
                  {designStats.stylePatterns.map((item, index) => (
                    <Badge
                      key={item.style}
                      bg={index < 3 ? 'success' : 'secondary'}
                      className="d-flex align-items-center gap-1"
                    >
                      {item.style}
                      <span className="badge bg-light text-dark ms-1">{item.count}</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">No style patterns detected yet</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Visual Content */}
      <Card>
        <Card.Header>
          <strong>🖼️ Recent Visual Content</strong>
        </Card.Header>
        <Card.Body>
          {designStats.recentVisualContent.length > 0 ? (
            <Row>
              {designStats.recentVisualContent.map((item) => (
                <Col key={item.id} md={6} lg={4} className="mb-3">
                  <Card className="h-100 shadow-sm">
                    <Card.Body className="p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <Badge bg="info">🎨 Visual</Badge>
                        <small className="text-muted">
                          {formatRelativeTime(item.timestamp)}
                        </small>
                      </div>

                      {item.metadata.dimensions && (
                        <p className="small mb-2">
                          <strong>Size:</strong> {item.metadata.dimensions}
                        </p>
                      )}

                      {item.metadata.visualElements && item.metadata.visualElements.length > 0 && (
                        <div className="mb-2">
                          <small className="text-muted">Elements:</small>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {item.metadata.visualElements.slice(0, 3).map((element, index) => (
                              <Badge key={index} bg="light" text="dark" className="small">
                                {element}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.metadata.colorPalette && item.metadata.colorPalette.length > 0 && (
                        <div className="mb-2">
                          <small className="text-muted">Colors:</small>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {item.metadata.colorPalette.slice(0, 3).map((color, index) => (
                              <Badge key={index} bg="secondary" className="small">
                                {color}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <p className="text-muted mb-0">No recent visual content found</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default DesignInsightsDashboard;