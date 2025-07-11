
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

  const getContentTypeEmoji = (type: string) => {
    switch (type) {
      case 'file': return '📄';
      case 'url': return '🔗';
      case 'text': return '📝';
      default: return '📋';
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
              {/* Query Understanding */}
              {results.queryAnalysis && (
                <Card className="mb-3 border-info">
                  <Card.Header className="bg-light">
                    <strong>🔍 What I Found</strong>
                  </Card.Header>
                  <Card.Body>
                    <p className="mb-2">
                      {results.queryAnalysis.isQuestion ? 
                        `I searched for answers about: "${results.query}"` : 
                        `I looked through your content for: "${results.query}"`
                      }
                    </p>
                    <div className="d-flex flex-wrap gap-2">
                      {results.queryAnalysis.timeContext && (
                        <Badge bg="primary">📅 {results.queryAnalysis.timeContext}</Badge>
                      )}
                      {results.queryAnalysis.contentTypes.map((type: string) => (
                        <Badge key={type} bg="secondary">📂 {type}</Badge>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Response */}
              {results.response && (
                <Card className="mb-3 border-success">
                  <Card.Header className="bg-success text-white">
                    <strong>💡 Here's What I Discovered</strong>
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-3">
                      <p className="lead">{results.response.message}</p>
                    </div>
                    
                    {/* Insights */}
                    {results.response.insights && (
                      <div className="mt-3">
                        <h6 className="text-success">🔍 Key Insights:</h6>
                        <div className="row">
                          {Object.entries(results.response.insights).map(([key, value]) => (
                            <div key={key} className="col-md-6 mb-2">
                              <div className="d-flex align-items-center">
                                <span className="badge bg-light text-dark me-2">
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                </span>
                                <span>{typeof value === 'object' && value !== null ? 
                                  Array.isArray(value) ? value.join(', ') : 
                                  Object.keys(value).length + ' items' : 
                                  String(value)
                                }</span>
                              </div>
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
                  <h5 className="mb-3">📚 Found {results.searchResults.length} relevant items:</h5>
                  {results.searchResults.map((result: any, index: number) => (
                    <Card key={index} className="mb-3 shadow-sm">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex gap-2">
                            <Badge bg="primary">{getContentTypeEmoji(result.metadata.type)} {result.metadata.type}</Badge>
                            {result.metadata.urgencyLevel !== 'low' && (
                              <Badge bg={getUrgencyColor(result.metadata.urgencyLevel)}>
                                {result.metadata.urgencyLevel === 'high' ? '🔴 Urgent' : '🟡 Important'}
                              </Badge>
                            )}
                            <Badge bg="success">
                              {formatScore(result.scores.composite) >= 80 ? '⭐ Highly Relevant' : 
                               formatScore(result.scores.composite) >= 60 ? '✨ Relevant' : '📌 Related'}
                            </Badge>
                          </div>
                          <small className="text-muted">
                            {formatRelativeTime(result.metadata.timestamp)}
                          </small>
                        </div>
                        
                        <p className="mb-2">{result.document.substring(0, 300)}...</p>
                        
                        <div className="row">
                          <div className="col-md-8">
                            <small className="text-muted">
                              <strong>Why this is relevant:</strong> {result.relevanceReason || 'Matches your query context'}
                            </small>
                          </div>
                          <div className="col-md-4 text-end">
                            <small className="text-muted">
                              {result.metadata.importanceScore > 7 ? '⭐⭐⭐ High Priority' : 
                               result.metadata.importanceScore > 4 ? '⭐⭐ Medium Priority' : 
                               '⭐ Standard'}
                              {result.metadata.submissionCount > 1 && (
                                <span className="ms-2">🔄 Revisited {result.metadata.submissionCount}x</span>
                              )}
                            </small>
                          </div>
                        </div>
                        
                        {result.metadata.contextualTags && (
                          <div className="mt-2">
                            {JSON.parse(result.metadata.contextualTags).slice(0, 5).map((tag: string) => (
                              <Badge key={tag} bg="light" text="dark" className="me-1">
                                #{tag}
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
