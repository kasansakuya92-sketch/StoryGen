import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { LogEntry as GlobalLogEntry } from '../utils/logger.ts';

// Re-exporting for local use if needed, but primarily using the singleton
export type LogEntry = GlobalLogEntry;

interface LogContextType {
  // The context itself doesn't need to hold the logs, as the singleton does.
  // It can be used to trigger updates or provide access to the logger instance.
  // For now, it can be simple.
}

const LogContext = createContext<LogContextType>({});

export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // This provider currently doesn't manage state itself,
  // as the singleton `logger` service handles state management.
  // It's here to establish a pattern and can be extended later.
  return (
    <LogContext.Provider value={{}}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogContext = () => useContext(LogContext);
