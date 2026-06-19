import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type NeoCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function NeoCard({ title, subtitle, children }: NeoCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderColor: '#263244',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  header: {
    gap: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
  },
});
