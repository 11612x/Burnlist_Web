import React from 'react';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(140,185,162)';

const MobileChartWrapper = ({ children, height = 400, style = {} }) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  return (
    <div style={{
      width: '100%',
      height: height,
      border: `1px solid ${green}`,
      background: black,
      position: 'relative',
      overflow: 'hidden',
      touchAction: 'pan-x pan-y', // Enable touch scrolling
      ...style
    }}>
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
      }}>
        {children}
      </div>
    </div>
  );
};

export default MobileChartWrapper; 