import React, { useEffect, useState } from 'react';
import { Container, Alert, Button, Card } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';

const ShareSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const items = params.get('items');
    setItemCount(items ? parseInt(items) : 0);
  }, [location]);

  return (
    <Container className="mt-4">
      <Card>
        <Card.Body className="text-center">
          <Alert variant="success">
            <Alert.Heading>✅ Share Successful!</Alert.Heading>
            <p>
              {itemCount > 0 
                ? `Successfully processed ${itemCount} shared item${itemCount > 1 ? 's' : ''}.`
                : 'Your shared content has been processed successfully.'
              }
            </p>
            <p className="mb-0">
              The content has been added to your personal data collection and is now searchable.
            </p>
          </Alert>
          
          <div className="d-grid gap-2">
            <Button 
              variant="primary" 
              onClick={() => navigate('/')}
              size="lg"
            >
              View All Content
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

export default ShareSuccess;