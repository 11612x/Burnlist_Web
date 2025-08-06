#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building Burnlist App...${NC}"

# Build the app
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    
    # Start the server in the background
    echo -e "${BLUE}🌐 Starting server...${NC}"
    npx serve dist -p 5175 &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 2
    
    # Open browser
    echo -e "${GREEN}🌍 Opening homepage in browser...${NC}"
    open http://localhost:5175
    
    echo -e "${GREEN}✅ App is running at http://localhost:5175${NC}"
echo -e "${BLUE}Press Ctrl+C to stop the server${NC}"
echo -e "${YELLOW}💡 Tip: Use ./migrate-data.sh to backup/restore localStorage data${NC}"

# Wait for user to stop
wait $SERVER_PID
else
    echo -e "\033[0;31m❌ Build failed!${NC}"
    exit 1
fi 