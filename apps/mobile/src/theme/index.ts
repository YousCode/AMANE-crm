import { useColorScheme } from 'react-native';
import { tokens, type ThemeColors } from '@amane/shared';
import { useStore } from '@/store';

export const FONT = {
  display: 'BodoniModa_400Regular',
  displayItalic: 'BodoniModa_400Regular_Italic',
  displayMedium: 'BodoniModa_500Medium',
  ui: 'Jost_400Regular',
  uiLight: 'Jost_300Light',
  uiMedium: 'Jost_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const RADIUS = tokens.radius;
export const GUTTER = 16;

export type Theme = { c: ThemeColors; dark: boolean; scheme: 'light' | 'dark' };

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useStore((s) => s.prefs.theme);
  const scheme: 'light' | 'dark' = pref === 'auto' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return { c: tokens.colors[scheme], dark: scheme === 'dark', scheme };
}

/** Couleur d'un statut de demande (chip). */
export function statutColor(c: ThemeColors, statut: string): string {
  switch (statut) {
    case 'nouvelle': return c.bad;
    case 'proposition': return c.warn;
    case 'confirmee': return c.ok;
    case 'encours': return c.info;
    case 'terminee': return c.fg3;
    case 'perdue': return c.fg3;
    default: return c.fg3;
  }
}
