#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Burnlist with Finviz API...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Stopping all processes...${NC}"
    if [ ! -z "$FINVIZ_PID" ]; then
        kill $FINVIZ_PID 2>/dev/null
        echo -e "${GREEN}✅ Finviz API server stopped${NC}"
    fi
    if [ ! -z "$APP_PID" ]; then
        kill $APP_PID 2>/dev/null
        echo -e "${GREEN}✅ App server stopped${NC}"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start Finviz API server
echo -e "${BLUE}🌐 Starting Finviz API server...${NC}"
node finviz-api-server.cjs &
FINVIZ_PID=$!

# Wait for Finviz server to start
sleep 3

# Check if Finviz server is running
if ! curl -s http://localhost:3001/api/hello > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Finviz API server might not be ready yet, continuing anyway...${NC}"
fi

# Build the app
echo -e "${BLUE}🔨 Building Burnlist App...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    
    # Start the app server in the background
    echo -e "${BLUE}🌐 Starting app server...${NC}"
    npx serve dist -p 5175 &
    APP_PID=$!
    
    # Wait a moment for server to start
    sleep 2
    
    # Open browser
    echo -e "${GREEN}🌍 Opening homepage in browser...${NC}"
    open http://localhost:5175
    
    echo -e "${GREEN}✅ App is running at http://localhost:5175${NC}"
    echo -e "${GREEN}✅ Finviz API server is running at http://localhost:3001${NC}"
    echo -e "${BLUE}Press Ctrl+C to stop all servers${NC}"
    echo -e "${YELLOW}💡 Tip: Use ./migrate-data.sh to backup/restore localStorage data${NC}"

    # Wait for user to stop
    wait $APP_PID
else
    echo -e "${RED}❌ Build failed!${NC}"
    cleanup
    exit 1
fi 