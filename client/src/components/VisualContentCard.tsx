import { Card, Badge, Row, Col } from 'react-bootstrap';

interface VisualContentMetadata {
  imageType?: string;
  dimensions?: string;
  visualElements?: string[];
  colorPalette?: string[];
  styleCharacteristics?: string[];
  designInsights?: string[];
  ocrText?: string;
  aiDescription?: string;
}

interface VisualContentCardProps {
  metadata: VisualContentMetadata;
  title?: string;
}

function VisualContentCard({ metadata, title }: VisualContentCardProps) {
  if (!metadata.imageType) {
    return null; // Not visual content
  }

  return (
    <Card className="mb-3 border-info">
      <Card.Header className="bg-info bg-opacity-10">
        <div className="d-flex align-items-center gap-2">
          <span>🎨</span>
          <strong>Visual Content Analysis</strong>
          {metadata.dimensions && (
            <Badge bg="light" text="dark">{metadata.dimensions}</Badge>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        <Row>
          {/* Visual Elements */}
          {metadata.visualElements && metadata.visualElements.length > 0 && (
            <Col md={6} className="mb-3">
              <h6 className="text-info">🔍 Visual Elements</h6>
              <div className="d-flex flex-wrap gap-1">
                {metadata.visualElements.map((element, index) => (
                  <Badge key={index} bg="primary" className="small">
                    {element}
                  </Badge>
                ))}
              </div>
            </Col>
          )}

          {/* Color Palette */}
          {metadata.colorPalette && metadata.colorPalette.length > 0 && (
            <Col md={6} className="mb-3">
              <h6 className="text-info">🎨 Color Palette</h6>
              <div className="d-flex flex-wrap gap-1">
                {metadata.colorPalette.map((color, index) => (
                  <Badge key={index} bg="secondary" className="small">
                    {color}
                  </Badge>
                ))}
              </div>
            </Col>
          )}

          {/* Style Characteristics */}
          {metadata.styleCharacteristics && metadata.styleCharacteristics.length > 0 && (
            <Col md={6} className="mb-3">
              <h6 className="text-info">✨ Style</h6>
              <div className="d-flex flex-wrap gap-1">
                {metadata.styleCharacteristics.map((style, index) => (
                  <Badge key={index} bg="success" className="small">
                    {style}
                  </Badge>
                ))}
              </div>
            </Col>
          )}

          {/* Design Insights */}
          {metadata.designInsights && metadata.designInsights.length > 0 && (
            <Col md={12} className="mb-3">
              <h6 className="text-info">💡 Design Insights</h6>
              <ul className="small mb-0">
                {metadata.designInsights.map((insight, index) => (
                  <li key={index} className="mb-1">{insight}</li>
                ))}
              </ul>
            </Col>
          )}

          {/* OCR Text */}
          {metadata.ocrText && metadata.ocrText.trim().length > 0 && (
            <Col md={12} className="mb-3">
              <h6 className="text-info">📝 Extracted Text</h6>
              <div className="p-2 bg-light rounded small">
                <em>"{metadata.ocrText.trim()}"</em>
              </div>
            </Col>
          )}

          {/* AI Description */}
          {metadata.aiDescription && metadata.aiDescription.trim().length > 0 && (
            <Col md={12}>
              <h6 className="text-info">🤖 AI Description</h6>
              <div className="p-2 bg-primary bg-opacity-10 rounded small">
                {metadata.aiDescription}
              </div>
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
}

export default VisualContentCard;