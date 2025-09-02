/**
 * System Logger Service - Comprehensive interaction logging for data analysis
 * This is separate from the user-facing history logs and designed for research/analytics
 */

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  userId?: string;
  workspaceId?: string;
  eventType: string;
  eventCategory: 'user_action' | 'system_response' | 'ai_interaction' | 'data_operation' | 'error' | 'performance';
  eventSubtype: string;
  data: any;
  context: {
    url?: string;
    userAgent?: string;
    viewport?: { width: number; height: number };
    instanceCount?: number;
    tableCount?: number;
    visualizationCount?: number;
    currentTab?: string;
    editingState?: string;
  };
  performance?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
  metadata?: any;
}

export interface SystemLogExport {
  exportId: string;
  exportTimestamp: string;
  sessionInfo: {
    sessionId: string;
    startTime: string;
    endTime: string;
    totalEvents: number;
    userAgent: string;
  };
  filters: {
    dateRange?: { start: string; end: string };
    eventTypes?: string[];
    categories?: string[];
  };
  logs: SystemLogEntry[];
  summary: {
    eventsByCategory: Record<string, number>;
    eventsByType: Record<string, number>;
    timeSpan: { start: string; end: string };
    totalInteractions: number;
  };
}

class SystemLogger {
  private logs: SystemLogEntry[] = [];
  private sessionId: string;
  private userId?: string;
  private workspaceId?: string;
  private logBuffer: SystemLogEntry[] = [];
  private isBuffering: boolean = false;
  private maxBufferSize: number = 1000;
  private maxLogsInMemory: number = 10000;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeSession();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession(): void {
    this.log('session_start', 'system_response', 'session_lifecycle', {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      url: window.location.href
    });
  }

  /**
   * Main logging method - logs all user interactions and system events
   */
  log(
    eventType: string,
    category: SystemLogEntry['eventCategory'],
    subtype: string,
    data: any,
    context?: Partial<SystemLogEntry['context']>,
    performance?: Partial<SystemLogEntry['performance']>,
    metadata?: any
  ): void {
    const entry: SystemLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      workspaceId: this.workspaceId,
      eventType,
      eventCategory: category,
      eventSubtype: subtype,
      data: this.sanitizeData(data),
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        ...context
      },
      performance,
      metadata
    };

    // Add to logs
    this.logs.push(entry);

    // Maintain memory limit
    if (this.logs.length > this.maxLogsInMemory) {
      // Keep only the most recent logs
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Console output for development
    console.log('[SystemLogger]', entry.eventType, entry);

    // Optionally persist to localStorage (with rotation)
    this.persistLog(entry);
  }

  /**
   * Log user interactions with UI components
   */
  logUserAction(
    action: string,
    component: string,
    data: any,
    context?: any,
    performance?: Partial<SystemLogEntry['performance']>
  ): void {
    this.log(
      `user_${action}`,
      'user_action',
      component,
      { action, component, ...data },
      context,
      performance
    );
  }

  /**
   * Log AI/LLM interactions
   */
  logAIInteraction(
    interactionType: 'chat' | 'suggestion' | 'macro_execution' | 'refinement',
    data: any,
    performance?: Partial<SystemLogEntry['performance']>
  ): void {
    this.log(
      `ai_${interactionType}`,
      'ai_interaction',
      interactionType,
      data,
      undefined,
      performance
    );
  }

  /**
   * Log data operations (table operations, instance changes, etc.)
   */
  logDataOperation(
    operation: string,
    data: any,
    context?: any,
    performance?: Partial<SystemLogEntry['performance']>
  ): void {
    this.log(
      `data_${operation}`,
      'data_operation',
      operation,
      data,
      context,
      performance
    );
  }

  /**
   * Log errors and exceptions
   */
  logError(
    errorType: string,
    error: Error | any,
    context?: any
  ): void {
    this.log(
      `error_${errorType}`,
      'error',
      errorType,
      {
        message: error?.message || String(error),
        stack: error?.stack,
        name: error?.name,
        ...context
      }
    );
  }

  /**
   * Log performance metrics
   */
  logPerformance(
    metric: string,
    data: any,
    performance: Partial<SystemLogEntry['performance']>
  ): void {
    this.log(
      `performance_${metric}`,
      'performance',
      metric,
      data,
      undefined,
      performance
    );
  }

  /**
   * Set user and workspace context
   */
  setContext(userId?: string, workspaceId?: string): void {
    this.userId = userId;
    this.workspaceId = workspaceId;
    
    this.log('context_update', 'system_response', 'context_change', {
      userId,
      workspaceId
    });
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filters?: {
    startTime?: string;
    endTime?: string;
    eventTypes?: string[];
    categories?: SystemLogEntry['eventCategory'][];
    limit?: number;
  }): SystemLogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime!);
      }
      if (filters.eventTypes?.length) {
        filteredLogs = filteredLogs.filter(log => filters.eventTypes!.includes(log.eventType));
      }
      if (filters.categories?.length) {
        filteredLogs = filteredLogs.filter(log => filters.categories!.includes(log.eventCategory));
      }
      if (filters.limit) {
        filteredLogs = filteredLogs.slice(-filters.limit);
      }
    }

    return filteredLogs;
  }

  /**
   * Export logs for analysis
   */
  exportLogs(filters?: Parameters<typeof this.getLogs>[0]): SystemLogExport {
    const filteredLogs = this.getLogs(filters);
    const sessionStart = this.logs[0]?.timestamp || new Date().toISOString();
    const sessionEnd = this.logs[this.logs.length - 1]?.timestamp || new Date().toISOString();

    // Generate summary statistics
    const eventsByCategory: Record<string, number> = {};
    const eventsByType: Record<string, number> = {};

    filteredLogs.forEach(log => {
      eventsByCategory[log.eventCategory] = (eventsByCategory[log.eventCategory] || 0) + 1;
      eventsByType[log.eventType] = (eventsByType[log.eventType] || 0) + 1;
    });

    const exportData: SystemLogExport = {
      exportId: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      exportTimestamp: new Date().toISOString(),
      sessionInfo: {
        sessionId: this.sessionId,
        startTime: sessionStart,
        endTime: sessionEnd,
        totalEvents: this.logs.length,
        userAgent: navigator.userAgent
      },
      filters: filters || {},
      logs: filteredLogs,
      summary: {
        eventsByCategory,
        eventsByType,
        timeSpan: {
          start: filteredLogs[0]?.timestamp || sessionStart,
          end: filteredLogs[filteredLogs.length - 1]?.timestamp || sessionEnd
        },
        totalInteractions: filteredLogs.length
      }
    };

    return exportData;
  }

  /**
   * Download logs as JSON file
   */
  downloadLogs(filters?: Parameters<typeof this.getLogs>[0], filename?: string): void {
    const exportData = this.exportLogs(filters);
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `webseek_system_logs_${this.sessionId}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.log('logs_exported', 'system_response', 'export', {
      exportId: exportData.exportId,
      totalLogs: exportData.logs.length,
      filename: link.download,
      filters
    });
  }

  /**
   * Clear logs (with confirmation for safety)
   */
  clearLogs(confirm: boolean = false): boolean {
    if (!confirm) {
      console.warn('[SystemLogger] clearLogs requires confirm=true parameter for safety');
      return false;
    }

    const logCount = this.logs.length;
    this.logs = [];
    
    this.log('logs_cleared', 'system_response', 'maintenance', {
      clearedLogCount: logCount
    });

    // Also clear persisted logs
    try {
      localStorage.removeItem('webseek_system_logs');
      localStorage.removeItem('webseek_log_index');
    } catch (error) {
      console.warn('[SystemLogger] Failed to clear persisted logs:', error);
    }

    return true;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): any {
    const logs = this.logs;
    const sessionStart = logs[0]?.timestamp;
    const sessionEnd = logs[logs.length - 1]?.timestamp;
    
    const categoryStats: Record<string, number> = {};
    const hourlyActivity: Record<string, number> = {};

    logs.forEach(log => {
      // Category stats
      categoryStats[log.eventCategory] = (categoryStats[log.eventCategory] || 0) + 1;
      
      // Hourly activity
      const hour = new Date(log.timestamp).toISOString().substr(0, 13); // YYYY-MM-DDTHH
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });

    return {
      sessionId: this.sessionId,
      totalEvents: logs.length,
      sessionDuration: sessionStart && sessionEnd 
        ? new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()
        : 0,
      categoryStats,
      hourlyActivity,
      timeSpan: { start: sessionStart, end: sessionEnd }
    };
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Sanitize data to remove sensitive information
   */
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = { ...data };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Persist logs to localStorage with rotation
   */
  private persistLog(entry: SystemLogEntry): void {
    try {
      const storageKey = 'webseek_system_logs';
      const indexKey = 'webseek_log_index';
      const maxStorageSize = 5000; // Max logs in localStorage
      
      // Get current index
      let currentIndex = parseInt(localStorage.getItem(indexKey) || '0');
      
      // Store the log entry
      localStorage.setItem(`${storageKey}_${currentIndex}`, JSON.stringify(entry));
      
      // Update index
      currentIndex = (currentIndex + 1) % maxStorageSize;
      localStorage.setItem(indexKey, currentIndex.toString());
      
    } catch (error) {
      // Storage full or disabled - continue without persisting
      console.warn('[SystemLogger] Failed to persist log:', error);
    }
  }
}

// Global system logger instance
export const systemLogger = new SystemLogger();

// Auto-log page visibility changes
document.addEventListener('visibilitychange', () => {
  systemLogger.logUserAction(
    document.hidden ? 'page_hidden' : 'page_visible',
    'document',
    { hidden: document.hidden }
  );
});

// Auto-log page unload
window.addEventListener('beforeunload', () => {
  const sessionStart = parseInt(systemLogger.getSessionId().split('_')[1]);
  systemLogger.log('session_end', 'system_response', 'session_lifecycle', {
    sessionDuration: Date.now() - sessionStart
  });
});

export default systemLogger;
