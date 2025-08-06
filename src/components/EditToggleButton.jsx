import React from 'react';
import { useThemeColor } from '../ThemeContext';
import CustomButton from './CustomButton';

const CRT_GREEN = 'rgb(149,184,163)';

const EditToggleButton = ({ editMode, setEditMode }) => {
  const black = useThemeColor('black');
  return (
    <div style={{ marginTop: 0, textAlign: "right" }}>
      <CustomButton
        onClick={() => setEditMode(!editMode)}
        style={{
          background: 'transparent',
          color: CRT_GREEN,
          border: 'none',
          fontFamily: "'Courier New', monospace",
          textTransform: 'lowercase',
          fontWeight: 400,
          letterSpacing: 1,
          margin: 0,
          boxShadow: 'none',
          borderRadius: 2,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '40px',
          height: '40px',
          padding: '8px 16px'
        }}
      >
        <img 
          src="/src/assets/edit.png" 
          alt="EDIT" 
          style={{ 
            width: '20px', 
            height: '20px',
            filter: 'brightness(0) saturate(100%) invert(85%) sepia(15%) saturate(638%) hue-rotate(86deg) brightness(95%) contrast(87%)'
          }} 
        />
      </CustomButton>
    </div>
  );
};

export default EditToggleButton;