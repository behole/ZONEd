import { useState } from 'react';
import { Card, Button, Alert, Badge, Collapse, Row, Col } from 'react-bootstrap';

function IOSSetupGuide() {
  const [showDetailedSteps, setShowDetailedSteps] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  const currentDomain = window.location.origin;
  const shareUrl = `${currentDomain}/share`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  return (
    <div>
      <Card className="mb-4 border-success">
        <Card.Header className="bg-success text-white">
          <h5 className="mb-0">📱 iOS Share Sheet Integration</h5>
        </Card.Header>
        <Card.Body>
          <Alert variant="info" className="mb-3">
            <strong>🎯 Goal:</strong> Share content from any iOS app directly to your ZONEd system with 100% reliability.
          </Alert>

          {/* Quick Setup */}
          <div className="mb-4">
            <h6>⚡ Quick Setup (Recommended)</h6>
            <p>Use this optimized shortcut URL for maximum compatibility:</p>
            <div className="d-flex gap-2 mb-2">
              <code className="flex-grow-1 p-2 bg-light rounded">
                {shareUrl}?url=[URL]&text=[Text]&title=[Title]&source=ios_shortcut
              </code>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => copyToClipboard(`${shareUrl}?url=[URL]&text=[Text]&title=[Title]&source=ios_shortcut`)}
              >
                📋 Copy
              </Button>
            </div>
            <small className="text-muted">
              This URL handles all content types and provides better error handling.
            </small>
          </div>

          {/* Shortcut Parameters */}
          <div className="mb-4">
            <h6>🔧 Shortcut Parameters</h6>
            <Row>
              <Col md={6}>
                <Card className="mb-2">
                  <Card.Body className="p-3">
                    <h6 className="text-primary">Primary Parameters</h6>
                    <ul className="mb-0 small">
                      <li><code>url</code> - Web page URLs</li>
                      <li><code>text</code> - Text content</li>
                      <li><code>title</code> - Content title</li>
                      <li><code>source</code> - Source identifier</li>
                    </ul>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="mb-2">
                  <Card.Body className="p-3">
                    <h6 className="text-secondary">Alternative Parameters</h6>
                    <ul className="mb-0 small">
                      <li><code>u</code> - Short for URL</li>
                      <li><code>t</code> - Short for text</li>
                      <li><code>content</code> - Alternative text</li>
                      <li><code>format=json</code> - JSON response</li>
                    </ul>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* Step by Step Guide */}
          <div className="mb-3">
            <Button 
              variant="outline-primary" 
              onClick={() => setShowDetailedSteps(!showDetailedSteps)}
              className="mb-2"
            >
              📋 {showDetailedSteps ? 'Hide' : 'Show'} Detailed Setup Steps
            </Button>
            
            <Collapse in={showDetailedSteps}>
              <div>
                <Card>
                  <Card.Body>
                    <h6>Step-by-Step iOS Shortcut Creation:</h6>
                    <ol>
                      <li className="mb-2">
                        <strong>Open Shortcuts App</strong>
                        <p className="small text-muted">Find the Shortcuts app on your iPhone/iPad</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Create New Shortcut</strong>
                        <p className="small text-muted">Tap the "+" button to create a new shortcut</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Receive" Action</strong>
                        <p className="small text-muted">
                          Search for "Receive" and add "Receive input from Share Sheet"<br/>
                          Configure to accept: <Badge bg="info">URLs</Badge> <Badge bg="info">Text</Badge> <Badge bg="info">Safari web pages</Badge>
                        </p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Get URLs from Input"</strong>
                        <p className="small text-muted">This extracts URLs from shared content</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Get Text from Input"</strong>
                        <p className="small text-muted">This extracts text content</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Get Name of Input"</strong>
                        <p className="small text-muted">This gets the title/name of shared content</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Get Contents of URL"</strong>
                        <p className="small text-muted">
                          Configure the URL as: <br/>
                          <code className="small">{shareUrl}?url=[URLs]&text=[Text]&title=[Name]&source=ios_shortcut</code>
                        </p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Add "Show Notification"</strong>
                        <p className="small text-muted">Show "Content shared to ZONEd!" for confirmation</p>
                      </li>
                      
                      <li className="mb-2">
                        <strong>Name Your Shortcut</strong>
                        <p className="small text-muted">Name it "Share to ZONEd" or similar</p>
                      </li>
                      
                      <li className="mb-0">
                        <strong>Enable in Share Sheet</strong>
                        <p className="small text-muted">Make sure "Use with Share Sheet" is enabled in shortcut settings</p>
                      </li>
                    </ol>
                  </Card.Body>
                </Card>
              </div>
            </Collapse>
          </div>

          {/* Troubleshooting */}
          <div className="mb-3">
            <Button 
              variant="outline-warning" 
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="mb-2"
            >
              🔧 {showTroubleshooting ? 'Hide' : 'Show'} Troubleshooting Guide
            </Button>
            
            <Collapse in={showTroubleshooting}>
              <div>
                <Card className="border-warning">
                  <Card.Body>
                    <h6 className="text-warning">Common Issues & Solutions:</h6>
                    
                    <div className="mb-3">
                      <strong>❌ "No content provided" error</strong>
                      <ul className="small">
                        <li>Make sure your shortcut includes "Get URLs from Input", "Get Text from Input", and "Get Name of Input" actions</li>
                        <li>Check that the URL parameters match exactly: <code>url</code>, <code>text</code>, <code>title</code></li>
                        <li>Verify the shortcut is configured to receive the right input types</li>
                      </ul>
                    </div>
                    
                    <div className="mb-3">
                      <strong>❌ Shortcut fails intermittently</strong>
                      <ul className="small">
                        <li>Add a "Wait" action (1-2 seconds) before the URL request</li>
                        <li>Use the alternative parameters: <code>u</code>, <code>t</code>, <code>content</code></li>
                        <li>Add <code>&format=json</code> to get JSON responses instead of redirects</li>
                      </ul>
                    </div>
                    
                    <div className="mb-3">
                      <strong>❌ Network timeout errors</strong>
                      <ul className="small">
                        <li>Increase timeout in "Get Contents of URL" to 30 seconds</li>
                        <li>Add error handling with "If" conditions</li>
                        <li>Use "Show Notification" to display error messages</li>
                      </ul>
                    </div>
                    
                    <div className="mb-0">
                      <strong>✅ Pro Tips for 100% Success Rate</strong>
                      <ul className="small">
                        <li>Always include the <code>source=ios_shortcut</code> parameter</li>
                        <li>Test with different content types (URLs, text, Safari pages)</li>
                        <li>Use the JSON format for better error handling</li>
                        <li>Add multiple fallback parameters for maximum compatibility</li>
                      </ul>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </Collapse>
          </div>

          {/* Test Section */}
          <Alert variant="success">
            <h6>🧪 Test Your Setup</h6>
            <p className="mb-2">
              Once your shortcut is set up, test it by sharing:
            </p>
            <ul className="mb-2">
              <li>A Safari web page</li>
              <li>Text from Notes app</li>
              <li>A URL from Messages</li>
            </ul>
            <p className="mb-0 small">
              Check the <strong>Browse</strong> section to see if your content appears correctly.
            </p>
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
}

export default IOSSetupGuide;