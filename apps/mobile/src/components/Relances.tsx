import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { RELANCE_TYPES, telNorm, type Relance, type RelanceEnvoi } from '@amane/shared';
import { useTheme } from '@/theme';
import { api, ApiError } from '@/lib/api';
import { relTime, fmtDayLong } from '@/lib/format';
import { waUrl, open } from '@/lib/links';
import { Panel, Txt, Sub, Label, Btn, Chip, Empty, Seg, Input } from '@/components/ui';
import { TEAM } from '@amane/shared';

/* Relances : vue unique calculée par le serveur, relance WhatsApp en un geste (fenêtre de 24 h ou modèle approuvé),
   « Noter » une relance faite ailleurs ; une relance faite reste bloquée pendant son délai (jamais deux fois). */

export const relanceLabel = (type: string) => RELANCE_TYPES.find((x) => x.id === type)?.court || (type === 'rappel' ? 'Rappel automatique' : type);
const who = (id: string) => (id === 'rappel' ? 'le rappel automatique' : TEAM.find((t) => t.id === id)?.nom || id);
const CANAL: Record<string, string> = { texte: 'WhatsApp', modele: 'modèle approuvé', manuel: 'hors CRM', rappel: 'rappel automatique' };
export const derniereTxt = (d?: RelanceEnvoi | null) => (d ? `Relancé ${relTime(d.at)} par ${who(d.by)} · ${CANAL[d.canal] || d.canal}` : '');

