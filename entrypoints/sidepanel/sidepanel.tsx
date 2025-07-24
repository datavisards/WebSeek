// sidepanel.tsx
import React, { useState, useEffect } from 'react';
import OperationView from './components/operationview.tsx';
import InstanceView from './components/instanceview.tsx';
import { Instance } from './types.tsx';
import './sidepanel.css';
import { Message } from './types.tsx';
import ToolView from './components/toolview.tsx';
import websocketService from './websocket';
import { contextService } from './context-service';

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

  // Sync contextService with state
  useEffect(() => {
    contextService.setInstances(instances);
    console.log("Instances:", instances);
  }, [instances]);

  useEffect(() => {
    contextService.setMessages(messages);
  }, [messages]);

  useEffect(() => {
    contextService.setHtmlContexts(htmlContexts);
    console.log("HTML contexts:", htmlContexts);
  }, [htmlContexts]);

  // Connect websocket on mount, cleanup on unmount
  useEffect(() => {
    websocketService.connect();
    return () => {
      websocketService.disconnect();
    };
  }, []);

  return (
    <div className="side-panel">
      {/* <OperationView logs={logs} htmlContexts={htmlContexts}/> */}
      <InstanceView instances={instances} setInstances={setInstances} logs={logs} htmlContexts={htmlContexts} onOperation={addLog} updateHTMLContext={setHtmlContexts} addMessage={addMessage} setAgentLoading={setAgentLoading}/>
      <ToolView logs={logs} htmlContexts={htmlContexts} messages={messages} addMessage={addMessage} setMessages={setMessages} agentLoading={agentLoading} setAgentLoading={setAgentLoading} instances={instances} setInstances={setInstances}></ToolView>
    </div>
  );
};

export default SidePanel;