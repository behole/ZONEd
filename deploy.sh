#!/bin/bash

echo "🚀 Building DropZone for production..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Build client
echo "🏗️ Building client..."
cd client
npm run build
cd ..

echo "✅ Build complete! Ready for deployment."
echo ""
echo "Next steps:"
echo "1. Push to GitHub"
echo "2. Connect to Railway"
echo "3. Deploy!"