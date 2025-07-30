import React from 'react';
import './SuggestionIndicator.css';

interface SuggestionIndicatorProps {
  isVisible: boolean;
  isGenerating: boolean;
}

const SuggestionIndicator: React.FC<SuggestionIndicatorProps> = ({
  isVisible,
  isGenerating
}) => {
  if (!isVisible) return null;

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