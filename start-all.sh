#!/bin/bash

# Start All Servers Script
# This script starts all three servers: burnlist frontend, twelve data API, and finviz proxy

echo "🚀 Starting all servers..."

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️  Port $1 is already in use"
        return 1
    else
        return 0
    fi
}

# Function to wait for a server to be ready
wait_for_server() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $name to start on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:$port >/dev/null 2>&1; then
            echo "✅ $name is ready on port $port"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $name failed to start on port $port"
    return 1
}

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node finviz-proxy-server.cjs" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "node twelvedata-api-server.cjs" 2>/dev/null
sleep 2

# Check ports
echo "🔍 Checking ports..."
check_port 3001 || exit 1
check_port 5173 || exit 1
check_port 5174 || exit 1
check_port 3002 || exit 1

# Start Finviz Proxy Server
echo "🔑 Starting Finviz Elite Proxy Server..."
node finviz-proxy-server.cjs &
FINVIZ_PID=$!
echo "   Finviz proxy PID: $FINVIZ_PID"

# Start Twelve Data API Server
echo "📊 Starting Twelve Data API Server..."
node twelvedata-api-server.cjs &
TWELVEDATA_PID=$!
echo "   Twelve Data API PID: $TWELVEDATA_PID"

# Wait a moment for servers to start
sleep 3

# Check if servers started successfully
if ! wait_for_server 3001 "Finviz Proxy"; then
    echo "❌ Failed to start Finviz proxy server"
    exit 1
fi

if ! wait_for_server 3002 "Twelve Data API"; then
    echo "❌ Failed to start Twelve Data API server"
    exit 1
fi

# Start Burnlist Frontend
echo "🌐 Starting Burnlist Frontend..."
npm run dev &
BURNLIST_PID=$!
echo "   Burnlist frontend PID: $BURNLIST_PID"

# Wait for frontend to start
sleep 5

# Check if frontend started
if ! wait_for_server 5173 "Burnlist Frontend" && ! wait_for_server 5174 "Burnlist Frontend"; then
    echo "❌ Failed to start Burnlist frontend"
    exit 1
fi

# Display server information
echo ""
echo "🎉 All servers started successfully!"
echo ""
echo "📋 Server Information:"
echo "   🌐 Burnlist Frontend: http://localhost:5173 (or 5174)"
echo "   📊 Twelve Data API:   http://localhost:3002"
echo "   🔑 Finviz Proxy:      http://localhost:3001"
echo ""
echo "🔗 Quick Links:"
echo "   • Burnlist App:       http://localhost:5173"
echo "   • Twelve Data API:    http://localhost:3002/health"
echo "   • Finviz Proxy:       http://localhost:3001/health"
echo "   • Finviz Test:        http://localhost:3001/api/test-elite"
echo ""
echo "🛑 To stop all servers, run: pkill -f 'node\|npm'"
echo ""

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🛑 Stopping all servers..."
    kill $FINVIZ_PID $TWELVEDATA_PID $BURNLIST_PID 2>/dev/null
    pkill -f "node finviz-proxy-server.cjs" 2>/dev/null
    pkill -f "node twelvedata-api-server.cjs" 2>/dev/null
    pkill -f "npm run dev" 2>/dev/null
    echo "✅ All servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
echo "⏳ All servers are running. Press Ctrl+C to stop all servers."
echo ""

# Wait for user to stop
while true; do
    sleep 10
    # Check if any server died
    if ! kill -0 $FINVIZ_PID 2>/dev/null; then
        echo "❌ Finviz proxy server stopped unexpectedly"
        cleanup
    fi
    if ! kill -0 $TWELVEDATA_PID 2>/dev/null; then
        echo "❌ Twelve Data API server stopped unexpectedly"
        cleanup
    fi
    if ! kill -0 $BURNLIST_PID 2>/dev/null; then
        echo "❌ Burnlist frontend stopped unexpectedly"
        cleanup
    fi
done 