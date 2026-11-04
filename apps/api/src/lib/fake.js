// Mode développement et tests manuels (FAKE_DB=1) : WhatsApp, IA, Whisper et Expo simulés par un faux `fetch`.
import { randomBytes } from 'node:crypto';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60, 1)]);

/** Remplace fetch pour graph.facebook.com, api.anthropic.com (FAKE_AI=1), api.openai.com et exp.host. Idempotent. */
export function installFakeFetch(outbox) {
  const real = globalThis.fetch;
  if (real.__amaneFake) return;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fakeFetch = async (input, init = {}) => {
    const url = String(input && input.url ? input.url : input);
    if (process.env.__AMANE_FAKE_WA === '1' && url.startsWith('https://graph.facebook.com/')) {
      const m = /graph\.facebook\.com\/v[\d.]+\/([^/?]+)(\/messages|\/media)?/.exec(url);
      if (m && m[2] === '/messages') {
        let body = null;
        try { body = JSON.parse(init.body); } catch { body = init.body; }
        if (body && body.status === 'read') { outbox.push({ at: new Date().toISOString(), url, body, kind: 'read' }); return json({ success: true }); }
        const id = 'wamid.DEVOUT' + randomBytes(10).toString('hex');
        outbox.push({ at: new Date().toISOString(), url, body, id, kind: 'message' });
        return json({ messaging_product: 'whatsapp', contacts: [{ input: body && body.to, wa_id: body && body.to }], messages: [{ id }] });
      }
      if (m && m[2] === '/media') {
        const id = 'media.DEV' + randomBytes(6).toString('hex');
        outbox.push({ at: new Date().toISOString(), url, body: { upload: true }, id, kind: 'upload' });
        return json({ id });
      }
      if (m && !m[2]) {
        const mediaId = decodeURIComponent(m[1]);
        const audio = /audio|voc/i.test(mediaId);
        return json({ url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${encodeURIComponent(mediaId)}`, mime_type: audio ? 'audio/ogg' : 'image/png', sha256: 'dev', file_size: audio ? OGG.length : PNG.length, id: mediaId, messaging_product: 'whatsapp' });
      }
    }
    if (process.env.__AMANE_FAKE_WA === '1' && url.startsWith('https://lookaside.fbsbx.com/')) {
      const audio = /audio|voc/i.test(url);
      return new Response(audio ? OGG : PNG, { status: 200, headers: { 'content-type': audio ? 'audio/ogg' : 'image/png' } });
    }
    if (process.env.__AMANE_FAKE_AI === '1' && url.startsWith('https://api.anthropic.com/')) {
      let body = {};
      try { body = JSON.parse(init.body); } catch { body = {}; }
      const schema = body.output_config && body.output_config.format && body.output_config.format.schema;
      const props = schema && schema.properties ? Object.keys(schema.properties) : [];
      let text;
      if (props.includes('brouillon')) text = JSON.stringify({ service: 'location', vehicule: 'Urus', debut: '', fin: '', lieu: '', passagers: 0, budget: 0, langue: 'FR', urgence: 'normale', resume: 'Demande de location simulée (IA de démonstration).', brouillon: 'Bonjour, merci pour votre message. Nous revenons vers vous très vite avec une proposition. Amel — Amane' });
      else if (props.includes('from')) {
        const src = String((body.messages && body.messages[0] && body.messages[0].content) || '');
        const txt = src.split('\nTexte :\n')[1] || src;
        const to = (/Langue cible : [^(]*\((\w+)\)/.exec(src) || [])[1] || 'FR';
        text = JSON.stringify({ text: `[${to}] ${txt.trim()}`, from: to === 'FR' ? 'EN' : 'FR' });
      } else if (/tableau du lundi/i.test(body.system || '')) text = 'Tableau du lundi (IA de démonstration) : belle semaine à tous.';
      else text = 'Bonjour, merci pour votre message. (Réponse IA de démonstration.) Amel — Amane';
      outbox.push({ at: new Date().toISOString(), url, body: { model: body.model, kind: props.length ? 'json' : 'text' }, kind: 'ia' });
      return json({ id: 'msg_dev', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
    }
    if (process.env.__AMANE_FAKE_WHISPER === '1' && url.startsWith('https://api.openai.com/')) {
      outbox.push({ at: new Date().toISOString(), url, body: { transcription: true }, kind: 'whisper' });
      return json({ text: 'Bonjour, je voudrais réserver une voiture pour samedi. (transcription de démonstration)', language: 'french' });
    }
    if (process.env.__AMANE_FAKE_PUSH === '1' && url.startsWith('https://exp.host/')) {
      let body = [];
      try { body = JSON.parse(init.body); } catch { body = []; }
      outbox.push({ at: new Date().toISOString(), url, body, kind: 'push' });
      return json({ data: body.map(() => ({ status: 'ok', id: 'ticket-' + randomBytes(4).toString('hex') })) });
    }
    return real(input, init);
  };
  fakeFetch.__amaneFake = true;
  globalThis.fetch = fakeFetch;
}
