import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/store';
import { useUI, applyTheme } from './store/ui';
import { Shell } from './components/Shell';
import { Login } from './screens/Login';
import { Today } from './screens/Today';
import { Messages } from './screens/Messages';
import { Demandes } from './screens/Demandes';
import { Planning } from './screens/Planning';
import { Clients } from './screens/Clients';
import { Carnet } from './screens/Carnet';
import { Flotte, Rentabilite } from './screens/Flotte';
import { Finances } from './screens/Finances';
import { Relances } from './screens/Relances';
import { Contrats } from './screens/Contrats';
import { Services } from './screens/Services';
import { Reglages } from './screens/Reglages';
import { Aide } from './screens/Aide';
import { startLive, stopLive } from './lib/ws';
import { Logo } from './components/Icon';

function Splash() { return <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', color: 'var(--fg)' }}><div style={{ textAlign: 'center' }}><Logo arch size={52} /><div style={{ marginTop: 14, fontFamily: 'var(--f-display)', letterSpacing: '.5em', paddingLeft: '.5em', fontSize: 13 }}>AMANE</div><div className="label" style={{ marginTop: 10 }}>Connexion…</div></div></div>; }

export default function App() {
  const auth = useStore((x) => x.auth); const boot = useStore((x) => x.boot); const user = useStore((x) => x.user);
  const theme = useUI((x) => x.theme);
  useEffect(() => { applyTheme(theme); boot(); }, [boot, theme]);
  useEffect(() => { if (auth === 'in') { startLive(); return () => stopLive(); } }, [auth]);
  if (auth === 'boot') return <Splash />;
  if (auth === 'login') return <Login expired={!!user} />;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Today />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:convId" element={<Messages />} />
          <Route path="demandes" element={<Demandes />} />
          <Route path="planning" element={<Planning />} />
          <Route path="clients" element={<Clients />} />
          <Route path="carnet" element={<Carnet />} />
          <Route path="flotte" element={<Flotte />} />
          <Route path="flotte/rentabilite" element={<Rentabilite />} />
          <Route path="finances" element={<Finances />} />
          <Route path="relances" element={<Relances />} />
          <Route path="contrats" element={<Contrats />} />
          <Route path="services" element={<Services />} />
          <Route path="reglages" element={<Reglages />} />
          <Route path="aide" element={<Aide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
