import React, { useState } from 'react';

const STORAGE_KEY = 'webseek_onboarding_done';

const STEPS = [
  {
    title: 'Welcome to WebSeek',
    icon: '🌐',
    content: 'WebSeek helps you collect, organize, and analyze data from the web — right in your browser sidebar.',
  },
  {
    title: 'Capture Web Data',
    icon: '📋',
    content: 'Navigate to any webpage and click elements to capture them as instances. Tables, images, and text are all supported.',
    tip: 'Tip: Use the capture button in the toolbar above the canvas.',
  },
  {
    title: 'Create Tables',
    icon: '📊',
    content: 'Click "Table" in the header to create a data table. Drag web content into cells to populate your dataset.',
    tip: 'Tip: Right-click any instance on the canvas for options including rename, infer, and export (tables as XLSX, visualizations as SVG/PNG).',
  },
  {
    title: 'Ask the AI',
    icon: '🤖',
    content: 'Use the Chat tab to ask questions about your data, request analysis, or have the AI perform operations on your tables.',
    tip: 'Tip: The AI can sort, filter, merge tables, and create visualizations for you.',
  },
  {
    title: 'AI Suggestions',
    icon: '💡',
    content: 'WebSeek automatically detects patterns in your work and suggests helpful next steps in the AI Suggestions panel.',
    tip: 'Tip: Click "Apply" on any suggestion to execute it, or "Dismiss" to skip it.',
  },
];

interface OnboardingModalProps {
  onDone: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const handleDone = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDone();
  };

  const current = STEPS[step];

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    padding: '28px 28px 20px',
    width: '320px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    animation: 'fadeIn 0.15s ease',
  };

  const dotStyle = (active: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: active ? '#007bff' : '#dee2e6',
    transition: 'background 0.2s',
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ fontSize: '36px', textAlign: 'center' }}>{current.icon}</div>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>{current.title}</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#444', lineHeight: 1.5, textAlign: 'center' }}>
          {current.content}
        </p>
        {current.tip && (
          <div style={{ background: '#f0f7ff', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#0056b3' }}>
            {current.tip}
          </div>
        )}

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '4px' }}>
          {STEPS.map((_, i) => <div key={i} style={dotStyle(i === step)} />)}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <button
            onClick={handleDone}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '12px', padding: 0, marginLeft: 0 }}
          >
            Skip
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{ background: '#f0f0f0', border: 'none', borderRadius: '6px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#333', marginLeft: 0 }}
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? handleDone : () => setStep(s => s + 1)}
              style={{ background: '#007bff', border: 'none', borderRadius: '6px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#fff', marginLeft: 0 }}
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export function shouldShowOnboarding(): boolean {
  try {
    return !localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

export default OnboardingModal;
