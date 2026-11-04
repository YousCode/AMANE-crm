import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Conversation, Message } from '@amane/shared';
import type { MediaX } from '@/types';
import { TEAM } from '@amane/shared';
import { useTheme, FONT } from '@/theme';
import { RoundPic, Sub, Txt } from './ui';
import { Icon } from './Icon';
import { useStore } from '@/store';
import { convName, convLang, winOpen } from '@/store/select';
import { shortTime, fmtDuration } from '@/lib/format';
import { tap } from '@/lib/haptics';

export function previewOf(cv: Conversation, last?: Message | null): string {
  const t = last?.type || '';
  if (last && t === 'audio') return `🎤 vocal ${fmtDuration((last.media as MediaX | undefined)?.duration || 0)}`;
  if (last && t === 'document') return `📎 ${last.media?.filename || 'document'}`;
  if (last && t === 'image') return `📷 ${last.media?.caption || 'photo'}`;
  if (last && t === 'video') return '🎬 vidéo';
  if (last && t === 'location') return `📍 ${last.location?.name || last.location?.address || 'position'}`;
  if (last && t === 'contacts') return `👤 ${last.text || 'contact'}`;
  const txt = cv.lastText || last?.text || '';
  return `${cv.lastDir === 'out' && !/^Vous : /.test(txt) ? 'Vous : ' : ''}${txt}`;
}

export function ConvRow({ cv, last, onPress, testID }: { cv: Conversation; last?: Message | null; onPress: () => void; testID?: string }) {
  const { c } = useTheme(); const data = useStore((s) => s.data);
  const n = cv.unread || 0; const nm = convName(data, cv); const L = convLang(data, cv); const open = winOpen(cv);
  const who = TEAM.find((t) => t.id === cv.assigne);
  const rtl = L === 'AR';
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${nm}, ${n ? `${n} non lu${n > 1 ? 's' : ''}, ` : ''}${L}`} onPress={() => { tap('select'); onPress(); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 74, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line2, backgroundColor: pressed ? c.panel2 : n ? c.panel : 'transparent' })}>
      <RoundPic name={nm} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Txt numberOfLines={1} style={{ fontFamily: n ? FONT.uiMedium : FONT.ui, flexShrink: 1 }}>{nm}</Txt>
          <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1, color: c.fg3, borderWidth: 1, borderColor: c.line2, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>{L}</Text>
          {who ? <Text style={{ fontFamily: FONT.ui, fontSize: 10.5, color: c.accent, letterSpacing: 0.3 }}>· {who.nom}</Text> : null}
        </View>
        <Sub numberOfLines={1} rtl={rtl} style={{ textAlign: 'left' }}>{previewOf(cv, last)}</Sub>
        {!open ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="clock" size={11} color={c.warn} /><Text style={{ fontFamily: FONT.ui, fontSize: 11, color: c.warn }}>Fenêtre fermée</Text></View> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: n ? c.accent : c.fg3 }}>{shortTime(cv.lastAt)}</Text>
        {n ? <View testID={`unread-${cv.id}`} style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: FONT.mono, fontSize: 11, color: c.accentInk }}>{n}</Text></View> : null}
      </View>
    </Pressable>
  );
}
