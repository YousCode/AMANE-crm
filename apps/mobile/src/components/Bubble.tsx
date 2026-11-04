import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { Message } from '@amane/shared';
import type { MediaX } from '@/types';
import { TEAM, parseDate } from '@amane/shared';
import { useTheme, FONT } from '@/theme';
import { Icon } from './Icon';
import { fmtTime, fmtDuration } from '@/lib/format';
import { openMedia, audioSource } from '@/lib/media';
import { mediaUrl, photoUrl, authHeaders } from '@/lib/api';
import { mapsUrl, open } from '@/lib/links';
import { tap } from '@/lib/haptics';

const TICK: Record<string, [string, 'ok' | 'read' | 'fail' | 'wait']> = { sending: ['…', 'wait'], envoye: ['✓', 'ok'], sent: ['✓', 'ok'], distribue: ['✓✓', 'ok'], delivered: ['✓✓', 'ok'], lu: ['✓✓', 'read'], read: ['✓✓', 'read'], echec: ['!', 'fail'], failed: ['!', 'fail'] };
const TICK_L: Record<string, string> = { sending: 'Envoi en cours', envoye: 'Envoyé', distribue: 'Distribué', lu: 'Lu', echec: 'Échec de l’envoi' };
const isAr = (s: string) => /[؀-ۿ]/.test(s);

function AudioPlayer({ id, duration, dark }: { id: string; duration?: number; dark: boolean }) {
  const { c } = useTheme();
  const [src, setSrc] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  useEffect(() => { let on = true; audioSource(id).then((s) => { if (on) setSrc(s); }); return () => { on = false; }; }, [id]);
  const player = useAudioPlayer(src);
  const st = useAudioPlayerStatus(player);
  const playing = !!st?.playing; const fg = dark ? c.bg : c.fg;
  const pos = st?.currentTime || 0; const dur = st?.duration || duration || 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 }}>
      <Pressable testID={`audio-${id}`} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Écouter le message vocal'} onPress={() => { tap('select'); try { if (playing) player.pause(); else player.play(); } catch { /* source absente */ } }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dark ? 'rgba(250,248,244,.16)' : c.fg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={playing ? 'pause' : 'play'} size={16} color={dark ? c.bg : c.bg} />
      </Pressable>
      <View style={{ flex: 1, height: 2, backgroundColor: dark ? 'rgba(250,248,244,.3)' : c.line, borderRadius: 1 }}>
        <View style={{ width: `${dur ? Math.min(100, (pos / dur) * 100) : 0}%`, height: 2, backgroundColor: dark ? c.bg : c.accent }} />
      </View>
      <Text style={{ fontFamily: FONT.mono, fontSize: 11.5, color: fg }}>{fmtDuration(playing ? pos : dur)}</Text>
    </View>
  );
}

function MediaImage({ id, dark }: { id: string; dark: boolean }) {
  const { c } = useTheme();
  const [h, setH] = useState<Record<string, string>>({});
  useEffect(() => { authHeaders().then(setH); }, []);
  const uri = id.startsWith('ph_') || /^(data:|https?:)/.test(id) ? photoUrl(id) : mediaUrl(id);
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel="Ouvrir la photo" onPress={() => void openMedia(id)}>
      <Image source={{ uri, headers: h }} style={{ width: 220, height: 160, borderRadius: 10, backgroundColor: dark ? 'rgba(250,248,244,.1)' : c.stone }} contentFit="cover" transition={150} />
    </Pressable>
  );
}

