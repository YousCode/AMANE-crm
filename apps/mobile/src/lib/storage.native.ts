import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/* Stockage hors ligne (appareil) : cache des données synchronisées + file d'attente des écritures. */
let db: SQLiteDatabase | null = null;
function open(): SQLiteDatabase {
  if (db) return db;
  db = openDatabaseSync('amane.db');
  db.execSync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY NOT NULL, v TEXT NOT NULL);');
  return db;
}

export const storage = {
  get(k: string): string | null {
    try { const r = open().getAllSync<{ v: string }>('SELECT v FROM kv WHERE k = ?', k); return r.length ? r[0].v : null; } catch { return null; }
  },
  set(k: string, v: string | null): void {
    try {
      if (v == null) open().runSync('DELETE FROM kv WHERE k = ?', k);
      else open().runSync('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, v);
    } catch { /* disque plein, base verrouillée… l'appli continue en mémoire */ }
  },
  clear(): void { try { open().runSync('DELETE FROM kv'); } catch { /* ignore */ } },
};
