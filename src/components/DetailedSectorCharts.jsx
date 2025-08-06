import React, { useState, useEffect } from 'react';
import { useThemeColor } from '../ThemeContext';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(140,185,162)';

const DetailedSectorCharts = ({ selectedTimeframe }) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const red = useThemeColor('#e31507');
  const gray = useThemeColor('#888');
  
  const [sectorData, setSectorData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch sector data from Finviz Elite
  useEffect(() => {
    fetchSectorData();
  }, []);

  const fetchSectorData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/finviz-sector');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvText = await response.text();
      console.log('Raw CSV data (first 500 chars):', csvText.substring(0, 500));
      const parsedData = parseSectorCSV(csvText);
      console.log('Parsed sector data:', parsedData);
      setSectorData(parsedData);
      logger.info(`📊 Loaded ${parsedData.length} sectors from Finviz Elite`);
    } catch (error) {
      logger.error('Error fetching sector data:', error);
      setError('Failed to load sector data');
    } finally {
      setIsLoading(false);
    }
  };

  const parseSectorCSV = (csvText) => {
    try {
      const lines = csvText.trim().split('\n');
      
      // Parse headers properly
      const headerLine = lines[0];
      const headers = [];
      let currentHeader = '';
      let inQuotes = false;
      
      for (let i = 0; i < headerLine.length; i++) {
        const char = headerLine[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          headers.push(currentHeader.trim());
          currentHeader = '';
        } else {
          currentHeader += char;
        }
      }
      headers.push(currentHeader.trim()); // Add the last header
      

      
      const sectorData = lines.slice(1).map((line, index) => {
        const sector = {};
        
        // Parse values properly
        const values = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim()); // Add the last value
        
        headers.forEach((header, i) => {
          const value = values[i];
          console.log(`Processing header: "${header}" with value: "${value}"`);
          
          // Only include the required columns
          if (['Name', 'Performance (Week)', 'Performance (Month)', 'Performance (Quarter)', 'Performance (Year To Date)'].includes(header)) {
            if (header === 'Name') {
              sector.name = value.replace(/"/g, ''); // Remove quotes
              console.log(`Set sector name to: ${sector.name}`);
            } else {
              // Convert percentage string to float (e.g., "-4.63%" -> -4.63)
              const cleanValue = value.replace(/[%"]/g, ''); // Remove % and quotes
              const key = header.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
              sector[key] = parseFloat(cleanValue) || 0;
              console.log(`Set ${key} to: ${sector[key]}`);
            }
          }
        });
        
        return sector;
      });
      
      return sectorData;
    } catch (error) {
      logger.error('Error parsing sector CSV:', error);
      return [];
    }
  };

  const getBarColor = (value) => {
    if (Math.abs(value) < 0.05) return '#000000'; // Black for values close to 0
    return value > 0 ? '#96B8A3' : '#B02A1B'; // CRT green for positive, CRT red for negative
  };

  const calculateAxisBounds = (data, key) => {
    const values = data.map(sector => sector[key]).filter(val => val !== undefined);
    if (values.length === 0) return [-10, 10];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    // If range is small, use a default range for visual clarity
    if (range < 8) {
      const center = (min + max) / 2;
      return [center - 4, center + 4];
    }
    
    // Round bounds outward to nearest clean number
    const roundToClean = (num) => {
      const abs = Math.abs(num);
      if (abs <= 5) return Math.sign(num) * 5;
      if (abs <= 10) return Math.sign(num) * 10;
      if (abs <= 25) return Math.sign(num) * 25;
      if (abs <= 50) return Math.sign(num) * 50;
      return Math.sign(num) * Math.ceil(abs / 100) * 100;
    };
    
    return [roundToClean(min), roundToClean(max)];
  };

  const renderBarChart = (data, performanceKey, title) => {
    if (!data || data.length === 0) {
      return (
        <div style={{ marginBottom: 32 }}>
          <h4 style={{ color: green, marginBottom: 16, fontFamily: 'Courier New, monospace' }}>
            {title}
          </h4>
          <div style={{ 
            background: '#000000',
            padding: 16,
            border: `2px solid ${green}`,
            fontFamily: 'Courier New, monospace',
            textAlign: 'center',
            color: gray
          }}>
            No data available
          </div>
        </div>
      );
    }
    
    const sortedData = [...data].sort((a, b) => (b[performanceKey] || 0) - (a[performanceKey] || 0));
    const bounds = calculateAxisBounds(data, performanceKey);
    
    return (
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ color: green, marginBottom: 16, fontFamily: 'Courier New, monospace' }}>
          {title}
        </h4>
        <div style={{ 
          background: '#000000',
          padding: 16,
          border: `2px solid ${green}`,
          fontFamily: 'Courier New, monospace'
        }}>
          {sortedData.map((sector, index) => {
            const value = sector[performanceKey] || 0;
            const percentage = ((value - bounds[0]) / (bounds[1] - bounds[0])) * 100;
            const barWidth = Math.max(0, Math.min(100, percentage));
            
            return (
              <div key={index} style={{ marginBottom: 8 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#ffffff'
                }}>
                  <div style={{ 
                    width: '180px', 
                    textAlign: 'left',
                    marginRight: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    color: '#96B8A3'
                  }}>
                    {sector.name || 'Unknown Sector'}
                  </div>
                  <div style={{ 
                    flex: 1,
                    height: '20px',
                    position: 'relative',
                    marginRight: 12
                  }}>
                    <div style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: getBarColor(value),
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <div style={{ 
                    width: '70px',
                    textAlign: 'right',
                    color: getBarColor(value),
                    fontWeight: 'bold',
                    fontSize: 11
                  }}>
                    {value > 0 ? '+' : ''}{(value || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      </div>
    );
  };

  const renderTable = () => {
    return (
      <div style={{ marginBottom: 32 }}>
        <h4 style={{ color: green, marginBottom: 16, fontFamily: 'Courier New, monospace' }}>
          SECTOR PERFORMANCE TABLE
        </h4>
        <div style={{ 
          background: '#000000',
          padding: 16,
          border: `2px solid ${green}`,
          fontFamily: 'Courier New, monospace'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: 15.84,
            color: '#ffffff'
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${gray}` }}>
                <th style={{ textAlign: 'left', padding: '8px', color: green }}>Sector</th>
                <th style={{ textAlign: 'right', padding: '8px', color: green }}>Week</th>
                <th style={{ textAlign: 'right', padding: '8px', color: green }}>Month</th>
                <th style={{ textAlign: 'right', padding: '8px', color: green }}>Quarter</th>
                <th style={{ textAlign: 'right', padding: '8px', color: green }}>YTD</th>
              </tr>
            </thead>
            <tbody>
              {sectorData.map((sector, index) => (
                <tr key={index} style={{ borderBottom: `1px solid ${gray}20` }}>
                  <td style={{ padding: '8px', fontWeight: 'bold', color: '#96B8A3' }}>{sector.name || 'Unknown Sector'}</td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '8px', 
                    color: getBarColor(sector.performance_week || 0) 
                  }}>
                    {(sector.performance_week || 0) > 0 ? '+' : ''}{(sector.performance_week || 0).toFixed(2)}%
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '8px', 
                    color: getBarColor(sector.performance_month || 0) 
                  }}>
                    {(sector.performance_month || 0) > 0 ? '+' : ''}{(sector.performance_month || 0).toFixed(2)}%
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '8px', 
                    color: getBarColor(sector.performance_quarter || 0) 
                  }}>
                    {(sector.performance_quarter || 0) > 0 ? '+' : ''}{(sector.performance_quarter || 0).toFixed(2)}%
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    padding: '8px', 
                    color: getBarColor(sector.performance_year_to_date || 0) 
                  }}>
                    {(sector.performance_year_to_date || 0) > 0 ? '+' : ''}{(sector.performance_year_to_date || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 32, 
        color: gray,
        fontFamily: 'Courier New, monospace'
      }}>
        Loading sector data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: 32, 
        color: red,
        fontFamily: 'Courier New, monospace'
      }}>
        {error}
      </div>
    );
  }

  // If timeframe is 'D' or 'day' (Day), show table instead of charts
  if (selectedTimeframe === 'D' || selectedTimeframe === 'day' || selectedTimeframe === 'Day') {
    return renderTable();
  }

  // Show charts for other timeframes
  const getChartConfig = () => {
    const timeframeMap = {
      'day': { dataKey: null, title: null }, // Will show table
      'week': { dataKey: 'performance_week', title: 'SECTOR PERFORMANCE - WEEKLY' },
      'month': { dataKey: 'performance_month', title: 'SECTOR PERFORMANCE - MONTHLY' },
      'quarter': { dataKey: 'performance_quarter', title: 'SECTOR PERFORMANCE - QUARTERLY' },
      'yeartodate': { dataKey: 'performance_year_to_date', title: 'SECTOR PERFORMANCE - YEAR-TO-DATE' }
    };
    
    const normalizedTimeframe = selectedTimeframe.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase();
    return timeframeMap[normalizedTimeframe] || timeframeMap['yeartodate'];
  };

  const config = getChartConfig();
  
  if (config.dataKey) {
    return renderBarChart(sectorData, config.dataKey, config.title);
  } else {
    return renderTable();
  }
};

export default DetailedSectorCharts; 