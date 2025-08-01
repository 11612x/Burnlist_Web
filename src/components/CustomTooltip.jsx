import React from "react";

const CRT_GREEN = 'rgb(140,185,162)';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length && payload[0] && payload[0].value != null) {
    let datePart = "";
    let timePart = "";
    let returnValue = payload[0].value;
    let additionalInfo = "";
    
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