/* Environnement Jest : modules natifs Expo simulés, routeur et zones sûres neutralisés. */

jest.mock('expo-secure-store', () => {
  const m: Record<string, string> = {};
  return { getItemAsync: jest.fn(async (k: string) => m[k] ?? null), setItemAsync: jest.fn(async (k: string, v: string) => { m[k] = v; }), deleteItemAsync: jest.fn(async (k: string) => { delete m[k]; }) };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), selectionAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' } }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })), requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })), setNotificationChannelAsync: jest.fn(), AndroidImportance: { HIGH: 4 },
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null),
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'test' } } } } }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })), requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })), launchCameraAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///p.jpg', width: 3000, height: 2000 }] })), launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })) }));
jest.mock('expo-image-manipulator', () => {
  const ctx = { resize: jest.fn(function (this: any) { return this; }), renderAsync: jest.fn(async () => ({ saveAsync: jest.fn(async () => ({ uri: 'file:///small.jpg', base64: 'QUJD' })) })) };
  return { ImageManipulator: { manipulate: jest.fn(() => ctx) }, SaveFormat: { JPEG: 'jpeg' } };
});
jest.mock('expo-audio', () => ({ useAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn() })), useAudioPlayerStatus: jest.fn(() => ({ playing: false, currentTime: 0, duration: 0 })) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => { class MockFile { exists = false; uri = 'file:///x'; write() { /* noop */ } delete() { /* noop */ } static async canPreview() { return false; } static async preview() { return undefined; } } return { File: MockFile, Paths: { cache: 'file:///cache' } }; });
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: async () => undefined }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: async () => true, hideAsync: async () => true }));
jest.mock('expo-image', () => { const RN = require('react-native'); const R = require('react'); return { Image: (p: any) => R.createElement(RN.View, { testID: 'image', accessibilityLabel: p.source?.uri }) }; });
jest.mock('react-native-svg', () => {
  const RN = require('react-native'); const R = require('react');
  const mk = (name: string) => (p: any) => R.createElement(RN.View, { ...p, testID: p.testID || name }, p.children);
  return { __esModule: true, default: mk('Svg'), Svg: mk('Svg'), Path: mk('Path'), Circle: mk('Circle') };
});
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return { SafeAreaProvider: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaView: RN.View };
});
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter, Redirect: ({ href }: any) => { const RN = require('react-native'); const R = require('react'); return R.createElement(RN.Text, { testID: 'redirect' }, String(href)); },
  useLocalSearchParams: () => ({}), Stack: ({ children }: any) => children, Tabs: ({ children }: any) => children, Link: ({ children }: any) => children,
}));
(globalThis as any).__routerMock = mockRouter;
