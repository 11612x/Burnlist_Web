# Burnlist - Render.com Deployment Guide

This guide will help you deploy the Burnlist application to Render.com, a modern cloud platform that offers free hosting for static sites and web services.

## 🚀 Quick Deploy

### Option 1: Deploy from Git Repository (Recommended)

1. **Push your code to GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Add Render.com deployment config"
   git push origin main
   ```

2. **Connect to Render.com**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables**
   - In the Render dashboard, go to your API service
   - Add environment variable: `FINVIZ_API_TOKEN` with your Finviz API token

4. **Deploy**
   - Click "Create Blueprint Instance"
   - Render will deploy both frontend and API services

### Option 2: Manual Deployment

1. **Prepare the deployment package**
   ```bash
   ./render-deploy.sh
   ```

2. **Create services manually in Render**
   - Create a Static Site for the frontend
   - Create a Web Service for the API

## 📁 Project Structure for Render

```
burnlist/
├── render.yaml              # Render.com configuration
├── render-deploy.sh         # Deployment script
├── finviz-api-server.cjs   # Backend API server
├── package.json            # Dependencies
├── src/                    # React frontend source
├── dist/                   # Built frontend (generated)
└── public/                 # Static assets
```

## 🔧 Configuration

### render.yaml
The `render.yaml` file defines two services:

1. **Frontend (Static Site)**
   - Serves the React app built with Vite
   - Routes API calls to the backend service
   - Handles client-side routing

2. **Backend (Web Service)**
   - Runs the Finviz API server
   - Handles `/api/*` requests
   - Uses Node.js environment

### Environment Variables

Set these in your Render dashboard:

- `FINVIZ_API_TOKEN`: Your Finviz API token
- `NODE_ENV`: Set to `production` (automatically set)

## 🌐 URLs

After deployment, your app will be available at:
- **Frontend**: `https://burnlist-frontend.onrender.com`
- **API**: `https://burnlist-api.onrender.com`

## 🔄 Continuous Deployment

Render.com automatically redeploys when you push changes to your Git repository.

## 📊 Monitoring

- **Logs**: Available in Render dashboard
- **Metrics**: Built-in performance monitoring
- **Health Checks**: Automatic health monitoring

## 🛠️ Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Verify Node.js version compatibility

2. **API Connection Issues**
   - Ensure `FINVIZ_API_TOKEN` is set correctly
   - Check that the API service is running

3. **Frontend Not Loading**
   - Verify the static site is deployed
   - Check that API routes are configured correctly

### Debug Commands

```bash
# Check build locally
npm run build

# Test API locally
node finviz-api-server.cjs

# View logs in Render dashboard
# Go to your service → Logs tab
```

## 💰 Cost

- **Free Tier**: 750 hours/month for web services
- **Static Sites**: Always free
- **Custom Domains**: Free with SSL

## 🔐 Security

- **HTTPS**: Automatically enabled
- **Environment Variables**: Securely stored
- **CORS**: Configured for cross-origin requests

## 📈 Scaling

- **Automatic**: Render scales based on traffic
- **Manual**: Upgrade to paid plans for more resources
- **Custom Domains**: Available on all plans

---

For more information, visit [Render.com Documentation](https://render.com/docs).