import React from 'react';
import './SnapshotStatusIndicator.css';

interface SnapshotStatusIndicatorProps {
  isVisible: boolean;
  isWaiting: boolean;
}

const SnapshotStatusIndicator: React.FC<SnapshotStatusIndicatorProps> = ({
  isVisible,
  isWaiting
}) => {
  if (!isVisible) return null;

  return (
    <div className={`snapshot-status-indicator ${isWaiting ? 'waiting' : ''}`}>
      <div className="indicator-content">
        {isWaiting ? (
          <>
            <div className="thinking-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <span className="indicator-text">Waiting for snapshots...</span>
          </>
        ) : (
          <>
            <span className="indicator-icon">✓</span>
            <span className="indicator-text">Snapshots ready</span>
          </>
        )}
      </div>
    </div>
  );
};

export default SnapshotStatusIndicator;