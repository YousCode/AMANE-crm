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
/** Les cinq collections métier, mémorisées, pour les règles dérivées. */
export function useData(): Data {
  const missions = useStore((x) => x.missions), clients = useStore((x) => x.clients), vehicules = useStore((x) => x.vehicules), partenaires = useStore((x) => x.partenaires), services = useStore((x) => x.services);
  return useMemo(() => ({ missions, clients, vehicules, partenaires, services }), [missions, clients, vehicules, partenaires, services]);
}
export function useTick(ms: number) { const [, set] = useState(0); useEffect(() => { const i = setInterval(() => set((x) => x + 1), ms); return () => clearInterval(i); }, [ms]); }
