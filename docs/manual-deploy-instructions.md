# Manual Deployment Instructions

Since SSH is not working, follow these steps to deploy manually:

## Step 1: Build the App Locally
```bash
npm run build
```

## Step 2: Create Deployment Package
```bash
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
```

## Step 3: Upload to Server
1. Go to Hetzner Cloud Console
2. Open your server's console
3. Run these commands in the console:

```bash
# Create app directory
mkdir -p /var/www/burnlist
cd /var/www/burnlist

# Download the deployment package
# You'll need to upload burnlist-deploy.tar.gz to the server
# You can do this by:
# 1. Using Hetzner's file upload feature
# 2. Or copying/pasting the tar.gz content
# 3. Or using a temporary file sharing service

# Extract the package
tar -xzf burnlist-deploy.tar.gz

# Install dependencies
npm install --production

# Setup environment
cp env.example .env
nano .env  # Edit with your API tokens

# Create Nginx config
cat > /etc/nginx/sites-available/burnlist << 'EOF'
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
EOF

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
echo "🌐 Your app should be available at: http://116.203.234.38"
```

## Step 4: Verify Deployment
1. Check if services are running: `pm2 status`
2. Check Nginx: `systemctl status nginx`
3. View logs: `pm2 logs`

## Step 5: Access Your App
Your app will be available at: http://116.203.234.38