import React, { useState } from 'react';
import './TransformPanel.css';

interface TransformPanelProps {
  columnIndex: number;
  columnName: string;
  columnData: any[];
  onTransform: (columnIndex: number, transformType: string, options?: any) => void;
  onClose: () => void;
}

export interface TransformOptions {
  extractPosition?: 'prefix' | 'suffix';
  extractLength?: number;
  splitDelimiter?: string;
  splitKeepPart?: number;
  dateFormat?: string;
  numberFormat?: string;
  customPattern?: string;
  replacement?: string;
}

const TransformPanel: React.FC<TransformPanelProps> = ({
  columnIndex,
  columnName,
  columnData,
  onTransform,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'format' | 'split' | 'custom'>('text');
  const [transformOptions, setTransformOptions] = useState<TransformOptions>({});

  // Get sample data from the column (first 3 non-empty values)
  const sampleData = columnData
    .filter(cell => cell && cell.toString().trim())
    .slice(0, 3)
    .map(cell => cell.toString());

  const handleTransform = (transformType: string) => {
    onTransform(columnIndex, transformType, transformOptions);
    onClose();
  };

  const previewTransform = (transformType: string, value: string): string => {
    try {
      switch (transformType) {
        case 'uppercase':
          return value.toUpperCase();
        case 'lowercase':
          return value.toLowerCase();
        case 'title-case':
          return value.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
          );
        case 'trim':
          return value.trim();
        case 'extract-prefix':
          return value.substring(0, transformOptions.extractLength || 3);
        case 'extract-suffix':
          const len = transformOptions.extractLength || 3;
          return value.substring(value.length - len);
        case 'split':
          const parts = value.split(transformOptions.splitDelimiter || ' ');
          const partIndex = transformOptions.splitKeepPart || 0;
          return partIndex === -1 ? 
            parts[parts.length - 1] || '' : 
            parts[partIndex] || '';
        case 'remove-spaces':
          return value.replace(/\s+/g, '');
        case 'format-currency':
          const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? value : `$${num.toFixed(2)}`;
        case 'format-number':
          const number = parseFloat(value.replace(/[^0-9.-]/g, ''));
          return isNaN(number) ? value : number.toLocaleString();
        default:
          return value;
      }
    } catch (error) {
      return value;
    }
  };

  return (
    <div className="transform-panel">
      <div className="transform-panel-header">
        <h4>Transform "{columnName}"</h4>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="transform-tabs">
        <button 
          className={activeTab === 'text' ? 'active' : ''}
          onClick={() => setActiveTab('text')}
        >
          Text
        </button>
        <button 
          className={activeTab === 'format' ? 'active' : ''}
          onClick={() => setActiveTab('format')}
        >
          Format
        </button>
        <button 
          className={activeTab === 'split' ? 'active' : ''}
          onClick={() => setActiveTab('split')}
        >
          Split
        </button>
        <button 
          className={activeTab === 'custom' ? 'active' : ''}
          onClick={() => setActiveTab('custom')}
        >
          Custom
        </button>
      </div>

      <div className="transform-content">
        {activeTab === 'text' && (
          <div className="transform-section">
            <h5>Text Transformations</h5>
            <div className="transform-buttons">
              <button onClick={() => handleTransform('uppercase')}>
                <span className="transform-icon">AA</span>
                Uppercase
              </button>
              <button onClick={() => handleTransform('lowercase')}>
                <span className="transform-icon">aa</span>
                Lowercase
              </button>
              <button onClick={() => handleTransform('title-case')}>
                <span className="transform-icon">Aa</span>
                Title Case
              </button>
              <button onClick={() => handleTransform('trim')}>
                <span className="transform-icon">✂️</span>
                Trim Spaces
              </button>
              <button onClick={() => handleTransform('remove-spaces')}>
                <span className="transform-icon">🚫</span>
                Remove All Spaces
              </button>
            </div>
          </div>
        )}

        {activeTab === 'format' && (
          <div className="transform-section">
            <h5>Format Transformations</h5>
            <div className="transform-buttons">
              <button onClick={() => handleTransform('format-currency')}>
                <span className="transform-icon">💰</span>
                Currency
              </button>
              <button onClick={() => handleTransform('format-number')}>
                <span className="transform-icon">🔢</span>
                Number
              </button>
              <button onClick={() => handleTransform('format-percentage')}>
                <span className="transform-icon">%</span>
                Percentage
              </button>
              <button onClick={() => handleTransform('format-date')}>
                <span className="transform-icon">📅</span>
                Date
              </button>
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <div className="transform-section">
            <h5>Split & Extract</h5>
            <div className="transform-options">
              <div className="option-group compact">
                <label>Extract Prefix (characters):</label>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={transformOptions.extractLength || 3}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    extractLength: parseInt(e.target.value)
                  })}
                />
                <button onClick={() => handleTransform('extract-prefix')}>Extract</button>
              </div>
              
              <div className="option-group compact">
                <label>Extract Suffix (characters):</label>
                <input 
                  type="number" 
                  min="1" 
                  max="50" 
                  value={transformOptions.extractLength || 3}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    extractLength: parseInt(e.target.value)
                  })}
                />
                <button onClick={() => handleTransform('extract-suffix')}>Extract</button>
              </div>

              <div className="option-group compact">
                <label>Split by delimiter:</label>
                <input 
                  type="text" 
                  value={transformOptions.splitDelimiter || ''}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    splitDelimiter: e.target.value
                  })}
                  placeholder="e.g., /, space, comma"
                />
                <label>Keep part:</label>
                <select 
                  value={transformOptions.splitKeepPart || 0}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    splitKeepPart: parseInt(e.target.value)
                  })}
                >
                  <option value={0}>First</option>
                  <option value={1}>Second</option>
                  <option value={2}>Third</option>
                  <option value={-1}>Last</option>
                </select>
                <button onClick={() => handleTransform('split')}>Split</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'custom' && (
          <div className="transform-section">
            <h5>Custom Transformations</h5>
            <div className="transform-options">
              <div className="option-group compact">
                <label>Find & Replace:</label>
                <input 
                  type="text" 
                  placeholder="Find text..."
                  value={transformOptions.customPattern || ''}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    customPattern: e.target.value
                  })}
                />
                <input 
                  type="text" 
                  placeholder="Replace with..."
                  value={transformOptions.replacement || ''}
                  onChange={(e) => setTransformOptions({
                    ...transformOptions, 
                    replacement: e.target.value
                  })}
                />
                <button onClick={() => handleTransform('find-replace')}>Replace</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransformPanel;
