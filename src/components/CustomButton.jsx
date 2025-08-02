import React from 'react';
import { useThemeColor } from '../ThemeContext';

const CustomButton = ({ children, onClick, type = 'button', style = {}, disabled = false, mobile = false, ...props }) => {
  const bg = useThemeColor(disabled ? '#444' : '#000');
  const fg = useThemeColor('#8CB9A2');
  const border = useThemeColor('#8CB9A2');
  
  // Mobile-specific styles
  const mobileStyles = mobile ? {
    minHeight: '44px',
    fontSize: '16px',
    padding: '12px 16px',
    borderRadius: '0',
    transition: 'all 0.2s ease',
  } : {};
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        padding: mobile ? '12px 16px' : '6px 16px',
        fontFamily: 'Courier New',
        fontSize: mobile ? '16px' : '15px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        borderRadius: mobile ? 0 : 2,
        margin: mobile ? '4px' : '2px',
        minHeight: mobile ? '44px' : 'auto',
        transition: 'all 0.2s ease',
        ...mobileStyles,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export default CustomButton; 