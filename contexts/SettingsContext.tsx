import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Settings } from '../types.ts';

const defaultSettings: Settings = {
  theme: 'light',
  typingSpeed: 'Normal',
  textSize: 'Medium',
  aiProvider: 'google',
  localModelUrl: 'http://localhost:11434/v1/chat/completions',
};

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const savedSettings = localStorage.getItem('vn_settings');
      if (savedSettings) {
        // Merge saved settings with defaults to prevent missing keys if new settings are added
        return { ...defaultSettings, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error("Could not parse settings from localStorage", error);
    }
    return defaultSettings;
  });

  // FIX: Corrected the malformed try-catch block which was causing parsing errors.
  useEffect(() => {
    try {
      localStorage.setItem('vn_settings', JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save settings to localStorage", error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);