import React, { useState } from 'react';
import { useThemeColor } from '../ThemeContext';

const CRT_GREEN = 'rgb(149,184,163)';
const CRT_GREEN_DARK = 'rgb(120,150,130)';

const DatePicker = ({ isOpen, onClose, onConfirm, title = "Select Start Date" }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const black = useThemeColor('black');

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(selectedDate);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // Get today's date in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: black,
        border: `2px solid ${CRT_GREEN}`,
        padding: '20px',
        minWidth: '300px',
        fontFamily: "'Courier New', monospace",
        color: CRT_GREEN
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          textAlign: 'center',
          fontSize: '16px'
        }}>
          {title}
        </h3>
        
        <div style={{
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={today}
            style={{
              background: 'transparent',
              border: `1px solid ${CRT_GREEN}`,
              color: CRT_GREEN,
              padding: '8px 12px',
              fontSize: '14px',
              fontFamily: "'Courier New', monospace",
              outline: 'none',
              width: '200px'
            }}
          />
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <button
            onClick={handleCancel}
            style={{
              background: 'transparent',
              border: `1px solid ${CRT_GREEN_DARK}`,
              color: CRT_GREEN_DARK,
              padding: '8px 16px',
              fontSize: '12px',
              fontFamily: "'Courier New', monospace",
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = CRT_GREEN_DARK;
              e.target.style.color = 'black';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = CRT_GREEN_DARK;
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleConfirm}
            disabled={!selectedDate}
            style={{
              background: selectedDate ? CRT_GREEN : 'transparent',
              border: `1px solid ${CRT_GREEN}`,
              color: selectedDate ? 'black' : CRT_GREEN_DARK,
              padding: '8px 16px',
              fontSize: '12px',
              fontFamily: "'Courier New', monospace",
              cursor: selectedDate ? 'pointer' : 'not-allowed',
              opacity: selectedDate ? 1 : 0.5
            }}
            onMouseEnter={(e) => {
              if (selectedDate) {
                e.target.style.background = CRT_GREEN;
                e.target.style.color = 'black';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedDate) {
                e.target.style.background = CRT_GREEN;
                e.target.style.color = 'black';
              }
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker; 