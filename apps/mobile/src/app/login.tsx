import React, { useState } from 'react';
import { View, Pressable, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEAM } from '@amane/shared';
import { useStore } from '@/store';
import { useTheme, FONT, GUTTER } from '@/theme';
import { ALogo } from '@/components/ALogo';
import { PinPad } from '@/components/PinPad';
import { Avatar, Btn, Input, Label, Sub, Txt, H1, Em, IconBtn } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ApiError, MOCK_MODE } from '@/lib/api';
import { tap } from '@/lib/haptics';

type Step = 'who' | 'pin' | 'setup-code' | 'setup-pin' | 'setup-confirm';

export default function Login() {
  const me = useStore((s) => s.me); const login = useStore((s) => s.login); const setup = useStore((s) => s.setup);
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const router = useRouter();
  const [who, setWho] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('who');
  const [pin, setPin] = useState(''); const [pin1, setPin1] = useState(''); const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (me) return <Redirect href="/(tabs)" />;
  const person = TEAM.find((t) => t.id === who);

  const fail = (msg: string) => { setErr(msg); setPin(''); tap('error'); };
  const submit = async (v: string) => {
    if (!who) return; setBusy(true); setErr(null);
    try { await login(who, v); tap('success'); router.replace('/(tabs)'); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'no_pin') { setStep('setup-code'); setPin(''); setErr(null); }
      else if (e instanceof ApiError && e.status === 429) fail('Trop de tentatives. Patientez quinze minutes.');
      else if (e instanceof ApiError && e.status === 401) fail('Code incorrect.');
      else if (e instanceof ApiError && e.code === 'offline') fail('Serveur injoignable. Vérifiez le réseau.');
      else fail(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally { setBusy(false); }
  };
  const submitSetup = async (v: string) => {
    if (!who) return;
    if (step === 'setup-pin') { setPin1(v); setPin(''); setStep('setup-confirm'); return; }
    if (v !== pin1) { fail('Les deux codes ne correspondent pas.'); setStep('setup-pin'); return; }
    setBusy(true); setErr(null);
    try { await setup(code.trim(), who, v); await login(who, v); tap('success'); router.replace('/(tabs)'); }
    catch (e) {
      if (e instanceof ApiError && e.code === 'bad_code') { setErr('Code d’installation incorrect.'); setStep('setup-code'); setPin(''); }
      else fail(e instanceof Error ? e.message : 'Création du code impossible.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView testID="login" contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 28, paddingBottom: ins.bottom + 20, paddingHorizontal: GUTTER + 4 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 14, marginBottom: 30 }}>
          <ALogo size={44} color={c.accent} />
          <Label style={{ letterSpacing: 4.5 }}>Amane · CRM de la maison</Label>
        </View>

        {step === 'who' ? (
          <View style={{ gap: 10 }}>
            <H1 style={{ textAlign: 'center', marginBottom: 12 }}>Qui êtes-vous ?</H1>
            {TEAM.map((t) => (
              <Pressable key={t.id} testID={`tile-${t.id}`} accessibilityRole="button" accessibilityLabel={`${t.nom}, ${t.role}`} onPress={() => { tap('select'); setWho(t.id); setStep('pin'); setErr(null); setPin(''); }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 78, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: pressed ? c.accent : c.line2, backgroundColor: c.panel, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <Avatar id={t.id} name={t.nom} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONT.display, fontSize: 23, color: c.fg }}>{t.nom}</Text>
                  <Sub style={{ letterSpacing: 0.4 }}>{t.role}</Sub>
                </View>
                <Icon name="right" size={18} color={c.fg3} />
              </Pressable>
            ))}
            {MOCK_MODE ? <Sub style={{ textAlign: 'center', marginTop: 10 }}>Mode démonstration · code 1234</Sub> : null}
          </View>
        ) : (
          <View style={{ gap: 22, alignItems: 'center' }}>
            <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBtn name="left" accessibilityLabel="Changer de personne" onPress={() => { setStep('who'); setWho(null); setPin(''); setErr(null); }} />
              {person ? <Avatar id={person.id} name={person.nom} size={34} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONT.display, fontSize: 22, color: c.fg }}>{person?.nom}</Text>
                <Sub>{step === 'pin' ? 'Votre code' : step === 'setup-code' ? 'Première connexion' : step === 'setup-pin' ? 'Choisissez un code (4 à 8 chiffres)' : 'Confirmez votre code'}</Sub>
              </View>
            </View>

            {step === 'setup-code' ? (
              <View style={{ alignSelf: 'stretch', gap: 12 }}>
                <Txt style={{ color: c.fg2 }}>Aucun code n’a encore été créé pour {person?.nom}. Saisissez le code d’installation remis par la maison, puis choisissez votre code personnel.</Txt>
                <Input testID="setup-code" label="Code d’installation" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="AMANE-…" error={err || undefined} />
                <Btn title="Continuer" kind="primary" testID="setup-next" disabled={!code.trim()} onPress={() => { setErr(null); setStep('setup-pin'); }} />
              </View>
            ) : (
              <>
                <PinPad value={pin} onChange={(v) => { setPin(v); if (err) setErr(null); }} onSubmit={step === 'pin' ? submit : submitSetup} disabled={busy} error={!!err} />
                <View style={{ minHeight: 22 }}>{err ? <Txt testID="login-error" style={{ color: c.bad, textAlign: 'center' }}>{err}</Txt> : busy ? <Sub>Connexion…</Sub> : null}</View>
              </>
            )}
          </View>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', marginTop: 36 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 17, color: c.fg2, textAlign: 'center' }} testID="slogan">
            Arrive as a <Em style={{ fontSize: 17 }} color={c.fg}>Guest</Em>. Leave with a <Em style={{ fontSize: 17 }} color={c.fg}>Story</Em>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
