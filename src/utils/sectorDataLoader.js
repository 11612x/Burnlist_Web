import { logger } from './logger.js';

/**
 * Parse CSV sector performance data
 * @param {string} csvText - Raw CSV text
 * @returns {Array} Parsed sector data
 */
export const parseSectorCSV = (csvText) => {
  try {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const sectorData = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const sector = {};
      
      headers.forEach((header, i) => {
        const value = values[i];
        
        // Parse numeric values
        if (['Week', 'Month', 'Quarter', 'HalfYear', 'Year', 'YearToDate', 'AnalystRecom', 'AvgVolume', 'RelativeVolume', 'Change'].includes(header)) {
          sector[header.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase()] = parseFloat(value) || 0;
        } else if (header === 'Volume') {
          sector.volume = parseFloat(value) || 0;
        } else {
          sector[header.toLowerCase()] = value;
        }
      });
      
      return sector;
    });
    
    logger.info(`📊 Parsed ${sectorData.length} sectors from CSV`);
    return sectorData;
  } catch (error) {
    logger.error('Error parsing sector CSV:', error);
    return [];
  }
};

/**
 * Load sector data from a CSV file
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Parsed sector data
 */
export const loadSectorDataFromFile = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    return parseSectorCSV(csvText);
  } catch (error) {
    logger.error('Error loading sector data from file:', error);
    return [];
  }
};

/**
 * Generate sample CSV data for testing
 * @returns {string} CSV formatted string
 */
export const generateSampleCSV = () => {
  return `Sector,Week,Month,Quarter,HalfYear,Year,YearToDate,AnalystRecom,AvgVolume,RelativeVolume,Change,Volume
Basic Materials,-4.63,-3.34,5.66,2.72,0.70,9.90,2.04,709328.16,1.08,-0.48,766214341.00
Communication Services,-0.52,1.43,15.71,3.20,29.72,11.56,1.60,638713.19,1.11,-1.59,711595174.00
Consumer Cyclical,-4.67,-1.62,8.57,-7.38,15.19,-2.57,1.82,1448328.31,1.10,-3.08,1593523147.00
Consumer Defensive,-1.60,-2.46,-1.23,1.28,7.31,4.41,2.00,503732.57,1.01,0.48,508926113.00
Energy,-1.28,-1.36,7.26,-3.27,-4.25,1.80,1.94,765347.41,0.91,-1.39,695800246.00
Financial,-3.69,-1.55,8.10,3.08,20.15,10.30,2.06,1435291.89,1.16,-1.63,1667379359.00
Healthcare,-4.50,-3.82,-5.35,-13.07,-14.67,-7.35,1.86,1364870.92,1.32,0.47,1795722275.00
Industrials,-3.23,1.16,14.30,6.26,15.41,12.00,2.04,970235.49,1.10,-1.44,1066111094.00
Real Estate,-3.13,-1.07,0.25,-2.14,-2.25,-0.41,1.93,510249.51,1.19,-0.26,606765936.00
Technology,-2.14,1.27,20.66,10.28,25.44,10.15,1.67,2583026.34,0.97,-2.22,2496969869.00
Utilities,1.07,4.86,7.86,10.18,19.05,13.99,2.12,230278.34,1.00,0.06,230236110.00`;
};

/**
 * Validate sector data structure
 * @param {Array} sectorData - Sector data to validate
 * @returns {boolean} True if valid
 */
export const validateSectorData = (sectorData) => {
  if (!Array.isArray(sectorData) || sectorData.length === 0) {
    return false;
  }
  
  const requiredFields = ['name', 'week', 'month', 'quarter', 'half_year', 'year', 'year_to_date', 'analyst_recom', 'avg_volume', 'relative_volume', 'change', 'volume'];
  
  return sectorData.every(sector => {
    return requiredFields.every(field => sector.hasOwnProperty(field));
  });
};

/**
 * Get top performing sectors by timeframe
 * @param {Array} sectorData - Sector data
 * @param {string} timeframe - Timeframe to sort by
 * @param {number} limit - Number of sectors to return
 * @returns {Array} Top performing sectors
 */
export const getTopPerformers = (sectorData, timeframe = 'year_to_date', limit = 5) => {
  const sorted = [...sectorData].sort((a, b) => b[timeframe] - a[timeframe]);
  return sorted.slice(0, limit);
};

/**
 * Get worst performing sectors by timeframe
 * @param {Array} sectorData - Sector data
 * @param {string} timeframe - Timeframe to sort by
 * @param {number} limit - Number of sectors to return
 * @returns {Array} Worst performing sectors
 */
export const getWorstPerformers = (sectorData, timeframe = 'year_to_date', limit = 5) => {
  const sorted = [...sectorData].sort((a, b) => a[timeframe] - b[timeframe]);
  return sorted.slice(0, limit);
};

/**
 * Calculate sector performance statistics
 * @param {Array} sectorData - Sector data
 * @returns {Object} Performance statistics
 */
export const calculateSectorStats = (sectorData) => {
  if (!sectorData || sectorData.length === 0) {
    return {};
  }
  
  const timeframes = ['week', 'month', 'quarter', 'half_year', 'year', 'year_to_date'];
  const stats = {};
  
  timeframes.forEach(timeframe => {
    const values = sectorData.map(sector => sector[timeframe]).filter(v => !isNaN(v));
    if (values.length > 0) {
      stats[timeframe] = {
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
        min: Math.min(...values),
        max: Math.max(...values),
        positive: values.filter(v => v > 0).length,
        negative: values.filter(v => v < 0).length
      };
    }
  });
  
  return stats;
}; 