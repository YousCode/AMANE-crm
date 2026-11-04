import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useStore } from '@/store';
import { useTheme, FONT } from '@/theme';
import { Dot } from './Icon';

/* État de synchronisation visible : Synchronisé / Hors ligne — n modifications en attente. */
export function SyncPill({ testID = 'sync-pill' }: { testID?: string }) {
  const { c } = useTheme();
  const sync = useStore((s) => s.sync); const pending = useStore((s) => s.pending.length); const wsOn = useStore((s) => s.wsOn); const syncNow = useStore((s) => s.syncNow);
  const label = sync === 'offline' ? `Hors ligne${pending ? ` — ${pending} en attente` : ''}` : sync === 'syncing' ? 'Synchronisation…' : sync === 'error' ? 'Serveur injoignable' : pending ? `${pending} en attente` : wsOn ? 'En direct' : 'Synchronisé';
  const col = sync === 'offline' || sync === 'error' ? c.warn : sync === 'syncing' ? c.fg3 : c.ok;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`Synchronisation : ${label}`} onPress={() => void syncNow()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Dot size={7} color={col} />
      <Text style={{ fontFamily: FONT.ui, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: c.fg2 }}>{label}</Text>
    </Pressable>
  );
}

export function Toast() {
  const { c } = useTheme();
  const toast = useStore((s) => s.toast); const setToast = useStore((s) => s.setToast);
  React.useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast, setToast]);
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 92, alignItems: 'center' }}>
      <Pressable onPress={() => setToast(null)} style={{ backgroundColor: c.fg, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, maxWidth: '88%' }} testID="toast">
        <Text style={{ fontFamily: FONT.ui, fontSize: 13.5, color: c.bg }}>{toast}</Text>
      </Pressable>
    </View>
  );
}
