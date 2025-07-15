import { useState, useEffect } from 'react';
import { Card, Button, Alert, Badge, Row, Col, Container } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';

const ShareSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  
  useEffect(() => {
    // Get URL parameters
    const urlParams = new URLSearchParams(location.search);
    const data = {
      itemsCount: urlParams.get('items') || '1',
      contentType: urlParams.get('type') || 'unknown',
      source: urlParams.get('source') || 'ios_shortcut',
      timestamp: new Date().toLocaleString()
    };
    setShareData(data);
  }, [location]);
  
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'url': return '🔗';
      case 'text': return '📝';
      case 'file': return '📄';
      default: return '📋';
    }
  };

  const getContentTypeLabel = (type: string) => {
    switch (type) {
      case 'url': return 'Web Content';
      case 'text': return 'Text Note';
      case 'file': return 'File Upload';
      default: return 'Content';
    }
  };

  if (!shareData) {
    return <Container className="mt-4"><div>Loading...</div></Container>;
  }
  
  return (
    <Container className="mt-4">
      <div className="text-center">
        <Card className="border-success shadow">
          <Card.Header className="bg-success text-white">
            <h4>✅ Content Successfully Captured!</h4>
          </Card.Header>
          <Card.Body>
            <Alert variant="success" className="mb-4">
              <div className="d-flex align-items-center justify-content-center gap-3 mb-3">
                <div className="display-4">🎉</div>
                <div>
                  <h5 className="mb-1">Perfect! Your content is now in ZONEd</h5>
                  <p className="mb-0">
                    Successfully processed {shareData.itemsCount} {getContentTypeLabel(shareData.contentType).toLowerCase()}
                    {shareData.itemsCount !== '1' ? 's' : ''} from your iOS device.
                  </p>
                </div>
              </div>
              
              <div className="d-flex justify-content-center gap-2">
                <Badge bg="primary" className="px-3 py-2">
                  {getContentTypeIcon(shareData.contentType)} {getContentTypeLabel(shareData.contentType)}
                </Badge>
                <Badge bg="info" className="px-3 py-2">
                  📱 iOS Share Sheet
                </Badge>
                <Badge bg="success" className="px-3 py-2">
                  ✅ Processed
                </Badge>
              </div>
            </Alert>
            
            <Row className="mb-4">
              <Col md={3}>
                <Card className="text-center h-100 border-0 bg-light">
                  <Card.Body className="py-3">
                    <div className="h4 text-primary">🧠</div>
                    <small><strong>AI Analyzed</strong><br/>Content processed with intelligence</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center h-100 border-0 bg-light">
                  <Card.Body className="py-3">
                    <div className="h4 text-success">🔍</div>
                    <small><strong>Searchable</strong><br/>Added to your knowledge base</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center h-100 border-0 bg-light">
                  <Card.Body className="py-3">
                    <div className="h4 text-warning">🏷️</div>
                    <small><strong>Tagged</strong><br/>Automatically categorized</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="text-center h-100 border-0 bg-light">
                  <Card.Body className="py-3">
                    <div className="h4 text-info">🔗</div>
                    <small><strong>Connected</strong><br/>Linked to related content</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            <div className="mb-4">
              <h6 className="text-muted mb-3">What would you like to do next?</h6>
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                <Button variant="primary" onClick={() => navigate('/query')} className="px-4">
                  🔍 Ask Questions About Your Content
                </Button>
                <Button variant="outline-primary" onClick={() => navigate('/browse')} className="px-4">
                  📚 Browse Your Library
                </Button>
                <Button variant="outline-secondary" onClick={() => navigate('/dashboard')} className="px-4">
                  📊 View Dashboard
                </Button>
              </div>
            </div>
            
            <div className="mb-3">
              <Button variant="success" onClick={() => navigate('/')} className="px-4">
                ➕ Share More Content
              </Button>
            </div>
            
            <div className="border-top pt-3">
              <Button 
                variant="link" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-muted"
              >
                {showDetails ? '▲ Hide' : '▼ Show'} Technical Details
              </Button>
              
              {showDetails && (
                <div className="mt-3 p-3 bg-light rounded text-start">
                  <h6 className="text-primary mb-2">📋 Processing Summary</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <small>
                        <strong>Content Details:</strong><br/>
                        • Type: {getContentTypeLabel(shareData.contentType)}<br/>
                        • Items: {shareData.itemsCount}<br/>
                        • Source: {shareData.source}<br/>
                        • Processed: {shareData.timestamp}
                      </small>
                    </div>
                    <div className="col-md-6">
                      <small>
                        <strong>AI Processing:</strong><br/>
                        • ✅ Content extracted and cleaned<br/>
                        • ✅ Importance score calculated<br/>
                        • ✅ Vector embeddings generated<br/>
                        • ✅ Contextual tags assigned
                      </small>
                    </div>
                  </div>
                  
                  <div className="mt-3 p-2 bg-white rounded border">
                    <small className="text-success">
                      <strong>🎯 Your iOS Share Sheet is working perfectly!</strong><br/>
                      Content was successfully captured and processed. The system is ready for your next share.
                    </small>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-muted">
              <small>
                💡 <strong>Pro Tip:</strong> Try asking "What did I just share?" in the Query section to see how your content was processed!
              </small>
            </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};

export default ShareSuccess;