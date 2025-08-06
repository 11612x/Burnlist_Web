import React from 'react';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(140,185,162)';

const MobileFormWrapper = ({ children, style = {} }) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  return (
    <div className="w-full bg-black border border-green-500 p-4 flex flex-col gap-4 md:p-3 md:gap-3 sm:p-2 sm:gap-2" style={{
      background: black,
      border: `1px solid ${green}`,
      ...style
    }}>
      {children}
    </div>
  );
};

export default MobileFormWrapper; 