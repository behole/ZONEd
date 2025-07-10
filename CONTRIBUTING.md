# Contributing to ZONEd

Thank you for your interest in contributing to ZONEd! This document provides guidelines and information for contributors.

## 🎯 Project Overview

ZONEd is a Personal Data PWA (Progressive Web App) that serves as a Universal Content Dropzone with AI-powered processing and intelligent retrieval. We welcome contributions that improve functionality, performance, documentation, and user experience.

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database (local or Railway)
- OpenAI API key
- Git

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/ZONEd.git
   cd ZONEd
   ```

2. **Install Dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Setup**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your configuration
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

## 📋 Development Guidelines

### Code Style

- **TypeScript**: Use TypeScript for new frontend code
- **ES6+**: Use modern JavaScript features
- **Formatting**: Follow existing code style and patterns
- **Comments**: Add comments for complex logic
- **Error Handling**: Include comprehensive error handling

### Commit Messages

Follow conventional commit format:
```
type(scope): description

feat(api): add new search endpoint
fix(ui): resolve upload button styling
docs(readme): update installation instructions
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

## 🛠️ Development Commands

See [AGENTS.md](AGENTS.md) for complete development guidelines and commands:

```bash
# Development
npm run dev              # Start both client and server
npm run dev:client       # Start only React dev server
npm run dev:server       # Start only Express server

# Building
npm run build           # Build for production
npm run start:production # Start production server

# Linting & Type Checking
cd client && npm run lint     # Lint frontend code
cd client && npm run build    # Type check frontend
```

## 🧪 Testing

### Manual Testing

1. **Content Processing**
   - Upload various file types (PDF, DOCX, images)
   - Test text content submission
   - Verify URL processing

2. **Search Functionality**
   - Test semantic search with various queries
   - Verify search result relevance
   - Check search performance

3. **API Endpoints**
   ```bash
   # Test content retrieval
   curl -X GET http://localhost:3001/api/content
   
   # Test search
   curl -X GET "http://localhost:3001/api/query?q=test"
   
   # Test vector search
   curl -X POST http://localhost:3001/api/vector/search \
     -H "Content-Type: application/json" \
     -d '{"query":"test query"}'
   ```

### Automated Testing

Currently, the project relies on manual testing. Contributions to add automated testing are welcome:

- Unit tests for utility functions
- Integration tests for API endpoints
- End-to-end tests for user workflows

## 📝 Areas for Contribution

### High Priority

1. **User Interface Improvements**
   - Enhanced content browsing and management
   - Better search result presentation
   - Improved mobile responsiveness

2. **Performance Optimization**
   - Database query optimization
   - Caching implementation
   - Large file processing improvements

3. **Testing Infrastructure**
   - Unit test setup
   - API endpoint testing
   - Frontend component testing

### Medium Priority

1. **Feature Enhancements**
   - Advanced search filters
   - Content organization (folders, tags)
   - Export functionality

2. **Developer Experience**
   - Better error messages
   - Development tooling improvements
   - Documentation enhancements

3. **Security & Reliability**
   - Input validation improvements
   - Rate limiting
   - Better error handling

### Future Enhancements

1. **Collaboration Features**
   - Multi-user support
   - Sharing capabilities
   - Permission management

2. **Advanced AI Features**
   - Custom model integration
   - Enhanced content analysis
   - Automated categorization

3. **Mobile & PWA**
   - Offline functionality
   - Push notifications
   - Native app features

## 🔍 Code Review Process

1. **Pull Request Requirements**
   - Clear description of changes
   - Reference to related issues
   - Manual testing completed
   - No breaking changes (unless discussed)

2. **Review Criteria**
   - Code quality and style
   - Functionality and performance
   - Documentation updates
   - Backward compatibility

3. **Approval Process**
   - At least one maintainer review
   - All discussions resolved
   - CI checks passing (when implemented)

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment Information**
   - Operating system
   - Node.js version
   - Browser (if frontend issue)

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Screenshots if applicable

3. **Additional Context**
   - Error messages or logs
   - Related configuration
   - Workarounds attempted

## 💡 Feature Requests

For new features:

1. **Check Existing Issues** - Avoid duplicates
2. **Provide Context** - Explain the use case
3. **Consider Implementation** - Suggest approach if possible
4. **Discuss First** - For major changes, open a discussion

## 📚 Documentation

Documentation improvements are always welcome:

- **README.md** - Installation and usage
- **AGENTS.md** - Development guidelines
- **PROJECT_STATUS.md** - Project progress and roadmap
- **API Documentation** - Endpoint documentation
- **Code Comments** - Inline documentation

## 🤝 Community Guidelines

- **Be Respectful** - Treat all contributors with respect
- **Be Constructive** - Provide helpful feedback
- **Be Patient** - Allow time for responses
- **Be Collaborative** - Work together toward common goals

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and ideas
- **Code Review** - For implementation guidance
- **Documentation** - Check existing docs first

## 🎉 Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

Thank you for contributing to ZONEd! Your efforts help make this project better for everyone.

---

**Questions?** Feel free to open a discussion or reach out to the maintainers.