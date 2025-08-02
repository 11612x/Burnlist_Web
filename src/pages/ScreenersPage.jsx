import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme, useThemeColor } from '../ThemeContext';
import CustomButton from '@components/CustomButton';
import NotificationBanner from '@components/NotificationBanner';
import ScreenerCard from '@components/ScreenerCard';
import ScreenerFormModal from '@components/ScreenerFormModal';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';
import logo from '../assets/logo.png';
import logoblack from '../assets/logoblack.png';

const CRT_GREEN = 'rgb(140,185,162)';

const ScreenersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isInverted, toggleTheme } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  
  const [screeners, setScreeners] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScreener, setEditingScreener] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Load screeners from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('burnlist_screeners');
      if (saved) {
        const parsed = JSON.parse(saved);
        setScreeners(parsed);
      }
    } catch (error) {
      logger.error('Failed to load screeners:', error);
    }
  }, []);

  // Save screeners to localStorage when they change
  useEffect(() => {
    localStorage.setItem('burnlist_screeners', JSON.stringify(screeners));
  }, [screeners]);

  const handleCreateScreener = () => {
    setEditingScreener(null);
    setIsModalOpen(true);
  };

  const handleEditScreener = (screener) => {
    setEditingScreener(screener);
    setIsModalOpen(true);
  };

  const handleDeleteScreener = (id) => {
    const keyToDelete = Object.keys(screeners).find(key => screeners[key].id === id);
    
    if (!keyToDelete) {
      logger.log('🗑️ Could not find screener with id:', id);
      return;
    }
    
    const { [keyToDelete]: deleted, ...remaining } = screeners;
    setScreeners(remaining);
    setNotification('🗑️ Screener deleted');
    setNotificationType('success');
  };

  const handleSaveScreener = (screenerData) => {
    if (editingScreener) {
      // Update existing screener
      const updated = { ...screeners };
      const keyToUpdate = Object.keys(screeners).find(key => screeners[key].id === editingScreener.id);
      if (keyToUpdate) {
        updated[keyToUpdate] = { ...screenerData, id: editingScreener.id, createdAt: editingScreener.createdAt };
        setScreeners(updated);
        setNotification('✅ Screener updated successfully');
        setNotificationType('success');
      }
    } else {
      // Create new screener
      const newScreener = {
        ...screenerData,
        id: `screener_${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      const updated = { ...screeners, [newScreener.id]: newScreener };
      setScreeners(updated);
      setNotification('✅ Screener created successfully');
      setNotificationType('success');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingScreener(null);
  };

  return (
    <div style={{ 
      fontFamily: 'Courier New', 
      color: green, 
      backgroundColor: black, 
      minHeight: '100vh', 
      padding: '0' 
    }}>
      {/* Main Content */}
      <div style={{ 
        padding: '32px',
        '@media (max-width: 768px)': {
          padding: '16px',
          paddingBottom: '80px', // Account for mobile navigation
        },
        '@media (max-width: 480px)': {
          padding: '12px',
          paddingBottom: '80px', // Account for mobile navigation
        }
      }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: '12px',
          '@media (max-width: 768px)': {
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginBottom: 16,
          }
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 12,
            '@media (max-width: 480px)': {
              gap: 8,
            }
          }}>
            <button
              onClick={toggleTheme}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                minHeight: '44px', // Touch-friendly
              }}
              aria-label="Toggle theme"
            >
              <img 
                src={isInverted ? logoblack : logo} 
                alt="Burnlist Logo" 
                style={{ 
                  width: 44, 
                  height: 44, 
                  marginRight: 10, 
                  transition: 'filter 0.3s',
                  '@media (max-width: 480px)': {
                    width: 36,
                    height: 36,
                    marginRight: 8,
                  }
                }} 
              />
            </button>
            <strong style={{ 
              fontSize: '170%', 
              lineHeight: '44px', 
              display: 'inline-block',
              color: green,
              height: '44px',
              '@media (max-width: 768px)': {
                fontSize: '140%',
                lineHeight: '36px',
                height: '36px',
              },
              '@media (max-width: 480px)': {
                fontSize: '120%',
                lineHeight: '32px',
                height: '32px',
              }
            }}>BURNLIST v1.1</strong>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            '@media (max-width: 768px)': {
              alignSelf: 'flex-end',
            }
          }}>
            <span style={{ color: red, fontWeight: 'bold', fontSize: 12 }}>0</span>
            <span style={{ color: green, fontWeight: 'bold', fontSize: 12 }}>0</span>
            <span style={{ color: green }}>
              ACCOUNT: local
            </span>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px 20px',
          borderBottom: `1px solid ${CRT_GREEN}`,
          background: 'rgba(0,0,0,0.3)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <CustomButton
            onClick={() => navigate('/')}
            style={{
              background: location.pathname === '/' ? CRT_GREEN : 'transparent',
              color: location.pathname === '/' ? '#000000' : CRT_GREEN,
              border: `1px solid ${CRT_GREEN}`,
              padding: '9px 18px',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '80px',
              textAlign: 'center'
            }}
          >
            BURNPAGE
          </CustomButton>
          
          <CustomButton
            onClick={() => navigate('/screeners')}
            style={{
              background: location.pathname === '/screeners' ? CRT_GREEN : 'transparent',
              color: location.pathname === '/screeners' ? '#000000' : CRT_GREEN,
              border: `1px solid ${CRT_GREEN}`,
              padding: '9px 18px',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '80px',
              textAlign: 'center'
            }}
          >
            SCREENERS
          </CustomButton>
          
          <CustomButton
            onClick={() => navigate('/universes')}
            style={{
              background: location.pathname === '/universes' || location.pathname.startsWith('/universe/') ? CRT_GREEN : 'transparent',
              color: location.pathname === '/universes' || location.pathname.startsWith('/universe/') ? '#000000' : CRT_GREEN,
              border: `1px solid ${CRT_GREEN}`,
              padding: '9px 18px',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '80px',
              textAlign: 'center'
            }}
          >
            UNIVERSE
          </CustomButton>
          
          <CustomButton
            onClick={() => navigate('/journal')}
            style={{
              background: location.pathname === '/journal' ? CRT_GREEN : 'transparent',
              color: location.pathname === '/journal' ? '#000000' : CRT_GREEN,
              border: `1px solid ${CRT_GREEN}`,
              padding: '9px 18px',
              fontFamily: "'Courier New', monospace",
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '80px',
              textAlign: 'center'
            }}
          >
            JOURNAL
          </CustomButton>
        </div>

        {/* Page Content */}
        <div style={{
          marginTop: '30px',
          color: green
        }}>


          {/* Screeners Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(252px, 252px))',
            rowGap: '20px',
            columnGap: '20px',
            margin: '70px 0 1px 0',
            justifyContent: 'center',
            alignItems: 'start'
          }}>
            {Object.values(screeners).length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '40px',
                border: `2px dashed ${green}`,
                borderRadius: '8px',
                color: gray
              }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                  No screeners yet
                </div>
                <div style={{ fontSize: '12px' }}>
                  Click "ADD SCREENER" to create your first screener
                </div>
              </div>
            ) : (
              Object.values(screeners).map(screener => (
                <ScreenerCard
                  key={screener.id}
                  screener={screener}
                  onDelete={handleDeleteScreener}
                  onEdit={handleEditScreener}
                  isEditMode={isEditMode}
                />
              ))
            )}
          </div>
        </div>

        {/* Centralized Notification Banner */}
        {notification && (
          <div style={{ 
            position: 'fixed', 
            top: 24, 
            left: 0, 
            right: 0, 
            zIndex: 10001, 
            display: 'flex', 
            justifyContent: 'center', 
            pointerEvents: 'none',
            '@media (max-width: 768px)': {
              top: 16,
            }
          }}>
            <div style={{ 
              minWidth: 320, 
              maxWidth: 480, 
              pointerEvents: 'auto',
              '@media (max-width: 768px)': {
                minWidth: 280,
                maxWidth: 'calc(100vw - 32px)',
              }
            }}>
              <NotificationBanner
                message={notification}
                type={notificationType}
                onClose={() => setNotification('')}
              />
            </div>
          </div>
        )}

        {/* Screener Form Modal */}
        <ScreenerFormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveScreener}
          screener={editingScreener}
        />
      </div>

      {/* Action Buttons - Bottom Right */}
      <div className="action-buttons-container">
        <style>
          {`
            .action-buttons-container {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            
            @media (max-width: 768px) {
              .action-buttons-container {
                position: fixed;
                top: 50%;
                right: 10px;
                transform: translateY(-50%);
                flex-direction: column;
                gap: 8px;
              }
            }
            
            @media (max-width: 480px) {
              .action-buttons-container {
                position: fixed;
                top: 50%;
                right: 8px;
                transform: translateY(-50%);
                flex-direction: column;
                gap: 6px;
              }
            }
            
            .action-button {
              background: ${black};
              color: ${green};
              border: 1px solid ${green};
              font-size: 12px;
              padding: 6px 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              min-height: 32px;
              font-family: 'Courier New', monospace;
              cursor: pointer;
              text-decoration: none;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            @media (max-width: 768px) {
              .action-button {
                font-size: 10px;
                padding: 6px 8px;
                min-height: 32px;
                width: 60px;
              }
            }
            
            @media (max-width: 480px) {
              .action-button {
                font-size: 9px;
                padding: 4px 6px;
                min-height: 28px;
                width: 50px;
              }
            }
          `}
        </style>
        <button
          onClick={handleCreateScreener}
          className="action-button"
          style={{
            backgroundColor: green,
            color: black,
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'all 0.2s ease-in-out',
            padding: '8px 16px'
          }}
        >
          +++
        </button>
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          {isEditMode ? 'done' : 'edit'}
        </button>
        <button
          onClick={() => {
            // Placeholder for import functionality
            setNotification('Import functionality coming soon');
            setNotificationType('info');
          }}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          import
        </button>
        <button
          onClick={() => {
            // Placeholder for export functionality
            setNotification('Export functionality coming soon');
            setNotificationType('info');
          }}
          className="action-button"
          style={{
            textTransform: 'lowercase',
            fontWeight: 400,
            letterSpacing: 1
          }}
        >
          export
        </button>
      </div>
    </div>
  );
};

export default ScreenersPage;