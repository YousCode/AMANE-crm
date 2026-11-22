/* La demande : le message se compose sous les yeux du visiteur et part depuis son propre WhatsApp.
   Si le site est servi par le CRM (GET /api/health répond), il peut aussi demander à être rappelé (POST /api/lead). */
import { CONFIG } from './config';
import { tr, message, LOCALES, type Lang } from './i18n';

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
let toastT = 0;
export function toast(text: string) {
  const t = $('#toast'); t.textContent = text; t.classList.add('on');
  clearTimeout(toastT); toastT = window.setTimeout(() => t.classList.remove('on'), 2600);
}

export function initForm(getLang: () => Lang) {
  const form = $<HTMLFormElement>('#askForm'), preview = $('#preview'), wa = $<HTMLAnchorElement>('#wa');
  const f = (n: string) => form.elements.namedItem(n) as HTMLInputElement & HTMLSelectElement;
  const cbBtn = $<HTMLButtonElement>('#callback'), cbField = $('#cbField'), priv = $('#priv');
  let callback = false;

  const update = () => {
    const L = getLang();
    const sel = f('service'); const service = sel.options[sel.selectedIndex]?.text || '';
    const d = f('date').value ? new Date(f('date').value + 'T12:00').toLocaleDateString(LOCALES[L], { weekday: 'long', day: 'numeric', month: 'long' }) : '';
    const langSel = f('lang'); const txt = message(L, f('name').value.trim(), service, d, f('guests').value.trim(), langSel.options[langSel.selectedIndex]?.text || '', f('message').value.trim());
    preview.textContent = txt;
    wa.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(txt)}`;
    priv.textContent = String(tr(L, callback ? 'priv2' : 'priv'));
  };
  form.addEventListener('input', update); form.addEventListener('change', update);
  form.addEventListener('submit', (e) => { e.preventDefault(); wa.click(); });

  $('#copy').addEventListener('click', () => {
    const done = () => toast(String(tr(getLang(), 'copied')));
    const select = () => { const r = document.createRange(); r.selectNodeContents(preview); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); done(); };
    if (navigator.clipboard) navigator.clipboard.writeText(preview.textContent || '').then(done).catch(select); else select();
  });

  if (CONFIG.whatsapp && CONFIG.email) { $('#contactLine').hidden = false; $('#waShow').textContent = '+' + CONFIG.whatsapp; $('#mailShow').textContent = CONFIG.email; }

  // Rappel : seulement quand le CRM répond.
  if (location.protocol.startsWith('http')) {
    fetch(CONFIG.api + '/api/health', { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).then((h) => {
      if (!h || !h.db) return;
      callback = true; cbBtn.hidden = false; cbField.hidden = false; update();
    }).catch(() => { /* site servi seul : WhatsApp uniquement */ });
  }
  cbBtn.addEventListener('click', async () => {
    const L = getLang(); const tel = f('tel').value.trim();
    if (tel.replace(/\D/g, '').length < 8) { toast(String(tr(L, 'cbneed'))); f('tel').focus(); return; }
    cbBtn.disabled = true;
    try {
      const sel = f('service');
      const r = await fetch(CONFIG.api + '/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nom: f('name').value.trim(), tel, langue: L.toUpperCase(), service: sel.value || sel.options[sel.selectedIndex]?.text || '', date: f('date').value, message: preview.textContent, website: f('website').value }) });
      if (!r.ok) throw new Error(String(r.status));
      toast(String(tr(L, 'cbok'))); f('tel').value = '';
    } catch { toast(String(tr(L, 'cberr'))); } finally { cbBtn.disabled = false; }
  });

  return { update, pick(service: string) { const sel = f('service'); const i = [...sel.options].findIndex((o) => o.value === service); if (i >= 0) { sel.selectedIndex = i; update(); } } };
}
