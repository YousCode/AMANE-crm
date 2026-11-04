import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { QUICK_REPLY_KEYS, QUICK_REPLY_LABELS, WA_TEMPLATES, t as tr, TEAM } from '@amane/shared';
import type { Mission, Partenaire, Client } from '@amane/shared';
import { useTheme, FONT, RADIUS } from '@/theme';
import { Icon } from './Icon';
import { Btn, Sub, Txt, Label } from './ui';
import { api, ApiError, messageFor } from '@/lib/api';
import { takeAndUpload } from '@/lib/photo';
import { tap } from '@/lib/haptics';
import { fmtTime, fmtDay } from '@/lib/format';

export type SendPayload = Record<string, unknown>;
export type Template = { name: string; label?: string; vars?: string[]; params?: string[] };
type Props = {
  convId: string; lang: string; open: boolean; firstName?: string;
  mission?: Mission | null; chauffeur?: Partenaire | null; client?: Client | null; vehiculeNom?: string; serviceNom?: string;
  aiDraft?: string | null; templates?: Template[];
  onSend: (payload: SendPayload, preview: { type: string; text: string }) => Promise<unknown>;
  onNote: (text: string) => Promise<unknown>;
  onAssign?: (userId: string) => void;
  onError?: (msg: string) => void;
  translateFn?: (text: string, to: string) => Promise<string>;
};

const TPL_LANG: Record<string, string> = { FR: 'fr', EN: 'en', AR: 'ar', ES: 'es', RU: 'ru', IT: 'it', DE: 'de', ZH: 'zh_CN' };
const TPL_DEFAULT: Template[] = WA_TEMPLATES.filter((x) => x.name !== 'amane_alerte').map((x) => ({ name: x.name, label: x.label, vars: [...x.vars] }));

