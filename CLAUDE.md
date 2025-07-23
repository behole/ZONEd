# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Lint, and Test Commands

### Development
```bash
npm run dev                # Start both client and server concurrently
npm run dev:client         # Start React dev server only (port 5173)
npm run dev:server         # Start Express server only (port 3001)
```

### Build and Production
```bash
npm run install:all        # Install dependencies for root, client, and server
npm run build              # Build client for production
npm run start:production   # Start production server (used by Railway)
```

### Code Quality
```bash
cd client && npm run lint  # ESLint with TypeScript for React code
cd client && npm run build:check  # TypeScript compilation check + build
```

### Testing
- No formal test framework configured
- Server has placeholder test script that exits with error
- Manual testing via API endpoints and client interface

## Architecture Overview

### Monorepo Structure
- **Root**: Build orchestration scripts and shared configuration
- **Client**: React 19 + TypeScript + Vite frontend (port 5173)  
- **Server**: Node.js + Express backend (port 3001)
- **Database**: PostgreSQL (production) with JSON file fallback (development)

### Key Server Components
- `server/index.js` - Main Express server with all API endpoints
- `server/database.js` - PostgreSQL operations and connection management
- `server/contentProcessor.js` - File processing (PDF, DOCX, images with OCR)
- `server/simpleVectorEngine.js` - OpenAI embeddings and vector search
- `server/ragProcessor.js` - Retrieval-Augmented Generation system
- `server/importanceEngine.js` - Content importance and urgency scoring
- `server/newsletterGenerator.js` - Content summarization and newsletters

### Client Architecture
- `client/src/App.tsx` - Main React app with React Router navigation
- `client/src/components/` - React components using React Bootstrap
- Single-page application with client-side routing
- No global state management (uses React hooks)

### Database Schema
- **PostgreSQL** (production): Optimized with GIN indexes for full-text search
- **JSON file** (development fallback): Stored in `server/db.json`
- Main table: `content` with JSONB fields for metadata, keywords, embeddings

### AI Integration
- **OpenAI API**: text-embedding-ada-002 for 1536-dimensional vectors
- **Semantic Search**: Vector similarity with relevance scoring
- **RAG System**: Context-aware question answering
- **Content Analysis**: Importance scoring and keyword extraction

## Core API Endpoints

### Content Management
- `POST /api/content` - Add new content (text, files, URLs)
- `GET /api/content` - Retrieve all content with optional filtering
- `DELETE /api/content/:id` - Delete specific content item

### File Operations  
- `POST /api/upload` - Upload files (PDF, DOCX, images) for processing
- Supports: PDF, DOCX, DOC, TXT, JPEG, PNG, GIF, WebP
- OCR processing for images via Tesseract.js

### Search and Query
- `GET /api/query?q=term` - Simple text search
- `POST /api/vector/search` - Semantic vector search with OpenAI embeddings
- `POST /api/rag/query` - Intelligent Q&A with context retrieval
- `GET /api/vector/stats` - Vector database statistics and health

### Content Sources
- `GET /api/sources/recent` - Recently added content
- `GET /api/sources/important` - High-importance content
- `POST /api/newsletter/generate` - Generate content summaries

## Environment Configuration

### Required Environment Variables
```bash
# OpenAI Integration
OPENAI_API_KEY=sk-proj-...     # Required for embeddings and RAG
USE_OPENAI=true                # Enable OpenAI features

# Database
DATABASE_URL=postgresql://...   # PostgreSQL connection (Railway auto-provides)

# Server
PORT=3001                      # Server port (optional)
NODE_ENV=production            # Environment mode
```

### Development Setup
1. Copy `server/.env.example` to `server/.env`
2. Add OpenAI API key and database URL
3. Run `npm run install:all` to install all dependencies
4. Run `npm run dev` to start both client and server

## Code Style and Conventions

### TypeScript/React (Client)
- Functional components with React hooks
- TypeScript strict mode enabled
- PascalCase for components, camelCase for functions/variables
- React Bootstrap for UI components
- ESLint configuration with React-specific rules

### Node.js/Express (Server)  
- CommonJS modules (require/module.exports)
- Async/await for asynchronous operations
- Express middleware pattern for API routes
- Error handling with try-catch and user-friendly responses
- Console logging for debugging and monitoring

### Database Operations
- PostgreSQL with connection pooling
- Prepared statements to prevent SQL injection
- JSONB fields for complex metadata storage
- Full-text search indexes for performance

## Deployment

### Railway Production
- Auto-deployment on push to main branch
- PostgreSQL service automatically provisioned
- Environment variables managed through Railway dashboard
- Build process: `npm run build` then `npm run start:production`

### File Storage
- Uploaded files stored in `server/uploads/` directory
- Railway persistent storage handles file persistence
- File processing extracts text content for search/indexing

## Development Workflow

### Adding New Features
1. Start with `npm run dev` for local development
2. Client changes: Edit React components in `client/src/`
3. Server changes: Modify Express routes in `server/index.js`
4. Database changes: Update schema in `server/database.js`
5. Run `cd client && npm run lint` before committing
6. Test manually via browser interface and API endpoints

### Common Tasks
- **Add API endpoint**: Extend `server/index.js` with new Express route
- **Add React component**: Create in `client/src/components/` and import in `App.tsx`
- **Database migration**: Modify `initializeTables()` in `server/database.js`
- **AI features**: Extend `simpleVectorEngine.js` or `ragProcessor.js`

### Debugging
- Server logs: Check Railway logs or local console output
- Client errors: Browser DevTools console and React error boundaries
- Database issues: Use `/api/debug/content` endpoint for inspection
- OpenAI integration: Check `/api/vector/stats` for API status