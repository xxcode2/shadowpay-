#!/bin/bash

# Build backend
echo "🔨 Building backend..."
cd backend
npm install
npm run build
cd ..

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Prepare public directory
echo "📁 Preparing public directory..."
rm -rf public
cp -r frontend/dist public

echo "✅ Build complete!"
