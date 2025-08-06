#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Burnlist Data Migration Tool${NC}"

# Function to backup localStorage data
backup_data() {
    echo -e "${BLUE}📦 Creating backup of localStorage data...${NC}"
    
    # Create backup directory
    mkdir -p backups
    
    # Get current timestamp
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    
    # Create backup file
    BACKUP_FILE="backups/burnlist_backup_${TIMESTAMP}.json"
    
    # Create a simple HTML file to extract localStorage
    cat > extract_localStorage.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>LocalStorage Extractor</title>
</head>
<body>
    <h2>LocalStorage Data</h2>
    <pre id="output"></pre>
    <script>
        const data = {
            watchlists: localStorage.getItem('burnlist_watchlists'),
            fetchCount: localStorage.getItem('burnlist_fetch_count'),
            tradeJournalTrades: localStorage.getItem('trade_journal_trades'),
            timestamp: new Date().toISOString()
        };
        document.getElementById('output').textContent = JSON.stringify(data, null, 2);
    </script>
</body>
</html>
EOF

    echo -e "${YELLOW}📋 Please open extract_localStorage.html in your browser and copy the data${NC}"
    echo -e "${YELLOW}💾 Save it to: $BACKUP_FILE${NC}"
    
    # Open the extractor file
    open extract_localStorage.html
}

# Function to restore localStorage data
restore_data() {
    echo -e "${BLUE}📥 Restoring localStorage data...${NC}"
    
    if [ -f "backups/burnlist_backup_*.json" ]; then
        LATEST_BACKUP=$(ls -t backups/burnlist_backup_*.json | head -1)
        echo -e "${GREEN}Found backup: $LATEST_BACKUP${NC}"
        
        # Create restore HTML file
        cat > restore_localStorage.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>LocalStorage Restorer</title>
</head>
<body>
    <h2>Restoring Data...</h2>
    <div id="status"></div>
    <script>
        const statusDiv = document.getElementById('status');
        
        // Load the backup data
        fetch('$LATEST_BACKUP')
            .then(response => response.json())
            .then(data => {
                if (data.watchlists) {
                    localStorage.setItem('burnlist_watchlists', data.watchlists);
                    statusDiv.innerHTML += '<p>✅ Watchlists restored</p>';
                }
                if (data.fetchCount) {
                    localStorage.setItem('burnlist_fetch_count', data.fetchCount);
                    statusDiv.innerHTML += '<p>✅ Fetch count restored</p>';
                }
                if (data.tradeJournalTrades) {
                    localStorage.setItem('trade_journal_trades', data.tradeJournalTrades);
                    statusDiv.innerHTML += '<p>✅ Trade journal restored</p>';
                }
                statusDiv.innerHTML += '<p>🎉 All data restored successfully!</p>';
            })
            .catch(error => {
                statusDiv.innerHTML = '<p>❌ Error restoring data: ' + error + '</p>';
            });
    </script>
</body>
</html>
EOF

        echo -e "${GREEN}📋 Please open restore_localStorage.html in your browser${NC}"
        open restore_localStorage.html
    else
        echo -e "${YELLOW}No backup files found in backups/ directory${NC}"
    fi
}

# Main menu
echo -e "${BLUE}Choose an option:${NC}"
echo -e "${GREEN}1)${NC} Backup current localStorage data"
echo -e "${GREEN}2)${NC} Restore from backup"
echo -e "${GREEN}3)${NC} Show backup files"
echo -e "${GREEN}4)${NC} Exit"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        backup_data
        ;;
    2)
        restore_data
        ;;
    3)
        echo -e "${BLUE}📁 Available backups:${NC}"
        ls -la backups/ 2>/dev/null || echo "No backups directory found"
        ;;
    4)
        echo -e "${GREEN}👋 Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${YELLOW}Invalid choice${NC}"
        exit 1
        ;;
esac 