export function RelancesList({ onToast }: { onToast: (t: string) => void }) {
  const { c } = useTheme();
  const [items, setItems] = useState<Relance[] | null>(null); const [vue, setVue] = useState<'afaire' | 'faites'>('afaire');
  const [busy, setBusy] = useState(''); const [edit, setEdit] = useState<Record<string, string>>({}); const [waOff, setWaOff] = useState(false); const [err, setErr] = useState('');
  const load = useCallback(() => api<{ items: Relance[] }>('GET', '/api/relances').then((r) => { setItems(r.items || []); setErr(''); }).catch((e) => { setErr(e instanceof ApiError ? e.message : 'Relances indisponibles.'); setItems((x) => x || []); }), []);
  useEffect(() => { void load(); }, [load]);
  const all = items || []; const afaire = all.filter((x) => !x.bloqueeJusqua); const faites = all.filter((x) => x.bloqueeJusqua);
  const list = vue === 'afaire' ? afaire : faites;

  const relancer = async (x: Relance) => {
    setBusy(x.key);
    try {
      const r = await api<{ canal: string }>('POST', '/api/relances/envoyer', { key: x.key, ...(edit[x.key] !== undefined ? { texte: edit[x.key] } : {}) });
      onToast(r.canal === 'modele' ? `Relance envoyée à ${x.nom} (modèle approuvé)` : `Relance envoyée à ${x.nom}`);
      setEdit((o) => { const n = { ...o }; delete n[x.key]; return n; });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'whatsapp_off') { setWaOff(true); onToast('WhatsApp n’est pas relié : envoyez depuis votre téléphone puis notez la relance.'); }
      else onToast(e instanceof ApiError ? e.message : 'Envoi impossible.');
    } finally { setBusy(''); void load(); }
  };
  const noter = async (x: Relance) => {
    setBusy(x.key);
    try { await api('POST', '/api/relances/marquer', { key: x.key }); onToast(`Relance notée pour ${x.nom}`); }
    catch (e) { onToast(e instanceof ApiError ? e.message : 'Impossible pour l’instant.'); }
    finally { setBusy(''); void load(); }
  };

  return (
    <View>
      <Seg value={vue} onChange={setVue} style={{ marginBottom: 12 }} options={[{ id: 'afaire', label: 'À faire', n: afaire.length }, { id: 'faites', label: 'Relancées', n: faites.length }]} />
      {err ? <Sub style={{ color: c.warn, marginBottom: 10 }}>{err}</Sub> : null}
      {waOff ? <Panel style={{ borderColor: c.warn, marginBottom: 10 }}><Sub style={{ color: c.fg2 }}>WhatsApp n’est pas relié au serveur. Ouvrez WhatsApp avec le bouton dédié, puis « Noter » pour garder la trace et ne pas relancer deux fois.</Sub></Panel> : null}
      {!items ? <Empty>Calcul…</Empty> : list.length ? list.map((x) => {
        const txt = edit[x.key] ?? x.messageSuggere; const bloq = !!x.bloqueeJusqua; const tel = telNorm(x.tel);
        return (
          <Panel key={x.key} testID={`relance-${x.key}`} style={{ marginBottom: 10, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Txt style={{ fontSize: 16 }}>{x.nom || 'Client'}</Txt>
              <Chip small text={relanceLabel(x.type)} color={c.accent} dot={false} />
              {x.cible === 'prestataire' ? <Chip small text="Prestataire" dot={false} /> : null}
            </View>
            <Sub>{x.raison}</Sub>
            {edit[x.key] !== undefined && !bloq
              ? <Input value={txt} onChangeText={(v) => setEdit((o) => ({ ...o, [x.key]: v }))} multiline accessibilityLabel="Message de relance" testID="relance-texte" />
              : <View style={{ borderLeftWidth: 2, borderLeftColor: c.accent, paddingLeft: 10 }}><Sub style={{ color: c.fg2 }}>{txt}</Sub></View>}
            {x.derniere ? <Label>{derniereTxt(x.derniere)}{bloq ? ` · à nouveau le ${fmtDayLong(x.bloqueeJusqua)}` : ''}</Label> : null}
            {!bloq ? <Label color={c.fg3}>{x.fenetre ? 'Fenêtre de 24 h ouverte : message libre' : 'Hors fenêtre : modèle approuvé « amane_relance »'}</Label> : null}
            {bloq ? <Chip small text="Relancé" color={c.ok} /> : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tel ? <Btn small kind="primary" icon="wa" title={busy === x.key ? 'Envoi…' : 'Relancer'} disabled={busy === x.key} testID={`relancer-${x.key}`} onPress={() => void relancer(x)} /> : <Sub>Pas de numéro</Sub>}
                {x.fenetre ? (edit[x.key] === undefined ? <Btn small kind="ghost" title="Modifier" onPress={() => setEdit((o) => ({ ...o, [x.key]: x.messageSuggere }))} /> : <Btn small kind="ghost" title="Annuler" onPress={() => setEdit((o) => { const n = { ...o }; delete n[x.key]; return n; })} />) : null}
                {waOff && tel ? <Btn small icon="wa" title="WhatsApp" onPress={() => void open(waUrl(x.tel, txt))} /> : null}
                <Btn small kind="ghost" title="Noter" testID={`noter-${x.key}`} disabled={busy === x.key} onPress={() => void noter(x)} />
              </View>
            )}
          </Panel>
        );
      }) : <Empty>{vue === 'faites' ? 'Aucune relance faite ces derniers jours.' : 'Rien à relancer. Beau travail.'}</Empty>}
    </View>
  );
}

/** Relances d'une fiche : q = « clientId=… », « missionId=… » ou « partenaireId=… ». */
export function RelancesHist({ q }: { q: string }) {
  const { c } = useTheme(); const [items, setItems] = useState<RelanceEnvoi[] | null>(null);
  useEffect(() => { let on = true; api<{ items: RelanceEnvoi[] }>('GET', '/api/relances/historique?' + q).then((r) => { if (on) setItems(r.items || []); }).catch(() => { if (on) setItems([]); }); return () => { on = false; }; }, [q]);
  if (!items) return <Sub>Chargement…</Sub>;
  if (!items.length) return <Sub>Aucune relance pour l’instant.</Sub>;
  return <View style={{ gap: 8 }}>{items.map((r) => <View key={r.id} style={{ borderBottomWidth: 1, borderBottomColor: c.line2, paddingBottom: 8 }}><Txt style={{ fontSize: 14 }}>{relanceLabel(r.type)} · {r.statut === 'echec' ? 'échec' : CANAL[r.canal] || r.canal}</Txt><Sub>{relTime(r.at)} · {who(r.by)}</Sub></View>)}</View>;
}
