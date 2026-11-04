// Tâches de fond (node-cron, une seule instance) : rappels toutes les 10 min, alertes toutes les heures,
// tableau du lundi 8 h 30 (Paris). Activées par CRON_ENABLED=1.
import cron from 'node-cron';
import { runRappels } from './rappels.js';
import { runAlerts } from './alerts.js';
import { sendDigest } from './digest.js';

export function startCron(getDb, { log = console.log } = {}) {
  const jobs = [];
  const safe = (label, fn) => async () => {
    try { const r = await fn(await getDb()); log(`[amane] cron ${label}`, JSON.stringify(r).slice(0, 300)); } catch (e) { console.error(`[amane] cron ${label}`, e && e.message); }
  };
  jobs.push(cron.schedule('*/10 * * * *', safe('rappels', (db) => runRappels(db)), { timezone: 'Europe/Paris' }));
  jobs.push(cron.schedule('7 * * * *', safe('alertes', (db) => runAlerts(db)), { timezone: 'Europe/Paris' }));
  jobs.push(cron.schedule('30 8 * * 1', safe('digest', (db) => sendDigest(db)), { timezone: 'Europe/Paris' }));
  log('[amane] tâches de fond actives : rappels (10 min), alertes (1 h), tableau du lundi (lun. 8 h 30 Paris)');
  return { stop() { for (const j of jobs) j.stop(); } };
}
