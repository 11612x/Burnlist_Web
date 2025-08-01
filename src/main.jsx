import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { logger } from './utils/logger';

logger.info("🚀 MAIN.JSX is running");


ReactDOM.createRoot(document.getElementById('root')).render(<App />);