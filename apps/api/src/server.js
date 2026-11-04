// Lancement : node src/server.js   (PORT=3000, HOST=0.0.0.0)
//   FAKE_DB=1   base en mémoire, PIN de démo 1234, WhatsApp simulé (/__dev/*)   ·   FAKE_AI=1 IA simulée
//   CRON_ENABLED=1  tâches de fond (rappels, alertes, tableau du lundi) — une seule instance
import { createApp } from './app.js';
import { getDb, dbConfigured } from './lib/db.js';
import { startCron } from './lib/cron.js';
import { VERSION } from './lib/version.js';

const fake = process.env.FAKE_DB === '1';
if (!fake && !dbConfigured()) {
  console.error('MONGODB_URI / MONGODB_DB absents : lancez avec FAKE_DB=1 pour une base en mémoire.');
  process.exit(1);
}
if (!fake && (process.env.AUTH_SECRET || '').length < 32) {
  console.error('AUTH_SECRET manquant ou trop court (32 caractères minimum).');
  process.exit(1);
}

const api = await createApp({ fake });
const port = await api.listen();
const host = process.env.HOST || '0.0.0.0';
console.log(`Amane API ${VERSION} — http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
console.log('  API : /api/health · WS : /ws · back-office : /app · CRM : /crm · site : /');
if (fake) {
  console.log('  base en mémoire (FAKE_DB=1) — les données disparaissent à l’arrêt');
  const pins = process.env.DEV_PINS ?? 'amel:1234,youssouf:1234,aziz:1234';
  console.log(pins === 'none' ? `  aucun PIN : créez-les avec le code d’installation « ${process.env.AMANE_SETUP_CODE} »` : `  PIN de démo : ${pins}`);
  if (process.env.__AMANE_FAKE_WA === '1') console.log('  WhatsApp simulé : POST /__dev/inbound {from, name, text|type…} · POST /__dev/status · GET /__dev/outbox · POST /__dev/clock');
  console.log(process.env.__AMANE_FAKE_AI === '1' ? '  IA simulée (FAKE_AI=1)' : process.env.ANTHROPIC_API_KEY ? '  IA réelle (ANTHROPIC_API_KEY)' : '  IA inactive (FAKE_AI=1 pour la simuler)');
} else {
  try { await getDb(); console.log('  base MongoDB prête'); } catch (e) { console.error('  base injoignable :', e && e.message); }
}
let cron = null;
if (process.env.CRON_ENABLED === '1') cron = startCron(getDb);

const stop = async (sig) => {
  console.log(`\n[amane] arrêt (${sig})…`);
  if (cron) cron.stop();
  await api.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
