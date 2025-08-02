import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import CustomButton from './CustomButton';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(140,185,162)';

const MobileNavigation = () => {
  const location = useLocation();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');

  const navItems = [
    { path: '/universes', label: 'UNIVERSE' },
    { path: '/journal', label: 'DASHBOARD' },
    { path: '/screeners', label: 'SCREENERS' },
    { path: '/', label: 'GRAPH VIEW' },
  ];

  return (
    <>
      <style>
        {`
          .mobile-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: ${black};
            border-top: 1px solid ${green};
            padding: 12px 16px;
            z-index: 1000;
            display: flex;
            justify-content: space-around;
            align-items: center;
            gap: 8px;
          }
          
          @media (min-width: 769px) {
            .mobile-nav {
              display: none !important;
            }
          }
          
          .mobile-nav-button {
            background: ${black};
            color: ${green};
            border: 1px solid ${green};
            padding: 8px 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: bold;
            text-decoration: none;
            text-align: center;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .mobile-nav-button:active {
            background: ${green};
            color: ${black};
          }
          
          @media (max-width: 480px) {
            .mobile-nav {
              padding: 8px 12px;
              gap: 6px;
            }
            .mobile-nav-button {
              font-size: 10px;
              padding: 6px 8px;
              letter-spacing: 0.3px;
            }
          }
        `}
      </style>
      <div className="mobile-nav">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="mobile-nav-button"
              style={{
                backgroundColor: isActive ? green : black,
                color: isActive ? black : green,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </>
  );
};

export default MobileNavigation; 