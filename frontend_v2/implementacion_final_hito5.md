Paso 1: Instalación de Dependencias
Ejecuta este comando en la carpeta frontend_v2 para instalar los módulos necesarios para el almacenamiento local y la gestión de archivos:

Bash
npx expo install @react-native-async-storage/async-storage expo-file-system expo-sharing
Paso 2: Motor de Ordenamiento (Sorting) en NeoTable.tsx
Reemplazaremos los encabezados de texto estático por botones interactivos y añadiremos la lógica para ordenar los datos según la columna seleccionada.

Actualiza tu archivo src/ui/NeoTable.tsx con este código:

TypeScript
import React, { useState, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export type AlertData = {
  id?: string;
  time?: string;
  instrument?: string;
  ratio?: string | number;
};

type NeoTableProps = {
  data: AlertData[];
};

type SortKey = 'time' | 'instrument' | 'ratio';
type SortDirection = 'asc' | 'desc';

const columns: { key: SortKey; label: string }[] = [
  { key: 'time', label: 'Hora' },
  { key: 'instrument', label: 'Instrumento' },
  { key: 'ratio', label: 'Ratio' }
];

export function NeoTable({ data }: NeoTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      // Limpiar y parsear si es ratio numérico encubierto como string ("5.2x" -> 5.2)
      if (sortKey === 'ratio') {
        valA = parseFloat(String(valA).replace(/[^0-9.]/g, '')) || 0;
        valB = parseFloat(String(valB).replace(/[^0-9.]/g, '')) || 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  return (
    <View style={styles.table}>
      <View style={styles.rowHeader}>
        {columns.map((column) => (
          <TouchableOpacity 
            key={column.key} 
            style={styles.headerCellContainer}
            onPress={() => handleSort(column.key)}
          >
            <Text style={styles.headerCell}>
              {column.label} {sortKey === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={sortedData}
        keyExtractor={(item, index) => item.id ?? `${item.time}-${item.instrument}-${index}`}
        ListEmptyComponent={<Text style={styles.empty}>Esperando alertas en vivo...</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text numberOfLines={1} style={styles.cellMuted}>{item.time ?? '--:--:--'}</Text>
            <Text numberOfLines={1} style={styles.cellStrong}>{item.instrument ?? 'N/A'}</Text>
            <Text numberOfLines={1} style={styles.cellPositive}>{item.ratio ?? '-'}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (mantén tus estilos cellMuted, cellPositive, cellStrong, empty, row, rowHeader, table intactos)
  headerCellContainer: {
    flex: 1,
    paddingVertical: 4,
  },
  headerCell: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Añade aquí los estilos restantes de tu archivo original...
  cellMuted: { color: '#CBD5E1', flex: 1, fontSize: 13 },
  cellPositive: { color: '#34D399', flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  cellStrong: { color: '#F8FAFC', flex: 1.25, fontSize: 13, fontWeight: '700' },
  empty: { color: '#94A3B8', paddingHorizontal: 14, paddingVertical: 18, textAlign: 'center' },
  row: { alignItems: 'center', borderBottomColor: '#1F2937', borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 46, paddingHorizontal: 14, paddingVertical: 10 },
  rowHeader: { backgroundColor: '#0F172A', borderBottomColor: '#263244', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  table: { backgroundColor: '#0B1120', borderColor: '#1F2937', borderRadius: 8, borderWidth: 1, maxHeight: 430, overflow: 'hidden' },
});
Paso 3: Presets y Exportación a CSV en App.tsx
Integraremos el manejo de estados guardados (Presets) y la generación de archivos para compartir (CSV).

Añade este código a tu App.tsx (reemplazando tu función principal y agregando las importaciones):

TypeScript
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { AlertData, NeoTable } from './src/ui/NeoTable';
import { NeoCard } from './src/ui/NeoCard';

// ... (mantén tus tipos y la función normalizeAlert idénticos a tu versión actual)

export default function App() {
  const [host, setHost] = useState('100.90.90.65:8000');
  const [minVolume, setMinVolume] = useState('5000'); // Preset Parameter
  const [ratioThreshold, setRatioThreshold] = useState('2.0'); // Preset Parameter
  
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');

  const websocketUrl = useMemo(() => `ws://${host.trim()}/ws/dashboard`, [host]);

  // Cargar Presets al inicio
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const savedVol = await AsyncStorage.getItem('@min_vol');
        const savedRatio = await AsyncStorage.getItem('@min_ratio');
        if (savedVol) setMinVolume(savedVol);
        if (savedRatio) setRatioThreshold(savedRatio);
      } catch (e) { console.error("Error loading presets", e); }
    };
    loadPresets();
  }, []);

  // Guardar Presets
  const savePresets = async () => {
    try {
      await AsyncStorage.setItem('@min_vol', minVolume);
      await AsyncStorage.setItem('@min_ratio', ratioThreshold);
      Alert.alert("Éxito", "Presets guardados correctamente.");
    } catch (e) {
      Alert.alert("Error", "No se pudieron guardar los presets.");
    }
  };

  // Exportar a CSV
  const exportToCSV = async () => {
    if (alerts.length === 0) {
      Alert.alert("Atención", "No hay datos para exportar.");
      return;
    }

    const headerString = 'Time,Instrument,Ratio\n';
    const rowString = alerts.map(d => `${d.time},${d.instrument},${d.ratio}`).join('\n');
    const csvString = `${headerString}${rowString}`;

    const fileUri = `${FileSystem.documentDirectory}O_Screener_Export_${Date.now()}.csv`;

    try {
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert("Error", "Compartir no está disponible en este dispositivo.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  // ... (mantén tu useEffect del WebSocket idéntico al actual)

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        
        {/* Cabecera y Botón Exportar */}
        <View style={styles.topBar}>
           <Text style={styles.appTitle}>O-Screener</Text>
           <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
             <Text style={styles.exportBtnText}>Export CSV</Text>
           </TouchableOpacity>
        </View>

        <NeoCard title="Screener Live" subtitle="Alertas y Parámetros">
          <View style={styles.connectionPanel}>
            {/* ... (mantén tu input del Host y StatusRow aquí) ... */}
            
            {/* Presets Controls */}
            <View style={styles.presetRow}>
               <View style={{flex: 1}}>
                  <Text style={styles.label}>Vol. Mínimo</Text>
                  <TextInput 
                    style={styles.input} 
                    value={minVolume} 
                    onChangeText={setMinVolume} 
                    keyboardType="numeric" 
                  />
               </View>
               <View style={{flex: 1}}>
                  <Text style={styles.label}>Ratio Mín. (x)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={ratioThreshold} 
                    onChangeText={setRatioThreshold} 
                    keyboardType="numeric" 
                  />
               </View>
               <TouchableOpacity style={styles.saveBtn} onPress={savePresets}>
                  <Text style={styles.saveBtnText}>Guardar</Text>
               </TouchableOpacity>
            </View>
          </View>

          <NeoTable data={alerts} />
        </NeoCard>
      </View>
    </SafeAreaView>
  );
}

// Añade estos estilos a tu objeto StyleSheet.create existente:
const additionalStyles = {
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  appTitle: { color: '#60A5FA', fontSize: 24, fontWeight: 'bold' },
  exportBtn: { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  exportBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  presetRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 },
  saveBtn: { backgroundColor: '#2563EB', paddingHorizontal: 16, height: 44, justifyContent: 'center', borderRadius: 8 },
  saveBtnText: { color: 'white', fontWeight: 'bold' }
};