import React, { useState } from 'react';

interface CleanupPreview {
  total: number;
  valuable: number;
  test: number;
  trash: number;
  questionable: number;
  toDelete: number;
  categories: {
    valuable: Array<{ id: string; content: string; type: string; importanceScore?: number }>;
    test: Array<{ id: string; content: string; type: string; reason: string }>;
    trash: Array<{ id: string; content: string; type: string; reason: string }>;
    questionable: Array<{ id: string; content: string; type: string; reason: string }>;
  };
}

const DatabaseCleanup: React.FC = () => {
  const [preview, setPreview] = useState<CleanupPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/cleanup/preview');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch preview');
    } finally {
      setLoading(false);
    }
  };

  const performCleanup = async (includeQuestionable = false) => {
    setLoading(true);
    setError(null);
    setCleanupResult(null);
    
    try {
      const response = await fetch('/api/cleanup/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deleteTest: true,
          deleteTrash: true,
          deleteQuestionable: includeQuestionable
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setCleanupResult(`Successfully deleted ${result.deletedCount} items. Database now contains ${result.remainingCount} items.`);
      
      // Refresh preview after cleanup
      await fetchPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform cleanup');
    } finally {
      setLoading(false);
    }
  };

  const truncateContent = (content: string, maxLength = 50) => {
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  return (
    <div className="database-cleanup">
      <div className="cleanup-header">
        <h2>🧹 Database Cleanup</h2>
        <p>Remove test data and trash content while preserving valuable information.</p>
      </div>

      <div className="cleanup-actions">
        <button 
          onClick={fetchPreview} 
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? '🔍 Analyzing...' : '🔍 Preview Cleanup'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {cleanupResult && (
        <div className="success-message">
          <h3>✅ Cleanup Complete</h3>
          <p>{cleanupResult}</p>
        </div>
      )}

      {preview && (
        <div className="cleanup-preview">
          <div className="stats-summary">
            <h3>📊 Database Analysis</h3>
            <div className="stats-grid">
              <div className="stat-item valuable">
                <span className="stat-number">{preview.valuable}</span>
                <span className="stat-label">✅ Valuable</span>
              </div>
              <div className="stat-item test">
                <span className="stat-number">{preview.test}</span>
                <span className="stat-label">🧪 Test</span>
              </div>
              <div className="stat-item trash">
                <span className="stat-number">{preview.trash}</span>
                <span className="stat-label">🗑️ Trash</span>
              </div>
              <div className="stat-item questionable">
                <span className="stat-number">{preview.questionable}</span>
                <span className="stat-label">❓ Questionable</span>
              </div>
            </div>
          </div>

          {(preview.test > 0 || preview.trash > 0) && (
            <div className="cleanup-actions">
              <button 
                onClick={() => performCleanup(false)} 
                disabled={loading}
                className="btn btn-warning"
              >
                {loading ? '🧹 Cleaning...' : `🧹 Clean ${preview.test + preview.trash} Items`}
              </button>
              
              {preview.questionable > 0 && (
                <button 
                  onClick={() => performCleanup(true)} 
                  disabled={loading}
                  className="btn btn-danger"
                >
                  {loading ? '🧹 Cleaning...' : `🧹 Clean All (${preview.test + preview.trash + preview.questionable} Items)`}
                </button>
              )}
            </div>
          )}

          <div className="content-categories">
            {preview.test > 0 && (
              <div className="category-section">
                <h4>🧪 Test Content (Will Delete)</h4>
                <div className="content-list">
                  {preview.categories.test.slice(0, 10).map(item => (
                    <div key={item.id} className="content-item test">
                      <span className="content-id">ID: {item.id}</span>
                      <span className="content-text">"{truncateContent(item.content)}"</span>
                      <span className="content-type">{item.type}</span>
                    </div>
                  ))}
                  {preview.categories.test.length > 10 && (
                    <div className="more-items">... and {preview.categories.test.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {preview.trash > 0 && (
              <div className="category-section">
                <h4>🗑️ Trash Content (Will Delete)</h4>
                <div className="content-list">
                  {preview.categories.trash.slice(0, 10).map(item => (
                    <div key={item.id} className="content-item trash">
                      <span className="content-id">ID: {item.id}</span>
                      <span className="content-text">"{truncateContent(item.content)}"</span>
                      <span className="content-reason">Reason: {item.reason}</span>
                    </div>
                  ))}
                  {preview.categories.trash.length > 10 && (
                    <div className="more-items">... and {preview.categories.trash.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {preview.questionable > 0 && (
              <div className="category-section">
                <h4>❓ Questionable Content (Review Needed)</h4>
                <div className="content-list">
                  {preview.categories.questionable.slice(0, 10).map(item => (
                    <div key={item.id} className="content-item questionable">
                      <span className="content-id">ID: {item.id}</span>
                      <span className="content-text">"{truncateContent(item.content)}"</span>
                      <span className="content-meta">{item.type} | {item.reason}</span>
                    </div>
                  ))}
                  {preview.categories.questionable.length > 10 && (
                    <div className="more-items">... and {preview.categories.questionable.length - 10} more</div>
                  )}
                </div>
              </div>
            )}

            {preview.valuable > 0 && (
              <div className="category-section">
                <h4>✅ Valuable Content (Will Keep)</h4>
                <div className="content-list">
                  {preview.categories.valuable.slice(0, 5).map(item => (
                    <div key={item.id} className="content-item valuable">
                      <span className="content-id">ID: {item.id}</span>
                      <span className="content-text">"{truncateContent(item.content)}"</span>
                      <span className="content-meta">{item.type} | Score: {item.importanceScore || 'N/A'}</span>
                    </div>
                  ))}
                  {preview.categories.valuable.length > 5 && (
                    <div className="more-items">... and {preview.categories.valuable.length - 5} more valuable items</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .database-cleanup {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .cleanup-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .cleanup-header h2 {
          color: #333;
          margin-bottom: 10px;
        }

        .cleanup-actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 20px 0;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #5a6268;
        }

        .btn-warning {
          background: #ffc107;
          color: #212529;
        }

        .btn-warning:hover:not(:disabled) {
          background: #e0a800;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c82333;
        }

        .error-message, .success-message {
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
        }

        .error-message {
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        .success-message {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
        }

        .stats-summary {
          margin: 30px 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }

        .stat-item {
          text-align: center;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid;
        }

        .stat-item.valuable {
          background: #d4edda;
          border-color: #28a745;
        }

        .stat-item.test {
          background: #fff3cd;
          border-color: #ffc107;
        }

        .stat-item.trash {
          background: #f8d7da;
          border-color: #dc3545;
        }

        .stat-item.questionable {
          background: #e2e3e5;
          border-color: #6c757d;
        }

        .stat-number {
          display: block;
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 0.9em;
          font-weight: 500;
        }

        .category-section {
          margin: 30px 0;
        }

        .category-section h4 {
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 2px solid #eee;
        }

        .content-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .content-item {
          display: flex;
          gap: 15px;
          padding: 10px;
          border-radius: 4px;
          font-size: 0.9em;
          align-items: center;
        }

        .content-item.test {
          background: #fff3cd;
        }

        .content-item.trash {
          background: #f8d7da;
        }

        .content-item.questionable {
          background: #e2e3e5;
        }

        .content-item.valuable {
          background: #d4edda;
        }

        .content-id {
          font-family: monospace;
          font-weight: bold;
          min-width: 80px;
        }

        .content-text {
          flex: 1;
          font-style: italic;
        }

        .content-type, .content-meta, .content-reason {
          font-size: 0.8em;
          color: #666;
        }

        .content-error {
          font-size: 0.8em;
          color: #dc3545;
        }

        .more-items {
          text-align: center;
          font-style: italic;
          color: #666;
          padding: 10px;
        }
      `}</style>
    </div>
  );
};

export default DatabaseCleanup;