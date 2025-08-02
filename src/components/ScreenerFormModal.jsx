import React, { useState, useEffect } from 'react';
import { useTheme, useThemeColor } from '../ThemeContext';
import CustomButton from './CustomButton';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';

const ScreenerFormModal = ({ isOpen, onClose, onSave, screener = null }) => {
  const { isInverted } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');

  const [formData, setFormData] = useState({
    name: '',
    apiLink: '',
    apiKey: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  // Initialize form data when screener is provided (edit mode)
  useEffect(() => {
    if (screener) {
      setFormData({
        name: screener.name || '',
        apiLink: screener.apiLink || '',
        apiKey: screener.apiKey || '',
        notes: screener.notes || ''
      });
    } else {
      setFormData({
        name: '',
        apiLink: '',
        apiKey: '',
        notes: ''
      });
    }
    setErrors({});
  }, [screener, isOpen]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.apiLink.trim()) {
      newErrors.apiLink = 'API link is required';
    } else if (!formData.apiLink.includes('finviz.com')) {
      newErrors.apiLink = 'API link must be a valid Finviz URL';
    }

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = 'API key is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const screenerData = {
      ...formData,
      id: screener?.id || `screener_${Date.now()}`,
      slug: formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      createdAt: screener?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(screenerData);
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

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
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: black,
        border: `2px solid ${green}`,
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          color: green,
          fontSize: '20px',
          fontWeight: 'bold'
        }}>
          {screener ? 'Edit Screener' : 'Create New Screener'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Name Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: green,
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Screener Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${errors.name ? red : green}`,
                borderRadius: '4px',
                backgroundColor: black,
                color: green,
                fontFamily: 'Courier New',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter screener name"
            />
            {errors.name && (
              <div style={{ color: red, fontSize: '12px', marginTop: '4px' }}>
                {errors.name}
              </div>
            )}
          </div>

          {/* API Link Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: green,
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Finviz API Link *
            </label>
            <input
              type="url"
              value={formData.apiLink}
              onChange={(e) => handleInputChange('apiLink', e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${errors.apiLink ? red : green}`,
                borderRadius: '4px',
                backgroundColor: black,
                color: green,
                fontFamily: 'Courier New',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="https://elite.finviz.com/export.ashx?v=111&f=..."
            />
            <div style={{ 
              fontSize: '11px', 
              color: gray, 
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Note: This URL serves as both the API endpoint and CSV data source for Finviz Elite screeners.
            </div>
            {errors.apiLink && (
              <div style={{ color: red, fontSize: '12px', marginTop: '4px' }}>
                {errors.apiLink}
              </div>
            )}
          </div>

          {/* API Key Field */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: green,
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              API Key *
            </label>
            <input
              type="text"
              value={formData.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              autoComplete="off"
              data-form-type="other"
              name="api-key"
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${errors.apiKey ? red : green}`,
                borderRadius: '4px',
                backgroundColor: black,
                color: green,
                fontFamily: 'Courier New',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your API key"
            />
            {errors.apiKey && (
              <div style={{ color: red, fontSize: '12px', marginTop: '4px' }}>
                {errors.apiKey}
              </div>
            )}
          </div>

          {/* Notes Field */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: green,
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: `1px solid ${green}`,
                borderRadius: '4px',
                backgroundColor: black,
                color: green,
                fontFamily: 'Courier New',
                fontSize: '14px',
                boxSizing: 'border-box',
                minHeight: '80px',
                resize: 'vertical'
              }}
              placeholder="Optional notes about this screener"
            />
          </div>

          {/* Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <CustomButton
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: green,
                border: `1px solid ${green}`,
                padding: '10px 20px',
                fontSize: '14px',
                minWidth: '80px'
              }}
            >
              Cancel
            </CustomButton>
            <CustomButton
              type="submit"
              style={{
                background: green,
                color: black,
                border: `1px solid ${green}`,
                padding: '10px 20px',
                fontSize: '14px',
                minWidth: '80px',
                fontWeight: 'bold'
              }}
            >
              {screener ? 'Update' : 'Create'}
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScreenerFormModal; 