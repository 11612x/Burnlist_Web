#!/bin/bash

# Deploy Burnlist to Render.com
# This script prepares the app for Render.com deployment

echo "🚀 Preparing Burnlist for Render.com deployment"

# Step 1: Build the app locally
echo "📦 Building the app..."
npm run build

# Step 2: Create deployment package for Render
echo "📋 Creating deployment package..."
tar -czf burnlist-render.tar.gz \
    dist/ \
    finviz-api-server.cjs \
    finviz-scraper.cjs \
    package.json \
    package-lock.json \
    render.yaml \
    vite.config.js \
    tailwind.config.js \
    postcss.config.js \
    src/ \
    public/

echo "✅ Deployment package created: burnlist-render.tar.gz"
echo ""
echo "📋 Next steps for Render.com deployment:"
echo "1. Go to https://dashboard.render.com"
echo "2. Create a new 'Blueprint' from your Git repository"
echo "3. Render will automatically detect the render.yaml file"
echo "4. Set up environment variables in Render dashboard:"
echo "   - FINVIZ_API_TOKEN: Your Finviz API token"
echo "5. Deploy both services (frontend and API)"
echo ""
echo "🌐 Your app will be available at:"
echo "   Frontend: https://burnlist-frontend.onrender.com"
echo "   API: https://burnlist-api.onrender.com"