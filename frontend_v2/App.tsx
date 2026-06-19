import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AlertData, NeoTable } from './src/ui/NeoTable';
import { NeoCard } from './src/ui/NeoCard';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

const DEFAULT_HOST = '100.125.209.0:8000';
const MAX_ALERTS = 100;
const PRESET_STORAGE_KEY = 'options_screener_mobile_preset';

function sanitizeHost(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^wss?:\/\//i, '')
    .replace(/\/.*$/, '');
}

function buildBackendUrls(hostInput: string) {
  const cleanHost = sanitizeHost(hostInput);

  return {
    healthUrl: cleanHost ? `http://${cleanHost}/docs` : '',
    websocketUrl: cleanHost ? `ws://${cleanHost}/ws/dashboard` : '',
  };
}

function normalizeAlert(raw: unknown): AlertData {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      instrument: 'Mensaje',
      ratio: String(raw ?? ''),
    };
  }

  const item = raw as Record<string, unknown>;
  const time = item.time ?? item.hora ?? item.timestamp ?? new Date().toLocaleTimeString();
  const instrument = item.instrument ?? item.instrumento ?? item.symbol ?? item.ticker ?? 'N/A';
  const ratio = item.ratio ?? item.value ?? item.score ?? '-';

  return {
    id: `${time}-${instrument}-${Date.now()}`,
    time: String(time),
    instrument: String(instrument),
    ratio: typeof ratio === 'number' ? ratio.toFixed(2) : String(ratio),
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export default function App() {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [backendReachable, setBackendReachable] = useState(false);
  const [lastError, setLastError] = useState('');
  const [minVolume, setMinVolume] = useState('5000');
  const [minRatio, setMinRatio] = useState('2.0');
  const [presetStatus, setPresetStatus] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const parameterPayloadRef = useRef({
    client: 'mobile',
    source: 'frontend_v2',
    min_volume: 5000,
    vol_price_mismatch_threshold: 2,
  });

  const { healthUrl, websocketUrl } = useMemo(() => buildBackendUrls(host), [host]);

  const buildParameterPayload = useCallback(
    () => ({
      client: 'mobile',
      source: 'frontend_v2',
      min_volume: Number.parseFloat(minVolume) || 0,
      vol_price_mismatch_threshold: Number.parseFloat(minRatio) || 0,
    }),
    [minRatio, minVolume],
  );

  useEffect(() => {
    parameterPayloadRef.current = buildParameterPayload();
  }, [buildParameterPayload]);

  const sendParameters = useCallback(() => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastError('WebSocket no conectado. Reintenta cuando el estado sea Conectado.');
      return;
    }

    socket.send(JSON.stringify(parameterPayloadRef.current));
    setPresetStatus('Parametros enviados');
  }, []);

  const exportCsv = useCallback(async () => {
    try {
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

      if (!directory) {
        Alert.alert('Export CSV', 'No hay un directorio disponible para crear el archivo.');
        return;
      }

      const rows = [
        ['Hora', 'Instrumento', 'Ratio'],
        ...alerts.map((alert) => [alert.time ?? '', alert.instrument ?? '', alert.ratio ?? '']),
      ];
      const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
      const fileUri = `${directory}options-alerts-${Date.now()}.csv`;

      await FileSystem.writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Export CSV',
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      Alert.alert('Export CSV', message);
    }
  }, [alerts]);

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
    if (!healthUrl) {
      setBackendReachable(false);
      return;
    }

    let cancelled = false;
    fetch(healthUrl)
      .then((response) => {
        if (!cancelled) {
          setBackendReachable(response.ok);
          setLastError(response.ok ? '' : `HTTP ${response.status}`);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setBackendReachable(false);
          setLastError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [healthUrl]);

  useEffect(() => {
    if (!websocketUrl) {
      setConnectionState('disconnected');
      return;
    }

    setConnectionState('connecting');
    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnectionState('connected');
      setLastError('');
      socket.send(JSON.stringify(parameterPayloadRef.current));
    };
    socket.onclose = () => setConnectionState('disconnected');
    socket.onerror = () => {
      setConnectionState('error');
      setLastError('No se pudo abrir ws://. Verifica Docker, Tailscale y puerto 8000.');
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setAlerts((current) => [normalizeAlert(message), ...current].slice(0, MAX_ALERTS));
      } catch {
        setAlerts((current) => [normalizeAlert(event.data), ...current].slice(0, MAX_ALERTS));
      }
    };

    return () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket.close();
    };
  }, [websocketUrl]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <NeoCard title="Options Screener Live" subtitle="Alertas en tiempo real desde /ws/dashboard">
          <View style={styles.actionBar}>
            <Pressable onPress={exportCsv} style={[styles.button, alerts.length === 0 && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>Export CSV</Text>
            </Pressable>
          </View>

          <View style={styles.connectionPanel}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, styles[connectionState]]} />
              <Text style={styles.statusText}>{statusLabel[connectionState]}</Text>
              <Text style={styles.backendStatus}>API {backendReachable ? 'OK' : 'sin respuesta'}</Text>
            </View>

            <Text style={styles.label}>Host del backend</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setHost}
              placeholder="100.125.209.0:8000"
              placeholderTextColor="#64748B"
              style={styles.input}
              value={host}
            />
            <Text style={styles.urlText}>{websocketUrl || 'Sin URL WebSocket'}</Text>

            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Text style={styles.label}>Volumen minimo</Text>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={setMinVolume}
                  placeholder="5000"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                  value={minVolume}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Ratio minimo</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={setMinRatio}
                  placeholder="2.0"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                  value={minRatio}
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Pressable onPress={sendParameters} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Aplicar</Text>
              </Pressable>
              <Pressable onPress={savePreset} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Guardar preset</Text>
              </Pressable>
              <Pressable onPress={loadPreset} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cargar preset</Text>
              </Pressable>
            </View>
            {presetStatus ? <Text style={styles.urlText}>{presetStatus}</Text> : null}
            {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
          </View>

          <NeoTable data={alerts} />
        </NeoCard>
      </View>
    </SafeAreaView>
  );
}

const statusLabel: Record<ConnectionState, string> = {
  connected: 'Conectado',
  connecting: 'Conectando',
  disconnected: 'Desconectado',
  error: 'Error de conexion',
};

const styles = StyleSheet.create({
  connected: {
    backgroundColor: '#34D399',
  },
  connecting: {
    backgroundColor: '#FBBF24',
  },
  connectionPanel: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  disconnected: {
    backgroundColor: '#94A3B8',
  },
  error: {
    backgroundColor: '#F87171',
  },
  backendStatus: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  actionBar: {
    alignItems: 'flex-start',
  },
  button: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buttonText: {
    color: '#052E16',
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F8FAFC',
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  field: {
    flex: 1,
    gap: 8,
    minWidth: 140,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  safeArea: {
    backgroundColor: '#020617',
    flex: 1,
  },
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  secondaryButton: {
    backgroundColor: '#1F2937',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  statusDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  urlText: {
    color: '#64748B',
    fontSize: 12,
  },
});
