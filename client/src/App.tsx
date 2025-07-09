
import { useState, useEffect } from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import NoteForm from './components/NoteForm';
import QueryPage from './components/QueryPage';
import SourcesPage from './components/SourcesPage';

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return (
    <>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand href="#home">Personal Data PWA</Navbar.Brand>
          <Nav className="me-auto">
            <Nav.Link href="#home">Home</Nav.Link>
            <Nav.Link href="#query">Query</Nav.Link>
            <Nav.Link href="#sources">Sources</Nav.Link>
          </Nav>
        </Container>
      </Navbar>
      <Container className="mt-4">
        {hash === '#query' ? (
          <QueryPage />
        ) : hash === '#sources' ? (
          <SourcesPage />
        ) : (
          <NoteForm />
        )}
      </Container>
    </>
  );
}

export default App;
