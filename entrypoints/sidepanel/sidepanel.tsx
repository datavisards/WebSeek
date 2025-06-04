import React from 'react';
import OperationView from './components/operationview.tsx';
import InstanceView from './components/instanceview.tsx';
import './sidepanel.css';

const SidePanel = () => {
  return (
    <div className="side-panel">
      <OperationView />
      <InstanceView />
    </div>
  );
};

export default SidePanel;