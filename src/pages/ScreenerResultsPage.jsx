import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme, useThemeColor } from '../ThemeContext';
import CustomButton from '@components/CustomButton';
import NavigationBar from '@components/NavigationBar';
import NotificationBanner from '@components/NotificationBanner';
import useNotification from '../hooks/useNotification';
import { logger } from '../utils/logger';
import { getTestData } from '../utils/testDataGenerator';
import { v4 as uuidv4 } from 'uuid';
import logo from '../assets/logo.png';
import logoblack from '../assets/logoblack.png';

const CRT_GREEN = 'rgb(140,185,162)';

const ScreenerResultsPage = () => {
  const { screenerSlug } = useParams();
  const navigate = useNavigate();
  const { isInverted, toggleTheme } = useTheme();
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');
  const { notification, notificationType, setNotification, setNotificationType } = useNotification();

  const [screener, setScreener] = useState(null);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'Ticker', direction: 'asc' });

  // Load screener data from localStorage
  useEffect(() => {
    try {
      const screeners = JSON.parse(localStorage.getItem('burnlist_screeners') || '{}');
      const screenerData = Object.values(screeners).find(s => s.slug === screenerSlug);
      
      if (screenerData) {
        setScreener(screenerData);
        fetchScreenerData(screenerData.apiLink);
      } else {
        setNotification('⚠️ Screener not found');
        setNotificationType('error');
        navigate('/screeners');
      }
    } catch (error) {
      logger.error('Failed to load screener:', error);
      setNotification('⚠️ Failed to load screener');
      setNotificationType('error');
      navigate('/screeners');
    }
  }, [screenerSlug, navigate]);

  const fetchScreenerData = async (apiLink) => {
    setIsLoading(true);
    setNotification('');
    
    logger.debug('Fetching screener data from:', apiLink);
    
    try {
      // Try multiple strategies for fetching data
      let success = false;
      let csvText = '';
      
      // Strategy 1: Try direct fetch (only for non-Elite URLs)
      if (!apiLink.includes('elite.finviz.com')) {
        try {
          const directResponse = await fetch(apiLink);
          if (directResponse.ok) {
            csvText = await directResponse.text();
            success = true;
          }
        } catch (directError) {
          logger.debug('Direct fetch failed, trying proxy...');
        }
      }
      
      // Strategy 1.5: Try local proxy server for Elite URLs
      if (!success && apiLink.includes('elite.finviz.com')) {
        try {
          // Transform the URL to use auth parameter
          let transformedUrl = apiLink;
          logger.debug('Original URL:', apiLink);
          
          // Use the API key from the screener data
          const apiKey = screener?.apiKey || 'f6202a40-4a7c-4d91-9ef8-068795ffbac0';
          
          if (apiLink.includes('ft=')) {
            // Replace ft= parameter with auth= parameter
            transformedUrl = apiLink.replace(/[?&]ft=[^&]*/, (match) => {
              const separator = match.startsWith('?') ? '?' : '&';
              return separator + `auth=${apiKey}`;
            });
            logger.debug('Transformed URL (ft->auth):', transformedUrl);
          } else if (apiLink.includes('elite.finviz.com') && !apiLink.includes('auth=')) {
            // If it's an Elite URL without auth parameter, add it
            const separator = apiLink.includes('?') ? '&' : '?';
            transformedUrl = apiLink + separator + `auth=${apiKey}`;
            logger.debug('Transformed URL (added auth):', transformedUrl);
          }
          
          // Use production API endpoint instead of localhost
          const proxyUrl = process.env.NODE_ENV === 'production' 
            ? `/api/finviz-proxy?url=${encodeURIComponent(transformedUrl)}`
            : `http://localhost:3001/api/finviz-proxy?url=${encodeURIComponent(transformedUrl)}`;
          logger.debug('Using proxy URL:', proxyUrl);
          const proxyResponse = await fetch(proxyUrl);
          
          if (proxyResponse.ok) {
            csvText = await proxyResponse.text();
            success = true;
            logger.debug('Successfully fetched data via proxy');
          } else {
            const errorData = await proxyResponse.json().catch(() => ({}));
            logger.error('Proxy server error:', errorData);
            throw new Error(`Proxy error: ${errorData.error || proxyResponse.statusText}`);
          }
        } catch (proxyError) {
          logger.debug('Proxy failed:', proxyError.message);
        }
      }
      
      // Strategy 2: Try CORS proxy if direct fetch failed (only for non-Elite URLs)
      if (!success && apiLink.includes('finviz.com') && !apiLink.includes('elite.finviz.com')) {
        try {
          const proxyUrl = `https://cors-anywhere.herokuapp.com/${apiLink}`;
          const proxyResponse = await fetch(proxyUrl, {
            headers: {
              'Origin': window.location.origin,
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (proxyResponse.ok) {
            csvText = await proxyResponse.text();
            success = true;
          }
        } catch (proxyError) {
          logger.debug('Proxy fetch failed, using test data...');
        }
      }
      
      if (success && csvText) {
        const parsedData = parseCSV(csvText);
        logger.debug('Parsed CSV data:', parsedData.slice(0, 3)); // Log first 3 rows for debugging
        setData(parsedData);
        setNotification('✅ Screener data loaded successfully');
        setNotificationType('success');
      } else {
        // Fallback to test data
        throw new Error('All fetch strategies failed');
      }
    } catch (error) {
      logger.error('Failed to fetch screener data:', error);
      
      // Always fallback to test data for any error
      if (apiLink.includes('elite.finviz.com')) {
        setNotification('⚠️ Elite authentication failed. Using test data for demonstration.');
        setNotificationType('warning');
      } else {
        setNotification('⚠️ API access blocked: Using test data for demonstration');
        setNotificationType('warning');
      }
      setData(getTestData());
    } finally {
      setIsLoading(false);
    }
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    
    // Parse CSV properly handling quoted values
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
    
    return lines.slice(1).map(line => {
      const values = parseCSVLine(line).map(v => v.replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = useMemo(() => {
    if (!data.length) return [];
    
    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      let comparison = 0;
      
      // Handle numeric values
      if (['Price', 'Change', 'Volume', 'P/E', 'Market Cap'].includes(sortConfig.key)) {
        const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));
        comparison = isNaN(aNum) ? -1 : isNaN(bNum) ? 1 : aNum - bNum;
      } else {
        // String comparison
        comparison = aValue.localeCompare(bValue);
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const handleRefresh = () => {
    if (screener) {
      fetchScreenerData(screener.apiLink);
    }
  };

  const handleSendToUniverse = () => {
    if (!screener || !data.length) {
      setNotification('⚠️ No data to send to universe');
      setNotificationType('error');
      return;
    }

    try {
      // Get current date/time for universe name
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const universeName = `${screener.name} ${dateStr}`;
      const universeId = uuidv4();
      const universeSlug = universeName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      
      // Convert screener data to universe format
      const universeItems = data.map(row => ({
        symbol: row.Ticker,
        buyPrice: parseFloat(row.Price) || 0,
        buyDate: new Date().toISOString(),
        addedAt: new Date().toISOString(),
        type: 'real'
      }));

      // Create new universe
      const newUniverse = {
        id: universeId,
        name: universeName,
        slug: universeSlug,
        items: universeItems,
        reason: `Created from screener: ${screener.name}`,
        createdAt: new Date().toISOString(),
      };

      // Load existing universes
      const existingUniverses = JSON.parse(localStorage.getItem('burnlist_universes') || '{}');
      
      // Add new universe
      const updatedUniverses = { ...existingUniverses, [universeId]: newUniverse };
      
      // Save to localStorage
      localStorage.setItem('burnlist_universes', JSON.stringify(updatedUniverses));
      
      setNotification(`✅ Created universe "${universeName}" with ${universeItems.length} tickers`);
      setNotificationType('success');
      
      // Navigate to the new universe
      navigate(`/universe/${universeSlug}`);
      
    } catch (error) {
      logger.error('Failed to create universe:', error);
      setNotification('❌ Failed to create universe');
      setNotificationType('error');
    }
  };

  const formatValue = (value, key) => {
    if (!value) return '-';
    
    switch (key) {
      case 'Price':
        return `$${parseFloat(value).toFixed(2)}`;
      case 'Change':
        const change = parseFloat(value);
        const color = change >= 0 ? green : red;
        return (
          <span style={{ color }}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </span>
        );
      case 'Volume':
        const vol = parseInt(value.replace(/,/g, ''));
        if (vol >= 1000000) {
          return `${(vol / 1000000).toFixed(1)}M`;
        } else if (vol >= 1000) {
          return `${(vol / 1000).toFixed(1)}K`;
        }
        return vol.toLocaleString();
      case 'Market Cap':
        const cap = value.replace(/[^\d]/g, '');
        const capNum = parseInt(cap);
        // Convert from millions to billions (e.g., 886700 -> 8.87B)
        const billions = capNum / 100000;
        return `$${billions.toFixed(2)}B`;
      default:
        return value;
    }
  };

  const SortableHeader = ({ column, label }) => (
    <th
      onClick={() => handleSort(column)}
      style={{
        cursor: 'pointer',
        padding: '12px 8px',
        textAlign: 'center',
        borderBottom: `2px solid ${green}`,
        color: green,
        fontWeight: 'bold',
        fontSize: '14.5px',
        userSelect: 'none',
        transition: 'background-color 0.2s',
        ':hover': {
          backgroundColor: 'rgba(140,185,162,0.1)'
        }
      }}
    >
      {label}
      {sortConfig.key === column && (
        <span style={{ marginLeft: '4px' }}>
          {sortConfig.direction === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </th>
  );

  if (!screener) {
    return (
      <div style={{ 
        fontFamily: 'Courier New', 
        color: green, 
        backgroundColor: black, 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        Loading...
      </div>
    );
  }

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
        padding: '32px'
      }}>
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
            <span style={{ color: red, fontWeight: 'bold', fontSize: 12 }}>19</span>
            <span style={{ color: green, fontWeight: 'bold', fontSize: 12 }}>6</span>
            <span style={{ color: green }}>
              ACCOUNT: local
            </span>
          </div>
        </div>

        <NavigationBar />

        {/* Navigation */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <CustomButton
            onClick={() => navigate('/screeners')}
            style={{
              background: 'transparent',
              color: green,
              border: `1px solid ${green}`,
              padding: '8px 16px',
              fontSize: '12px',
              minWidth: 'auto'
            }}
          >
            ← BACK TO SCREENERS
          </CustomButton>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CustomButton
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                background: 'transparent',
                color: green,
                border: 'none',
                padding: '0',
                fontSize: '24px',
                minWidth: 'auto',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                textDecoration: 'none',
                fontWeight: 'bold',

              }}
            >
              {screener.name}
            </CustomButton>
          </div>
        </div>

        {/* Screener Info */}
        {screener.notes && (
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            border: `1px solid ${green}`,
            borderRadius: '4px',
            backgroundColor: 'rgba(140,185,162,0.05)'
          }}>
            <div style={{ fontSize: '12px', color: gray }}>
              {screener.notes}
            </div>
          </div>
        )}

        {/* Results Table */}
        <div style={{
          overflowX: 'auto',
          border: `1px solid ${green}`,
          borderRadius: '4px'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14.5px'
          }}>
            <thead>
              <tr>
                <SortableHeader column="Ticker" label="Ticker" />
                <SortableHeader column="Company" label="Company" />
                <SortableHeader column="Price" label="Price" />
                <SortableHeader column="Change" label="Change" />
                <SortableHeader column="Volume" label="Volume" />
                <SortableHeader column="P/E" label="P/E" />
                <SortableHeader column="Market Cap" label="Market Cap" />
                <SortableHeader column="Sector" label="Sector" />
                <SortableHeader column="Country" label="Country" />
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr key={index} style={{
                  borderBottom: `1px solid ${gray}`,
                  ':hover': {
                    backgroundColor: 'rgba(140,185,162,0.05)'
                  }
                }}>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                    <a
                      href={`https://elite.finviz.com/charts?t=${row.Ticker}&p=d&l=1h1v`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: green,
                        textDecoration: 'none',
                        cursor: 'pointer',
                        ':hover': {
                          textDecoration: 'underline'
                        }
                      }}
                    >
                      {row.Ticker}
                    </a>
                  </td>
                  <td style={{ padding: '8px', textAlign: 'left' }}>
                    {row.Company}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatValue(row.Price, 'Price')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatValue(row.Change, 'Change')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatValue(row.Volume, 'Volume')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatValue(row['P/E'], 'P/E')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {formatValue(row['Market Cap'], 'Market Cap')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'left' }}>
                    {row.Sector}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    {row.Country}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Results Summary */}
        <div style={{
          marginTop: '16px',
          fontSize: '14.5px',
          color: gray,
          textAlign: 'center'
        }}>
          Showing {sortedData.length} results
        </div>

        {/* Send to Universe Button */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center'
        }}>
          <CustomButton
            onClick={handleSendToUniverse}
            disabled={!data.length}
            style={{
              backgroundColor: data.length ? 'rgb(150,184,163)' : gray,
              color: black,
              border: `1px solid rgb(150,184,163)`,
              padding: '12px 24px',
              fontSize: '14px',
              minWidth: '200px',
              opacity: data.length ? 1 : 0.6,
              cursor: data.length ? 'pointer' : 'not-allowed'
            }}
          >
            SEND TO UNIVERSE
          </CustomButton>
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

          }}>
            <div style={{ 
              minWidth: 320, 
              maxWidth: 480, 
              pointerEvents: 'auto',

            }}>
              <NotificationBanner
                message={notification}
                type={notificationType}
                onClose={() => setNotification('')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenerResultsPage; 