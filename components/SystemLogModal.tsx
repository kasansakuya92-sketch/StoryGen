import React, { useState, useEffect } from 'react';
import { logger, LogEntry } from '../utils/logger.ts';

interface SystemLogModalProps {
  onClose: () => void;
}

const typeStyles = {
    request: {
        borderColor: 'border-blue-500',
        textColor: 'text-blue-700 dark:text-blue-300',
        labelBg: 'bg-blue-500/20'
    },
    response: {
        borderColor: 'border-green-500',
        textColor: 'text-green-800 dark:text-green-300',
        labelBg: 'bg-green-500/20'
    },
    error: {
        borderColor: 'border-destructive',
        textColor: 'text-red-800 dark:text-red-300',
        labelBg: 'bg-destructive/20'
    },
};


const LogEntryView: React.FC<{ entry: LogEntry }> = ({ entry }) => {
    const styles = typeStyles[entry.type];

    const formatContent = (content: any) => {
        try {
            if (typeof content === 'string') {
                return content;
            }
            return JSON.stringify(content, null, 2);
        } catch {
            return String(content);
        }
    };
    
    return (
        <div className={`bg-card/50 p-3 rounded-md border-l-4 ${styles.borderColor}`}>
            <div className="flex justify-between items-center text-xs mb-2">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${styles.labelBg} ${styles.textColor}`}>{entry.type.toUpperCase()}</span>
                    <span className="font-mono text-foreground/80">{entry.source}</span>
                </div>
                <span className="text-foreground/60">{entry.timestamp.toLocaleTimeString()}</span>
            </div>
            <pre className="text-xs whitespace-pre-wrap bg-background/50 p-2 rounded overflow-x-auto max-h-60">
                <code>
                    {formatContent(entry.content)}
                </code>
            </pre>
        </div>
    );
};


const SystemLogModal: React.FC<SystemLogModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());

  useEffect(() => {
    const handleLogUpdate = (updatedLogs: LogEntry[]) => {
      setLogs([...updatedLogs]); // Create new array to trigger re-render
    };
    logger.subscribe(handleLogUpdate);
    return () => logger.unsubscribe(handleLogUpdate);
  }, []);
  
  const handleClear = () => {
      logger.clearLogs();
  };

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-border">
        <header className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">AI System Log</h2>
          <button onClick={onClose} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50">&times;</button>
        </header>
        
        <div className="flex-grow overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center text-foreground/70 h-full flex items-center justify-center">
              <p>No AI activity recorded yet. Generate some content to see logs here.</p>
            </div>
          ) : (
            logs.map((entry, index) => <LogEntryView key={`${entry.timestamp.getTime()}-${index}`} entry={entry} />)
          )}
        </div>

        <footer className="p-4 border-t border-border flex justify-end gap-2 flex-shrink-0">
          <button onClick={handleClear} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Clear Logs</button>
        </footer>
      </div>
    </div>
  );
};

export default SystemLogModal;
