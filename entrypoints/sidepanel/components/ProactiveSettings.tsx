import React, { useState, useEffect } from 'react';
import { proactiveService, ProactiveSettings as Settings } from '../proactive-service';
import './ProactiveSettings.css';

interface ProactiveSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProactiveSettings: React.FC<ProactiveSettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<Settings>(proactiveService.getSettings());

  useEffect(() => {
    if (isOpen) {
      setSettings(proactiveService.getSettings());
    }
  }, [isOpen]);

  const handleSettingsChange = (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    proactiveService.updateSettings({ [key]: value });
  };

  const handleReset = () => {
    proactiveService.resetSession();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Proactive AI Settings</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-content">
          <div className="setting-group">
            <label className="setting-label">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => handleSettingsChange('enabled', e.target.checked)}
              />
              Enable proactive suggestions
            </label>
            <p className="setting-description">
              When enabled, AI will automatically suggest next steps based on your workflow
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Idle timeout: {settings.idleTimeoutMs / 1000}s
            </label>
            <input
              type="range"
              min="1000"
              max="10000"
              step="1000"
              value={settings.idleTimeoutMs}
              onChange={(e) => handleSettingsChange('idleTimeoutMs', parseInt(e.target.value))}
              className="setting-slider"
            />
            <p className="setting-description">
              How long to wait after you stop interacting before generating suggestions
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Confidence threshold: {Math.round(settings.confidenceThreshold * 100)}%
            </label>
            <input
              type="range"
              min="0.5"
              max="0.9"
              step="0.1"
              value={settings.confidenceThreshold}
              onChange={(e) => handleSettingsChange('confidenceThreshold', parseFloat(e.target.value))}
              className="setting-slider"
            />
            <p className="setting-description">
              Minimum confidence required to show suggestions
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Max suggestions per session: {settings.maxSuggestionsPerSession}
            </label>
            <input
              type="range"
              min="5"
              max="20"
              step="5"
              value={settings.maxSuggestionsPerSession}
              onChange={(e) => handleSettingsChange('maxSuggestionsPerSession', parseInt(e.target.value))}
              className="setting-slider"
            />
            <p className="setting-description">
              Limit suggestions to avoid overwhelming you
            </p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="reset-btn" onClick={handleReset}>
            Reset Session
          </button>
          <button className="close-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProactiveSettings;