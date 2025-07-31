import React from 'react';
import { Alert, Button, Card } from 'react-bootstrap';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('🚨 Error Info:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-danger">
          <Card.Header className="bg-danger text-white">
            <h5 className="mb-0">⚠️ Something went wrong</h5>
          </Card.Header>
          <Card.Body>
            <Alert variant="danger">
              <Alert.Heading>Component Error</Alert.Heading>
              <p>
                This component encountered an error and couldn't render properly. 
                This is likely due to a data formatting issue.
              </p>
              <details className="mt-3">
                <summary>Technical Details</summary>
                <pre className="mt-2 small">
                  {this.state.error?.message}
                </pre>
              </details>
            </Alert>
            <div className="d-flex gap-2">
              <Button 
                variant="primary" 
                onClick={() => window.location.reload()}
              >
                🔄 Reload Page
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => this.setState({ hasError: false })}
              >
                🔄 Try Again
              </Button>
            </div>
          </Card.Body>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;