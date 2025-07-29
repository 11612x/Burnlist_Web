import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import CustomButton from './CustomButton';

const CRT_GREEN = 'rgb(140,185,162)';

const NavigationBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isInverted } = useTheme();

  const isCurrentPage = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/burn/');
    }
    return location.pathname === path;
  };

  const getButtonStyle = (isActive) => ({
    background: isActive ? CRT_GREEN : 'transparent',
    color: isActive ? '#000000' : CRT_GREEN,
    border: `1px solid ${CRT_GREEN}`,
    padding: '8px 16px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '80px',
    textAlign: 'center'
  });

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '10px 20px',
      borderBottom: `1px solid ${CRT_GREEN}`,
      background: 'rgba(0,0,0,0.3)',
      gap: '10px'
    }}>
      <CustomButton
        onClick={() => navigate('/universes')}
        style={getButtonStyle(isCurrentPage('/universes'))}
      >
        UNIVERSE
      </CustomButton>
      
      <CustomButton
        onClick={() => navigate('/journal')}
        style={getButtonStyle(isCurrentPage('/journal'))}
      >
        JOURNAL
      </CustomButton>
      
      <CustomButton
        onClick={() => navigate('/')}
        style={getButtonStyle(isCurrentPage('/'))}
      >
        BURNPAGE
      </CustomButton>
    </div>
  );
};

export default NavigationBar; 