#!/bin/bash

# Stop All Servers Script
# This script stops all running servers

echo "🛑 Stopping all servers..."

# Kill all relevant processes
echo "🧹 Cleaning up processes..."

# Kill Finviz proxy server
pkill -f "node finviz-proxy-server.cjs" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Stopped Finviz proxy server"
else
    echo "ℹ️  Finviz proxy server was not running"
fi

# Kill Twelve Data API server
pkill -f "node twelvedata-api-server.cjs" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Stopped Twelve Data API server"
else
    echo "ℹ️  Twelve Data API server was not running"
fi

# Kill Vite dev server
pkill -f "vite" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Stopped Vite dev server"
else
    echo "ℹ️  Vite dev server was not running"
fi

# Kill any npm processes
pkill -f "npm run dev" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Stopped npm dev process"
else
    echo "ℹ️  npm dev process was not running"
fi

# Wait a moment for processes to fully stop
sleep 2

# Check if any processes are still running
echo "🔍 Checking for remaining processes..."
if pgrep -f "finviz-proxy-server\|twelvedata-api-server\|vite" > /dev/null; then
    echo "⚠️  Some processes are still running. Force killing..."
    pkill -9 -f "finviz-proxy-server\|twelvedata-api-server\|vite" 2>/dev/null
fi

echo ""
echo "🎉 All servers stopped successfully!"
echo ""
echo "📋 Port Status:"
echo "   🔑 Finviz Proxy (3001): $(lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null && echo "❌ Still in use" || echo "✅ Available")"
echo "   📊 Twelve Data API (3002): $(lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null && echo "❌ Still in use" || echo "✅ Available")"
echo "   🌐 Vite Dev Server (5173/5174): $(lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null && echo "❌ Still in use" || echo "✅ Available")"
echo "" 