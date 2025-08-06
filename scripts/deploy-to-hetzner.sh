#!/bin/bash

# Deploy Burnlist to Hetzner VPS
# Usage: ./deploy-to-hetzner.sh YOUR_SERVER_IP

if [ -z "$1" ]; then
    echo "Usage: ./deploy-to-hetzner.sh YOUR_SERVER_IP"
    echo "Example: ./deploy-to-hetzner.sh 123.456.789.10"
    exit 1
fi

SERVER_IP=$1
REMOTE_USER="root"
REMOTE_DIR="/var/www/burnlist"

echo "🚀 Deploying Burnlist to Hetzner VPS at $SERVER_IP"

# Step 1: Build the app locally
echo "📦 Building the app..."
npm run build

# Step 2: Create deployment package
echo "📋 Creating deployment package..."
tar -czf burnlist-deploy.tar.gz \
    dist/ \
    finviz-api-server.cjs \
    finviz-scraper.cjs \
    package.json \
    package-lock.json \
    start-all.sh \
    start-with-finviz.sh \
    start-app.sh \
    env.example

# Step 3: Upload to server
echo "📤 Uploading to server..."
scp burnlist-deploy.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/

# Step 4: Setup server (run on remote)
echo "🔧 Setting up server..."
ssh $REMOTE_USER@$SERVER_IP << 'EOF'
    # Update system
    apt update && apt upgrade -y
    
    # Install Node.js
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    # Install Nginx
    apt install nginx -y
    
    # Install PM2
    npm install -g pm2
    
    # Create app directory
    mkdir -p /var/www/burnlist
    cd /var/www/burnlist
    
    # Extract deployment package
    tar -xzf /tmp/burnlist-deploy.tar.gz
    
    # Install dependencies
    npm install --production
    
    # Setup environment
    if [ ! -f .env ]; then
        cp env.example .env
        echo "⚠️  Please edit .env file with your API tokens"
    fi
    
    # Create Nginx config
    cat > /etc/nginx/sites-available/burnlist << 'NGINX_CONFIG'
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root /var/www/burnlist/dist;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # Backend APIs
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
NGINX_CONFIG
    
    # Enable site
    ln -sf /etc/nginx/sites-available/burnlist /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx config
    nginx -t
    
    # Start services
    pm2 start finviz-api-server.cjs --name "finviz-api"
    pm2 start finviz-scraper.cjs --name "finviz-scraper"
    pm2 save
    pm2 startup
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    echo "✅ Deployment complete!"
    echo "🌐 Your app should be available at: http://$SERVER_IP"
    echo "📝 Don't forget to:"
    echo "   1. Edit /var/www/burnlist/.env with your API tokens"
    echo "   2. Restart services: pm2 restart all"
    echo "   3. Setup SSL with: certbot --nginx -d your-domain.com"
EOF

# Step 5: Cleanup
echo "🧹 Cleaning up..."
rm burnlist-deploy.tar.gz

echo "🎉 Deployment script completed!"
echo "📋 Next steps:"
echo "   1. SSH to your server: ssh root@$SERVER_IP"
echo "   2. Edit environment: nano /var/www/burnlist/.env"
echo "   3. Restart services: pm2 restart all"
echo "   4. Check status: pm2 status"
echo "   5. View logs: pm2 logs"