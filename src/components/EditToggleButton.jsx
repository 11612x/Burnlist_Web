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
          border: `1px solid ${CRT_GREEN}`,
          fontFamily: "'Courier New', monospace",
          textTransform: 'lowercase',
          fontWeight: 400,
          letterSpacing: 1,
          margin: 0,
          boxShadow: 'none',
          borderRadius: 2,
          fontSize: 15,
        }}
      >
        {editMode ? 'done' : 'edit'}
      </CustomButton>
    </div>
  );
};

export default EditToggleButton;