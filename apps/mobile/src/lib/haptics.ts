import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useStore } from '@/store';

/* Retour haptique sur les actions principales (appel, envoi, changement de statut). Sans effet sur le web. */
export function tap(kind: 'light' | 'medium' | 'success' | 'warning' | 'error' | 'select' = 'light'): void {
  if (Platform.OS === 'web' || !useStore.getState().prefs.haptics) return;
  try {
    if (kind === 'select') void Haptics.selectionAsync();
    else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === 'error') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
  } catch { /* appareil sans moteur haptique */ }
}
