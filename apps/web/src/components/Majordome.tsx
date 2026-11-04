/* Majordome : colle un message reçu → fiche client, demande et brouillon de réponse (via /api/ai). */
import { useState } from 'react';
import s from './Modal.module.css';
import { Icon } from './Icon';
import { useUI } from '../store/ui';
import { useStore } from '../store/store';
import { api, type ApiError } from '../lib/api';
import { fmtE, fmtDT, parse, copyText } from '../lib/format';
import { useData } from '../lib/hooks';
import { services, svcName, vehicles, blank } from '../lib/rules';
import { LANGUES } from '../shared';

interface Res { client: Record<string, string>; mission: Record<string, string | number>; priorite: string; reponse: string }
export const aiPrompt = (D: ReturnType<typeof useData>, text: string) => `Tu es l'assistant de la conciergerie de luxe Amane à Paris. Aujourd'hui : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Europe/Paris).
Analyse le message client ci-dessous et réponds UNIQUEMENT par un objet JSON de cette forme :
{"client":{"nom":"","tel":"","email":"","langue":"FR|EN|AR|RU|ZH|ES|IT|DE","pays":"","hotel":""},"mission":{"titre":"titre court","service":"un id parmi la liste","vehicule":"nom du véhicule demandé ou vide","debut":"YYYY-MM-DDTHH:MM ou vide","fin":"YYYY-MM-DDTHH:MM ou vide","lieu":"","budget":0,"notes":"détails utiles"},"priorite":"haute|normale|basse","reponse":"brouillon de réponse dans la langue du client"}
Services (id = nom) : ${services(D.services).map((x) => `${x.id} = ${x.nom}`).join('; ')}. Véhicules de la flotte : ${vehicles(D.vehicules).map((v) => v.nom).join(', ') || 'aucun'}.
Règles : n'invente aucune information absente du message (laisse vide). Dates relatives résolues par rapport à aujourd'hui. La réponse : vouvoiement, sobre et chaleureuse, signée « Amane », sans annoncer de prix, propose un échange pour confirmer les détails.
Message client :
"""${text}"""`;

