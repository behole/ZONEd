# AGENTS.md - Development Guidelines

## Build/Lint/Test Commands
- **Development**: `npm run dev` (starts both client and server)
- **Client**: `cd client && npm run dev` (Vite dev server on port 5173)
- **Server**: `cd server && npm start` (Express server on port 3001)
- **Build**: `npm run build` (installs deps + builds client)
- **Lint**: `cd client && npm run lint` (ESLint with TypeScript)
- **Single test**: No test framework configured - placeholder commands only

## Architecture & Database
- **Monorepo**: Separate client/server directories with shared build scripts
- **Database**: PostgreSQL (production) or JSON file fallback (development)
- **Vector DB**: ChromaDB for vector storage + OpenAI embeddings (1536-dimensional)
- **AI Integration**: OpenAI API for embeddings, chat completion, and RAG
- **File Processing**: PDF-parse, Mammoth (DOCX), Tesseract.js (OCR)
- **Core APIs**: `/api/content`, `/api/upload`, `/api/vector/search`, `/api/rag/query`

## Code Style Guidelines
- **Client**: TypeScript strict mode, React 19 functional components, ESLint
- **Server**: Node.js/Express, CommonJS modules, async/await patterns
- **Components**: PascalCase naming, TypeScript interfaces for props
- **State**: React hooks (useState, useEffect), no global state management
- **Error handling**: Try-catch with user alerts, console.error logging
- **API calls**: Fetch with proper response checking and error boundaries
- **Imports**: ES6 imports (client), CommonJS require (server)
- **Styling**: Bootstrap 5 + React Bootstrap components, responsive design