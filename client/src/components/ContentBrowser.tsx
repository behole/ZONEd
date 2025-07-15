import { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Badge, Button, Form, InputGroup, 
  Dropdown, Modal, Alert, Spinner, ButtonGroup 
} from 'react-bootstrap';

interface ContentItem {
  id: string;
  type: 'text' | 'url' | 'file';
  content: string;
  extractedContent?: string;
  timestamp: string;
  importanceScore: number;
  submissionCount: number;
  contextualTags: string[];
  metadata: any;
  urgencyAssessment?: {
    level: 'low' | 'medium' | 'high';
  };
}

interface FilterOptions {
  type: string;
  importance: string;
  urgency: string;
  timeframe: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

function ContentBrowser() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [filteredContent, setFilteredContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    importance: 'all',
    urgency: 'all',
    timeframe: 'all',
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    applyFiltersAndSearch();
  }, [content, searchQuery, filters]);

  const loadContent = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/content');
      
      if (!response.ok) {
        throw new Error('Failed to load content');
      }
      
      const data = await response.json();
      setContent(data.content || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFiltersAndSearch = () => {
    let filtered = [...content];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.content.toLowerCase().includes(query) ||
        (item.extractedContent && item.extractedContent.toLowerCase().includes(query)) ||
        (item.metadata?.title && item.metadata.title.toLowerCase().includes(query)) ||
        item.contextualTags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply filters
    if (filters.type !== 'all') {
      filtered = filtered.filter(item => item.type === filters.type);
    }

    if (filters.importance !== 'all') {
      switch (filters.importance) {
        case 'high':
          filtered = filtered.filter(item => item.importanceScore >= 7);
          break;
        case 'medium':
          filtered = filtered.filter(item => item.importanceScore >= 4 && item.importanceScore < 7);
          break;
        case 'low':
          filtered = filtered.filter(item => item.importanceScore < 4);
          break;
      }
    }

    if (filters.urgency !== 'all') {
      filtered = filtered.filter(item => 
        item.urgencyAssessment?.level === filters.urgency
      );
    }

    if (filters.timeframe !== 'all') {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (filters.timeframe) {
        case 'today':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }
      
      filtered = filtered.filter(item => new Date(item.timestamp) > cutoffDate);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'importance':
          aValue = a.importanceScore;
          bValue = b.importanceScore;
          break;
        case 'submissions':
          aValue = a.submissionCount;
          bValue = b.submissionCount;
          break;
        case 'timestamp':
        default:
          aValue = new Date(a.timestamp).getTime();
          bValue = new Date(b.timestamp).getTime();
      }
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredContent(filtered);
  };

  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: 'all',
      importance: 'all',
      urgency: 'all',
      timeframe: 'all',
      sortBy: 'timestamp',
      sortOrder: 'desc'
    });
    setSearchQuery('');
  };

  const openPreview = (item: ContentItem) => {
    setSelectedItem(item);
    setShowPreview(true);
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

  const getUrgencyColor = (level?: string) => {
    switch (level) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  const renderContentCard = (item: ContentItem) => (
    <Card 
      key={item.id} 
      className="h-100 shadow-sm content-card" 
      style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
      onClick={() => openPreview(item)}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex gap-1 flex-wrap">
            <Badge bg="outline-primary" className="small">
              {getContentTypeIcon(item.type)} {item.type}
            </Badge>
            <Badge bg={getImportanceColor(item.importanceScore)} className="small">
              ⭐ {item.importanceScore.toFixed(1)}
            </Badge>
            {item.urgencyAssessment?.level === 'high' && (
              <Badge bg="danger" className="small">🔴</Badge>
            )}
            {item.submissionCount > 1 && (
              <Badge bg="info" className="small">🔄 {item.submissionCount}</Badge>
            )}
          </div>
          <small className="text-muted">
            {formatRelativeTime(item.timestamp)}
          </small>
        </div>
        
        {/* Content preview */}
        <div className="mb-2">
          {item.metadata?.title && (
            <h6 className="card-title text-truncate mb-1">{item.metadata.title}</h6>
          )}
          <p className="card-text small text-muted" style={{ 
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.extractedContent || item.content}
          </p>
        </div>
        
        {/* Visual indicators for special content */}
        {item.metadata?.imageType && (
          <div className="mb-2">
            <Badge bg="info" className="small">🎨 Visual Content</Badge>
            {item.metadata.dimensions && (
              <Badge bg="light" text="dark" className="small ms-1">
                {item.metadata.dimensions}
              </Badge>
            )}
          </div>
        )}
        
        {item.metadata?.domain && (
          <div className="mb-2">
            <Badge bg="light" text="dark" className="small">
              🌐 {item.metadata.domain}
            </Badge>
          </div>
        )}
        
        {/* Tags */}
        {item.contextualTags && item.contextualTags.length > 0 && (
          <div className="mt-2">
            {item.contextualTags.slice(0, 3).map(tag => (
              <Badge key={tag} bg="light" text="dark" className="me-1 small">
                #{tag}
              </Badge>
            ))}
            {item.contextualTags.length > 3 && (
              <Badge bg="light" text="dark" className="small">
                +{item.contextualTags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );

  const renderListItem = (item: ContentItem) => (
    <Card 
      key={item.id} 
      className="mb-2 shadow-sm" 
      style={{ cursor: 'pointer' }}
      onClick={() => openPreview(item)}
    >
      <Card.Body className="p-3">
        <Row className="align-items-center">
          <Col md={8}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span>{getContentTypeIcon(item.type)}</span>
              {item.metadata?.title ? (
                <h6 className="mb-0">{item.metadata.title}</h6>
              ) : (
                <span className="text-truncate">
                  {item.content.substring(0, 60)}...
                </span>
              )}
            </div>
            <p className="text-muted small mb-0">
              {(item.extractedContent || item.content).substring(0, 120)}...
            </p>
          </Col>
          <Col md={4} className="text-end">
            <div className="d-flex gap-1 justify-content-end mb-1">
              <Badge bg={getImportanceColor(item.importanceScore)}>
                ⭐ {item.importanceScore.toFixed(1)}
              </Badge>
              {item.submissionCount > 1 && (
                <Badge bg="info">🔄 {item.submissionCount}</Badge>
              )}
            </div>
            <small className="text-muted">
              {formatRelativeTime(item.timestamp)}
            </small>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading content...</span>
        </Spinner>
        <p className="mt-2">Loading your content library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error Loading Content</Alert.Heading>
        <p>{error}</p>
        <Button variant="outline-danger" onClick={loadContent}>
          Try Again
        </Button>
      </Alert>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📚 Content Library</h2>
        <div className="d-flex gap-2">
          <ButtonGroup size="sm">
            <Button 
              variant={viewMode === 'grid' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('grid')}
            >
              ⊞ Grid
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'primary' : 'outline-primary'}
              onClick={() => setViewMode('list')}
            >
              ☰ List
            </Button>
          </ButtonGroup>
          <Button variant="outline-secondary" size="sm" onClick={loadContent}>
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="small">Search Content</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search content, tags, titles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => setSearchQuery('')}
                    >
                      ✕
                    </Button>
                  )}
                </InputGroup>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">Type</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.type}
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="text">📝 Text</option>
                  <option value="url">🔗 URLs</option>
                  <option value="file">📄 Files</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">Importance</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.importance}
                  onChange={(e) => handleFilterChange('importance', e.target.value)}
                >
                  <option value="all">All Levels</option>
                  <option value="high">⭐⭐⭐ High</option>
                  <option value="medium">⭐⭐ Medium</option>
                  <option value="low">⭐ Low</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <Form.Group>
                <Form.Label className="small">Time</Form.Label>
                <Form.Select
                  size="sm"
                  value={filters.timeframe}
                  onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </Form.Select>
              </Form.Group>
            </Col>
            
            <Col md={2}>
              <div className="d-flex gap-1">
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={clearFilters}
                >
                  Clear
                </Button>
                <Dropdown>
                  <Dropdown.Toggle variant="outline-primary" size="sm">
                    Sort
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => handleFilterChange('sortBy', 'timestamp')}>
                      📅 By Date
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleFilterChange('sortBy', 'importance')}>
                      ⭐ By Importance
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleFilterChange('sortBy', 'submissions')}>
                      🔄 By Activity
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => handleFilterChange('sortOrder', 'desc')}>
                      ↓ Descending
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => handleFilterChange('sortOrder', 'asc')}>
                      ↑ Ascending
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Results Summary */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <p className="mb-0 text-muted">
          Showing {filteredContent.length} of {content.length} items
          {searchQuery && ` for "${searchQuery}"`}
        </p>
      </div>

      {/* Content Grid/List */}
      {filteredContent.length > 0 ? (
        viewMode === 'grid' ? (
          <Row>
            {filteredContent.map((item) => (
              <Col key={item.id} md={6} lg={4} className="mb-3">
                {renderContentCard(item)}
              </Col>
            ))}
          </Row>
        ) : (
          <div>
            {filteredContent.map(renderListItem)}
          </div>
        )
      ) : (
        <Alert variant="info">
          <Alert.Heading>No Content Found</Alert.Heading>
          <p>
            {searchQuery || Object.values(filters).some(f => f !== 'all' && f !== 'timestamp' && f !== 'desc') 
              ? 'Try adjusting your search or filters.' 
              : 'Start adding content to build your knowledge base.'}
          </p>
        </Alert>
      )}

      {/* Content Preview Modal */}
      <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedItem && (
              <>
                {getContentTypeIcon(selectedItem.type)} Content Preview
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <div>
              {/* Metadata */}
              <div className="mb-3">
                <div className="d-flex gap-2 mb-2">
                  <Badge bg={getImportanceColor(selectedItem.importanceScore)}>
                    ⭐ Importance: {selectedItem.importanceScore.toFixed(1)}
                  </Badge>
                  {selectedItem.urgencyAssessment?.level !== 'low' && (
                    <Badge bg={getUrgencyColor(selectedItem.urgencyAssessment?.level)}>
                      {selectedItem.urgencyAssessment?.level === 'high' ? '🔴 Urgent' : '🟡 Important'}
                    </Badge>
                  )}
                  <Badge bg="info">
                    🔄 Submitted {selectedItem.submissionCount} time{selectedItem.submissionCount > 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {selectedItem.metadata?.title && (
                  <h5>{selectedItem.metadata.title}</h5>
                )}
                
                <p className="text-muted small">
                  Added {formatRelativeTime(selectedItem.timestamp)}
                  {selectedItem.metadata?.domain && ` from ${selectedItem.metadata.domain}`}
                </p>
              </div>

              {/* Content */}
              <div className="mb-3">
                <h6>Content:</h6>
                <div className="p-3 bg-light rounded">
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedItem.extractedContent || selectedItem.content}
                  </p>
                </div>
              </div>

              {/* Visual Content Info */}
              {selectedItem.metadata?.imageType && (
                <div className="mb-3">
                  <h6>Visual Analysis:</h6>
                  <div className="p-3 bg-light rounded">
                    {selectedItem.metadata.visualElements && (
                      <p><strong>Elements:</strong> {selectedItem.metadata.visualElements.join(', ')}</p>
                    )}
                    {selectedItem.metadata.colorPalette && (
                      <p><strong>Colors:</strong> {selectedItem.metadata.colorPalette.join(', ')}</p>
                    )}
                    {selectedItem.metadata.designInsights && (
                      <div>
                        <strong>Design Insights:</strong>
                        <ul>
                          {selectedItem.metadata.designInsights.map((insight: string, index: number) => (
                            <li key={index}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedItem.contextualTags && selectedItem.contextualTags.length > 0 && (
                <div className="mb-3">
                  <h6>Tags:</h6>
                  <div className="d-flex flex-wrap gap-1">
                    {selectedItem.contextualTags.map(tag => (
                      <Badge key={tag} bg="light" text="dark">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreview(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ContentBrowser;