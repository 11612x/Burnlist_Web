import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Set proper MIME types for CSS files
app.use((req, res, next) => {
  if (req.path.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css');
  }
  next();
});

// API Routes - proxy to finviz-api-server
app.use('/api', async (req, res) => {
  try {
    // Import and use the finviz API server
    const { default: finvizServer } = await import('./finviz-api-server.cjs');
    finvizServer(req, res);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'API server error' });
  }
});

// Serve static files from the dist directory with aggressive cache busting
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: (req, res) => {
    // No cache for JS files to force updates
    if (req.path.endsWith('.js')) {
      return 0; // No cache for JS files
    }
    return '1h'; // 1 hour for other files
  },
  etag: false, // Disable etag for JS files
  lastModified: false // Disable lastModified for JS files
}));

// Add cache control headers for JS files
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Handle all routes by serving index.html (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Combined server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'dist')}`);
  console.log(`🔗 API routes available at /api/*`);
});