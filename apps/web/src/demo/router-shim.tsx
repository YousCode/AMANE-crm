/* Démo autonome : le routeur vit en mémoire (la page de démonstration n'a pas d'adresse à elle), le reste de react-router est inchangé.
   Branché par `vite.demo.config.ts` à la place de « react-router-dom » ; jamais utilisé par l'application réelle. */
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
export * from 'react-router-dom';
export function BrowserRouter({ children }: { children?: ReactNode; basename?: string }) {
  return <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>;
}
