
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import NoteForm from './components/NoteForm';
import QueryPage from './components/QueryPage';
import SourcesPage from './components/SourcesPage';
import ShareSuccess from './components/ShareSuccess';
import ShareError from './components/ShareError';

function AppContent() {
  const location = useLocation();

  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand as={Link} to="/">Personal Data PWA</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" active={location.pathname === '/'}>Home</Nav.Link>
            <Nav.Link as={Link} to="/query" active={location.pathname === '/query'}>Query</Nav.Link>
            <Nav.Link as={Link} to="/sources" active={location.pathname === '/sources'}>Sources</Nav.Link>
          </Nav>
        </Container>
      </Navbar>
      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<NoteForm />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/share-success" element={<ShareSuccess />} />
          <Route path="/share-error" element={<ShareError />} />
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
