import React from 'react';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(140,185,162)';

const MobileTableWrapper = ({ children, style = {} }) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  return (
    <div 
      className="mobile-table-wrapper"
      style={{
        border: `1px solid ${green}`,
        background: black,
        ...style
      }}>
      {children}
    </div>
  );
};

export default MobileTableWrapper; 