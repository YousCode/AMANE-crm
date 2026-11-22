import type React from 'react';
/* Aide : prise en main en six étapes, qui fait quoi, outils de conciergerie (dont les prestataires), raccourcis, sauvegarde JSON. */
import { useNavigate } from 'react-router-dom';
import s from './Lists.module.css';
import { Icon } from '../components/Icon';
import { Av, teamOf } from '../components/ui';
import { useStore } from '../store/store';
import { useUI } from '../store/ui';
import { useData } from '../lib/hooks';
import { exportJSON } from '../lib/rules';
import { download, today } from '../lib/format';

export function Aide() {
  const user = useStore((x) => x.user); const put = useStore((x) => x.put); const D = useData(); const { openDrawer, setMj, setPlus, toast } = useUI(); const nav = useNavigate(); const me = teamOf(user?.id);
  function importJSON() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; let data: Record<string, unknown[]>; try { data = JSON.parse(await f.text()); } catch { toast('Fichier illisible : choisissez une sauvegarde Amane (.json).'); return; }
      const cols = ['clients', 'missions', 'vehicules', 'services', 'partenaires'] as const; if (!data || !cols.some((c) => Array.isArray(data[c]))) { toast('Ce fichier n’est pas une sauvegarde Amane.'); return; }
      const n = cols.reduce((t, c) => t + ((data[c] || []) as unknown[]).length, 0); if (!confirm(`Importer ${n} fiches dans la base de l’équipe ? Les fiches de même identifiant seront remplacées.`)) return;
      for (const c of cols) for (const o of (data[c] || []) as { id?: string }[]) { if (o && o.id) await put(c, o as never); } toast('Sauvegarde importée.'); };
    inp.click();
  }
  const steps: [string, string, React.ReactElement][] = [
    ['Connectez-vous', 'Chacun entre avec son prénom et son code personnel (4 à 8 chiffres). Sur téléphone, installez l’application sur l’écran d’accueil : appeler, écrire sur WhatsApp ou lancer l’itinéraire se fait en un geste depuis chaque fiche.', <button className="btn sm" type="button" onClick={() => setPlus(true)}>{me ? 'Connecté : ' + me.nom : 'Mon compte'}</button>],
    ['Répondez aux messages', 'Les WhatsApp des clients arrivent dans Messages, traduits en français sous l’original. Vous rédigez en français, l’aperçu traduit part dans la langue du client. Réponses rapides, brouillon du Majordome, notes internes pour passer la main à un collègue.', <button className="btn sm" type="button" onClick={() => nav('/messages')}>Ouvrir les messages</button>],
    ['Créez une demande', '« Nouvelle demande » en haut, ou le Majordome : collez le message du client, il crée la fiche client, la demande et un brouillon de réponse dans sa langue.', <><button className="btn sm" type="button" onClick={() => openDrawer('mission')}><Icon k="plus" />Nouvelle demande</button><button className="btn sm" type="button" onClick={() => setMj(true)}><Icon k="spark" />Majordome</button></>],
    ['Faites-la avancer', 'Dans Demandes, glissez la carte de colonne en colonne : Nouvelle → Proposition → Confirmée → En cours → Terminée (ou Perdue). Le Planning montre la voiture occupée et signale les doubles réservations en rouge. « À relancer » liste qui attend une réponse.', <button className="btn sm" type="button" onClick={() => nav('/demandes')}>Ouvrir les demandes</button>],
    ['Bouclez le dossier', 'Dès qu’une demande est confirmée, elle apparaît dans Contrats : contrat (à rédiger, envoyé, signé), pièces du client, caution, état des lieux au départ et au retour, paiement. Le devis s’envoie par lien : le client l’accepte d’un geste.', <button className="btn sm" type="button" onClick={() => nav('/contrats')}>Ouvrir les contrats</button>],
    ['Tenez la flotte à jour', 'Dans Flotte : photos de chaque voiture, « Qui est libre ? » sur une période, révisions, journal (entretiens, PV) et rentabilité par véhicule.', <button className="btn sm" type="button" onClick={() => nav('/flotte')}>Ouvrir la flotte</button>],
  ];
  const roles: [string, string][] = [['amel', 'Répond aux demandes et aux messages, relance les propositions, tient les fiches clients et les goûts de chacun.'], ['youssouf', 'Attribue les véhicules, prépare les départs, suit révisions, photos, journal et doubles réservations. Valide les prestataires et leurs véhicules.'], ['aziz', 'Contrats, pièces d’identité, cautions, états des lieux, encaissement des soldes, finances.']];
  return <>
    <div className="view-h"><div><div className="label">Prise en main</div><h2>Comment fonctionne le CRM</h2></div></div>
    <div className={s.aide}>
      <div className="panel pad"><div className="panel-h"><h2>En six étapes</h2><span className="sub">du message à la remise des clés</span></div><div className={s.steps}>{steps.map((x, i) => <div key={i} className={s.stA}><span className={s.n}>{i + 1}</span><div><h3>{x[0]}</h3><p>{x[1]}</p><div className={s.go}>{x[2]}</div></div></div>)}</div></div>
      <div className="stack">
        <div className="panel pad"><div className="panel-h"><h2>Qui fait quoi</h2><span className="sub">l’onglet « À faire » suit ce partage</span></div>{roles.map(([id, d]) => { const t = teamOf(id)!; return <div key={id} className={s.who}><Av id={id} /><div><b>{t.nom} · {t.role}</b><span>{d}</span></div></div>; })}</div>
        <div className="panel pad"><div className="panel-h"><h2>Outils de conciergerie</h2><span className="sub">dans chaque fiche demande</span></div>
          <div className={s.facts}>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Devis & facture</b> : numéro D-année-0001 automatique, envoi par lien au client, transformation en facture, règlements. Le statut de paiement suit tout seul.</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Programme</b> : les étapes du séjour, envoyées sur WhatsApp ou en carnet dans la langue du client (FR, EN, ES, AR), et l’espace client en ligne.</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Carnet</b> : chauffeurs, restaurants, hôtels, boutiques, garages. Un chauffeur pris deux fois apparaît en rouge dans le Planning. Les commissions se notent dans le devis.</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Prestataires</b> (Youssouf) : un loueur s’inscrit sur la page « Devenir prestataire », ou se crée dans le Carnet (type Loueur). L’inscription se valide dans le Carnet : son lien personnel est créé, à lui envoyer par WhatsApp. Avec ce lien, sans mot de passe, il déclare ses véhicules et ses jours libres. Dans une demande, choisissez son véhicule puis « Demander la dispo » : sa réponse et la marge s’affichent dans la fiche.</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Tâches</b> : une checklist par demande, avec un modèle par service ; chaque tâche arrive dans « À faire » de son responsable.</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Journal de flotte</b> (Youssouf) : entretiens, dommages, coûts, échéances. Pour un PV, la date suffit : le conducteur à désigner est retrouvé, et Aziz le voit dans « À faire ».</span></div>
            <div><i>·</i><span><b style={{ fontWeight: 500, color: 'var(--fg)' }}>Finances</b> (Aziz) : facturé, encaissé, factures en retard, commissions, coûts de la flotte, export CSV.</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button className="btn sm" type="button" onClick={() => download(`amane-sauvegarde-${today()}.json`, exportJSON(D))}><Icon k="down" />Sauvegarder toutes les données (JSON)</button><button className="btn sm ghost" type="button" onClick={importJSON}><Icon k="up" />Importer une sauvegarde</button></div></div>
        <div className="panel pad"><div className="panel-h"><h2>Raccourcis</h2></div><ul className={s.kb}><li><kbd>⌘K</kbd><kbd>Ctrl K</kbd>chercher un client, une demande, une voiture, ou lancer une action</li><li><kbd>Échap</kbd>fermer une fiche ou une fenêtre</li><li><kbd>Entrée</kbd>dans le fil : envoyer le message (Maj + Entrée pour une nouvelle ligne)</li></ul></div>
        <div className="panel pad"><div className="panel-h"><h2>Ce qui est enregistré</h2><span className="sub">base partagée, en direct</span></div><div className={s.facts}>
          <div><i>·</i><span>Clients, demandes, devis, carnet, flotte, services, conversations et photos sont dans une base commune. Ce que l’un modifie apparaît chez les autres aussitôt.</span></div>
          <div><i>·</i><span>Seuls Amel, Youssouf et Aziz, connectés avec leur code, voient les données. Hors connexion, vos modifications attendent sur le téléphone et partent au retour du réseau.</span></div>
          <div><i>·</i><span>Le Majordome et les traductions passent par le serveur Amane : rien n’est envoyé seul au client.</span></div>
        </div></div>
      </div>
    </div>
  </>;
}
