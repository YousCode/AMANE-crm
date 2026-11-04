// GET /api/meteo : session requise, Open-Meteo mis en forme et en cache, 503 propre si indisponible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, fresh, login } from './helpers.js';
import { describe as wmo, conseil, resetMeteoCache, fakeMeteoPayload } from '../src/lib/meteo.js';

test('codes WMO et conseils', () => {
  assert.deepEqual(wmo(0, 1), { label: 'Ciel dégagé', icon: 'soleil' });
  assert.deepEqual(wmo(0, 0), { label: 'Nuit claire', icon: 'lune' });
  assert.equal(wmo(63, 1).label, 'Pluie');
  assert.equal(wmo(95, 1).icon, 'orage');
  assert.match(conseil({ code: 0, tempMax: 18, pluieProba: 5, vent: 10 }), /décapotée/);
  assert.match(conseil({ code: 3, tempMax: 10, pluieProba: 80, vent: 10 }), /Pluie probable/);
  assert.match(conseil({ code: 3, tempMax: 2, pluieProba: 0, vent: 10 }), /Froid/);
});

test('GET /api/meteo : 401 sans session, puis météo mise en forme et en cache', async () => {
  fresh();
  resetMeteoCache();
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://api.open-meteo.com/')) { calls++; return new Response(JSON.stringify(fakeMeteoPayload()), { status: 200, headers: { 'content-type': 'application/json' } }); }
    return realFetch(input, init);
  };
  try {
    const anon = await fetch(BASE + '/api/meteo');
    assert.equal(anon.status, 401);
    const cookie = await login('amel');
    const r = await fetch(BASE + '/api/meteo', { headers: { cookie } });
    assert.equal(r.status, 200);
    const m = await r.json();
    assert.equal(m.ville, 'Paris');
    assert.equal(m.actuel.temp, 13);
    assert.equal(m.actuel.label, 'Éclaircies');
    assert.equal(m.aujourdhui.max, 15);
    assert.equal(m.demain.label, 'Pluie');
    assert.equal(m.heures.length, 12);
    assert.ok(m.aujourdhui.lever && m.aujourdhui.coucher);
    assert.ok(typeof m.conseil === 'string' && m.conseil.length > 10);
    assert.equal(m.cache, false);
    const r2 = await fetch(BASE + '/api/meteo', { headers: { cookie } });
    assert.equal((await r2.json()).cache, true);
    assert.equal(calls, 1, 'une seule requête Open-Meteo grâce au cache');
  } finally { globalThis.fetch = realFetch; }
});

test('GET /api/meteo : 503 meteo_off si Open-Meteo est injoignable et rien en cache', async () => {
  fresh();
  resetMeteoCache();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const url = String(input); if (url.startsWith('https://api.open-meteo.com/')) throw new Error('réseau'); return realFetch(input, init); };
  try {
    const cookie = await login('amel');
    const r = await fetch(BASE + '/api/meteo', { headers: { cookie } });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'meteo_off');
  } finally { globalThis.fetch = realFetch; }
});
