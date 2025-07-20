
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigationType } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import NoteForm from './components/NoteForm';
import QueryPage from './components/QueryPage';
import SourcesPage from './components/SourcesPage';
import ContentDashboard from './components/ContentDashboard';
import ContentBrowser from './components/ContentBrowser';
import ShareSuccess from './components/ShareSuccess';
import ShareError from './components/ShareError';

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
        <Routes>
          <Route path="/dashboard" element={<ContentDashboard key={`dashboard-${routeKey}`} />} />
          <Route path="/" element={<NoteForm key={`home-${routeKey}`} />} />
          <Route path="/browse" element={<ContentBrowser key={`browse-${routeKey}`} />} />
          <Route path="/query" element={<QueryPage key={`query-${routeKey}`} />} />
          <Route path="/sources" element={<SourcesPage key={`sources-${routeKey}`} />} />
          <Route path="/share-success" element={<ShareSuccess key={`share-success-${routeKey}`} />} />
          <Route path="/share-error" element={<ShareError key={`share-error-${routeKey}`} />} />
        </Routes>
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
