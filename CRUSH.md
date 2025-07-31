# CRUSH.md - ZONEd Development Guide

## Build Commands
- **Development**: `npm run dev` (starts client+server)
- **Client only**: `cd client && npm run dev`
- **Server only**: `cd server && npm start`
- **Build**: `npm run build`
- **Lint**: `cd client && npm run lint`
- **Type check**: `cd client && npm run build:check`

## Code Style
- **Components**: PascalCase for files, functional components
- **Types**: TypeScript strict mode, explicit return types
- **Imports**: React hooks > external > internal
- **State**: React hooks only, no global state
- **Error handling**: Try-catch blocks with user feedback
- **API**: Fetch with proper error boundaries
- **Styling**: Bootstrap 5 + React Bootstrap responsive design

## iOS Sharing Troubleshooting
1. **Test URL**: `GET /share?url=[URL]&text=[Text]&title=[Title]&source=ios_shortcut`
2. **Check parameters**: Ensure `url=[URL]&text=[Text]&title=[Title]&source=ios_shortcut`
3. **Fallback**: Use alternative params `u`, `t`, `content`
4. **Validation**: Verify content appears in `/api/content`
5. **Debug**: Add `&format=json` for JSON responses