
import { useState, useRef } from 'react';
import { Form, Button, Card, Alert, Badge } from 'react-bootstrap';
import ShareInstructions from './ShareInstructions';

interface ContentItem {
  type: 'text' | 'file' | 'url';
  content: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    url?: string;
    title?: string;
  };
}

function NoteForm() {
  const [textContent, setTextContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(handleFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(handleFile);
  };

  const handleFile = (file: File) => {
    const newItem: ContentItem = {
      type: 'file',
      content: file.name,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }
    };
    setContentItems(prev => [...prev, newItem]);
  };

  const handleUrlAdd = () => {
    if (!urlInput.trim()) return;
    
    const newItem: ContentItem = {
      type: 'url',
      content: urlInput,
      metadata: {
        url: urlInput,
      }
    };
    setContentItems(prev => [...prev, newItem]);
    setUrlInput('');
  };

  const handleTextAdd = () => {
    if (!textContent.trim()) return;
    
    const newItem: ContentItem = {
      type: 'text',
      content: textContent,
    };
    setContentItems(prev => [...prev, newItem]);
    setTextContent('');
  };

  const removeItem = (index: number) => {
    setContentItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contentItems.length === 0) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: contentItems }),
      });
      
      if (response.ok) {
        setContentItems([]);
        alert('Content saved successfully!');
      } else {
        alert('Failed to save content.');
      }
    } catch (error) {
      console.error('Error saving content:', error);
      alert('An error occurred while saving content.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <h2>Universal Content Dropzone</h2>
      
      <ShareInstructions />
      
      {/* Drag and Drop Zone */}
      <Card 
        className={`mb-4 ${isDragOver ? 'border-primary bg-light' : 'border-dashed'}`}
        style={{ 
          borderStyle: 'dashed', 
          borderWidth: '2px',
          minHeight: '150px',
          cursor: 'pointer'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Card.Body className="text-center d-flex flex-column justify-content-center">
          <h5>Drop files here or click to browse</h5>
          <p className="text-muted">
            Supports documents, images, PDFs, and more
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.mp3,.mp4,.csv,.json"
          />
        </Card.Body>
      </Card>

      {/* URL Input */}
      <Form.Group className="mb-3">
        <Form.Label>Add URL/Link</Form.Label>
        <div className="d-flex gap-2">
          <Form.Control
            type="url"
            placeholder="https://example.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUrlAdd()}
          />
          <Button variant="outline-primary" onClick={handleUrlAdd}>
            Add URL
          </Button>
        </div>
      </Form.Group>

      {/* Text Input */}
      <Form.Group className="mb-3">
        <Form.Label>Add Text Content</Form.Label>
        <div className="d-flex flex-column gap-2">
          <Form.Control
            as="textarea"
            rows={3}
            placeholder="Paste text, notes, thoughts..."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
          />
          <Button variant="outline-primary" onClick={handleTextAdd} className="align-self-start">
            Add Text
          </Button>
        </div>
      </Form.Group>

      {/* Content Items Preview */}
      {contentItems.length > 0 && (
        <div className="mb-4">
          <h5>Content to Process ({contentItems.length} items)</h5>
          {contentItems.map((item, index) => (
            <Card key={index} className="mb-2">
              <Card.Body className="py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg={item.type === 'file' ? 'info' : item.type === 'url' ? 'warning' : 'secondary'}>
                      {item.type.toUpperCase()}
                    </Badge>
                    <span className="text-truncate" style={{ maxWidth: '400px' }}>
                      {item.content}
                    </span>
                    {item.metadata?.fileSize && (
                      <small className="text-muted">
                        ({formatFileSize(item.metadata.fileSize)})
                      </small>
                    )}
                  </div>
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => removeItem(index)}
                  >
                    ×
                  </Button>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      )}

      {/* Submit Button */}
      {contentItems.length > 0 && (
        <div className="d-grid">
          <Button 
            variant="primary" 
            size="lg" 
            onClick={handleSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : `Process ${contentItems.length} Item${contentItems.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {contentItems.length === 0 && (
        <Alert variant="info">
          Add some content above to get started. You can drag & drop files, paste URLs, or add text.
        </Alert>
      )}
    </div>
  );
}

export default NoteForm;
