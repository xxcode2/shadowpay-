#!/bin/bash
set -e

echo "🏗️ ShadowPay Build Script"
echo "=========================="

# Build Backend
echo ""
echo "📦 Building Backend..."
cd backend

# Install dependencies
npm install

# Generate Prisma Client (doesn't need database connection)
echo "  ├─ Generating Prisma client..."
npx prisma generate || echo "  └─ ⚠️  Prisma generation optional during build"

# Compile TypeScript
echo "  ├─ Compiling TypeScript..."
npm run build

echo "  └─ ✅ Backend built"

cd ..

# Build Frontend
echo ""
echo "🎨 Building Frontend..."
cd frontend

# Install dependencies
npm install

# Build with Vite
echo "  ├─ Building with Vite..."
npm run build

echo "  └─ ✅ Frontend built"

cd ..

# Prepare Public Directory
echo ""
echo "📁 Preparing public directory..."
rm -rf .vercel/output
mkdir -p .vercel/output/static
cp -r frontend/dist/* .vercel/output/static/

echo ""
echo "✅ Build Complete!"
echo "=========================="

