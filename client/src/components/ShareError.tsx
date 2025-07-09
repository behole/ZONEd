import React from 'react';
import { Container, Alert, Button, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const ShareError: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container className="mt-4">
      <Card>
        <Card.Body className="text-center">
          <Alert variant="danger">
            <Alert.Heading>❌ Share Failed</Alert.Heading>
            <p>
              There was an error processing your shared content. Please try again.
            </p>
            <p className="mb-0">
              If the problem persists, you can manually add content through the main app.
            </p>
          </Alert>
          
          <div className="d-grid gap-2">
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
              size="lg"
            >
              Go to Main App
            </Button>
            <Button 
              variant="outline-secondary" 
              onClick={() => window.close()}
            >
              Close
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ShareError;