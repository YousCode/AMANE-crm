/* Connexion : trois tuiles (Amel, Youssouf, Aziz), pavé numérique, première connexion (code d'installation + nouveau PIN). */
import { useEffect, useRef, useState } from 'react';
import s from './Login.module.css';
import { Icon, Logo } from '../components/Icon';
import { Av } from '../components/ui';
import { TEAM } from '../shared';
import { useStore } from '../store/store';
import type { ApiError } from '../lib/api';

type Step = 'who' | 'pin' | 'setup';
const lsGet = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function Login({ expired }: { expired?: boolean }) {
  const login = useStore((x) => x.login); const setup = useStore((x) => x.setup); const offline = useStore((x) => x.offline);
  const last = lsGet('amane.me'); const [who, setWho] = useState<string>(TEAM.some((t) => t.id === last) ? last : '');
  const [step, setStep] = useState<Step>(who ? 'pin' : 'who'); const [pin, setPin] = useState(''); const [msg, setMsg] = useState<string>(expired ? 'Votre session a expiré : saisissez à nouveau votre code.' : offline ? 'Serveur injoignable pour l’instant.' : ''); const [err, setErr] = useState(false); const [busy, setBusy] = useState(false); const [noPin, setNoPin] = useState(false); const [shake, setShake] = useState(0);
  const [code, setCode] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState('');
  const t = TEAM.find((x) => x.id === who); const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function submit(p: string) {
    if (busy || p.length < 4) return; clearTimeout(timer.current); setBusy(true); setMsg(''); setErr(false);
    try { await login(who, p); lsSet('amane.me', who); }
    catch (e) {
      const x = e as ApiError; setPin(''); setErr(true); setNoPin(false);
      if (x.status === 401) { setMsg('Code incorrect.'); setShake((n) => n + 1); if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch { /* ignore */ } }
      else if (x.status === 409) { setErr(false); setNoPin(true); setMsg(''); }
      else if (x.status === 429) setMsg('Trop d’essais. Réessayez dans un quart d’heure.');
      else if (x.code === 'offline') setMsg('Serveur injoignable. Vérifiez la connexion.');
      else setMsg(x.message || 'Connexion impossible pour l’instant.');
    } finally { setBusy(false); }
  }
  function key(k: string) {
    if (step !== 'pin' || busy) return; clearTimeout(timer.current);
    let p = pin;
    if (k === 'del') p = p.slice(0, -1); else if (k === 'ok') { if (p.length >= 4) submit(p); return; } else if (/^\d$/.test(k) && p.length < 8) { p += k; if (navigator.vibrate) try { navigator.vibrate(6); } catch { /* ignore */ } }
    setPin(p); if (err && p.length) { setErr(false); setMsg(''); }
    if (p.length >= 8) submit(p); else if (p.length >= 4) timer.current = setTimeout(() => submit(p), 1200);
  }
  useEffect(() => { const f = (e: KeyboardEvent) => { if (step !== 'pin' || e.metaKey || e.ctrlKey || e.altKey) return; if (/^\d$/.test(e.key)) { e.preventDefault(); key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); key('del'); } else if (e.key === 'Enter') { e.preventDefault(); key('ok'); } }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); });
  async function doSetup(e: React.FormEvent) {
    e.preventDefault(); setErr(true);
    if (!code.trim()) return setMsg('Saisissez le code d’installation.'); if (!/^\d{4,8}$/.test(p1)) return setMsg('Le code personnel compte 4 à 8 chiffres.'); if (p1 !== p2) return setMsg('Les deux codes ne correspondent pas.');
    setBusy(true); setMsg(''); setErr(false);
    try { await setup(code.trim(), who, p1); lsSet('amane.me', who); }
    catch (x) { const er = x as ApiError; setErr(true); setMsg(er.status === 429 ? 'Trop d’essais. Réessayez dans un quart d’heure.' : er.status === 401 || er.status === 403 ? 'Code d’installation incorrect.' : er.code === 'offline' ? 'Serveur injoignable. Vérifiez la connexion.' : er.message || 'Création impossible pour l’instant.'); }
    finally { setBusy(false); }
  }
  const pick = (id: string) => { setWho(id); lsSet('amane.me', id); setStep('pin'); setPin(''); setMsg(''); setErr(false); setNoPin(false); };
  const n = Math.max(4, pin.length);
  return (
    <div className={s.login}>
      <div className={s.in} role="dialog" aria-modal="true" aria-label="Connexion">
        <div className={s.logo} aria-hidden="true"><Logo arch size={58} /></div>
        <div className={s.word}>AMANE</div><div className={s.sub}>Espace équipe</div>
        <div className={s.body}>
          {(step === 'who' || !t) && <>
            <h1 className={s.h}>Qui êtes-vous ?</h1><p className={s.p}>Choisissez votre prénom, puis saisissez votre code personnel.</p>
            <div className={s.tiles}>{TEAM.map((p) => <button key={p.id} className={s.tile} type="button" onClick={() => pick(p.id)} data-testid={`tile-${p.id}`}><Av id={p.id} lg /><span><b>{p.nom}</b><span className={s.r}>{p.role}</span></span><span className={s.chev}><Icon k="right" /></span></button>)}</div>
          </>}
          {t && step !== 'who' && <button className={s.who} type="button" onClick={() => setStep('who')}><Av id={t.id} /><span>{t.nom} · changer</span></button>}
          {t && step === 'pin' && <>
            <h1 className={s.h}>Bonjour, <em>{t.nom}</em>.</h1><p className={s.p}>Votre code personnel</p>
            <div key={shake} className={`${s.dots} ${shake ? s.shake : ''}`} role="img" aria-label={`${pin.length} chiffre${pin.length > 1 ? 's' : ''} saisi${pin.length > 1 ? 's' : ''}`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i < pin.length ? s.on : ''} />)}</div>
            <div className={`${s.msg} ${err ? s.err : ''}`} role="status" aria-live="polite">{noPin ? <>Votre code n’a pas encore été créé. <button className="lnk" type="button" onClick={() => setStep('setup')}>Première connexion</button></> : msg}</div>
            <div className={s.pad} aria-busy={busy}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => <button key={k} className={s.key} type="button" onClick={() => key(String(k))} aria-label={String(k)}>{k}</button>)}
              <button className={`${s.key} ${s.fn}`} type="button" onClick={() => key('del')} aria-label="Effacer"><Icon k="del" /></button>
              <button className={s.key} type="button" onClick={() => key('0')} aria-label="0">0</button>
              <button className={`${s.key} ${s.ok}`} type="button" onClick={() => key('ok')} aria-label="Valider"><Icon k="check" w={2} /></button>
            </div>
            <button className={s.link} type="button" onClick={() => { setStep('setup'); setMsg(''); setErr(false); }}>Première connexion ou code oublié ?</button>
          </>}
          {t && step === 'setup' && <>
            <h1 className={s.h}>Première <em>connexion</em></h1>
            <p className={s.p}>{who === 'youssouf' ? 'Saisissez le code d’installation défini sur le serveur' : 'Demandez le code d’installation à Youssouf'}, puis choisissez votre code personnel : 4 à 8 chiffres, que vous seul connaissez.</p>
            <form className={s.form} onSubmit={doSetup} autoComplete="off" noValidate>
              <div className="f"><label htmlFor="lgCode">Code d’installation</label><input id="lgCode" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" spellCheck={false} /></div>
              <div className="f"><label htmlFor="lgP1">Nouveau code personnel</label><input id="lgP1" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" /></div>
              <div className="f"><label htmlFor="lgP2">Confirmez ce code</label><input id="lgP2" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></div>
              <div className={`${s.msg} ${err ? s.err : ''}`} role="status" aria-live="polite">{msg}</div>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Création…' : 'Créer mon code'}</button>
            </form>
          </>}
          <div className={s.tag}>Arrive as a <i>Guest</i>. Leave with a <i>Story</i>.</div>
        </div>
      </div>
    </div>
  );
}
