import { useState, useEffect } from 'react';
import { Card, Button, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';

interface Source {
  id: string;
  name: string;
  description: string;
  requiresSetup: boolean;
}

interface ImportResult {
  success: boolean;
  sourceType: string;
  imported?: number;
  vectorized?: number;
  error?: string;
}

function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [instructions, setInstructions] = useState<any>(null);
  const [importOptions, setImportOptions] = useState<any>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetchAvailableSources();
  }, []);

  const fetchAvailableSources = async () => {
    try {
      const response = await fetch('/api/sources/available');
      const data = await response.json();
      if (data.success) {
        setSources(data.sources);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const handleSourceSelect = async (source: Source) => {
    setSelectedSource(source);
    setImportOptions({});
    setImportResult(null);
    
    // Fetch instructions for this source
    try {
      const response = await fetch(`/api/sources/${source.id}/instructions`);
      const data = await response.json();
      if (data.success) {
        setInstructions(data.instructions);
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
    }
    
    setShowModal(true);
  };

  const handleImport = async () => {
    if (!selectedSource) return;
    
    setIsImporting(true);
    try {
      const response = await fetch(`/api/sources/${selectedSource.id}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importOptions),
      });
      
      const result = await response.json();
      setImportResult(result);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        sourceType: selectedSource.id,
        error: 'Failed to import content'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const renderSourceCard = (source: Source) => (
    <Card key={source.id} className="mb-3">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <Card.Title className="d-flex align-items-center gap-2">
              {source.name}
              {source.requiresSetup && (
                <Badge bg="warning" text="dark">Setup Required</Badge>
              )}
            </Card.Title>
            <Card.Text>{source.description}</Card.Text>
          </div>
          <Button 
            variant="primary" 
            onClick={() => handleSourceSelect(source)}
          >
            Import
          </Button>
        </div>
      </Card.Body>
    </Card>
  );

  const renderInstructions = () => {
    if (!instructions) return null;
    
    return (
      <div className="mb-4">
        <h6>Setup Instructions:</h6>
        {Object.entries(instructions).map(([key, value]: [string, any]) => (
          <div key={key} className="mb-3">
            <strong>{key.replace('_', ' ').toUpperCase()}:</strong>
            <ul className="mt-2">
              {value.steps?.map((step: string, index: number) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
            {value.note && (
              <Alert variant="info" className="mt-2">
                <small><strong>Note:</strong> {value.note}</small>
              </Alert>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderImportOptions = () => {
    if (!selectedSource) return null;
    
    switch (selectedSource.id) {
      case 'text_files':
        return (
          <Form.Group className="mb-3">
            <Form.Label>Directory Path</Form.Label>
            <Form.Control
              type="text"
              placeholder="/path/to/your/text/files"
              value={importOptions.directory || ''}
              onChange={(e) => setImportOptions({
                ...importOptions,
                directory: e.target.value
              })}
            />
            <Form.Text className="text-muted">
              Path to directory containing text files (.txt, .md, .note)
            </Form.Text>
          </Form.Group>
        );
      
      case 'email_export':
        return (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Email Export File Path</Form.Label>
              <Form.Control
                type="text"
                placeholder="/path/to/your/email/export.mbox"
                value={importOptions.filePath || ''}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  filePath: e.target.value
                })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Format</Form.Label>
              <Form.Select
                value={importOptions.format || 'mbox'}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  format: e.target.value
                })}
              >
                <option value="mbox">MBOX</option>
                <option value="eml">EML</option>
              </Form.Select>
            </Form.Group>
          </>
        );
      
      case 'chrome_history':
      case 'safari_history':
      case 'firefox_history':
        return (
          <>
            <Form.Group className="mb-3">
              <Form.Label>Days Back</Form.Label>
              <Form.Control
                type="number"
                min="1"
                max="365"
                value={importOptions.daysBack || 7}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  daysBack: parseInt(e.target.value)
                })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Limit</Form.Label>
              <Form.Control
                type="number"
                min="10"
                max="1000"
                value={importOptions.limit || 100}
                onChange={(e) => setImportOptions({
                  ...importOptions,
                  limit: parseInt(e.target.value)
                })}
              />
            </Form.Group>
          </>
        );
      
      default:
        return (
          <Alert variant="info">
            No additional configuration required for this source.
          </Alert>
        );
    }
  };

  return (
    <div>
      <h2>Content Sources</h2>
      <p className="text-muted">
        Import content from various sources to expand your personal knowledge base.
      </p>
      
      {sources.map(renderSourceCard)}
      
      {/* Import Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Import from {selectedSource?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSource?.description && (
            <p className="text-muted">{selectedSource.description}</p>
          )}
          
          {renderInstructions()}
          
          <h6>Import Options:</h6>
          {renderImportOptions()}
          
          {importResult && (
            <Alert variant={importResult.success ? 'success' : 'danger'} className="mt-3">
              {importResult.success ? (
                <>
                  <strong>Import Successful!</strong><br/>
                  Imported: {importResult.imported} items<br/>
                  Vectorized: {importResult.vectorized} items
                </>
              ) : (
                <>
                  <strong>Import Failed:</strong><br/>
                  {importResult.error}
                </>
              )}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary" 
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? (
              <>
                <Spinner size="sm" className="me-2" />
                Importing...
              </>
            ) : (
              'Start Import'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default SourcesPage;