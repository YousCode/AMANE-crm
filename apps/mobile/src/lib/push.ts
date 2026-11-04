import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';

/*
 * Notifications push (expo-notifications) : jeton Expo enregistré via POST /api/push/register {token, platform}.
 * Le serveur envoie « nouvelle demande », « message reçu », « devis accepté », « rappel » avec
 * data:{convId} ou data:{missionId} ; l'appui ouvre la conversation ou la demande (voir app/_layout.tsx).
 */
export function setupNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
    });
  } catch { /* module natif absent (Expo Go web) */ }
}

export async function registerPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('amane', { name: 'Amane', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 120, 80, 120], lightColor: '#B8955C' });
    }
    const { status: cur } = await Notifications.getPermissionsAsync();
    let status = cur;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await api('POST', '/api/push/register', { token, platform: Platform.OS });
    return token;
  } catch {
    return null; // Expo Go sans projectId, simulateur, refus : l'appli fonctionne sans push
  }
}

/** Route à ouvrir pour une notification : `/conv/<id>` ou `/mission/<id>`. */
export function routeForNotification(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  if (data.convId) return `/conv/${encodeURIComponent(String(data.convId))}`;
  if (data.missionId) return `/mission/${encodeURIComponent(String(data.missionId))}`;
  if (data.url && typeof data.url === 'string') return data.url;
  return null;
}
