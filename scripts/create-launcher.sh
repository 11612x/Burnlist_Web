#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Creating Burnlist Launcher...${NC}"

# Get the current directory (absolute path)
CURRENT_DIR=$(pwd)

# Create the launcher script
cat > burnlist-launcher.sh << EOF
#!/bin/bash
cd "$CURRENT_DIR"
./start-app.sh
EOF

# Make the launcher executable
chmod +x burnlist-launcher.sh

# Create desktop shortcut
DESKTOP_DIR="$HOME/Desktop"
LAUNCHER_NAME="Burnlist App"

# Create .command file (macOS executable)
cat > "$DESKTOP_DIR/$LAUNCHER_NAME.command" << EOF
#!/bin/bash
cd "$CURRENT_DIR"
./start-app.sh
EOF

chmod +x "$DESKTOP_DIR/$LAUNCHER_NAME.command"

echo -e "${GREEN}✅ Launcher created!${NC}"
echo -e "${BLUE}📁 Desktop shortcut: $DESKTOP_DIR/$LAUNCHER_NAME.command${NC}"
echo -e "${BLUE}🚀 To run: Double-click the 'Burnlist App' file on your desktop${NC}"
echo -e "${BLUE}💻 Or run: ./burnlist-launcher.sh${NC}" 