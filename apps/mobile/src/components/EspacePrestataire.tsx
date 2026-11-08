import React, { useCallback, useEffect, useState } from 'react';
import { View, Share, Platform } from 'react-native';
import { firstName, type EspacePrestataireInfo } from '@amane/shared';
import { useTheme } from '@/theme';
import { api, ApiError } from '@/lib/api';
import { relTime, fmtDT } from '@/lib/format';
import { waUrl, open } from '@/lib/links';
import { Panel, Txt, Sub, Label, Btn, Chip, Mono } from '@/components/ui';

/* Espace prestataire d'un partenaire : lien personnel sans compte (créer, envoyer, renouveler, révoquer)
   et missions confiées, avec la confirmation notée par l'équipe si le prestataire a confirmé de vive voix. */
export function EspacePrestataire({ pid, nom, contact, tel, onToast }: { pid: string; nom: string; contact?: string; tel?: string; onToast: (t: string) => void }) {
  const { c } = useTheme();
  const [info, setInfo] = useState<EspacePrestataireInfo | null>(null); const [busy, setBusy] = useState(false); const [ask, setAsk] = useState<'' | 'renew' | 'revoke'>(''); const [err, setErr] = useState('');
  const load = useCallback(() => api<EspacePrestataireInfo>('GET', `/api/partenaires/${encodeURIComponent(pid)}/espace`).then((r) => { setInfo(r); setErr(''); }).catch((e) => setErr(e instanceof ApiError ? e.message : 'Espace indisponible.')), [pid]);
  useEffect(() => { void load(); }, [load]);
  const run = async (f: () => Promise<unknown>, ok: string) => { setBusy(true); try { await f(); onToast(ok); setAsk(''); } catch (e) { onToast(e instanceof ApiError ? e.message : 'Impossible pour l’instant.'); } finally { setBusy(false); void load(); } };
  const prenom = firstName(contact || nom);
  const message = info?.url ? `Bonjour${prenom ? ' ' + prenom : ''}, voici votre espace prestataire Amane : vos missions et les disponibilités de notre flotte, à jour en temps réel. ${info.url}` : '';
  const envoyer = async () => { const w = waUrl(tel, message); if (w) await open(w); else if (Platform.OS !== 'web') await Share.share({ message }); else onToast(info?.url || ''); };

  if (!info) return <Sub>{err || 'Chargement…'}</Sub>;
  return (
    <View style={{ gap: 12 }}>
      <Panel testID="espace-prestataire" style={{ gap: 10 }}>
        <Label>Lien personnel</Label>
        {info.actif && info.url ? <>
          <Mono numberOfLines={1} style={{ fontSize: 12, color: c.fg2 }}>{info.url}</Mono>
          <Sub>Créé {relTime(info.createdAt)} · {info.vues ? `ouvert ${info.vues} fois, dernière fois ${relTime(info.vuAt)}` : 'pas encore ouvert'}</Sub>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn small kind="primary" icon="wa" title="Envoyer le lien" testID="espace-envoyer" onPress={() => void envoyer()} />
            <Btn small icon="link" title="Ouvrir" onPress={() => void open(info.url!)} />
            {ask === 'renew' ? <Btn small kind="gold" title="Confirmer : nouveau lien" disabled={busy} onPress={() => void run(() => api('POST', `/api/partenaires/${encodeURIComponent(pid)}/espace`, { renouveler: true }), 'Nouveau lien : l’ancien ne fonctionne plus')} /> : <Btn small kind="ghost" title="Nouveau lien" onPress={() => setAsk('renew')} />}
            {ask === 'revoke' ? <Btn small kind="danger" title="Confirmer la révocation" testID="espace-revoquer-oui" disabled={busy} onPress={() => void run(() => api('DELETE', `/api/partenaires/${encodeURIComponent(pid)}/espace`), 'Lien révoqué')} /> : <Btn small kind="ghost" title="Révoquer" testID="espace-revoquer" onPress={() => setAsk('revoke')} />}
          </View>
        </> : <>
          <Sub style={{ color: c.fg2 }}>{nom} verra les missions confiées (date, lieu, prénom du client, véhicule) et les disponibilités de la flotte, sans compte ni mot de passe. Jamais de montants ni de téléphones de clients.</Sub>
          <Btn small kind="primary" icon="link" title="Créer le lien" testID="espace-creer" disabled={busy} style={{ alignSelf: 'flex-start' }} onPress={() => void run(() => api('POST', `/api/partenaires/${encodeURIComponent(pid)}/espace`), 'Lien de l’espace créé')} />
        </>}
      </Panel>
      <Panel style={{ gap: 10 }}>
        <Label>Missions confiées</Label>
        {info.missions.length ? info.missions.map((m) => (
          <View key={m.id} style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: c.line2, paddingBottom: 10 }}>
            <Txt style={{ fontSize: 15 }}>{m.titre || 'Mission'}</Txt>
            <Sub>{fmtDT(m.debut)}</Sub>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {m.confirmeeAt ? <Chip small text="Confirmée" color={c.ok} /> : <Chip small text="À confirmer" color={c.warn} />}
              {m.confirmeeAt ? null : <Btn small title="Noter confirmée" testID={`confirmer-${m.id}`} disabled={busy} onPress={() => void run(() => api('POST', `/api/missions/${encodeURIComponent(m.id)}/confirmation`, { partenaireId: pid }), 'Confirmation notée')} />}
            </View>
          </View>
        )) : <Sub>Aucune mission ferme à venir.</Sub>}
      </Panel>
    </View>
  );
}
