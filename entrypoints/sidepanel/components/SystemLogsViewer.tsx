import React, { useState, useEffect } from 'react';
import { systemLogger, SystemLogEntry, SystemLogExport } from '../system-logger';
import './SystemLogsViewer.css';

interface SystemLogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SystemLogsViewer: React.FC<SystemLogsViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLogEntry[]>([]);
  const [sessionStats, setSessionStats] = useState<any>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    applyFilters();
  }, [logs, selectedCategory, selectedEventType, searchTerm, dateRange]);

  const refreshLogs = () => {
    const allLogs = systemLogger.getLogs();
    const stats = systemLogger.getSessionStats();
    setLogs(allLogs);
    setSessionStats(stats);
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(log => log.eventCategory === selectedCategory);
    }

    // Filter by event type
    if (selectedEventType !== 'all') {
      filtered = filtered.filter(log => log.eventType === selectedEventType);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.eventType.toLowerCase().includes(term) ||
        log.eventSubtype.toLowerCase().includes(term) ||
        JSON.stringify(log.data).toLowerCase().includes(term) ||
        log.eventCategory.toLowerCase().includes(term)
      );
    }

    // Filter by date range
    if (dateRange.start) {
      filtered = filtered.filter(log => log.timestamp >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(log => log.timestamp <= dateRange.end);
    }

    setFilteredLogs(filtered);
  };

  const exportLogs = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const exportData = systemLogger.exportLogs({
        eventTypes: selectedEventType !== 'all' ? [selectedEventType] : undefined,
        categories: selectedCategory !== 'all' ? [selectedCategory as any] : undefined,
        startTime: dateRange.start || undefined,
        endTime: dateRange.end || undefined
      });
      
      const jsonString = JSON.stringify(exportData, null, 2);
      downloadFile(jsonString, `webseek_system_logs_${Date.now()}.json`, 'application/json');
    } else if (format === 'csv') {
      const csvContent = convertLogsToCSV(filteredLogs);
      downloadFile(csvContent, `webseek_system_logs_${Date.now()}.csv`, 'text/csv');
    }
  };

  const convertLogsToCSV = (logsToExport: SystemLogEntry[]): string => {
    if (logsToExport.length === 0) return '';

    const headers = [
      'timestamp',
      'sessionId',
      'eventType',
      'eventCategory',
      'eventSubtype',
      'dataJson',
      'url',
      'userAgent',
      'viewportWidth',
      'viewportHeight',
      'instanceCount',
      'tableCount',
      'visualizationCount'
    ];

    const csvRows = [headers.join(',')];

    logsToExport.forEach(log => {
      const row = [
        log.timestamp,
        log.sessionId,
        log.eventType,
        log.eventCategory,
        log.eventSubtype,
        `"${JSON.stringify(log.data).replace(/"/g, '""')}"`,
        log.context.url || '',
        `"${(log.context.userAgent || '').replace(/"/g, '""')}"`,
        log.context.viewport?.width || '',
        log.context.viewport?.height || '',
        log.context.instanceCount || '',
        log.context.tableCount || '',
        log.context.visualizationCount || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    if (window.confirm('Are you sure you want to clear all system logs? This action cannot be undone.')) {
      systemLogger.clearLogs(true);
      refreshLogs();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getUniqueCategories = () => {
    const categories = new Set(logs.map(log => log.eventCategory));
    return Array.from(categories).sort();
  };

  const getUniqueEventTypes = () => {
    const eventTypes = new Set(logs.map(log => log.eventType));
    return Array.from(eventTypes).sort();
  };

  if (!isOpen) return null;

  return (
    <div className="system-logs-viewer-overlay">
      <div className="system-logs-viewer">
        <div className="system-logs-header">
          <h2>System Logs Viewer</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="system-logs-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Events:</span>
              <span className="stat-value">{sessionStats.totalEvents || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Session Duration:</span>
              <span className="stat-value">
                {sessionStats.sessionDuration ? 
                  `${Math.round(sessionStats.sessionDuration / 1000 / 60)} min` : 
                  '0 min'
                }
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Filtered Events:</span>
              <span className="stat-value">{filteredLogs.length}</span>
            </div>
          </div>
        </div>

        <div className="system-logs-filters">
          <div className="filter-row">
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>
                  {category.replace('_', ' ')}
                </option>
              ))}
            </select>

            <select 
              value={selectedEventType} 
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Event Types</option>
              {getUniqueEventTypes().map(eventType => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-row">
            <input
              type="datetime-local"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="date-input"
            />
            <span>to</span>
            <input
              type="datetime-local"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="date-input"
            />
          </div>
        </div>

        <div className="system-logs-actions">
          <button onClick={refreshLogs} className="action-button">
            🔄 Refresh
          </button>
          <button onClick={() => exportLogs('json')} className="action-button">
            📄 Export JSON
          </button>
          <button onClick={() => exportLogs('csv')} className="action-button">
            📊 Export CSV
          </button>
          <button onClick={clearLogs} className="action-button danger">
            🗑️ Clear Logs
          </button>
        </div>

        <div className="system-logs-content">
          <div className="logs-list">
            {filteredLogs.length === 0 ? (
              <div className="no-logs">No logs match the current filters</div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className={`log-entry ${log.eventCategory}`}>
                  <div className="log-header">
                    <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                    <span className={`log-category ${log.eventCategory}`}>
                      {log.eventCategory.replace('_', ' ')}
                    </span>
                    <span className="log-type">{log.eventType}</span>
                  </div>
                  <div className="log-details">
                    <div className="log-subtype">{log.eventSubtype}</div>
                    <div className="log-data">
                      <pre>{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
                    {log.performance && (
                      <div className="log-performance">
                        Performance: {log.performance.duration || 'N/A'}ms
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemLogsViewer;
