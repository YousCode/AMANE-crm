import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseDate, type Mission } from '@amane/shared';
import { useStore } from '@/store';
import { byId, convClient, convName, convMission, convLang, winOpen, convMsgs, qrName, chauffeurOf, vehicleOf, svcName } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Bubble, DaySep } from '@/components/Bubble';
import { Composer } from '@/components/Composer';
import { IconBtn, Pill, RoundPic, Sub, Txt, Label, Btn, Panel, Empty } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { telUrl, waUrl, open } from '@/lib/links';
import { dayLabel, fmtTime, fmtUntil, fmtPhone, fmtDT, toLocalInput, fmtE } from '@/lib/format';
import { api } from '@/lib/api';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const convId = decodeURIComponent(String(id || ''));
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const router = useRouter();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me); const markRead = useStore((s) => s.markRead); const sendMessage = useStore((s) => s.sendMessage); const addNote = useStore((s) => s.addNote); const save = useStore((s) => s.save); const setToast = useStore((s) => s.setToast);
  const cv = byId(data.conversations, convId);
  const [aiOpen, setAiOpen] = useState(true);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (cv) void markRead(cv.id); }, [cv?.id, cv?.unread, markRead]);
  const msgs = useMemo(() => (cv ? convMsgs(data, cv.id) : []), [data, cv]);
  useEffect(() => { const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 60); return () => clearTimeout(t); }, [msgs.length]);

  if (!cv) return <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top }}><IconBtn name="left" accessibilityLabel="Retour" onPress={() => router.back()} style={{ margin: 16 }} /><Empty>Conversation introuvable.</Empty></View>;
  const client = convClient(data, cv); const m = convMission(data, cv); const L = convLang(data, cv); const open_ = winOpen(cv); const nm = convName(data, cv);
  const tel = '+' + String(cv.phone || cv.id).replace(/\D/g, '');
  const ch = chauffeurOf(data, m); const v = vehicleOf(data, m);
  const templates = ((data.reglages.find((r: any) => r.id === 'templates') || {}) as any).templates;
  const ai = cv.aiFields || {};
  const aiRows: [string, string][] = ([['Service', ai.service && svcName(data, String(ai.service))], ['Véhicule', ai.vehicule], ['Du', ai.debut && fmtDT(ai.debut)], ['Au', ai.fin && fmtDT(ai.fin)], ['Lieu', ai.lieu], ['Passagers', ai.passagers], ['Budget', ai.budget && fmtE(ai.budget)], ['Urgence', ai.urgence]] as [string, unknown][]).filter((x) => x[1] != null && x[1] !== '' && x[1] !== 0).map(([a, b]) => [a, String(b)]);

  const applyAi = async () => {
    const patch: Partial<Mission> = {};
    if (ai.service && byId(data.services, ai.service)) patch.service = String(ai.service);
    if (ai.vehicule) { const q = String(ai.vehicule).toLowerCase(); const vv = data.vehicules.find((x) => q.includes(x.nom.toLowerCase()) || x.nom.toLowerCase().includes(q)); if (vv) patch.vehiculeId = vv.id; }
    if (parseDate(ai.debut)) patch.debut = toLocalInput(parseDate(ai.debut) as Date); if (parseDate(ai.fin)) patch.fin = toLocalInput(parseDate(ai.fin) as Date);
    if (ai.lieu) patch.lieu = String(ai.lieu); if (+(ai.budget as number) && !(m && +(m.montant || 0))) patch.montant = +(ai.budget as number);
    if (ai.passagers) patch.passagers = ai.passagers as number;
    if (m) { await save('missions', { ...m, ...patch }, 'Appliquer l’analyse'); setToast('Demande mise à jour.'); router.push(`/mission/${m.id}`); }
    else {
      const id = 'm_' + Date.now().toString(36);
      await save('missions', { id, titre: `WhatsApp — ${nm}`, clientId: client?.id || '', statut: 'nouvelle', responsable: me?.id || 'amel', service: 'location', vehiculeId: '', debut: '', fin: '', lieu: '', montant: '', acompte: '', chauffeur: '', chauffeurId: '', programme: [], taches: [], commissions: [], devis: null, notes: cv.aiSummary || '', paiement: 'non', contrat: { statut: 'a_rediger', caution: '', cautionStatut: 'aucune', pieces: { permis: false, passeport: false, domicile: false }, edlDepart: { fait: false, km: '', carburant: 'Plein', notes: '' }, edlRetour: { fait: false, km: '', carburant: 'Plein', notes: '' } }, convId: cv.id, source: 'whatsapp', canal: 'WhatsApp', ...patch }, 'Créer la demande');
      router.push(`/mission/${id}`);
    }
  };
  const createClient = async () => {
    const id = 'c_' + Date.now().toString(36);
    await save('clients', { id, nom: cv.nom || cv.profil || fmtPhone(cv.id), tel, canal: 'WhatsApp', langue: L, statut: 'prospect', responsable: me?.id || 'amel' }, 'Créer la fiche');
    router.push(`/client/${id}`);
  };
  let day = '';
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View testID="screen-conv" style={{ flex: 1, paddingTop: ins.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line2 }}>
          <IconBtn name="left" accessibilityLabel="Retour aux conversations" border={false} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/messages'))} />
          <RoundPic name={nm} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 19, color: c.fg }}>{nm}</Text>
            <Sub numberOfLines={2}>{fmtPhone(cv.id)} · {L} · {open_ ? `fenêtre ouverte jusqu’à ${fmtUntil(cv.windowUntil)}` : 'fenêtre fermée'}</Sub>
          </View>
        </View>
        <View style={{ height: 59, backgroundColor: c.bg2, borderBottomWidth: 1, borderBottomColor: c.line2 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
          <Pill dark title="Appeler" icon="phone" testID="cv-tel" onPress={() => void open(telUrl(tel))} />
          <Pill title="WhatsApp" icon="wa" testID="cv-wa" onPress={() => void open(waUrl(tel))} />
          <Pill title={client ? 'Fiche client' : 'Créer la fiche'} icon="user" testID="cv-client" onPress={() => (client ? router.push(`/client/${client.id}`) : void createClient())} />
          <Pill title={m ? 'Demande' : 'Créer la demande'} icon="demandes" testID="cv-mission" onPress={() => (m ? router.push(`/mission/${m.id}`) : void applyAi())} />
        </ScrollView></View>
        <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10 }} keyboardShouldPersistTaps="handled">
          {(cv.aiSummary || aiRows.length) && aiOpen ? (
            <Panel testID="ai-card" style={{ marginBottom: 10, borderColor: c.accent }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="spark" size={13} color={c.accent} /><Label color={c.accent}>Analyse du Majordome</Label>
                <View style={{ flex: 1 }} />
                <Pressable accessibilityRole="button" accessibilityLabel="Réduire" onPress={() => setAiOpen(false)} hitSlop={8}><Icon name="close" size={14} color={c.fg3} /></Pressable>
              </View>
              {cv.aiSummary ? <Txt style={{ marginTop: 6 }}>{cv.aiSummary}</Txt> : null}
              {aiRows.length ? (
                <View style={{ marginTop: 8, gap: 3 }}>
                  {aiRows.map(([k, val]) => <View key={k} style={{ flexDirection: 'row', gap: 10 }}><Sub style={{ width: 80 }}>{k}</Sub><Txt style={{ flex: 1, fontSize: 13.5 }}>{val}</Txt></View>)}
                  <Btn small title={m ? 'Appliquer à la demande' : 'Créer la demande avec ces informations'} testID="ai-apply" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => void applyAi()} />
                </View>
              ) : null}
            </Panel>
          ) : null}
          {m ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/mission/${m.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 8, borderRadius: 10, borderWidth: 1, borderColor: c.line2, backgroundColor: c.panel }}>
              <Icon name="demandes" size={15} color={c.accent} /><Sub numberOfLines={1} style={{ flex: 1, color: c.fg2 }}>{m.titre}{v ? ` · ${v.nom}` : ''}{m.debut ? ` · ${fmtDT(m.debut)}` : ''}</Sub><Icon name="right" size={14} color={c.fg3} />
            </Pressable>
          ) : null}
          {msgs.length ? msgs.map((x) => {
            const d = parseDate(x.at); const k = d ? d.toDateString() : ''; const sep = k !== day; day = k;
            const quoted = x.replyTo ? byId(data.messages, x.replyTo) : null;
            return <React.Fragment key={x.id}>{sep ? <DaySep label={dayLabel(d)} /> : null}<Bubble m={x} quoted={quoted} testID={`msg-${x.id}`} /></React.Fragment>;
          }) : <Empty>Aucun message dans cette conversation.</Empty>}
        </ScrollView>
        <View style={{ paddingBottom: ins.bottom }}>
          <Composer convId={cv.id} lang={L} open={open_} firstName={qrName(data, cv)} mission={m} chauffeur={ch} client={client} vehiculeNom={v?.nom} serviceNom={m ? svcName(data, m.service) : undefined} aiDraft={cv.aiDraft} templates={templates}
            onSend={(payload, prev) => sendMessage(cv.id, payload, prev)} onNote={(t) => addNote(cv.id, t)} onError={(msg) => setToast(msg)}
            onAssign={(uid) => { void api('POST', '/api/whatsapp/assign', { convId: cv.id, assigne: uid }).catch((e) => setToast(e instanceof Error ? e.message : 'Transfert impossible.')); useStore.getState().upsert('conversations', { ...cv, assigne: uid as typeof cv.assigne }); }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
