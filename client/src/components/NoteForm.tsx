
import { useState, useRef } from 'react';
import { Form, Button, Card, Alert, Badge, Collapse } from 'react-bootstrap';
import ShareInstructions from './ShareInstructions';
import IOSSetupGuide from './IOSSetupGuide';

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
  file?: File; // Store actual file object for upload
}

function NoteForm() {
  const [textContent, setTextContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
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
      },
      file: file // Store the actual file object
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
      // Separate files from other content types
      const fileItems = contentItems.filter(item => item.type === 'file');
      const nonFileItems = contentItems.filter(item => item.type !== 'file');
      
      // Upload files first if any
      if (fileItems.length > 0) {
        const formData = new FormData();
        fileItems.forEach(item => {
          if (item.file) {
            formData.append('files', item.file);
          }
        });
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload files');
        }
      }
      
      // Process non-file items if any
      let contentResult = null;
      if (nonFileItems.length > 0) {
        const contentResponse = await fetch('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: nonFileItems }),
        });
        
        if (!contentResponse.ok) {
          throw new Error('Failed to save content');
        }
        
        contentResult = await contentResponse.json();
        console.log('Content processing result:', contentResult);
      }
      
      setContentItems([]);
      
      // Check for any failed extractions and show helpful messages
      if (contentResult?.items) {
        const failedExtractions = contentResult.items.filter((item: any) => 
          item.metadata?.extractionQuality === 'failed_with_fallback'
        );
        
        if (failedExtractions.length > 0) {
          const failedUrls = failedExtractions.map((item: any) => ({
            url: item.metadata.url,
            errorType: item.metadata.errorType,
            userAction: item.metadata.fallbackData?.userAction
          }));
          
          console.log('Some URLs had extraction issues:', failedUrls);
          
          // Show a helpful message instead of just "success"
          const errorMessages = failedUrls.map((failed: any) => 
            `• ${failed.userAction || 'Try again later'}`
          ).join('\n');
          
          alert(`✅ Content processed!\n\n⚠️ Note: ${failedExtractions.length} URL${failedExtractions.length > 1 ? 's' : ''} couldn't be fully extracted but ${failedExtractions.length > 1 ? 'were' : 'was'} saved:\n\n${errorMessages}\n\n💡 You can still search for and access these URLs later in your content library.`);
        } else {
          alert('✅ Content processed successfully!');
        }
      } else {
        alert('✅ Content processed successfully!');
      }
    } catch (error) {
      console.error('Error processing content:', error);
      alert('An error occurred while processing content.');
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
      
      {/* iOS Setup Guide Toggle */}
      <div className="mb-4">
        <Button 
          variant="outline-success" 
          onClick={() => setShowIOSGuide(!showIOSGuide)}
          className="mb-2"
        >
          📱 {showIOSGuide ? 'Hide' : 'Show'} iOS Share Sheet Setup
        </Button>
        
        <Collapse in={showIOSGuide}>
          <div>
            <IOSSetupGuide />
          </div>
        </Collapse>
      </div>
      
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
