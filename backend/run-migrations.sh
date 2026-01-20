#!/bin/bash

# This script should be run AFTER deployment to Vercel
# It will run Prisma migrations against the production database

echo "🗄️ Running Database Migrations..."
echo "=================================="

# Make sure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable not set"
  echo ""
  echo "Set it with:"
  echo "  export DATABASE_URL='your-database-url'"
  exit 1
fi

echo "📍 Database: $DATABASE_URL"

# Run migrations
echo ""
echo "Running migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations Complete!"
echo "=================================="
