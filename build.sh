#!/bin/bash
set -e

echo "🔧 Installing root dependencies..."
npm install

echo "🔧 Installing client dependencies..."
cd client
npm install

echo "🔧 Building client..."
npm run build

echo "🔧 Installing server dependencies..."
cd ../server
npm install

echo "✅ Build complete!"