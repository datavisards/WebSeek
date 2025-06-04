// sidepanel.tsx
import React, { useState } from 'react';
import OperationView from './components/operationview.tsx';
import InstanceView from './components/instanceview.tsx';
import './sidepanel.css';

const SidePanel = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  return (
    <div className="side-panel">
      <OperationView logs={logs} />
      <InstanceView onOperation={addLog} />
    </div>
  );
};

export default SidePanel;