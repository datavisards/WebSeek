import React, { useState, useEffect } from 'react';
import { getApiSettings, saveApiSettings, ApiSettings } from '../apis';

interface ApiSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiSettingsPanel: React.FC<ApiSettingsPanelProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<ApiSettings>(getApiSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getApiSettings());
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveApiSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '360px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '13px',
    color: '#333',
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: 'monospace',
    background: '#fafafa',
  };

  const btnRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>API Settings</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: '0 4px', marginLeft: 0 }}
          >×</button>
        </div>

        <label style={labelStyle}>
          API Key
          <input
            type="password"
            value={settings.apiKey}
            onChange={e => setSettings(s => ({ ...s, apiKey: e.target.value }))}
            placeholder="sk-or-..."
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Base URL
          <input
            type="text"
            value={settings.baseURL}
            onChange={e => setSettings(s => ({ ...s, baseURL: e.target.value }))}
            placeholder="https://openrouter.ai/api/v1"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Model
          <input
            type="text"
            value={settings.model}
            onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
            placeholder="google/gemini-2.5-flash"
            style={inputStyle}
          />
          <span style={{ fontSize: '11px', color: '#888' }}>
            Any OpenRouter-compatible model identifier
          </span>
        </label>

        <div style={btnRowStyle}>
          <button onClick={onClose} style={{ background: '#f0f0f0', color: '#333', border: '1px solid #ccc', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginLeft: 0 }}>
            Cancel
          </button>
          <button onClick={handleSave} style={{ background: saved ? '#28a745' : '#007bff', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', marginLeft: 0 }}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiSettingsPanel;
