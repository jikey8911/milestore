import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSettings } from '../context/SettingsContext';
import { AlertData, NeoTable } from '../ui/NeoTable';
import { NeoCard } from '../ui/NeoCard';

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
const MAX_ALERTS = 100;

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

export function DashboardScreen() {
  const { host, minVolume, minRatio } = useSettings();
  const navigation = useNavigation<any>();

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [backendReachable, setBackendReachable] = useState(false);
  const [lastError, setLastError] = useState('');

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
    [minRatio, minVolume]
  );

  useEffect(() => {
    parameterPayloadRef.current = buildParameterPayload();
    
    // Automatically send new parameters to websocket if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(parameterPayloadRef.current));
    }
  }, [buildParameterPayload]);

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
      setLastError('No se pudo abrir ws://. Verifica configuración en Settings.');
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
      <View style={styles.screen}>
        <View style={styles.topBar}>
           <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
             <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
               <Ionicons name="settings-outline" size={24} color="#94A3B8" />
             </Pressable>
             <Text style={styles.appTitle}>O-Screener</Text>
           </View>
           
           <Pressable onPress={exportCsv} style={[styles.exportBtn, alerts.length === 0 && styles.buttonDisabled]}>
             <Text style={styles.exportBtnText}>Export CSV</Text>
           </Pressable>
        </View>

        <NeoCard title="Screener Live" subtitle="Alertas y Parámetros">
        <View style={styles.connectionPanel}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, styles[connectionState]]} />
            <Text style={styles.statusText}>{statusLabel[connectionState]}</Text>
            <Text style={styles.backendStatus}>API {backendReachable ? 'OK' : 'sin respuesta'}</Text>
          </View>
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
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: '#020617',
  },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  appTitle: { 
    color: '#60A5FA', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  exportBtn: { 
    backgroundColor: '#16A34A', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6 
  },
  iconBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  exportBtnText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  connectionPanel: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    marginBottom: 16,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  statusDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  statusText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  backendStatus: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  connected: {
    backgroundColor: '#34D399',
  },
  connecting: {
    backgroundColor: '#FBBF24',
  },
  disconnected: {
    backgroundColor: '#94A3B8',
  },
  error: {
    backgroundColor: '#F87171',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
  },
});
