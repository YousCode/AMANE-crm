import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { useTheme, FONT } from '@/theme';
import { Icon } from './Icon';
import { tap } from '@/lib/haptics';

/* Pavé numérique : 4 à 8 chiffres, points d'état, effacer, valider (touche noire). */
export function PinPad({ value, onChange, onSubmit, min = 4, max = 8, disabled, error }: { value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; min?: number; max?: number; disabled?: boolean; error?: boolean }) {
  const { c } = useTheme();
  const press = (k: string) => {
    if (disabled) return;
    tap('select');
    if (k === 'del') onChange(value.slice(0, -1));
    else if (k === 'ok') { if (value.length >= min) { tap('medium'); onSubmit(value); } }
    else if (value.length < max) onChange(value + k);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <View style={{ alignItems: 'center', gap: 22 }}>
      <View testID="pin-dots" accessibilityLabel={`${value.length} chiffre${value.length > 1 ? 's' : ''} saisi${value.length > 1 ? 's' : ''}`} style={{ flexDirection: 'row', gap: 12, height: 14, alignItems: 'center' }}>
        {Array.from({ length: Math.max(min, value.length) }).map((_, i) => (
          <View key={i} style={{ width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: error ? c.bad : i < value.length ? c.fg : c.line, backgroundColor: error ? c.bad : i < value.length ? c.fg : 'transparent' }} />
        ))}
      </View>
      <View style={{ width: 276, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {keys.map((k) => {
          const ok = k === 'ok', del = k === 'del';
          const canOk = value.length >= min;
          return (
            <Pressable key={k} testID={`key-${k}`} accessibilityRole="button" accessibilityLabel={ok ? 'Valider' : del ? 'Effacer' : k} disabled={disabled || (ok && !canOk)} onPress={() => press(k)}
              style={({ pressed }) => ({ width: 76, height: 76, borderRadius: 38, borderWidth: del ? 0 : 1, borderColor: ok ? c.fg : c.line, backgroundColor: ok ? c.fg : del ? 'transparent' : pressed ? c.panel2 : c.panel, alignItems: 'center', justifyContent: 'center', opacity: ok && !canOk ? 0.35 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] })}>
              {ok ? <Icon name="check" size={26} color={c.bg} stroke={1.8} /> : del ? <Icon name="backspace" size={24} color={c.fg} /> : <Text style={{ fontFamily: FONT.uiLight, fontSize: 28, color: c.fg }}>{k}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
