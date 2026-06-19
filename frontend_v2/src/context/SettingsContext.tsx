import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const PRESET_STORAGE_KEY = 'options_screener_mobile_preset';
export const DEFAULT_HOST = '100.125.209.0:8000';

type SettingsContextType = {
  host: string;
  setHost: (val: string) => void;
  minVolume: string;
  setMinVolume: (val: string) => void;
  minRatio: string;
  setMinRatio: (val: string) => void;
  savePreset: () => Promise<void>;
  loadPreset: () => Promise<void>;
  presetStatus: string;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [minVolume, setMinVolume] = useState('5000');
  const [minRatio, setMinRatio] = useState('2.0');
  const [presetStatus, setPresetStatus] = useState('');

  const savePreset = useCallback(async () => {
    await AsyncStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({
        host,
        minVolume,
        minRatio,
      }),
    );
    setPresetStatus('Preset guardado');
  }, [host, minRatio, minVolume]);

  const loadPreset = useCallback(async () => {
    const preset = await AsyncStorage.getItem(PRESET_STORAGE_KEY);

    if (!preset) {
      setPresetStatus('Sin preset guardado');
      return;
    }

    const parsed = JSON.parse(preset) as Partial<{ host: string; minVolume: string; minRatio: string }>;
    setHost(parsed.host ?? DEFAULT_HOST);
    setMinVolume(parsed.minVolume ?? '5000');
    setMinRatio(parsed.minRatio ?? '2.0');
    setPresetStatus('Preset cargado');
  }, []);

  useEffect(() => {
    loadPreset();
  }, [loadPreset]);

  return (
    <SettingsContext.Provider
      value={{
        host,
        setHost,
        minVolume,
        setMinVolume,
        minRatio,
        setMinRatio,
        savePreset,
        loadPreset,
        presetStatus,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
