import React, { useState, useEffect, useRef } from 'react';
import './SuggestionIndicator.css';

interface SuggestionIndicatorProps {
  isVisible: boolean;
  isGenerating: boolean;
}

const READY_DISPLAY_MS = 4000; // auto-hide "Suggestions ready" after 4 seconds

const SuggestionIndicator: React.FC<SuggestionIndicatorProps> = ({
  isVisible,
  isGenerating
}) => {
  const [readyVisible, setReadyVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible && !isGenerating) {
      // Generation just finished — show "ready" and start auto-hide timer
      setReadyVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setReadyVisible(false), READY_DISPLAY_MS);
    }
    if (isGenerating) {
      // New generation started — cancel any pending hide
      if (timerRef.current) clearTimeout(timerRef.current);
      setReadyVisible(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, isGenerating]);

  if (!isVisible) return null;
  if (!isGenerating && !readyVisible) return null;

  return (
    <div className={`suggestion-indicator ${isGenerating ? 'generating' : ''}`}>
      <div className="indicator-content">
        {isGenerating ? (
          <>
            <div className="thinking-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
            <span className="indicator-text">AI is analyzing...</span>
          </>
        ) : (
          <>
            <span className="indicator-icon">💭</span>
            <span className="indicator-text">Suggestions ready</span>
          </>
        )}
      </div>
    </div>
  );
};

export default SuggestionIndicator;
