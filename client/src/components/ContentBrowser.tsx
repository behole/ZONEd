import { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Badge, Button, Form, InputGroup, 
  Dropdown, Modal, Alert, Spinner, ButtonGroup 
} from 'react-bootstrap';
import SafeNumericDisplay from './SafeNumericDisplay';
import VisualContentCard from './VisualContentCard';

interface ContentItem {
  id: string;
  type: 'text' | 'url' | 'file';
  content: string;
  extractedContent?: string;
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
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set());
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  
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
      setError(null); // Clear previous errors
      console.log('🔄 Loading content browser data...');
      console.log('🌐 Current URL:', window.location.href);
      console.log('📡 Fetching from:', '/api/content');
      
      const response = await fetch('/api/content', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 Content Browser API Response status:', response.status);
      console.log('📡 Content Browser API Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Content Browser API Error Response:', errorText);
        throw new Error(`Failed to load content: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📊 Content Browser Raw API Data received:', data);
      console.log('📊 Content Browser Data structure:', {
        hasContent: !!data.content,
        contentType: typeof data.content,
        contentLength: data.content?.length,
        hasNotes: !!data.notes,
        notesLength: data.notes?.length,
        dataKeys: Object.keys(data)
      });
      
      const allContent = data.content || [];
      console.log('📋 Content Browser items found:', allContent.length);
      
      if (allContent.length > 0) {
        console.log('📋 Content Browser sample item:', allContent[0]);
        console.log('📋 Content Browser all IDs:', allContent.map(item => item.id));
      }
      
      setContent(allContent);
      console.log('✅ Content Browser data loading completed successfully');
      
    } catch (err) {
      console.error('❌ Content Browser loading error:', err);
      console.error('❌ Content Browser Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      console.log('🏁 Content Browser loading finished (loading state set to false)');
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
          filtered = filtered.filter(item => (item.importanceScore || 1) >= 7);
          break;
        case 'medium':
          filtered = filtered.filter(item => (item.importanceScore || 1) >= 4 && (item.importanceScore || 1) < 7);
          break;
        case 'low':
          filtered = filtered.filter(item => (item.importanceScore || 1) < 4);
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
          aValue = a.importanceScore || 1;
          bValue = b.importanceScore || 1;
          break;
        case 'submissions':
          aValue = a.submissionCount || 1;
          bValue = b.submissionCount || 1;
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

  const deleteItem = async (itemId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation(); // Prevent opening preview when clicking delete
    }

    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    setDeletingItems(prev => new Set(prev).add(itemId));

    try {
      const response = await fetch(`/api/content/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete item: ${response.status} ${response.statusText}`);
      }

      // Remove item from local state
      setContent(prev => prev.filter(item => item.id !== itemId));
      
      // Close preview if this item was being previewed
      if (selectedItem?.id === itemId) {
        setShowPreview(false);
        setSelectedItem(null);
      }

      console.log(`✅ Successfully deleted item ${itemId}`);
    } catch (error) {
      console.error('❌ Delete error:', error);
      alert(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const regenerateSummary = async (itemId: string) => {
    console.log('🔄 Starting regenerate summary for ID:', itemId, typeof itemId);
    setRegeneratingIds(prev => new Set(prev).add(itemId));

    try {
      console.log('📡 Making POST request to:', `/api/content/${itemId}/regenerate-summary`);
      
      const response = await fetch(`/api/content/${itemId}/regenerate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        throw new Error(errorData.error || `Failed to regenerate summary: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Success response:', result);
      
      // Update the content item with new summary
      setContent(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, summary: result.summary }
          : item
      ));

      // Update selected item if it's the one we regenerated
      if (selectedItem?.id === itemId) {
        setSelectedItem(prev => prev ? { ...prev, summary: result.summary } : null);
      }

      console.log('✅ Summary regenerated successfully');
    } catch (error) {
      console.error('❌ Regenerate summary error:', error);
      alert(`Failed to regenerate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRegeneratingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
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

  const renderContentCard = (item: ContentItem) => {
    const isImage = item.mimetype && item.mimetype.startsWith('image/');
    const imageUrl = isImage && item.filename ? `/uploads/${item.filename}` : null;
    
    // Debug logging for images
    if (item.mimetype?.startsWith('image/')) {
      console.log('ContentBrowser Image Item:', {
        id: item.id,
        type: item.type,
        mimetype: item.mimetype,
        filename: item.filename,
        imageUrl,
        metadata: item.metadata
      });
    }
    
    return (
      <Card 
        key={item.id} 
        className="h-100 shadow-sm content-card" 
        style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
        onClick={() => openPreview(item)}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        {imageUrl && (
          <div style={{ height: '120px', overflow: 'hidden' }}>
            <img 
              src={imageUrl} 
              alt={item.originalName || 'Content image'} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover'
              }}
              onError={(e) => {
                console.error('ContentBrowser image load error:', imageUrl);
                console.error('Error details:', e);
              }}
              onLoad={() => console.log('ContentBrowser image loaded:', imageUrl)}
            />
          </div>
        )}
        <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex gap-1 flex-wrap">
            <Badge bg="outline-primary" className="small">
              {getContentTypeIcon(item.type)} {item.type}
            </Badge>
            <Badge bg={getImportanceColor(item.importanceScore || 1)} className="small">
              ⭐ <SafeNumericDisplay value={item.importanceScore} decimals={1} fallback={1} />
            </Badge>
            {item.urgencyAssessment?.level === 'high' && (
              <Badge bg="danger" className="small">🔴</Badge>
            )}
            {item.submissionCount > 1 && (
              <Badge bg="info" className="small">🔄 {item.submissionCount}</Badge>
            )}
          </div>
          <div className="d-flex align-items-center gap-2">
            <small className="text-muted">
              {formatRelativeTime(item.timestamp)}
            </small>
            <Button
              variant="outline-danger"
              size="sm"
              className="p-1"
              style={{ fontSize: '0.7rem', lineHeight: 1 }}
              onClick={(e) => deleteItem(item.id, e)}
              disabled={deletingItems.has(item.id)}
              title="Delete this item"
            >
              {deletingItems.has(item.id) ? '⏳' : '🗑️'}
            </Button>
          </div>
        </div>
        
        {/* Content preview */}
        <div className="mb-2">
          {item.metadata?.title && (
            <h6 className="card-title text-truncate mb-1">{item.metadata.title}</h6>
          )}
          
          {/* AI Summary */}
          <div className="mb-2">
            {item.summary ? (
              <>
                <p className="card-text" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontStyle: 'italic',
                  color: '#495057',
                  fontSize: '0.9rem',
                  lineHeight: '1.4'
                }}>
                  💡 {item.summary}
                </p>
                <small className="text-muted">AI Generated Summary</small>
              </>
            ) : (
              <>
                <p className="card-text text-muted" style={{ 
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontSize: '0.85rem',
                  fontStyle: 'italic'
                }}>
                  📝 Summary not yet generated...
                </p>
                <small className="text-muted">Processing</small>
              </>
            )}
          </div>
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
  };

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
              <Badge bg={getImportanceColor(item.importanceScore || 1)}>
                ⭐ <SafeNumericDisplay value={item.importanceScore} decimals={1} fallback={1} />
              </Badge>
              {item.submissionCount > 1 && (
                <Badge bg="info">🔄 {item.submissionCount}</Badge>
              )}
              <Button
                variant="outline-danger"
                size="sm"
                className="p-1 ms-2"
                style={{ fontSize: '0.7rem', lineHeight: 1 }}
                onClick={(e) => deleteItem(item.id, e)}
                disabled={deletingItems.has(item.id)}
                title="Delete this item"
              >
                {deletingItems.has(item.id) ? '⏳' : '🗑️'}
              </Button>
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
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={loadContent}>
              🔄 Refresh
            </Button>
            <Button 
              variant="outline-info" 
              size="sm" 
              onClick={() => {
                console.log('🔍 Content Browser Debug Info:');
                console.log('- Total content items:', content.length);
                console.log('- Filtered content items:', filteredContent.length);
                console.log('- Current filters:', filters);
                console.log('- Search query:', searchQuery);
                console.log('- Loading state:', isLoading);
                console.log('- Error state:', error);
                alert('Check browser console (F12) for debug info');
              }}
            >
              🐛 Debug
            </Button>
          </div>
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
          <Alert.Heading>
            {content.length === 0 ? '📚 Your Content Library Awaits!' : 'No Content Found'}
          </Alert.Heading>
          <p>
            {content.length === 0 
              ? 'Your content library is empty. Start adding content to build your personal knowledge base!'
              : searchQuery || Object.values(filters).some(f => f !== 'all' && f !== 'timestamp' && f !== 'desc') 
                ? 'Try adjusting your search or filters to find what you\'re looking for.' 
                : 'No content matches your current criteria.'}
          </p>
          {content.length === 0 && (
            <div className="d-flex gap-2">
              <Button variant="primary" href="/">
                ➕ Add Your First Content
              </Button>
              <Button variant="outline-secondary" onClick={loadContent}>
                🔄 Refresh
              </Button>
            </div>
          )}
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
                  <Badge bg={getImportanceColor(selectedItem.importanceScore || 1)}>
                    ⭐ Importance: <SafeNumericDisplay value={selectedItem.importanceScore} decimals={1} fallback={1} />
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

              {/* AI Summary */}
              {selectedItem.summary ? (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">💡 AI Generated Summary:</h6>
                    <Button 
                      size="sm" 
                      variant="outline-primary"
                      onClick={() => regenerateSummary(selectedItem.id)}
                      disabled={regeneratingIds.has(selectedItem.id)}
                    >
                      {regeneratingIds.has(selectedItem.id) ? '⏳ Generating...' : '🔄 Regenerate'}
                    </Button>
                  </div>
                  <div className="p-3 bg-primary bg-opacity-10 rounded border-start border-primary border-3">
                    <p className="mb-0" style={{ fontStyle: 'italic', fontSize: '1.05rem', lineHeight: '1.5' }}>
                      {selectedItem.summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="mb-0">📝 Summary:</h6>
                    <Button 
                      size="sm" 
                      variant="primary"
                      onClick={() => regenerateSummary(selectedItem.id)}
                      disabled={regeneratingIds.has(selectedItem.id)}
                    >
                      {regeneratingIds.has(selectedItem.id) ? '⏳ Generating...' : '✨ Generate Summary'}
                    </Button>
                  </div>
                  <div className="p-3 bg-warning bg-opacity-10 rounded border-start border-warning border-3">
                    <p className="mb-0 text-muted" style={{ fontStyle: 'italic' }}>
                      AI summary not yet generated for this content.
                    </p>
                  </div>
                </div>
              )}

              {/* Original Content */}
              <div className="mb-3">
                <h6>Original Content:</h6>
                <div className="p-3 bg-light rounded" style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>
                    {selectedItem.extractedContent || selectedItem.content}
                  </p>
                </div>
              </div>

              {/* Visual Content Analysis */}
              <VisualContentCard 
                metadata={selectedItem.metadata} 
                title={selectedItem.metadata?.title}
                filename={selectedItem.metadata?.filename}
                mimetype={selectedItem.metadata?.mimetype}
                originalName={selectedItem.metadata?.originalName}
              />

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
          {selectedItem && (
            <Button 
              variant="danger" 
              onClick={() => deleteItem(selectedItem.id)}
              disabled={deletingItems.has(selectedItem.id)}
            >
              {deletingItems.has(selectedItem.id) ? '⏳ Deleting...' : '🗑️ Delete Item'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ContentBrowser;