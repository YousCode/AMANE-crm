import React, { useState } from 'react';
import { View, Switch } from 'react-native';
import { useStore } from '@/store';
import { useTheme } from '@/theme';
import { Screen, Panel, Label, Sub, Txt, Seg, Btn, Input } from '@/components/ui';
import { API_URL, MOCK_MODE } from '@/lib/api';
import { registerPush } from '@/lib/push';

export default function Reglages() {
  const { c } = useTheme();
  const prefs = useStore((s) => s.prefs); const setPrefs = useStore((s) => s.setPrefs); const data = useStore((s) => s.data); const save = useStore((s) => s.save); const setToast = useStore((s) => s.setToast);
  const general = (data.reglages.find((r: any) => r.id === 'general') || { id: 'general', autoReply: true, horaires: { debut: '09:00', fin: '21:00' }, fuseau: 'Europe/Paris' }) as any;
  const rappels = (data.reglages.find((r: any) => r.id === 'rappels') || { id: 'rappels', veille: true, merci: true, acompte: true }) as any;
  const [g, setG] = useState(general);
  const row = (label: string, sub: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1 }}><Txt>{label}</Txt><Sub>{sub}</Sub></View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.fg, false: c.line }} thumbColor={c.bg} />
    </View>
  );
  return (
    <Screen testID="screen-reglages" title="Réglages" eyebrow="Cet appareil et la maison" back>
      <Panel style={{ gap: 8, marginBottom: 12 }}>
        <Label>Apparence</Label>
        <Seg value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[{ id: 'auto', label: 'Automatique' }, { id: 'light', label: 'Clair' }, { id: 'dark', label: 'Sombre' }]} />
        {row('Retour haptique', 'Vibration légère sur les actions principales', prefs.haptics, (haptics) => setPrefs({ haptics }))}
        {row('Rôle client (test)', 'Affiche l’écran « Espace client » dans Plus', prefs.roleClient, (roleClient) => setPrefs({ roleClient }))}
      </Panel>
      <Panel style={{ gap: 8, marginBottom: 12 }}>
        <Label>Réponse automatique WhatsApp</Label>
        {row('Activée', 'Une fois par 12 h, dans la langue du client', !!g.autoReply, (autoReply) => setG({ ...g, autoReply }))}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Input style={{ flex: 1 }} label="Journée dès" value={g.horaires?.debut || ''} onChangeText={(v) => setG({ ...g, horaires: { ...g.horaires, debut: v } })} />
          <Input style={{ flex: 1 }} label="Nuit dès" value={g.horaires?.fin || ''} onChangeText={(v) => setG({ ...g, horaires: { ...g.horaires, fin: v } })} />
        </View>
        <Sub>Les textes par langue se modifient depuis le back-office.</Sub>
        <Btn small kind="primary" title="Enregistrer" style={{ alignSelf: 'flex-start' }} onPress={() => save('reglages', g, 'Réglages').then(() => setToast('Réglages enregistrés.')).catch((e) => setToast(e.message))} />
      </Panel>
      <Panel style={{ gap: 4, marginBottom: 12 }}>
        <Label>Rappels automatiques</Label>
        {row('Veille de mission', 'J-1 à 18 h, Paris', rappels.veille !== false, (v) => void save('reglages', { ...rappels, veille: v }, 'Rappels'))}
        {row('Remerciement', 'J+1 à 10 h', rappels.merci !== false, (v) => void save('reglages', { ...rappels, merci: v }, 'Rappels'))}
        {row('Relance d’acompte', 'J-3 si l’acompte n’est pas reçu', rappels.acompte !== false, (v) => void save('reglages', { ...rappels, acompte: v }, 'Rappels'))}
      </Panel>
      <Panel style={{ gap: 8 }}>
        <Label>Notifications et serveur</Label>
        <Sub>Serveur : {MOCK_MODE ? 'démonstration intégrée' : API_URL}</Sub>
        <Btn small title="Réactiver les notifications" style={{ alignSelf: 'flex-start' }} onPress={() => registerPush().then((t) => setToast(t ? 'Notifications activées.' : 'Notifications indisponibles sur cet appareil.'))} />
      </Panel>
    </Screen>
  );
}
