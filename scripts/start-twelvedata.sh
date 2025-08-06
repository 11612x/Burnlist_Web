#!/bin/bash

echo "🚀 Starting Burnlist with Twelve Data API server..."

# Kill any existing processes on the ports we need
echo "🔄 Cleaning up existing processes..."
pkill -f "twelvedata-api-server.cjs" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Start Twelve Data API server in the background
echo "📊 Starting Twelve Data API server on port 3002..."
node twelvedata-api-server.cjs &
TWELVEDATA_PID=$!

# Wait a moment for the Twelve Data server to start
sleep 2

# Check if Twelve Data server started successfully
if curl -s http://localhost:3002/health > /dev/null; then
    echo "✅ Twelve Data API server is running on http://localhost:3002"
else
    echo "❌ Failed to start Twelve Data API server"
    kill $TWELVEDATA_PID 2>/dev/null
    exit 1
fi

# Start the Burnlist frontend
echo "🌐 Starting Burnlist frontend..."
npm run dev &
FRONTEND_PID=$!

# Wait a moment for the frontend to start
sleep 3

echo "✅ Both servers are running!"
echo "📊 Twelve Data API: http://localhost:3002"
echo "🌐 Burnlist: http://localhost:5173 (or check terminal for actual port)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $TWELVEDATA_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep the script running
wait 