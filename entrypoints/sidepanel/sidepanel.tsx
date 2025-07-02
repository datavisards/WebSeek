// sidepanel.tsx
import React, { useState } from 'react';
import OperationView from './components/operationview.tsx';
import InstanceView from './components/instanceview.tsx';
import { Instance } from './types.tsx';
import './sidepanel.css';
import { Message } from './types.tsx';
import ToolView from './components/toolview.tsx';

const SidePanel = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [htmlContexts, setHtmlContexts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const getInstanceById = (id: string): Instance | undefined => {
    return instances.find(instance => instance.id === id);
  };

  return (
    <div className="side-panel">
      {/* <OperationView logs={logs} htmlContexts={htmlContexts}/> */}
      <InstanceView instances={instances} setInstances={setInstances} logs={logs} htmlContexts={htmlContexts} onOperation={addLog} updateHTMLContext={setHtmlContexts} addMessage={addMessage} setAgentLoading={setAgentLoading}/>
      <ToolView logs={logs} htmlContexts={htmlContexts} messages={messages} addMessage={addMessage} setMessages={setMessages} agentLoading={agentLoading} setAgentLoading={setAgentLoading} getInstanceById={getInstanceById}></ToolView>
    </div>
  );
};

export default SidePanel;