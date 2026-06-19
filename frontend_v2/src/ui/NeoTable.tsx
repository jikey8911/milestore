import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

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

const columns: Array<{ label: string; key: SortKey; flex: number; align?: 'right' }> = [
  { label: 'Hora', key: 'time', flex: 1 },
  { label: 'Instrumento', key: 'instrument', flex: 1.25 },
  { label: 'Ratio', key: 'ratio', flex: 1, align: 'right' },
];

function parseRatio(value: AlertData['ratio']) {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function NeoTable({ data }: NeoTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'ratio',
    direction: 'desc',
  });

  const sortedData = useMemo(() => {
    const directionFactor = sortConfig.direction === 'asc' ? 1 : -1;

    return [...data].sort((left, right) => {
      if (sortConfig.key === 'ratio') {
        return (parseRatio(left.ratio) - parseRatio(right.ratio)) * directionFactor;
      }

      const leftValue = String(left[sortConfig.key] ?? '');
      const rightValue = String(right[sortConfig.key] ?? '');
      return leftValue.localeCompare(rightValue) * directionFactor;
    });
  }, [data, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <View style={styles.table}>
      <View style={styles.rowHeader}>
        {columns.map((column) => (
          <Pressable
            key={column.key}
            onPress={() => handleSort(column.key)}
            style={[styles.headerButton, { flex: column.flex }]}
          >
            <Text style={[styles.headerCell, column.align === 'right' && styles.alignRight]}>
              {column.label}
              {sortConfig.key === column.key ? (sortConfig.direction === 'desc' ? ' ↓' : ' ↑') : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={sortedData}
        keyExtractor={(item, index) => item.id ?? `${item.time}-${item.instrument}-${index}`}
        ListEmptyComponent={<Text style={styles.empty}>Esperando alertas en vivo...</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text numberOfLines={1} style={styles.cellMuted}>
              {item.time ?? '--:--:--'}
            </Text>
            <Text numberOfLines={1} style={styles.cellStrong}>
              {item.instrument ?? 'N/A'}
            </Text>
            <Text numberOfLines={1} style={styles.cellPositive}>
              {item.ratio ?? '-'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cellMuted: {
    color: '#CBD5E1',
    flex: 1,
    fontSize: 13,
  },
  cellPositive: {
    color: '#34D399',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  cellStrong: {
    color: '#F8FAFC',
    flex: 1.25,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    color: '#94A3B8',
    paddingHorizontal: 14,
    paddingVertical: 18,
    textAlign: 'center',
  },
  headerCell: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  headerButton: {
    minHeight: 24,
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#1F2937',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowHeader: {
    backgroundColor: '#0F172A',
    borderBottomColor: '#263244',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  table: {
    backgroundColor: '#0B1120',
    borderColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 430,
    overflow: 'hidden',
  },
  alignRight: {
    textAlign: 'right',
  },
});
