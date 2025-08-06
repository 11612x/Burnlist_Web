import React, { useMemo } from 'react';
import { logger } from '../utils/logger';

const NAVQualityMonitor = ({ navData, watchlistSlug, timeframe }) => {
  const qualityStats = useMemo(() => {
    if (!navData || navData.length === 0) {
      return null;
    }

    const totalPoints = navData.length;
    const validPoints = navData.filter(p => p.valid).length;
    const fallbackPoints = navData.filter(p => !p.valid && !p.bootstrapped).length;
    const bootstrappedPoints = navData.filter(p => p.bootstrapped).length;
    const anomalyPoints = navData.filter(p => p.anomaly).length;
    const qualityPercentage = totalPoints > 0 ? (validPoints / totalPoints) * 100 : 0;

    // Calculate average data coverage
    const avgDataCoverage = navData.reduce((sum, point) => sum + (point.dataCoverage || 0), 0) / totalPoints;

    // Calculate confidence statistics
    const confidenceScores = navData.map(p => p.confidenceScore || 0).filter(c => c > 0);
    const avgConfidence = confidenceScores.length > 0 ? 
      confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length : 0;
    const highConfidencePoints = confidenceScores.filter(c => c >= 0.8).length;
    const lowConfidencePoints = confidenceScores.filter(c => c < 0.5).length;

    // Calculate cohort statistics
    const cohortSizes = navData.map(p => p.cohortSize || 0).filter(c => c > 0);
    const avgCohortSize = cohortSizes.length > 0 ? 
      cohortSizes.reduce((sum, c) => sum + c, 0) / cohortSizes.length : 0;
    
    const avgFullWeightTickers = navData.reduce((sum, p) => sum + (p.fullWeightTickers || 0), 0) / totalPoints;
    const avgFallbackTickers = navData.reduce((sum, p) => sum + (p.fallbackTickers || 0), 0) / totalPoints;
    
    const highFullWeightPoints = navData.filter(p => p.fullWeightTickers && p.cohortSize && (p.fullWeightTickers / p.cohortSize) >= 0.8).length;
    const lowFullWeightPoints = navData.filter(p => p.fullWeightTickers && p.cohortSize && (p.fullWeightTickers / p.cohortSize) < 0.5).length;

    // Find points with low coverage
    const lowCoveragePoints = navData.filter(p => p.dataCoverage < 0.7).length;

    // Group fallback reasons
    const fallbackReasons = {};
    navData.filter(p => !p.valid).forEach(point => {
      const reason = point.reason || 'unknown';
      fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
    });

    // Group fallback strategies
    const fallbackStrategies = {};
    navData.filter(p => !p.valid || p.bootstrapped).forEach(point => {
      const strategy = point.fallbackStrategy || 'unknown';
      fallbackStrategies[strategy] = (fallbackStrategies[strategy] || 0) + 1;
    });

    // Group market status
    const marketStatus = {};
    navData.forEach(point => {
      const status = point.marketStatus || 'unknown';
      marketStatus[status] = (marketStatus[status] || 0) + 1;
    });

    // Calculate volatility statistics
    const volatilities = navData.map(p => p.volatility || 0).filter(v => v > 0);
    const avgVolatility = volatilities.length > 0 ? 
      volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length : 0;
    const highVolatilityPoints = volatilities.filter(v => v > 0.15).length;

    // Calculate adaptive threshold info
    const tickerCount = navData[0]?.totalTickers || 0;
    let adaptiveThreshold;
    if (tickerCount <= 3) {
      adaptiveThreshold = Math.max(2, tickerCount);
    } else if (tickerCount <= 10) {
      adaptiveThreshold = Math.ceil(tickerCount / 2);
    } else {
      adaptiveThreshold = Math.max(2, Math.floor(tickerCount * 0.7));
    }

    return {
      totalPoints,
      validPoints,
      fallbackPoints,
      bootstrappedPoints,
      anomalyPoints,
      qualityPercentage,
      avgDataCoverage,
      lowCoveragePoints,
      fallbackReasons,
      fallbackStrategies,
      marketStatus,
      avgConfidence,
      highConfidencePoints,
      lowConfidencePoints,
      avgVolatility,
      highVolatilityPoints,
      tickerCount,
      adaptiveThreshold,
      avgCohortSize,
      avgFullWeightTickers,
      avgFallbackTickers,
      highFullWeightPoints,
      lowFullWeightPoints
    };
  }, [navData]);

  if (!qualityStats) {
    return null;
  }

  const getQualityColor = (percentage) => {
    if (percentage >= 90) return '#4CAF50'; // Green
    if (percentage >= 70) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getQualityLabel = (percentage) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'Fair';
    return 'Poor';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  return (
    <div style={{
      padding: '10px',
      margin: '5px 0',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderRadius: '4px',
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#ffffff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
        <span>NAV Data Quality Monitor</span>
        <span style={{
          color: getQualityColor(qualityStats.qualityPercentage),
          fontWeight: 'bold'
        }}>
          {getQualityLabel(qualityStats.qualityPercentage)} ({qualityStats.qualityPercentage.toFixed(1)}%)
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '10px' }}>
        <div>
          <span style={{ color: '#888' }}>Valid Points:</span>
          <span style={{ color: '#4CAF50', marginLeft: '5px' }}>{qualityStats.validPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Fallback Points:</span>
          <span style={{ color: '#FFD700', marginLeft: '5px' }}>{qualityStats.fallbackPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Bootstrapped:</span>
          <span style={{ color: '#FFA500', marginLeft: '5px' }}>{qualityStats.bootstrappedPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Anomalies:</span>
          <span style={{ color: '#800080', marginLeft: '5px' }}>{qualityStats.anomalyPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Avg Coverage:</span>
          <span style={{ marginLeft: '5px' }}>{(qualityStats.avgDataCoverage * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Avg Confidence:</span>
          <span style={{ 
            color: getConfidenceColor(qualityStats.avgConfidence), 
            marginLeft: '5px' 
          }}>{(qualityStats.avgConfidence * 100).toFixed(0)}%</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>High Confidence:</span>
          <span style={{ color: '#4CAF50', marginLeft: '5px' }}>{qualityStats.highConfidencePoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Low Confidence:</span>
          <span style={{ color: '#F44336', marginLeft: '5px' }}>{qualityStats.lowConfidencePoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Avg Volatility:</span>
          <span style={{ marginLeft: '5px' }}>{(qualityStats.avgVolatility * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>High Volatility:</span>
          <span style={{ color: '#FF9800', marginLeft: '5px' }}>{qualityStats.highVolatilityPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Cohort Size:</span>
          <span style={{ marginLeft: '5px' }}>{qualityStats.avgCohortSize.toFixed(1)}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Avg Full Weight:</span>
          <span style={{ color: '#4CAF50', marginLeft: '5px' }}>{qualityStats.avgFullWeightTickers.toFixed(1)}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Avg Fallback:</span>
          <span style={{ color: '#FFD700', marginLeft: '5px' }}>{qualityStats.avgFallbackTickers.toFixed(1)}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>High Full Weight:</span>
          <span style={{ color: '#4CAF50', marginLeft: '5px' }}>{qualityStats.highFullWeightPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Low Full Weight:</span>
          <span style={{ color: '#F44336', marginLeft: '5px' }}>{qualityStats.lowFullWeightPoints}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Threshold:</span>
          <span style={{ marginLeft: '5px' }}>{qualityStats.adaptiveThreshold}/{qualityStats.tickerCount}</span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Low Coverage:</span>
          <span style={{ color: '#FF9800', marginLeft: '5px' }}>{qualityStats.lowCoveragePoints}</span>
        </div>
      </div>

      {Object.keys(qualityStats.marketStatus).length > 0 && (
        <div style={{ marginTop: '5px', fontSize: '9px' }}>
          <span style={{ color: '#888' }}>Market Status:</span>
          <div style={{ marginTop: '2px' }}>
            {Object.entries(qualityStats.marketStatus).map(([status, count]) => (
              <div key={status} style={{ 
                color: status === 'open' ? '#4CAF50' : 
                       status === 'closed' ? '#F44336' : 
                       status === 'pre_market' ? '#FF9800' : 
                       status === 'after_hours' ? '#FFD700' : '#888' 
              }}>
                • {status}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(qualityStats.fallbackStrategies).length > 0 && (
        <div style={{ marginTop: '5px', fontSize: '9px' }}>
          <span style={{ color: '#888' }}>Fallback Strategies:</span>
          <div style={{ marginTop: '2px' }}>
            {Object.entries(qualityStats.fallbackStrategies).map(([strategy, count]) => (
              <div key={strategy} style={{ 
                color: strategy === 'bootstrapped' ? '#FFA500' : 
                       strategy === 'carry_forward' ? '#FFD700' : 
                       strategy === 'interpolated' ? '#87CEEB' : '#FFD700' 
              }}>
                • {strategy}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(qualityStats.fallbackReasons).length > 0 && (
        <div style={{ marginTop: '5px', fontSize: '9px' }}>
          <span style={{ color: '#888' }}>Fallback Reasons:</span>
          <div style={{ marginTop: '2px' }}>
            {Object.entries(qualityStats.fallbackReasons).map(([reason, count]) => (
              <div key={reason} style={{ color: '#FFD700' }}>
                • {reason}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '5px', fontSize: '9px', color: '#888' }}>
        <span>Timeframe: {timeframe} | Watchlist: {watchlistSlug}</span>
      </div>
    </div>
  );
};

export default NAVQualityMonitor; 