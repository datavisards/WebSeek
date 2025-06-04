import React from 'react';
import './operationview.css';

interface OperationViewProps {
  logs: string[];
}

const OperationView = ({ logs }: OperationViewProps) => (
  <div className="view-container operation-view">
    <h3 className="view-title-container">Operations</h3>
    <div className="view-content">
      {logs.length > 0 ? (
        logs.map((log, index) => (
          <div key={index} className="operation-log">
            {log}
          </div>
        ))
      ) : (
        <p>No operations yet.</p>
      )}
    </div>
  </div>
);

export default OperationView;