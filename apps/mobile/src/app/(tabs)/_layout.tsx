import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/store';
import { unreadTotal, todos } from '@/store/select';
import { useTheme, FONT } from '@/theme';
import { Icon, type IconName } from '@/components/Icon';
import { tap } from '@/lib/haptics';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Aujourd’hui', icon: 'salon' },
  { name: 'messages', title: 'Messages', icon: 'messages' },
  { name: 'demandes', title: 'Demandes', icon: 'demandes' },
  { name: 'planning', title: 'Planning', icon: 'planning' },
  { name: 'clients', title: 'Clients', icon: 'clients' },
  { name: 'plus', title: 'Plus', icon: 'more' },
];

function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { c } = useTheme(); const ins = useSafeAreaInsets();
  const data = useStore((s) => s.data); const me = useStore((s) => s.me);
  const unread = unreadTotal(data); const nNew = data.missions.filter((m) => m.statut === 'nouvelle').length;
  const nTodo = me ? (todos(data)[me.id] || []).length : 0;
  return (
    <View testID="tabbar" style={{ flexDirection: 'row', backgroundColor: c.bg2, borderTopWidth: 1, borderTopColor: c.line2, paddingBottom: Math.max(ins.bottom, 8), paddingTop: 6 }}>
      {state.routes.map((route: { key: string; name: string }, i: number) => {
        const tab = TABS.find((t) => t.name === route.name); if (!tab) return null;
        const on = state.index === i;
        const badge = tab.name === 'messages' ? unread : tab.name === 'demandes' ? nNew : tab.name === 'index' ? nTodo : 0;
        return (
          <Pressable key={route.key} testID={`tab-${tab.name}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tab.title + (badge ? `, ${badge}` : '')}
            onPress={() => { tap('select'); if (!on) navigateToTab(route.key); }}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
            <View>
              <Icon name={tab.icon} size={22} color={on ? c.fg : c.fg3} stroke={on ? 1.9 : 1.5} />
              {badge ? <View style={{ position: 'absolute', top: -5, right: -11, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: FONT.mono, fontSize: 10, color: c.accentInk }}>{badge}</Text></View> : null}
            </View>
            <Text numberOfLines={1} style={{ fontFamily: FONT.ui, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: on ? c.fg : c.fg3 }}>{tab.title}</Text>
            {on ? <View style={{ position: 'absolute', top: 0, width: 18, height: 2, borderRadius: 1, backgroundColor: c.accent }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const me = useStore((s) => s.me);
  if (!me) return <Redirect href="/login" />;
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, lazy: true }}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
    </Tabs>
  );
}
