import React, { useState, useEffect } from 'react';
import { fetchManager } from '@data/twelvedataFetchManager';

const CRT_GREEN = 'rgb(140,185,162)';

const RequestStatus = () => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const updateStatus = () => {
      const requestStatus = fetchManager.getRequestStatus();
      setStatus(requestStatus);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const { current, limit, remaining, resetIn } = status;
  const percentage = (current / limit) * 100;
  const isNearLimit = percentage > 80;
  const isAtLimit = percentage >= 100;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'black',
      border: `1px solid ${isAtLimit ? '#e31507' : isNearLimit ? '#FFA500' : CRT_GREEN}`,
      padding: '8px 12px',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      color: isAtLimit ? '#e31507' : isNearLimit ? '#FFA500' : CRT_GREEN,
      zIndex: 10000,
      borderRadius: '4px',
      minWidth: '120px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
        API Requests
      </div>
      <div style={{ fontSize: '11px' }}>
        {current}/{limit} ({percentage.toFixed(0)}%)
      </div>
      <div style={{ fontSize: '10px', color: '#888' }}>
        Reset in {resetIn}s
      </div>
      {isAtLimit && (
        <div style={{ fontSize: '10px', color: '#e31507', fontWeight: 'bold' }}>
          ⚠️ RATE LIMITED
        </div>
      )}
    </div>
  );
};

export default RequestStatus; 