import React, { useState } from 'react';
import { Card, Button, Alert, Modal } from 'react-bootstrap';

const ShareInstructions: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const currentUrl = window.location.origin;



  return (
    <>
      <Card className="mb-3">
        <Card.Header>
          <h5>📱 Share Content to Your Personal Data</h5>
        </Card.Header>
        <Card.Body>
          <Alert variant="info">
            <strong>Quick Share Options:</strong>
          </Alert>
          
          <div className="d-grid gap-2">
            <Button 
              variant="primary" 
              onClick={() => setShowModal(true)}
            >
              📖 Setup iOS Shortcut (Recommended)
            </Button>
            
            <Button 
              variant="outline-secondary"
              onClick={() => {
                const text = prompt("Enter text to save:");
                if (text) {
                  window.open(`/share?text=${encodeURIComponent(text)}`, '_blank');
                }
              }}
            >
              ✏️ Quick Text Share
            </Button>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Setup iOS Shortcut</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success">
            <strong>This method works 100% of the time!</strong>
          </Alert>
          
          <h6>Steps:</h6>
          <ol>
            <li><strong>Open iOS Shortcuts app</strong></li>
            <li><strong>Tap "+" to create new shortcut</strong></li>
            <li><strong>Add "Get Contents of URL" action</strong></li>
            <li><strong>Configure:</strong>
              <ul>
                <li>URL: <code>{currentUrl}/share</code></li>
                <li>Method: GET</li>
                <li>Add parameter: <code>text</code> = "Shortcut Input"</li>
              </ul>
            </li>
            <li><strong>Tap settings (⚙️) → Enable "Use with Share Sheet"</strong></li>
            <li><strong>Name it "Save to Personal Data"</strong></li>
            <li><strong>Save</strong></li>
          </ol>
          
          <Alert variant="warning">
            <strong>Now you can share from any app:</strong><br/>
            Share button → "Save to Personal Data" → Done!
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ShareInstructions;