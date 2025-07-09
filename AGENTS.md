# AGENTS.md - Development Guidelines

## Build/Lint/Test Commands
- **Client dev**: `cd client && npm run dev`
- **Client build**: `cd client && npm run build` (runs TypeScript check + Vite build)
- **Client lint**: `cd client && npm run lint`
- **Server start**: `cd server && npm start`
- **No tests configured** - server package.json shows placeholder test command

## Code Style Guidelines
- **Language**: TypeScript for client, JavaScript for server
- **Framework**: React 19 + Vite + React Bootstrap for client, Express for server
- **Imports**: ES6 imports, React hooks imported from 'react'
- **Components**: Function components with TypeScript, PascalCase naming
- **Props**: Use proper TypeScript interfaces for component props
- **State**: Use React hooks (useState, useEffect) for state management
- **Error handling**: Try-catch blocks with user-friendly alerts and console.error logging
- **API calls**: Use fetch with proper error handling and response checking
- **Formatting**: ESLint configured with TypeScript, React hooks, and React refresh rules
- **File structure**: Components in src/components/, main app logic in src/
- **Styling**: Bootstrap classes, React Bootstrap components

## Notes
- Monorepo with separate client/server directories
- Client uses Vite for bundling, TypeScript strict mode
- No testing framework currently configured