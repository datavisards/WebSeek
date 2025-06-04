import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wsLogo from '/WebSeek.png';
import './App.css';

// Add type for chrome extension APIs
// @ts-ignore
const chrome = (window as any).chrome;

function App() {
  const openSidePanel = () => {
    if (chrome?.sidePanel?.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: string | any[]) => {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          chrome.sidePanel.open({ tabId: tabId });
        } else {
          alert('No active tab found.');
        }
      });
    } else {
      alert('Side panel API is not available in this browser.');
    }
  };

  return (
    <div>
      <div>
        <a href="https://wxt.dev" target="_blank">
          <img src={wsLogo} className="logo" alt="WXT logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>WebSeek</h1>
      <div className="card">
        <p>
          WebSeek is a web extension that streamlines web data analysis by integrating example-driven idea demonstration with AI agents.
        </p>
        <button style={{ marginLeft: 12 }} onClick={openSidePanel}>
          Try it NOW
        </button>
      </div>
    </div>
  );
}

export default App;