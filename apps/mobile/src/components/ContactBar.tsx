import React from 'react';
import { ScrollView } from 'react-native';
import { Pill } from './ui';
import { telUrl, waUrl, mapsUrl, smsUrl, mailUrl, open } from '@/lib/links';

/* Appeler / WhatsApp / SMS / E-mail / Itinéraire — partout où il y a une personne ou un lieu. */
export function ContactBar({ tel, waText, lieu, email, extra, compact }: { tel?: string; waText?: string; lieu?: string; email?: string; extra?: React.ReactNode; compact?: boolean }) {
  const t = telUrl(tel), w = waUrl(tel, waText), m = mapsUrl(lieu), s = smsUrl(tel), e = mailUrl(email);
  if (!t && !w && !m && !extra) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {t ? <Pill dark title="Appeler" icon="phone" testID="ct-tel" onPress={() => void open(t)} /> : null}
      {w ? <Pill title="WhatsApp" icon="wa" testID="ct-wa" onPress={() => void open(w)} /> : null}
      {m ? <Pill title="Itinéraire" icon="nav" testID="ct-maps" onPress={() => void open(m)} /> : null}
      {!compact && s ? <Pill title="SMS" icon="messages" testID="ct-sms" onPress={() => void open(s)} /> : null}
      {!compact && e ? <Pill title="E-mail" icon="note" testID="ct-mail" onPress={() => void open(e)} /> : null}
      {extra}
    </ScrollView>
  );
}
