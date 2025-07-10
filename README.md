# ZONEd - Personal Data PWA

> **Universal Content Dropzone** - AI-powered personal content management and intelligent retrieval system

[![Railway Deploy](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI-green)](https://openai.com)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://postgresql.org)
[![React](https://img.shields.io/badge/Frontend-React-61dafb)](https://reactjs.org)

## 🎯 Overview

ZONEd is a Progressive Web Application that serves as your personal AI-powered content management system. Drop any content (files, text, URLs) and get intelligent search, processing, and insights powered by OpenAI embeddings and semantic search.

### ✨ Key Features

- 🔄 **Universal Content Ingestion** - PDF, DOCX, images, text, URLs
- 🧠 **AI-Powered Processing** - OpenAI embeddings for semantic understanding
- 🔍 **Intelligent Search** - Natural language queries with contextual results
- 📊 **Smart Importance Scoring** - Automatic content prioritization
- 🏗️ **Production Ready** - PostgreSQL database with Railway deployment
- 📱 **Progressive Web App** - Works on desktop and mobile

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (or Railway account)
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ZONEd.git
cd ZONEd

# Install all dependencies
npm run install:all

# Set up environment variables
cp server/.env.example server/.env
# Edit server/.env with your API keys and database URL

# Start development servers
npm run dev
```

Visit `http://localhost:5173` to access the application.

## 🏗️ Architecture

### Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + React Bootstrap
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with optimized schemas
- **AI/ML**: OpenAI API (embeddings + chat completion)
- **Deployment**: Railway with auto-deployment
- **File Processing**: PDF-parse, Mammoth, Tesseract.js (OCR)

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Client  │───▶│  Express Server  │───▶│   PostgreSQL    │
│   (Port 5173)   │    │   (Port 3001)    │    │    Database     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   OpenAI API     │
                       │  (Embeddings +   │
                       │   Chat Models)   │
                       └──────────────────┘
```

## 📁 Project Structure

```
ZONEd/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   ├── App.tsx        # Main application component
│   │   └── main.tsx       # Application entry point
│   ├── package.json       # Frontend dependencies
│   └── vite.config.ts     # Vite configuration
├── server/                 # Express backend application
│   ├── contentProcessor.js    # File processing & text extraction
│   ├── simpleVectorEngine.js  # OpenAI embeddings & vector search
│   ├── ragProcessor.js        # RAG system for intelligent responses
│   ├── database.js           # PostgreSQL operations
│   ├── importanceEngine.js   # Content importance scoring
│   ├── index.js             # Main Express server
│   ├── uploads/             # File upload directory
│   └── package.json        # Backend dependencies
├── railway.json            # Railway deployment configuration
├── package.json           # Root package.json with scripts
├── AGENTS.md             # Development guidelines
├── PROJECT_STATUS.md     # Comprehensive project documentation
└── README.md             # This file
```

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Start only React dev server
npm run dev:server       # Start only Express server

# Production
npm run build           # Build client for production
npm run start:production # Start production server

# Setup
npm run install:all     # Install all dependencies
```

### Environment Variables

Create `server/.env` with:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
USE_OPENAI=true

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Optional: Server Configuration
PORT=3001
NODE_ENV=development
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/content` | Add new content (files, text, URLs) |
| `GET` | `/api/content` | Retrieve all content |
| `POST` | `/api/upload` | Upload files for processing |
| `GET` | `/api/query` | Search content with text queries |
| `POST` | `/api/vector/search` | Semantic vector search |
| `POST` | `/api/rag/query` | Intelligent RAG-powered queries |
| `GET` | `/api/vector/stats` | Vector database statistics |

## 🚀 Deployment

### Railway Deployment

1. **Connect Repository**: Link your GitHub repo to Railway
2. **Add PostgreSQL**: Add PostgreSQL service to your Railway project
3. **Set Environment Variables**:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `USE_OPENAI`: `true`
   - `DATABASE_URL`: Auto-provided by Railway PostgreSQL service
4. **Deploy**: Push to main branch triggers auto-deployment

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm run start:production
```

## 📊 Features

### Content Processing
- ✅ **Multi-format Support**: PDF, DOCX, DOC, TXT, Images
- ✅ **OCR Processing**: Extract text from images using Tesseract.js
- ✅ **Smart Chunking**: Intelligent text segmentation
- ✅ **Keyword Extraction**: Automatic keyword identification
- ✅ **Deduplication**: Fingerprint-based duplicate detection

### AI & Search
- ✅ **OpenAI Embeddings**: 1536-dimensional vector embeddings
- ✅ **Semantic Search**: Vector similarity with relevance scoring
- ✅ **Importance Scoring**: AI-powered content importance assessment
- ✅ **RAG System**: Retrieval-Augmented Generation for intelligent responses
- ✅ **Natural Language Queries**: Ask questions in plain English

### Data Management
- ✅ **PostgreSQL Database**: Persistent, scalable storage
- ✅ **Full-text Search**: Optimized database indexes
- ✅ **Metadata Extraction**: Rich content metadata
- ✅ **Content Versioning**: Track content submissions and updates

## 🔍 Usage Examples

### Adding Content

```javascript
// Add text content
POST /api/content
{
  "items": [
    {
      "content": "Your text content here",
      "type": "text"
    }
  ]
}

// Upload files
POST /api/upload
Content-Type: multipart/form-data
files: [file1.pdf, file2.docx, ...]
```

### Searching Content

```javascript
// Simple text search
GET /api/query?q=search terms

// Semantic vector search
POST /api/vector/search
{
  "query": "find documents about AI",
  "options": {
    "limit": 10,
    "threshold": 0.7
  }
}

// Intelligent RAG query
POST /api/rag/query
{
  "query": "What are the main themes in my recent documents?",
  "options": {
    "includeContext": true
  }
}
```

## 🛠️ Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check database connection
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

**OpenAI API Issues**
```bash
# Verify OpenAI configuration
curl -X GET http://localhost:3001/api/vector/stats
```

**File Upload Problems**
- Check file size limits (default: reasonable limits for most files)
- Verify supported file types: PDF, DOCX, DOC, TXT, JPEG, PNG, GIF, WebP
- Ensure uploads directory has write permissions

### Debug Endpoints

- `GET /api/debug/content` - Inspect database content
- `GET /api/vector/stats` - Check vector database status
- Server logs provide detailed processing information

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for powerful AI capabilities
- [Railway](https://railway.app) for seamless deployment
- [React](https://reactjs.org) and [Node.js](https://nodejs.org) communities
- All the amazing open-source libraries that make this possible

## 📞 Support

- 📖 **Documentation**: See [PROJECT_STATUS.md](PROJECT_STATUS.md) for detailed project information
- 🛠️ **Development**: Check [AGENTS.md](AGENTS.md) for development guidelines
- 🐛 **Issues**: Report bugs via GitHub Issues
- 💬 **Discussions**: Use GitHub Discussions for questions and ideas

---

**Built with ❤️ for personal productivity and AI-powered content management**