#!/bin/bash

# Finviz Elite Proxy Setup Script

echo "🚀 Setting up Finviz Elite Proxy Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install express cors axios

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Test the proxy server
echo "🧪 Testing proxy server..."
node finviz-proxy-server.cjs &
PROXY_PID=$!

# Wait a moment for server to start
sleep 3

# Test the health endpoint
echo "🔍 Testing health endpoint..."
curl -s http://localhost:3001/health

# Test the API key
echo "🔑 Testing API key..."
curl -s http://localhost:3001/api/test-elite

# Stop the test server
kill $PROXY_PID 2>/dev/null

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the proxy server:"
echo "  node finviz-proxy-server.cjs"
echo ""
echo "To test your API key:"
echo "  curl http://localhost:3001/api/test-elite"
echo ""
echo "Your Elite API key is configured: f6202a40-4a7c-4d91-9ef8-068795ffbac0"
echo ""
echo "Example Elite URL format:"
echo "  https://elite.finviz.com/export.ashx?v=111&f=cap_smallover,sh_avgvol_o500,sh_price_o7,sh_relvol_o1.5,ta_pattern_channelup2|channelup|wedgeresistance|wedgeup,ta_perf_5to-1w,ta_rsi_55to70&ft=4" 