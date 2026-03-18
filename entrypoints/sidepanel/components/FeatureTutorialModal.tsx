import React, { useState, useEffect } from 'react';

interface TutorialStep {
  icon: string;
  title: string;
  content: string;
  tip?: string;
}

interface FeatureTutorialModalProps {
  storageKey: string;
  steps: TutorialStep[];
}

const FeatureTutorialModal: React.FC<FeatureTutorialModalProps> = ({ storageKey, steps }) => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setVisible(true);
    } catch { /* ignore */ }
  }, [storageKey]);

  if (!visible) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  const dismiss = () => {
    try { localStorage.setItem(storageKey, 'done'); } catch { /* ignore */ }
    setVisible(false);
  };

  const dotStyle = (active: boolean): React.CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: active ? '#007bff' : '#dee2e6',
    transition: 'background 0.2s',
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px 24px 18px',
        width: '300px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ fontSize: '32px', textAlign: 'center' }}>{current.icon}</div>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, textAlign: 'center' }}>{current.title}</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#444', lineHeight: 1.5, textAlign: 'center' }}>
          {current.content}
        </p>
        {current.tip && (
          <div style={{ background: '#f0f7ff', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', color: '#0056b3' }}>
            {current.tip}
          </div>
        )}

        {steps.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '2px' }}>
            {steps.map((_, i) => <div key={i} style={dotStyle(i === step)} />)}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '12px', padding: 0 }}
          >
            Skip
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#333' }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? dismiss : () => setStep(s => s + 1)}
              style={{ background: '#007bff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureTutorialModal;
