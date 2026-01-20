#!/bin/bash

# ShadowPay Development Script
# Runs both backend and frontend

echo "🚀 Starting ShadowPay Development Environment..."

# Kill previous processes
pkill -f "npm run dev" 2>/dev/null || true

# Start backend in background
echo "📡 Starting Backend (port 3001)..."
cd backend && npm run dev &
BACKEND_PID=$!

sleep 2

# Start frontend in background
echo "🎨 Starting Frontend (port 5173)..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ ShadowPay is running!"
echo "  Backend:  http://localhost:3001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait
