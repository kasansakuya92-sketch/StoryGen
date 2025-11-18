// utils/logger.ts
export interface LogEntry {
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  source: string;
  content: any;
}

type LogListener = (logs: LogEntry[]) => void;

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  public addLog(log: Omit<LogEntry, 'timestamp'>) {
    const newEntry: LogEntry = { ...log, timestamp: new Date() };
    this.logs = [newEntry, ...this.logs.slice(0, 99)]; // Keep last 100
    this.notifyListeners();
  }
  
  public getLogs(): LogEntry[] {
    return this.logs;
  }
  
  public clearLogs() {
    this.logs = [];
    this.notifyListeners();
  }

  public subscribe(listener: LogListener) {
    this.listeners.add(listener);
    // Immediately notify with current logs
    listener(this.logs);
  }

  public unsubscribe(listener: LogListener) {
    this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.logs));
  }
}

export const logger = new LoggerService();
