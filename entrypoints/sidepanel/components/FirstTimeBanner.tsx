import React, { useState, useEffect } from 'react';

interface FirstTimeBannerProps {
  storageKey: string;
  steps: Array<{ icon: string; text: string }>;
}

/**
 * A compact, dismissible "first-time" tip banner.
 * Shown once per key (tracked in localStorage). Renders nothing after dismiss.
 */
const FirstTimeBanner: React.FC<FirstTimeBannerProps> = ({ storageKey, steps }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch { /* ignore */ }
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(storageKey, 'done'); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div style={{
      background: '#e8f4fd',
      border: '1px solid #b3d9f7',
      borderRadius: 6,
      padding: '8px 10px',
      margin: '6px 8px',
      fontSize: 12,
      color: '#1a4a6b',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flexShrink: 0,
      position: 'relative',
    }}>
      <button
        onClick={dismiss}
        style={{ position: 'absolute', top: 4, right: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5a8ab0', padding: 0, lineHeight: 1 }}
        title="Dismiss"
      >×</button>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>{step.icon}</span>
          <span style={{ lineHeight: 1.4 }}>{step.text}</span>
        </div>
      ))}
      <button
        onClick={dismiss}
        style={{ alignSelf: 'flex-end', marginTop: 2, background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
      >Got it</button>
    </div>
  );
};

export default FirstTimeBanner;
