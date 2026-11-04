import React from 'react';
import { Redirect } from 'expo-router';
import { useStore } from '@/store';

export default function Index() {
  const me = useStore((s) => s.me);
  return <Redirect href={me ? '/(tabs)' : '/login'} />;
}
