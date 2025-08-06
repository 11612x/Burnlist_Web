#!/bin/bash

# Test Render.com setup locally
echo "🧪 Testing Render.com setup locally..."

# Check if all required files exist
echo "📁 Checking required files..."
required_files=("render.yaml" "finviz-api-server.cjs" "package.json" "vite.config.js")
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test build
echo "🔨 Testing build process..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Test API server
echo "🚀 Testing API server..."
timeout 10s node finviz-api-server.cjs &
API_PID=$!

# Wait a moment for server to start
sleep 3

# Test health endpoint
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ API server is running"
else
    echo "❌ API server failed to start"
    kill $API_PID 2>/dev/null
    exit 1
fi

# Kill the test server
kill $API_PID 2>/dev/null

echo ""
echo "🎉 All tests passed! Your app is ready for Render.com deployment."
echo ""
echo "📋 Next steps:"
echo "1. Push your code to GitHub/GitLab"
echo "2. Go to https://dashboard.render.com"
echo "3. Create a new Blueprint from your repository"
echo "4. Set FINVIZ_API_TOKEN in environment variables"
echo "5. Deploy!"