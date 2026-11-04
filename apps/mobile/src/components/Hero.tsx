import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import type { Mission } from '@amane/shared';
import { parseDate } from '@amane/shared';
import { useTheme, FONT } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Btn, Label } from './ui';
import { useStore } from '@/store';
import { clientOf, vehicleOf, chauffeurOf, nextMission, whenLabel, helloTxt } from '@/store/select';
import { telUrl, waUrl, mapsUrl, open } from '@/lib/links';
import { fmtTime } from '@/lib/format';
import { tap } from '@/lib/haptics';

/* Carte héros « Prochaine mission » : noire, heure en Bodoni, Appeler / WhatsApp / Itinéraire / Ouvrir. */
export function Hero({ now = new Date() }: { now?: Date }) {
  const { c, dark } = useTheme(); const router = useRouter();
  const data = useStore((s) => s.data);
  const nx = nextMission(data, now);
  const bg = dark ? c.panel : c.fg; const fg = dark ? c.fg : c.bg; const openInk = dark ? c.bg : c.fg;
  if (!nx) {
    return (
      <View testID="hero-none" style={{ borderRadius: 18, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel, padding: 20 }}>
        <Label>Prochaine mission</Label>
        <Text style={{ fontFamily: FONT.display, fontSize: 22, color: c.fg, marginTop: 10 }}>Aucune mission confirmée à venir.</Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 13.5, color: c.fg3, marginTop: 8, marginBottom: 16 }}>Dès qu’une demande est confirmée, elle apparaît ici avec l’appel au client et l’itinéraire en un geste.</Text>
        <Btn title="Voir les demandes" small kind="primary" icon="demandes" onPress={() => router.push('/(tabs)/demandes')} />
      </View>
    );
  }
  const m: Mission = nx.m; const cl = clientOf(data, m); const v = vehicleOf(data, m); const ch = chauffeurOf(data, m);
  const a = parseDate(m.debut); const b = parseDate(m.fin);
  const tel = telUrl(cl?.tel), wa = waUrl(cl?.tel, helloTxt(cl)), maps = mapsUrl(m.lieu || '');
  const rows: [string, string][] = [];
  if (cl?.nom) rows.push(['Client', cl.nom]); if (v) rows.push(['Voiture', v.nom]); if (m.lieu) rows.push(['Lieu', m.lieu]); if (ch || m.chauffeur) rows.push(['Chauffeur', ch ? ch.nom : m.chauffeur || '']);
  const cell = (key: string, icon: IconName, title: string, url: string, testID: string) => (
    <Pressable key={key} testID={testID} accessibilityRole="button" accessibilityLabel={`${title}${url ? '' : ' (indisponible)'}`} disabled={!url} onPress={() => { tap('medium'); void open(url); }}
      style={({ pressed }) => ({ flex: 1, minHeight: 60, borderRadius: 12, borderWidth: 1, borderColor: dark ? c.line : 'rgba(250,248,244,.24)', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, opacity: !url ? 0.32 : pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={19} color={fg} />
      <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: fg, letterSpacing: 0.3 }}>{title}</Text>
    </Pressable>
  );
  return (
    <View testID="hero" accessibilityLabel={nx.cur ? 'Mission en cours' : 'Prochaine mission'} style={{ borderRadius: 18, backgroundColor: bg, padding: 20, paddingBottom: 16, overflow: 'hidden', borderWidth: dark ? 1 : 0, borderColor: c.line2 }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -34, top: -26, width: 150, height: 210, borderWidth: 1, borderColor: 'rgba(184,149,92,.55)', borderTopLeftRadius: 75, borderTopRightRadius: 75 }} />
      <Label color={c.champagne} style={{ letterSpacing: 3.5, fontSize: 10 }}>{nx.cur ? 'Mission en cours' : 'Prochaine mission'}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <Text testID="hero-time" style={{ fontFamily: FONT.display, fontSize: 46, lineHeight: 48, color: fg }}>{fmtTime(nx.cur ? b : a)}</Text>
        <Text style={{ fontFamily: FONT.ui, fontSize: 13, letterSpacing: 0.5, color: fg, opacity: 0.72 }}>{whenLabel(m, nx.cur, now)}</Text>
      </View>
      <Text testID="hero-title" style={{ fontFamily: FONT.display, fontSize: 22, lineHeight: 27, color: fg, marginTop: 12 }}>{m.titre}</Text>
      <View style={{ marginTop: 12, marginBottom: 16, gap: 5 }}>
        {rows.map(([k, val]) => (
          <View key={k} style={{ flexDirection: 'row', gap: 14, alignItems: 'baseline' }}>
            <Text style={{ fontFamily: FONT.ui, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase', color: fg, opacity: 0.55, width: 78 }}>{k}</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 13.5, color: fg, flex: 1 }}>{val}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {cell('tel', 'phone', 'Appeler', tel, 'hero-tel')}
        {cell('wa', 'wa', 'WhatsApp', wa, 'hero-wa')}
        {cell('maps', 'nav', 'Itinéraire', maps, 'hero-maps')}
        <Pressable testID="hero-open" accessibilityRole="button" accessibilityLabel="Ouvrir la demande" onPress={() => { tap('light'); router.push(`/mission/${m.id}`); }}
          style={({ pressed }) => ({ flex: 1, minHeight: 60, borderRadius: 12, backgroundColor: fg, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, opacity: pressed ? 0.85 : 1 })}>
          <Icon name="right" size={19} color={openInk} />
          <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: openInk, letterSpacing: 0.3 }}>Ouvrir</Text>
        </Pressable>
      </View>
    </View>
  );
}
