#!/bin/bash

# This script sets up the database schema
# Run this on first deployment or when schema changes

echo "🗄️ Running Prisma migrations..."
npx prisma migrate dev --name init

echo "✅ Database schema updated!"
