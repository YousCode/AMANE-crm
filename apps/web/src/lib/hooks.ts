import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../store/store';
import type { Data } from './rules';

const MQ = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width:1019px)') : null;
export function useIsMobile() {
  const [m, setM] = useState(!!MQ?.matches);
  useEffect(() => { if (!MQ) return; const f = () => setM(MQ.matches); MQ.addEventListener ? MQ.addEventListener('change', f) : MQ.addListener(f); return () => { MQ.removeEventListener ? MQ.removeEventListener('change', f) : MQ.removeListener(f); }; }, []);
  return m;
}
export const isMobile = () => !!MQ?.matches;
const CQ = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer:coarse)') : null;
/** Appareil tactile (cibles de 44 px, y compris tablette). */
export function useCoarse() {
  const [m, setM] = useState(!!CQ?.matches);
  useEffect(() => { if (!CQ) return; const f = () => setM(CQ.matches); CQ.addEventListener ? CQ.addEventListener('change', f) : CQ.addListener(f); return () => { CQ.removeEventListener ? CQ.removeEventListener('change', f) : CQ.removeListener(f); }; }, []);
  return m;
}
/** Les cinq collections métier, mémorisées, pour les règles dérivées. */
export function useData(): Data {
  const missions = useStore((x) => x.missions), clients = useStore((x) => x.clients), vehicules = useStore((x) => x.vehicules), partenaires = useStore((x) => x.partenaires), services = useStore((x) => x.services), reglages = useStore((x) => x.reglages);
  return useMemo(() => ({ missions, clients, vehicules, partenaires, services, reglages }), [missions, clients, vehicules, partenaires, services, reglages]);
}
export function useTick(ms: number) { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]); }
