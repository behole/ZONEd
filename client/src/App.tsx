
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigationType } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import NoteForm from './components/NoteForm';
import QueryPage from './components/QueryPage';
import SourcesPage from './components/SourcesPage';
import ContentDashboard from './components/ContentDashboard';
import ContentBrowser from './components/ContentBrowser';
import ShareSuccess from './components/ShareSuccess';
import ShareError from './components/ShareError';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const location = useLocation();
  const navigationType = useNavigationType();

  // Force re-render on navigation changes
  const routeKey = `${location.pathname}-${location.search}-${Date.now()}`;

  console.log('🧭 Navigation:', {
    pathname: location.pathname,
    navigationType,
    timestamp: new Date().toISOString()
  });

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            🧠 ZONEd
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/dashboard" active={location.pathname === '/dashboard'}>
                📊 Dashboard
              </Nav.Link>
              <Nav.Link as={Link} to="/" active={location.pathname === '/'}>
                ➕ Add Content
              </Nav.Link>
              <Nav.Link as={Link} to="/browse" active={location.pathname === '/browse'}>
                📚 Browse
              </Nav.Link>
              <Nav.Link as={Link} to="/query" active={location.pathname === '/query'}>
                🔍 Query
              </Nav.Link>
              <Nav.Link as={Link} to="/sources" active={location.pathname === '/sources'}>
                🔗 Sources
              </Nav.Link>
            </Nav>
            <Nav>
              <span className="navbar-text text-light small">
                Personal Intelligence System
              </span>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <ErrorBoundary>
          <Routes>
            <Route path="/dashboard" element={
              <ErrorBoundary>
                <ContentDashboard key={`dashboard-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/" element={
              <ErrorBoundary>
                <NoteForm key={`home-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/browse" element={
              <ErrorBoundary>
                <ContentBrowser key={`browse-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/query" element={
              <ErrorBoundary>
                <QueryPage key={`query-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/sources" element={
              <ErrorBoundary>
                <SourcesPage key={`sources-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/share-success" element={
              <ErrorBoundary>
                <ShareSuccess key={`share-success-${routeKey}`} />
              </ErrorBoundary>
            } />
            <Route path="/share-error" element={
              <ErrorBoundary>
                <ShareError key={`share-error-${routeKey}`} />
              </ErrorBoundary>
            } />
          </Routes>
        </ErrorBoundary>
      </Container>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
