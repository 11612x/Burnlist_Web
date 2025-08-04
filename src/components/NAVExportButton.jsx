import React, { useState } from 'react';
import { useThemeColor } from '../ThemeContext';
import navCalculator from '../data/navCalculator';
import { logger } from '../utils/logger';

const CRT_GREEN = 'rgb(149,184,163)';

const NAVExportButton = ({ 
  portfolioData, 
  watchlistSlug, 
  timeframe = 'W',
  buttonText = 'Export NAV',
  className = '',
  devOnly = false 
}) => {
  const green = useThemeColor(CRT_GREEN);
  const black = useThemeColor('black');
  const [isExporting, setIsExporting] = useState(false);

  // Hide button if devOnly is true and not in development
  if (devOnly && process.env.NODE_ENV === 'production') {
    return null;
  }

  const handleExport = async () => {
    if (!portfolioData || portfolioData.length === 0) {
      logger.warn('No portfolio data available for export');
      return;
    }

    setIsExporting(true);
    
    try {
      // Calculate NAV performance data
      const navData = navCalculator.calculateNAVPerformance(portfolioData, timeframe);
      
      if (!navData || navData.length === 0) {
        logger.warn('No NAV data generated for export');
        setIsExporting(false);
        return;
      }

      // Export as JSON
      const exportData = navCalculator.exportNAVSeries(navData, watchlistSlug, timeframe);
      
      // Create JSON file
      const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      // Create CSV data
      const csvData = generateCSV(exportData.navSeries);
      const csvBlob = new Blob([csvData], {
        type: 'text/csv'
      });

      // Download JSON file
      const jsonUrl = URL.createObjectURL(jsonBlob);
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `nav-export-${watchlistSlug}-${timeframe}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);

      // Download CSV file
      const csvUrl = URL.createObjectURL(csvBlob);
      const csvLink = document.createElement('a');
      csvLink.href = csvUrl;
      csvLink.download = `nav-export-${watchlistSlug}-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(csvLink);
      csvLink.click();
      document.body.removeChild(csvLink);
      URL.revokeObjectURL(csvUrl);

      logger.log(`✅ NAV data exported successfully: ${navData.length} points for ${watchlistSlug} (${timeframe})`);
      
    } catch (error) {
      logger.error('Error exporting NAV data:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const generateCSV = (navSeries) => {
    const headers = [
      'timestamp',
      'navValue',
      'confidenceScore',
      'validTickers',
      'totalCohort',
      'fallbackCount',
      'anomaly',
      'marketStatus',
      'unweightedAverage',
      'driftWarning',
      'driftAmount',
      'inactiveTickerCount'
    ];

    const csvRows = [headers.join(',')];
    
    navSeries.forEach(point => {
      const row = [
        point.timestamp,
        point.navValue,
        point.confidenceScore,
        point.validTickers,
        point.totalCohort,
        point.fallbackCount,
        point.anomaly,
        point.marketStatus,
        point.unweightedAverage,
        point.driftWarning,
        point.driftAmount,
        point.inactiveTickerCount
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || !portfolioData || portfolioData.length === 0}
      className={className}
      style={{
        fontFamily: 'Courier New',
        fontSize: '12px',
        padding: '6px 12px',
        backgroundColor: black,
        border: `1px solid ${green}`,
        color: green,
        cursor: isExporting ? 'not-allowed' : 'pointer',
        opacity: isExporting ? 0.6 : 1,
        borderRadius: 0,
        ...(!portfolioData || portfolioData.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : {})
      }}
      title={`Export NAV series data for ${watchlistSlug} (${timeframe}) as JSON and CSV files`}
    >
      {isExporting ? 'Exporting...' : buttonText}
    </button>
  );
};

export default NAVExportButton;