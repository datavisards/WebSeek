// sidepanel.tsx
import React, { useState } from 'react';
import OperationView from './components/operationview.tsx';
import InstanceView from './components/instanceview.tsx';
import './sidepanel.css';

const SidePanel = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [htmlContexts, setHtmlContexts] = useState<Record<string, string>>({});

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  return (
    <div className="side-panel">
      <OperationView logs={logs} htmlContexts={htmlContexts}/>
      <InstanceView onOperation={addLog} updateHTMLContext={setHtmlContexts}/>
    </div>
  );
};

export default SidePanel;