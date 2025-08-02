import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme, useThemeColor } from '../ThemeContext';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';

const ScreenerCard = ({ screener, onDelete, onEdit, isEditMode = false }) => {
  const { isInverted } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(screener.id);
    }
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(screener);
    }
  };

  return (
    <Link
      to={`/screeners/screener/${screener.slug}`}
      style={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'block'
      }}
    >
      <div
        style={{
          width: 252,
          height: isEditMode ? 250 : 120,
          fontFamily: 'Courier New',
          background: 'transparent',
          padding: '10px 8px',
          margin: 0,
          border: `1px solid ${green}`,
          borderRadius: 0,
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          position: 'relative',
          boxSizing: 'border-box',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {/* Name */}
        <div style={{ 
          fontSize: 18, 
          color: green, 
          fontWeight: 'bold', 
          marginBottom: 4, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap'
        }}>
          {screener.name}
        </div>
        
        {/* Show edit/delete buttons only in edit mode */}
        {isEditMode && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: 4 }}>
            <button
              onClick={handleEdit}
              style={{
                backgroundColor: 'transparent',
                color: green,
                border: `1px solid ${green}`,
                padding: '1px 4px',
                fontSize: 9,
                width: '50%',
                fontWeight: 'bold',
                fontFamily: 'Courier New',
                cursor: 'pointer',
                minHeight: '16px'
              }}
            >
              EDIT
            </button>
            <button
              onClick={handleDelete}
              style={{
                backgroundColor: 'transparent',
                color: red,
                border: `1px solid ${red}`,
                padding: '1px 4px',
                fontSize: 9,
                width: '50%',
                fontWeight: 'bold',
                fontFamily: 'Courier New',
                cursor: 'pointer',
                minHeight: '16px'
              }}
            >
              DEL
            </button>
          </div>
        )}
        
        {/* Notes */}
        <div style={{ 
          fontSize: 14, 
          color: green, 
          marginBottom: 4, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {screener.notes || 'N/A'}
        </div>
        
        {/* Screener info */}
        <div style={{ 
          fontSize: 13, 
          color: green, 
          marginBottom: 2,
          cursor: 'help'
        }}
        title={`Screener Type: Market | Created: ${new Date(screener.createdAt).toLocaleDateString()}`}>
          Market Screener
        </div>
        
        {/* Last update */}
        <div style={{ 
          fontSize: 11, 
          color: gray, 
          marginBottom: 2,
          cursor: 'help'
        }}
        title={`Created: ${new Date(screener.createdAt).toLocaleDateString()}`}>
          {new Date(screener.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
};

export default ScreenerCard; 