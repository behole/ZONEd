
import { useState } from 'react';
import { Form, Button, Card, Badge, Spinner, Alert } from 'react-bootstrap';

interface QueryResult {
  success: boolean;
  query: string;
  queryAnalysis?: any;
  response?: any;
  searchResults?: any[];
  error?: string;
}

function QueryPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNewsletter, setIsGeneratingNewsletter] = useState(false);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error querying:', error);
      setResults({
        success: false,
        query,
        error: 'An error occurred while processing your query.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuery = (quickQuery: string) => {
    setQuery(quickQuery);
  };

  const handleGenerateNewsletter = async () => {
    setIsGeneratingNewsletter(true);
    try {
      const response = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeframe: 'week',
          format: 'html'
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Open newsletter in new window
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(data.content);
          newWindow.document.close();
        }
      } else {
        alert('Failed to generate newsletter: ' + data.error);
      }
    } catch (error) {
      console.error('Newsletter generation error:', error);
      alert('An error occurred while generating the newsletter.');
    } finally {
      setIsGeneratingNewsletter(false);
    }
  };

  const formatScore = (score: number) => {
    return Math.round(score * 100);
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      default: return 'secondary';
    }
  };

  return (
    <div>
      <h2>Intelligent Query Interface</h2>
      
      {/* Quick Query Buttons */}
      <div className="mb-3">
        <h6>Quick Queries:</h6>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleQuickQuery("What am I thinking about lately?")}
          >
            What am I thinking about lately?
          </Button>
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleQuickQuery("Show me urgent items")}
          >
            Show me urgent items
          </Button>
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleQuickQuery("What did I work on this week?")}
          >
            What did I work on this week?
          </Button>
          <Button 
            variant="outline-primary" 
            size="sm"
            onClick={() => handleQuickQuery("Show me trending topics")}
          >
            Show me trending topics
          </Button>
        </div>
        
        {/* Newsletter Generation */}
        <div className="d-flex gap-2">
          <Button 
            variant="success" 
            size="sm"
            onClick={handleGenerateNewsletter}
            disabled={isGeneratingNewsletter}
          >
            {isGeneratingNewsletter ? (
              <>
                <Spinner size="sm" className="me-2" />
                Generating...
              </>
            ) : (
              '📰 Generate Weekly Newsletter'
            )}
          </Button>
        </div>
      </div>

      {/* Query Form */}
      <Form onSubmit={handleQuery}>
        <Form.Group className="mb-3">
          <Form.Label>Ask anything about your content</Form.Label>
          <Form.Control
            type="text"
            placeholder="e.g., What am I thinking about lately? Show me important files. What's trending?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isLoading}
          />
          <Form.Text className="text-muted">
            Try natural language queries! The system understands context, time, and importance.
          </Form.Text>
        </Form.Group>
        <Button 
          variant="primary" 
          type="submit" 
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" className="me-2" />
              Processing...
            </>
          ) : (
            'Query'
          )}
        </Button>
      </Form>

      {/* Results */}
      {results && (
        <div className="mt-4">
          {results.success ? (
            <>
              {/* Query Analysis */}
              {results.queryAnalysis && (
                <Card className="mb-3">
                  <Card.Header>
                    <strong>Query Analysis</strong>
                  </Card.Header>
                  <Card.Body>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      <Badge bg="info">Intent: {results.queryAnalysis.primaryIntent}</Badge>
                      {results.queryAnalysis.timeContext && (
                        <Badge bg="secondary">Time: {results.queryAnalysis.timeContext}</Badge>
                      )}
                      {results.queryAnalysis.contentTypes.map((type: string) => (
                        <Badge key={type} bg="success">Type: {type}</Badge>
                      ))}
                    </div>
                    <small className="text-muted">
                      {results.queryAnalysis.isQuestion ? 'Question detected' : 'Statement detected'}
                      {results.queryAnalysis.needsAggregation && ' • Aggregation needed'}
                      {results.queryAnalysis.needsSummary && ' • Summary requested'}
                    </small>
                  </Card.Body>
                </Card>
              )}

              {/* Response */}
              {results.response && (
                <Card className="mb-3">
                  <Card.Header>
                    <strong>Response</strong>
                  </Card.Header>
                  <Card.Body>
                    <p>{results.response.message}</p>
                    
                    {/* Insights */}
                    {results.response.insights && (
                      <div className="mt-3">
                        <h6>Insights:</h6>
                        <div className="row">
                          {Object.entries(results.response.insights).map(([key, value]) => (
                            <div key={key} className="col-md-6 mb-2">
                              <small>
                                <strong>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong>{' '}
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}

              {/* Search Results */}
              {results.searchResults && results.searchResults.length > 0 && (
                <div>
                  <h5>Found {results.searchResults.length} relevant items:</h5>
                  {results.searchResults.map((result: any, index: number) => (
                    <Card key={index} className="mb-3">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex gap-2">
                            <Badge bg="primary">{result.metadata.type}</Badge>
                            <Badge bg={getUrgencyColor(result.metadata.urgencyLevel)}>
                              {result.metadata.urgencyLevel}
                            </Badge>
                            <Badge bg="info">
                              Score: {formatScore(result.scores.composite)}%
                            </Badge>
                          </div>
                          <small className="text-muted">
                            {new Date(result.metadata.timestamp).toLocaleDateString()}
                          </small>
                        </div>
                        
                        <p className="mb-2">{result.document.substring(0, 300)}...</p>
                        
                        <div className="row">
                          <div className="col-md-6">
                            <small>
                              <strong>Importance:</strong> {result.metadata.importanceScore}/10<br/>
                              <strong>Submissions:</strong> {result.metadata.submissionCount}<br/>
                              <strong>Velocity:</strong> {result.metadata.velocity}
                            </small>
                          </div>
                          <div className="col-md-6">
                            <small>
                              <strong>Relevance:</strong> {result.relevanceReason}<br/>
                              <strong>Semantic:</strong> {formatScore(result.scores.semantic)}%<br/>
                              <strong>Recency:</strong> {formatScore(result.scores.recency)}%
                            </small>
                          </div>
                        </div>
                        
                        {result.metadata.contextualTags && (
                          <div className="mt-2">
                            {JSON.parse(result.metadata.contextualTags).map((tag: string) => (
                              <Badge key={tag} bg="light" text="dark" className="me-1">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Alert variant="danger">
              <strong>Error:</strong> {results.error}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

export default QueryPage;