export function Majordome() {
  const { mj, mjText, setMj, openDrawer, toast } = useUI(); const D = useData(); const put = useStore((x) => x.put); const user = useStore((x) => x.user); const health = useStore((x) => x.health);
  const [busy, setBusy] = useState(false); const [res, setRes] = useState<Res | null>(null); const [err, setErr] = useState('');
  if (!mj) return null;
  const iaOff = health?.ia === false;
  async function run() {
    if (!mjText.trim()) { toast('Collez d’abord un message.'); return; } setBusy(true); setErr(''); setRes(null);
    try { const r = await api<{ text: string }>('POST', '/api/ai', { messages: [{ role: 'user', content: aiPrompt(D, mjText) + '\n\nRéponds uniquement par l’objet JSON, sans texte autour ni balise de code.' }], max_tokens: 1500 }); const m = String(r.text || '').match(/\{[\s\S]*\}/); if (!m) throw { code: 'bad_json' }; const j = JSON.parse(m[0]); setRes({ client: j.client || {}, mission: j.mission || {}, priorite: j.priorite || '', reponse: j.reponse || '' }); }
    catch (e) { const x = e as ApiError; setErr(x.code === 'ia_off' || x.status === 503 ? 'Le Majordome n’est pas activé sur le serveur (clé IA absente).' : x.code === 'offline' ? 'Hors ligne : le Majordome a besoin de la connexion.' : x.status === 429 ? 'Trop de demandes : réessayez dans une minute.' : 'Analyse impossible. Réessayez avec un message plus court.'); }
    finally { setBusy(false); }
  }
  async function create() {
    if (!res) return; const tel = String(res.client.tel || '').replace(/\D/g, '');
    let c = D.clients.find((x) => tel && String(x.tel || '').replace(/\D/g, '').endsWith(tel.slice(-8))) || D.clients.find((x) => res.client.nom && x.nom && x.nom.toLowerCase() === String(res.client.nom).toLowerCase());
    let cid = c?.id;
    if (!cid) cid = await put('clients', { ...blank('client', user?.id || 'amel'), nom: res.client.nom || 'Client à identifier', tel: res.client.tel || '', email: res.client.email || '', langue: (LANGUES as readonly string[]).includes(res.client.langue) ? res.client.langue : 'FR', pays: res.client.pays || '', hotel: res.client.hotel || '' });
    const v = vehicles(D.vehicules).find((x) => res.mission.vehicule && x.nom.toLowerCase().includes(String(res.mission.vehicule).toLowerCase().split(' ')[0]));
    const svcOk = services(D.services).some((x) => x.id === res.mission.service);
    const m: Record<string, unknown> = { ...blank('mission', user?.id || 'amel'), titre: res.mission.titre || '', clientId: cid, service: svcOk ? res.mission.service : 'conciergerie', vehiculeId: v ? v.id : '', lieu: res.mission.lieu || '', montant: +res.mission.budget || '', notes: [res.mission.notes, res.priorite ? 'Urgence : ' + res.priorite : '', 'Message d’origine :\n' + mjText].filter(Boolean).join('\n\n') };
    if (parse(String(res.mission.debut))) m.debut = res.mission.debut; if (parse(String(res.mission.fin))) m.fin = res.mission.fin;
    const id = await put('missions', m); setMj(false, ''); setRes(null); openDrawer('mission', id, 'main', { aiDraft: res.reponse });
  }
  const rows = (o: [string, unknown][]) => o.filter((x) => x[1]).map(([a, b]) => <div key={a} style={{ display: 'contents' }}><dt>{a}</dt><dd>{String(b)}</dd></div>);
  return (
    <div className={s.modal} onClick={(e) => { if (e.target === e.currentTarget) setMj(false); }}>
      <div className={s.box} role="dialog" aria-modal="true" aria-labelledby="mjTitle">
        <div className={s.body}>
          <div className={s.h}><span className={`${s.orb} ${busy ? s.busy : ''}`} /><div><h2 id="mjTitle">Majordome</h2><div className="muted" style={{ fontSize: 13 }}>Collez un message reçu (WhatsApp, e-mail, Instagram). Il en tire la fiche client, la demande et un brouillon de réponse.</div></div><button className="btn sm ghost" type="button" onClick={() => setMj(false)} style={{ marginLeft: 'auto' }} aria-label="Fermer"><Icon k="close" /></button></div>
          <div className="f"><label htmlFor="mjIn">Message reçu</label><textarea id="mjIn" style={{ minHeight: 130 }} value={mjText} onChange={(e) => setMj(true, e.target.value)} placeholder="Ex. Bonjour, je serai à Paris du 12 au 15 avec ma famille au Plaza, nous aimerions un van avec chauffeur et un G 63 pour le samedi soir…" /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><button className="btn sm primary" type="button" onClick={run} disabled={busy || iaOff}><Icon k="spark" />{busy ? 'Analyse en cours…' : 'Analyser'}</button>{iaOff && <span className="muted">Le Majordome n’est pas activé sur le serveur (clé IA absente).</span>}</div>
          {err && <div className="warn-box"><Icon k="alert" /><span>{err}</span></div>}
          {res && <>
            <div className={s.res}>
              <div className={s.card}><div className="label">Client</div><dl>{rows([['Nom', res.client.nom], ['Téléphone', res.client.tel], ['E-mail', res.client.email], ['Langue', res.client.langue], ['Pays', res.client.pays], ['Hôtel', res.client.hotel]])}</dl></div>
              <div className={s.card}><div className="label">Demande</div><dl>{rows([['Titre', res.mission.titre], ['Service', svcName(D.services, String(res.mission.service))], ['Véhicule', res.mission.vehicule], ['Début', res.mission.debut && fmtDT(parse(String(res.mission.debut)))], ['Fin', res.mission.fin && fmtDT(parse(String(res.mission.fin)))], ['Lieu', res.mission.lieu], ['Budget', res.mission.budget && fmtE(res.mission.budget)], ['Urgence', res.priorite]])}</dl></div>
            </div>
            {res.reponse && <div className={s.card} style={{ padding: 14 }}><div className="label">Brouillon de réponse</div><div className={s.reply} dir="auto" style={{ marginTop: 8 }}>{res.reponse}</div></div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn sm gold" type="button" onClick={create}>Créer la fiche et la demande</button>{res.reponse && <button className="btn sm" type="button" onClick={() => copyText(res.reponse).then((ok) => toast(ok ? 'Copié' : 'Copie impossible'))}><Icon k="copy" />Copier la réponse</button>}</div>
          </>}
        </div>
      </div>
    </div>
  );
}
