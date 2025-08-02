import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import NotificationBanner from '@components/NotificationBanner';
import CustomButton from '@components/CustomButton';
import { useTheme, useThemeColor } from '../ThemeContext';
import { formatDateEuropean } from '../utils/dateUtils';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';
import logo from '../assets/logo.png';
import logoblack from '../assets/logoblack.png';

const CRT_GREEN = 'rgb(140,185,162)';

const UniverseHomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [universes, setUniverses] = useState({});
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();
  const [editMode, setEditMode] = useState(false);
  const [justClicked, setJustClicked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { isInverted, toggleTheme } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');

  // Load universes from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("burnlist_universes");
      if (saved) {
        const parsed = JSON.parse(saved);
        setUniverses(parsed);
      }
    } catch (error) {
      console.error("Failed to load universes:", error);
    }
  }, []);

  // Save universes to localStorage when they change
  useEffect(() => {
    localStorage.setItem("burnlist_universes", JSON.stringify(universes));
  }, [universes]);

  const handleCreateUniverse = () => {
    setJustClicked(true);
    setTimeout(() => setJustClicked(false), 150);
    
    const currentDate = formatDateEuropean(new Date());
    
    const universeName = `Universe ${currentDate}`;
    const universeId = uuidv4();
    const universeSlug = universeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    // Check if name already exists (case-insensitive)
    const exists = Object.values(universes).some(u => u.name && u.name.toLowerCase() === universeName.toLowerCase());
    if (exists) {
      setNotification('⚠️ Universe name already exists');
      setNotificationType('error');
      return;
    }
    
    const newUniverse = {
      id: universeId,
      name: universeName,
      slug: universeSlug,
      items: [],
      reason: '',
      createdAt: new Date().toISOString(),
    };
    
    const updated = { ...universes, [universeId]: newUniverse };
    setUniverses(updated);
    localStorage.setItem('burnlist_universes', JSON.stringify(updated));
    setNotification('');
  };

  const handleDeleteUniverse = (id) => {
    const keyToDelete = Object.keys(universes).find(key => universes[key].id === id);
    
    if (!keyToDelete) {
      logger.log('🗑️ Could not find universe with id:', id);
      return;
    }
    
    const { [keyToDelete]: deleted, ...remaining } = universes;
    setUniverses(remaining);
    localStorage.setItem("burnlist_universes", JSON.stringify(remaining));
    if (deleted) {
      logger.log('🗑️ Deleted universe:', deleted.name);
    } else {
      logger.log('🗑️ Deleted universe with id:', id);
    }
  };

  const handleUpdateUniverseName = useCallback((id, newName) => {
    // Prevent duplicate names (case-insensitive, except for current)
    const duplicate = Object.values(universes).some(u => u.id !== id && u.name && u.name.toLowerCase() === newName.toLowerCase());
    if (duplicate) {
      setNotification('⚠️ Name already exists');
      setNotificationType('error');
      return;
    }
    setUniverses((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = { ...updated[id], name: newName, slug: newName.toLowerCase().replace(/[^a-z0-9]/g, '-') };
      }
      localStorage.setItem('burnlist_universes', JSON.stringify(updated));
      return updated;
    });
  }, [setUniverses, universes]);

  const handleUpdateUniverseReason = useCallback((id, newReason) => {
    const updated = {
      ...universes,
      [id]: {
        ...universes[id],
        reason: newReason
      }
    };
    setUniverses(updated);
    localStorage.setItem('burnlist_universes', JSON.stringify(updated));
  }, [setUniverses, universes]);

  // Track editing state and previous name for each universe
  const [editingNames, setEditingNames] = useState({}); // { [id]: { value, prev } }

  // When entering edit mode, initialize editingNames
  useEffect(() => {
    if (editMode) {
      const initial = {};
      Object.values(universes).forEach(u => {
        initial[u.id] = { value: u.name, prev: u.name };
      });
      setEditingNames(initial);
    } else {
      setEditingNames({});
    }
  }, [editMode, universes]);

  // Handler for input change (just update local state)
  const handleEditNameInput = (id, value) => {
    setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], value } }));
  };

  // Handler for blur or 'Done' (validate and commit)
  const commitEditName = (id) => {
    const newName = editingNames[id]?.value || '';
    // Prevent duplicate names (case-insensitive, except for current)
    const duplicate = Object.values(universes).some(u => u.id !== id && u.name && u.name.toLowerCase() === newName.toLowerCase());
    if (duplicate) {
      setNotification('⚠️ Name already exists');
      setNotificationType('error');
      // Revert to previous name
      setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], value: prev[id].prev } }));
      return;
    }
    // Commit the name change
    setUniverses((prev) => {
      const updated = { ...prev };
      if (updated[id]) {
        updated[id] = { ...updated[id], name: newName, slug: newName.toLowerCase().replace(/[^a-z0-9]/g, '-') };
      }
      localStorage.setItem('burnlist_universes', JSON.stringify(updated));
      return updated;
    });
    setEditingNames(prev => ({ ...prev, [id]: { ...prev[id], prev: newName } }));
  };

  const sortedUniverses = useMemo(() => Object.values(universes), [universes]);

  return (
    <div style={{ fontFamily: 'Courier New', color: green, backgroundColor: black, minHeight: '100vh', padding: '0' }}>
      {/* Main Content */}
      <div style={{ padding: '32px' }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-start', 
            gap: 12
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
                minHeight: '44px',
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
                  transition: 'filter 0.3s'
                }} 
              />
            </button>
            <strong style={{ 
              fontSize: '170%', 
              lineHeight: '44px', 
              display: 'inline-block',
              color: green,
              height: '44px'
            }}>BURNLIST v1.1</strong>
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10
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
              background: location.pathname === '/' || location.pathname.startsWith('/burn/') ? CRT_GREEN : 'transparent',
              color: location.pathname === '/' || location.pathname.startsWith('/burn/') ? '#000000' : CRT_GREEN,
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



      {/* Centralized Notification Banner */}
      {notification && (
        <div style={{ position: 'fixed', top: 24, left: 0, right: 0, zIndex: 10001, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ minWidth: 320, maxWidth: 480, pointerEvents: 'auto' }}>
            <NotificationBanner
              message={notification}
              type={notificationType}
              onClose={() => setNotification('')}
            />
          </div>
        </div>
      )}

      {/* Loading and error banners */}
      {isLoading && (
        <NotificationBanner 
          message="Loading universes..." 
          type="loading" 
        />
      )}
      {error && (
        <NotificationBanner 
          message={error} 
          type="error" 
          onClose={() => setError(null)} 
        />
      )}

      {Object.keys(universes).length === 0 && (
        <p style={{ textAlign: 'center', color: gray, marginTop: '50px' }}>
          No universes found. Create your first universe to get started.
        </p>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(252px, 252px))',
        rowGap: '20px',
        columnGap: '20px',
        margin: '70px 0 1px 0',
        justifyContent: 'center',
        alignItems: 'start',
      }}>
        {sortedUniverses.map((universe, idx) => {
          const tickers = universe.items || [];
                     const cardContent = (
             <div style={{
               width: 252,
               height: editMode ? 250 : 120,
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
             }}>
              {/* Name (editable) */}
              {editMode ? (
                <input
                  value={editingNames[universe.id]?.value ?? universe.name}
                  onChange={e => handleEditNameInput(universe.id, e.target.value)}
                  onBlur={() => commitEditName(universe.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEditName(universe.id);
                    }
                  }}
                  style={{
                    fontFamily: 'Courier New',
                    fontSize: 16,
                    color: green,
                    background: 'transparent',
                    border: `1px solid ${green}`,
                    marginBottom: 2,
                    padding: '2px 4px',
                    width: '100%',
                    fontWeight: 'bold',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minHeight: '24px'
                  }}
                />
              ) : (
                <div style={{ fontSize: 18, color: green, fontWeight: 'bold', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {universe.name || `UNIVERSE ${idx + 1}`}
                </div>
              )}
              {/* Delete button (only in edit mode) */}
              {editMode && (
                <CustomButton
                  onClick={() => handleDeleteUniverse(universe.id)}
                  style={{
                    backgroundColor: 'transparent',
                    color: red,
                    border: `1px solid ${red}`,
                    padding: '1px 4px',
                    marginBottom: 2,
                    fontSize: 9,
                    width: '100%',
                    fontWeight: 'bold',
                    fontFamily: 'Courier New',
                    cursor: 'pointer',
                    minHeight: '16px'
                  }}
                >
                  DELETE
                </CustomButton>
              )}
              {/* Reason (editable) */}
              {editMode ? (
                <input
                  value={universe.reason || ''}
                  onChange={e => handleUpdateUniverseReason(universe.id, e.target.value)}
                  style={{
                    fontFamily: 'Courier New',
                    fontSize: 12,
                    color: green,
                    background: 'transparent',
                    border: `1px solid ${green}`,
                    marginBottom: 2,
                    padding: '2px 4px',
                    width: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minHeight: '16px'
                  }}
                  placeholder="Reason..."
                />
              ) : (
                <div style={{ fontSize: 14, color: green, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {universe.reason || 'N/A'}
                </div>
              )}
              {/* Universe info */}
              <div style={{ fontSize: 13, color: green, marginBottom: 2 }}>
                {tickers.length} tickers
              </div>
              {/* Created date */}
              <div style={{ fontSize: 11, color: gray, marginBottom: 2 }}>
                {formatDateEuropean(universe.createdAt)}
              </div>
                             {/* Status */}
               <div style={{ fontSize: 19, color: green, fontWeight: 'bold', marginBottom: 2 }}>
                 {tickers.length > 0 ? 'ACTIVE' : 'EMPTY'}
               </div>
            </div>
          );
          return (
            <div key={universe.id} style={{ margin: 0 }}>
              {editMode ? cardContent : (
                <Link to={`/universe/${universe.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {cardContent}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      

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
        onClick={handleCreateUniverse}
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
        onClick={() => setEditMode(!editMode)}
        className="action-button"
        style={{
          textTransform: 'lowercase',
          fontWeight: 400,
          letterSpacing: 1
        }}
      >
        {editMode ? 'done' : 'edit'}
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

export default UniverseHomePage; 