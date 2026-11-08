import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium } from '@expo-google-fonts/bodoni-moda';
import { Jost_300Light, Jost_400Regular, Jost_500Medium } from '@expo-google-fonts/jost';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import * as Notifications from 'expo-notifications';
import { useStore } from '@/store';
import { useTheme } from '@/theme';
import { Toast } from '@/components/SyncPill';
import { Loading } from '@/components/ui';
import { setupNotificationHandler, registerPush, routeForNotification } from '@/lib/push';

SplashScreen.preventAutoHideAsync().catch(() => { /* web */ });
setupNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({ BodoniModa_400Regular, BodoniModa_400Regular_Italic, BodoniModa_500Medium, Jost_300Light, Jost_400Regular, Jost_500Medium, IBMPlexMono_400Regular, IBMPlexMono_500Medium });
  const booted = useStore((s) => s.booted); const boot = useStore((s) => s.boot); const me = useStore((s) => s.me);
  const { c, dark } = useTheme(); const router = useRouter();

  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => { if ((fontsLoaded || fontsError) && booted) SplashScreen.hideAsync().catch(() => { /* web */ }); }, [fontsLoaded, fontsError, booted]);

  // Push : enregistrement du jeton une fois connecté ; un appui sur une notification ouvre la conversation ou la demande.
  useEffect(() => {
    if (!me || Platform.OS === 'web') return;
    void registerPush();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const to = routeForNotification(r.notification.request.content.data as Record<string, unknown>);
      if (to) router.push(to as never);
    });
    Notifications.getLastNotificationResponseAsync?.().then((r) => {
      const to = r && routeForNotification(r.notification.request.content.data as Record<string, unknown>);
      if (to) router.push(to as never);
    }).catch(() => { /* ignore */ });
    return () => sub.remove();
  }, [me, router]);

  if ((!fontsLoaded && !fontsError) || !booted) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: Platform.OS === 'web' ? 'none' : 'default' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="conv/[id]" />
          <Stack.Screen name="mission/[id]" />
          <Stack.Screen name="client/[id]" />
          <Stack.Screen name="vehicule/[id]" />
          <Stack.Screen name="espace/[token]" />
          <Stack.Screen name="partenaire/[id]" />
        </Stack>
        <Toast />
      </View>
    </SafeAreaProvider>
  );
}

export function LoadingScreen() { return <Loading />; }
