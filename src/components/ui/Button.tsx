import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/src/theme/use-app-theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * All button text goes through the theme.
 *
 * The first version used a bare <Text> inside a Pressable, which inherits no
 * colour and therefore renders near-black — invisible in dark mode. Nothing in
 * this app should render a bare <Text> on a coloured surface.
 */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  style,
  accessibilityHint,
}: Props) {
  const c = useAppTheme();

  const background =
    variant === 'primary' ? c.accent : variant === 'secondary' ? c.surfaceStrong : 'transparent';
  const textColor = variant === 'primary' ? c.textOnAccent : c.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:
            pressed && variant === 'primary'
              ? c.accentPressed
              : pressed && variant !== 'ghost'
                ? c.border
                : background,
          borderColor: variant === 'ghost' ? c.border : 'transparent',
          borderWidth: variant === 'ghost' ? 1 : 0,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: textColor, fontWeight: variant === 'primary' ? '700' : '600' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  label: { fontSize: 15 },
});
