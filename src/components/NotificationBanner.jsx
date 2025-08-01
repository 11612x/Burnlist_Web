import React from 'react';
import { useThemeColor } from '../ThemeContext';

const NotificationBanner = ({ message, type = 'info', onClose }) => {
  if (!message) return null;
  
  // Use dark green theme colors
  const bg = useThemeColor(type === 'error' ? '#1a0f0f' : type === 'success' ? '#0f1a0f' : type === 'loading' ? '#0a0a0a' : '#0f0f0f');
  const fg = useThemeColor('#8CB9A2'); // CRT green for all types
  const border = useThemeColor(type === 'error' ? '#e31507' : type === 'success' ? '#0de309' : '#8CB9A2');
  
  return (
    <div
      style={{
        background: bg,
        color: fg,
        border: `2px solid ${border}`,
        padding: '12px 16px',
        textAlign: 'center',
        fontFamily: 'Courier New',
        fontSize: 14,
        fontWeight: 'bold',
        position: 'relative',
        marginBottom: 8,
        cursor: onClose ? 'pointer' : 'default',
        userSelect: 'none',
        opacity: 1,
        borderRadius: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        minHeight: '44px', // Touch-friendly
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
      aria-label={onClose ? 'Dismiss notification' : undefined}
      tabIndex={onClose ? 0 : undefined}
      role="alert"
    >
      {message}
    </div>
  );
};

export default NotificationBanner;