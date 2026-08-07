import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Color } from '@/src/chess/types';
import { useAppTheme } from '@/src/theme/use-app-theme';
import { Piece } from './Piece';

type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];
const NAMES: Record<PromotionPiece, string> = {
  q: 'Queen',
  r: 'Rook',
  b: 'Bishop',
  n: 'Knight',
};

interface Props {
  color: Color;
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/**
 * Underpromotion matters here — some puzzle solutions promote to a knight, and
 * auto-queening would silently fail those. So all four choices are offered.
 */
export function PromotionPicker({ color, onChoose, onCancel }: Props) {
  const c = useAppTheme();

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <View style={[styles.sheet, { backgroundColor: c.background, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>Promote to</Text>
          <View style={styles.row}>
            {CHOICES.map((type) => (
              <Pressable
                key={type}
                style={({ pressed }) => [
                  styles.choice,
                  { backgroundColor: pressed ? c.surfaceStrong : c.surface },
                ]}
                onPress={() => onChoose(type)}
                accessibilityRole="button"
                accessibilityLabel={`Promote to ${NAMES[type]}`}
              >
                <Piece piece={{ type, color }} size={52} />
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  choice: { padding: 8, borderRadius: 10 },
});
