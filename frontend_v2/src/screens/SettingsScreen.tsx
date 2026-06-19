import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';

export function SettingsScreen() {
  const { 
    host, setHost, 
    minVolume, setMinVolume, 
    minRatio, setMinRatio, 
    savePreset, loadPreset, presetStatus 
  } = useSettings();

  return (
    <View style={styles.screen}>
      <Text style={styles.sectionTitle}>Conexión</Text>
      <View style={styles.panel}>
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
        <Text style={styles.hint}>Ej: 100.90.90.65:8000</Text>
      </View>

      <Text style={styles.sectionTitle}>Parámetros de Filtrado</Text>
      <View style={styles.panel}>
        <View style={styles.fieldGrid}>
          <View style={styles.field}>
            <Text style={styles.label}>Vol. Mínimo</Text>
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
            <Text style={styles.label}>Ratio Mín. (x)</Text>
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
          <Pressable onPress={savePreset} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Guardar Preset</Text>
          </Pressable>
          <Pressable onPress={loadPreset} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Recargar Preset</Text>
          </Pressable>
        </View>
        
        {presetStatus ? <Text style={styles.statusText}>{presetStatus}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: '#020617',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 16,
  },
  panel: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
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
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#1F2937',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#34D399',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  }
});