export function Composer(p: Props) {
  const { c, dark } = useTheme();
  const [text, setText] = useState(''); const [mode, setMode] = useState<'msg' | 'note'>('msg'); const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState(false); const [preview, setPreview] = useState<{ fr: string; tr: string } | null>(null); const [tplOpen, setTplOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const L = (p.lang || 'FR').toUpperCase(); const qrLang = ['FR', 'EN', 'ES', 'AR'].includes(L) ? L : 'EN';
  const vars = { prenom: p.firstName || '', nom: p.firstName || '', lieu: p.mission?.lieu || '', heure: p.mission ? fmtTime(p.mission.debut) : '', date: p.mission ? fmtDay(p.mission.debut) : '', voiture: p.vehiculeNom || '', chauffeur: p.chauffeur?.nom || '', numero: p.mission?.devis?.numero || '', service: p.serviceNom || p.mission?.service || '' };
  const closed = !p.open; const templates = p.templates?.length ? p.templates : TPL_DEFAULT;
  const err = (e: unknown) => p.onError?.(e instanceof ApiError ? e.message : e instanceof Error ? e.message : messageFor('erreur_serveur'));

  const insert = (s: string) => { setText((cur) => (cur.trim() ? cur.trim() + (/[.!?…。؟]$/.test(cur.trim()) ? ' ' : '\n') + s : s)); };
  const doSend = async (payload: SendPayload, prev: { type: string; text: string }) => {
    setBusy(true);
    try { await p.onSend(payload, prev); setText(''); setPreview(null); setAttach(false); tap('success'); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const send = async () => {
    const v = text.trim(); if (!v) return;
    if (mode === 'note') { setBusy(true); try { await p.onNote(v); setText(''); setMode('msg'); tap('success'); } catch (e) { err(e); } finally { setBusy(false); } return; }
    // Rédaction en français → traduction dans la langue du client avant envoi, aperçu modifiable.
    if (L !== 'FR' && !preview) {
      setBusy(true);
      try {
        const translated = p.translateFn ? await p.translateFn(v, L) : (await api<{ text: string }>('POST', '/api/translate', { text: v, to: L, from: 'FR', context: 'message' })).text;
        setPreview({ fr: v, tr: translated });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ia_off') await doSend({ text: v }, { type: 'text', text: v });
        else err(e);
      } finally { setBusy(false); }
      return;
    }
    await doSend({ text: v }, { type: 'text', text: v });
  };
  const sendTranslated = () => preview && doSend({ text: preview.tr, translation: preview.fr }, { type: 'text', text: preview.tr });
  const sendFrench = () => preview && doSend({ text: preview.fr }, { type: 'text', text: preview.fr });
  const sendTemplate = (tpl: Template) => {
    const params = (tpl.vars || tpl.params || []).map((k) => String((vars as Record<string, string>)[k] ?? ''));
    const label = `[Modèle ${tpl.name}] ${params.filter(Boolean).join(' · ')}`;
    setTplOpen(false);
    return doSend({ template: { name: tpl.name, lang: TPL_LANG[L] || 'en', params } }, { type: 'template', text: label });
  };
  const sendPhoto = async (source: 'camera' | 'library') => {
    setBusy(true);
    try { const r = await takeAndUpload(source); if (r) await doSend({ media: { type: 'image', photoId: r.id, caption: text.trim() || undefined } }, { type: 'image', text: text.trim() }); }
    catch (e) { err(e); } finally { setBusy(false); }
  };
  const sendLocation = () => p.mission?.lieu && doSend({ location: { lat: 0, lng: 0, name: p.mission.titre, address: p.mission.lieu } }, { type: 'location', text: p.mission.lieu });
  const sendContact = () => p.chauffeur && doSend({ contact: { partenaireId: p.chauffeur.id } }, { type: 'contacts', text: `${p.chauffeur.nom}${p.chauffeur.tel ? ' · ' + p.chauffeur.tel : ''}` });
  const sendDoc = (kind: 'devis' | 'facture') => p.mission?.devis && doSend({ media: { type: 'document', url: `/api/missions/${p.mission.id}/${kind}.pdf`, filename: `${kind === 'devis' ? p.mission.devis.numero : p.mission.devis.factureNumero}.pdf` } }, { type: 'document', text: `${kind === 'devis' ? p.mission.devis.numero : p.mission.devis.factureNumero}.pdf` });

  const chip = (key: string, label: string, onPress: () => void, icon?: string, accent?: boolean) => (
    <Pressable key={key} testID={`qr-${key}`} accessibilityRole="button" accessibilityLabel={label} onPress={() => { tap('select'); onPress(); }} style={{ height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: accent ? c.accent : c.line2, backgroundColor: c.panel, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon ? <Icon name={icon} size={14} color={c.accent} /> : null}
      <Text style={{ fontFamily: FONT.ui, fontSize: 12.5, color: accent ? c.fg : c.fg2 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="composer" style={{ borderTopWidth: 1, borderTopColor: c.line2, backgroundColor: c.bg2, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, gap: 8 }}>
      {closed ? (
        <View testID="window-closed" style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: RADIUS, borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, backgroundColor: c.panel }}>
          <Icon name="clock" size={18} color={c.warn} />
          <Sub style={{ flex: 1, color: c.fg2 }}><Txt style={{ fontFamily: FONT.uiMedium, fontSize: 13 }}>Fenêtre de 24 h fermée.</Txt> WhatsApp n’autorise un message libre que dans les 24 h qui suivent le dernier message du client. Envoyez un modèle approuvé.</Sub>
          <Btn small kind="primary" title="Modèle" testID="btn-template" onPress={() => setTplOpen((v) => !v)} />
        </View>
      ) : null}
      {tplOpen ? (
        <View style={{ gap: 6 }}>
          <Label>Modèles approuvés · {TPL_LANG[L] || 'en'}</Label>
          {templates.map((tp) => (
            <Pressable key={tp.name} testID={`tpl-${tp.name}`} accessibilityRole="button" onPress={() => void sendTemplate(tp)} style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel }}>
              <Txt style={{ fontFamily: FONT.uiMedium }}>{tp.label || tp.name}</Txt>
              <Sub>{tp.name} · {(tp.vars || tp.params || []).join(', ') || 'sans paramètre'}</Sub>
            </Pressable>
          ))}
        </View>
      ) : null}
      {preview ? (
        <View testID="translation-preview" style={{ padding: 12, borderRadius: RADIUS, borderWidth: 1, borderColor: c.accent, backgroundColor: c.panel, gap: 8 }}>
          <Label color={c.accent}>Aperçu · envoi en {L}</Label>
          <TextInput testID="preview-input" value={preview.tr} onChangeText={(v) => setPreview({ ...preview, tr: v })} multiline style={{ fontFamily: FONT.ui, fontSize: 15, lineHeight: 21, color: c.fg, writingDirection: L === 'AR' ? 'rtl' : 'ltr', textAlign: L === 'AR' ? 'right' : 'left', minHeight: 44 }} />
          <Sub>{preview.fr}</Sub>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn small kind="primary" title="Envoyer" testID="preview-send" loading={busy} onPress={() => void sendTranslated()} />
            <Btn small title="Envoyer en français quand même" testID="preview-send-fr" onPress={() => void sendFrench()} />
            <Btn small kind="ghost" title="Annuler" onPress={() => setPreview(null)} />
          </View>
        </View>
      ) : null}
      {attach ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {chip('camera', 'Photo', () => void sendPhoto('camera'), 'camera')}
          {chip('library', 'Galerie', () => void sendPhoto('library'), 'image')}
          {p.mission?.devis?.numero ? chip('devis', `Devis ${p.mission.devis.numero}`, () => void sendDoc('devis'), 'doc') : null}
          {p.mission?.devis?.factureNumero ? chip('facture', `Facture ${p.mission.devis.factureNumero}`, () => void sendDoc('facture'), 'doc') : null}
          {p.mission?.lieu ? chip('location', 'Lieu de la mission', () => void sendLocation(), 'pin') : null}
          {p.chauffeur ? chip('contact', `Contact ${p.chauffeur.nom}`, () => void sendContact(), 'contact') : null}
        </ScrollView>
      ) : null}
      {assignOpen ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Label>Transférer à</Label>
          {TEAM.map((u) => chip('as-' + u.id, u.nom, () => { p.onAssign?.(u.id); setAssignOpen(false); setMode('note'); setText(`Transféré à ${u.nom} : `); }))}
        </View>
      ) : null}
      {!closed && mode === 'msg' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} testID="quick-replies">
          {p.aiDraft ? chip('ai', 'Brouillon IA', () => insert(p.aiDraft || ''), 'spark', true) : null}
          {QUICK_REPLY_KEYS.filter((k) => !['devis_lien', 'espace_lien'].includes(k)).map((k) => chip(k, QUICK_REPLY_LABELS[k] || k, () => insert(tr(qrLang, 'quick.' + k, vars))))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <Pressable testID="btn-attach" accessibilityRole="button" accessibilityLabel="Pièce jointe" onPress={() => { tap('select'); setAttach((v) => !v); setAssignOpen(false); }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: attach ? c.fg : c.line, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}><Icon name={attach ? 'close' : 'plus'} size={18} color={c.fg} /></Pressable>
        <Pressable testID="btn-note" accessibilityRole="button" accessibilityLabel={mode === 'note' ? 'Revenir au message' : 'Note interne'} accessibilityState={{ selected: mode === 'note' }} onPress={() => { tap('select'); setMode((m) => (m === 'note' ? 'msg' : 'note')); }} onLongPress={() => setAssignOpen((v) => !v)} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: mode === 'note' ? c.warn : c.line, backgroundColor: mode === 'note' ? (dark ? 'rgba(226,188,114,.14)' : '#FBF4E1') : c.panel, alignItems: 'center', justifyContent: 'center' }}><Icon name="note" size={18} color={mode === 'note' ? c.warn : c.fg} /></Pressable>
        <TextInput testID="composer-input" value={text} onChangeText={setText} multiline placeholder={mode === 'note' ? 'Note interne (jamais envoyée au client)…' : closed ? 'Fenêtre fermée : modèle uniquement' : L !== 'FR' ? `Écrivez en français, envoi en ${L}…` : 'Votre message…'} placeholderTextColor={c.fg3} editable={!busy && (!closed || mode === 'note')} accessibilityLabel="Message"
          style={{ flex: 1, minHeight: 44, maxHeight: 150, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 9, borderRadius: 22, borderWidth: 1, borderColor: mode === 'note' ? c.warn : c.line, backgroundColor: mode === 'note' ? (dark ? 'rgba(226,188,114,.14)' : '#FBF4E1') : c.bg, fontFamily: FONT.ui, fontSize: 15, lineHeight: 20, color: c.fg }} />
        <Pressable testID="btn-send" accessibilityRole="button" accessibilityLabel={mode === 'note' ? 'Enregistrer la note' : 'Envoyer'} disabled={busy || !text.trim() || (closed && mode === 'msg')} onPress={() => { tap('medium'); void send(); }} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: mode === 'note' ? c.warn : c.fg, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() || (closed && mode === 'msg') ? 0.4 : pressed ? 0.85 : 1 })}>
          <Icon name={mode === 'note' ? 'check' : 'send'} size={18} color={c.bg} />
        </Pressable>
      </View>
    </View>
  );
}