export function Bubble({ m, quoted, testID }: { m: Message; quoted?: Message | null; testID?: string }) {
  const { c, dark } = useTheme();
  const out = m.dir === 'out'; const note = m.dir === 'note';
  const by = out && TEAM.find((t) => t.id === m.by)?.nom; const auto = out && (m.by === 'auto' || m.by === 'ia');
  const tk = out ? TICK[m.status] || TICK.envoye : null;
  const bg = note ? (dark ? 'rgba(226,188,114,.14)' : '#FBF4E1') : out ? (dark ? c.panel2 : c.fg) : c.panel;
  const fg = note ? c.fg : out ? (dark ? c.fg : c.bg) : c.fg;
  const rtl = !!m.text && isAr(m.text);
  const type = m.type || 'text';
  const media = m.media as MediaX | undefined;
  const sub = (txt: string) => <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: fg, opacity: 0.7, fontStyle: 'italic' }}>{txt}</Text>;
  return (
    <View testID={testID} style={{ alignSelf: note ? 'center' : out ? 'flex-end' : 'flex-start', maxWidth: '82%', opacity: String(m.status) === 'sending' ? 0.55 : 1, marginVertical: 3 }}>
      <View style={{ backgroundColor: bg, borderRadius: 16, borderBottomLeftRadius: out || note ? 16 : 5, borderBottomRightRadius: out ? 5 : 16, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6, borderWidth: out && !dark ? 0 : 1, borderColor: note ? (dark ? 'rgba(226,188,114,.4)' : '#EAD9A8') : c.line2, gap: 6 }}>
        {note ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="note" size={12} color={c.warn} /><Text style={{ fontFamily: FONT.ui, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: c.warn }}>Note interne · {TEAM.find((t) => t.id === m.by)?.nom || m.by}</Text></View> : null}
        {quoted ? <View style={{ borderLeftWidth: 2, borderLeftColor: c.accent, paddingLeft: 8, opacity: 0.8 }}><Text numberOfLines={2} style={{ fontFamily: FONT.ui, fontSize: 12.5, color: fg }}>{quoted.text || quoted.media?.filename || quoted.type}</Text></View> : null}
        {type === 'image' && media ? <MediaImage id={media.id} dark={out && !dark} /> : null}
        {type === 'video' && media ? <Pressable accessibilityRole="button" onPress={() => void openMedia(media.id, media.filename)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="video" size={16} color={fg} />{sub('Vidéo · ouvrir')}</Pressable> : null}
        {type === 'document' && media ? (
          <Pressable testID={`doc-${media.id}`} accessibilityRole="button" accessibilityLabel={`Ouvrir ${media.filename || 'le document'}`} onPress={() => { tap('select'); void openMedia(media.id, media.filename); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: out && !dark ? 'rgba(250,248,244,.3)' : c.line, alignItems: 'center', justifyContent: 'center' }}><Icon name="doc" size={18} color={fg} /></View>
            <View style={{ flexShrink: 1 }}><Text numberOfLines={1} style={{ fontFamily: FONT.uiMedium, fontSize: 13.5, color: fg }}>{media.filename || 'Document'}</Text>{sub(media.mime?.includes('pdf') ? 'PDF · ouvrir' : 'Ouvrir')}</View>
          </Pressable>
        ) : null}
        {(type === 'audio' || type === 'voice') && media ? <AudioPlayer id={media.id} duration={media.duration} dark={out && !dark} /> : null}
        {type === 'location' && m.location ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir l’itinéraire" onPress={() => void open(mapsUrl(m.location?.address || m.location?.name || `${m.location?.lat},${m.location?.lng}`))} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="pin" size={16} color={out && !dark ? fg : c.accent} />
            <View style={{ flexShrink: 1 }}><Text style={{ fontFamily: FONT.uiMedium, fontSize: 13.5, color: fg }}>{m.location.name || 'Position'}</Text>{m.location.address ? sub(m.location.address) : null}</View>
          </Pressable>
        ) : null}
        {type === 'contacts' ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="contact" size={16} color={fg} /><Text style={{ fontFamily: FONT.uiMedium, fontSize: 13.5, color: fg }}>{m.text || m.contacts?.[0]?.nom || 'Contact'}</Text></View> : null}
        {type === 'sticker' ? sub('Autocollant') : null}
        {m.transcript ? <Text style={{ fontFamily: FONT.ui, fontSize: 14, color: fg, writingDirection: isAr(m.transcript) ? 'rtl' : 'ltr', textAlign: isAr(m.transcript) ? 'right' : 'left' }}>{m.transcript}</Text> : null}
        {m.text && type !== 'contacts' ? <Text testID={`txt-${m.id}`} selectable style={{ fontFamily: type === 'template' ? FONT.displayItalic : FONT.ui, fontSize: 14.5, lineHeight: 21, color: fg, writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>{m.text}</Text> : null}
        {media?.caption && type === 'image' ? <Text style={{ fontFamily: FONT.ui, fontSize: 13.5, color: fg, writingDirection: isAr(media.caption) ? 'rtl' : 'ltr' }}>{media.caption}</Text> : null}
        {!out && !note && m.translation ? (
          <View style={{ borderTopWidth: 1, borderTopColor: c.line2, paddingTop: 6, flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
            <Icon name="translate" size={12} color={c.fg3} />
            <Text testID={`tr-${m.id}`} style={{ fontFamily: FONT.ui, fontSize: 13, lineHeight: 18, color: c.fg3, flexShrink: 1 }}>{m.translation}</Text>
          </View>
        ) : null}
        {out && m.translation && m.translation !== m.text ? <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: fg, opacity: 0.65 }}>{m.translation}</Text> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 1 }}>
          {auto ? <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: fg, opacity: 0.6 }}>Réponse automatique ·</Text> : by ? <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: fg, opacity: 0.6 }}>{by} ·</Text> : null}
          <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: fg, opacity: 0.6 }}>{fmtTime(parseDate(m.at))}</Text>
          {tk ? <Text accessibilityLabel={TICK_L[m.status] || 'Envoyé'} style={{ fontFamily: FONT.mono, fontSize: 10, color: tk[1] === 'read' ? c.accent : tk[1] === 'fail' ? c.bad : fg, opacity: tk[1] === 'read' || tk[1] === 'fail' ? 1 : 0.6 }}>{tk[0]}</Text> : null}
        </View>
        {m.status === 'echec' && m.erreur ? <Text style={{ fontFamily: FONT.ui, fontSize: 11.5, color: c.bad }}>{m.erreur}</Text> : null}
      </View>
      {m.emoji ? <View style={{ position: 'absolute', bottom: -8, [out ? 'left' : 'right']: 8, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line2, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 12 }}>{m.emoji}</Text></View> : null}
    </View>
  );
}

export function DaySep({ label }: { label: string }) {
  const { c } = useTheme();
  return <Text style={{ alignSelf: 'center', fontFamily: FONT.ui, fontSize: 10, letterSpacing: 2.6, textTransform: 'uppercase', color: c.fg3, paddingTop: 12, paddingBottom: 4 }}>{label}</Text>;
}

export const isWeb = Platform.OS === 'web';
