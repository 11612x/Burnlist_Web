import React from "react";

const CRT_GREEN = 'rgb(140,185,162)';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0] && payload[0].value != null) {
    let datePart = "";
    let timePart = "";
    let returnValue = payload[0].value;
    let additionalInfo = "";
    let navMetadata = null;
    
    if (payload && payload[0] && payload[0].payload && payload[0].payload.timestampValue) {
      const dt = new Date(payload[0].payload.timestampValue);
      
      // Format date as DD-MM-YY (European format)
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const year = String(dt.getFullYear()).slice(-2);
      datePart = `${day}-${month}-${year}`;
      
      // Format time as HH:MM:SS (24-hour format)
      timePart = dt.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      
      // Add additional context if available
      if (payload[0].payload.xIndex !== undefined) {
        additionalInfo = `Point ${payload[0].payload.xIndex + 1}`;
      }
      
      // Extract NAV metadata if available
      navMetadata = payload[0].payload.navMetadata;
    }

    // Determine return color based on value
    const returnColor = returnValue >= 0 ? CRT_GREEN : '#e31507';
    const returnPrefix = returnValue >= 0 ? '+' : '';

    return (
      <div
        style={{
          backgroundColor: '#000',
          border: `1px solid ${CRT_GREEN}`,
          padding: '12px',
          borderRadius: 0,
          fontFamily: 'Courier New',
          fontSize: '12px',
          minWidth: '160px',
          maxWidth: '280px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
          zIndex: 10000,
        }}
      >
        {/* Return Value - Most prominent */}
        <div style={{ 
          color: returnColor, 
          margin: '0 0 8px 0',
          fontSize: '14px',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          {returnPrefix}{returnValue.toFixed(2)}%
          {navMetadata?.anomaly && (
            <span style={{ color: '#ff6b35', marginLeft: '6px' }}>⚠</span>
          )}
        </div>
        
        {/* Date and Time */}
        <div style={{ 
          color: CRT_GREEN, 
          margin: '4px 0',
          fontSize: '11px',
          textAlign: 'center'
        }}>
          {datePart}
        </div>
        <div style={{ 
          color: CRT_GREEN, 
          margin: '4px 0',
          fontSize: '11px',
          textAlign: 'center'
        }}>
          {timePart}
        </div>

        {/* NAV Metadata Section */}
        {navMetadata && (
          <>
            <div style={{ 
              borderTop: `1px solid ${CRT_GREEN}`,
              paddingTop: '6px',
              marginTop: '6px'
            }}>
              {/* Confidence Score */}
              <div style={{ 
                color: navMetadata.confidenceScore >= 0.7 ? CRT_GREEN : '#ff6b35', 
                fontSize: '10px',
                margin: '2px 0'
              }}>
                Confidence: {(navMetadata.confidenceScore || 0).toFixed(2)}
              </div>
              
              {/* Ticker Counts */}
              <div style={{ 
                color: '#ccc', 
                fontSize: '10px',
                margin: '2px 0'
              }}>
                {navMetadata.fullWeightTickers || 0}/{navMetadata.validTickers || 0}/{navMetadata.totalTickers || 0} tickers
              </div>
              
              {/* Market Status */}
              <div style={{ 
                color: navMetadata.marketStatus === 'open' ? CRT_GREEN : '#888', 
                fontSize: '10px',
                margin: '2px 0'
              }}>
                Market: {navMetadata.marketStatus || 'unknown'}
              </div>
              
              {/* Drift Warning */}
              {navMetadata.driftWarning && (
                <div style={{ 
                  color: '#ff6b35', 
                  fontSize: '10px',
                  margin: '2px 0'
                }}>
                  ⚠ Drift: {navMetadata.driftAmount >= 0 ? '+' : ''}{navMetadata.driftAmount.toFixed(1)}%
                </div>
              )}
              
              {/* Inactive Tickers Warning */}
              {navMetadata.inactiveTickers && navMetadata.inactiveTickers.length > 0 && (
                <div style={{ 
                  color: '#ff6b35', 
                  fontSize: '10px',
                  margin: '2px 0'
                }}>
                  ⚠ {navMetadata.inactiveTickers.length} inactive
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Additional Info if available */}
        {additionalInfo && (
          <div style={{ 
            color: '#888', 
            margin: '4px 0 0 0',
            fontSize: '10px',
            textAlign: 'center',
            borderTop: `1px solid ${CRT_GREEN}`,
            paddingTop: '4px'
          }}>
            {additionalInfo}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default CustomTooltip;