import React from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, ScrollView, ActivityIndicator, type ViewStyle, type TextStyle, type StyleProp, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme, FONT, RADIUS, GUTTER, statutColor } from '@/theme';
import { Icon, Dot, type IconName } from './Icon';
import { tap } from '@/lib/haptics';
import { STATUTS } from '@amane/shared';
import { initial } from '@/lib/format';

/* ---------- Texte ---------- */
type TxtProps = { children?: React.ReactNode; style?: StyleProp<TextStyle>; color?: string; numberOfLines?: number; testID?: string; rtl?: boolean; accessibilityRole?: 'header' | 'text'; selectable?: boolean };
export function Txt({ children, style, color, numberOfLines, testID, rtl, accessibilityRole, selectable }: TxtProps) {
  const { c } = useTheme();
  return <Text style={[{ fontFamily: FONT.ui, fontSize: 14.5, lineHeight: 21, color: color || c.fg, writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : undefined }, style]} numberOfLines={numberOfLines} testID={testID} accessibilityRole={accessibilityRole} selectable={selectable}>{children}</Text>;
}
export function Sub({ children, style, numberOfLines, rtl }: TxtProps) {
  const { c } = useTheme();
  return <Txt style={[{ fontSize: 13, lineHeight: 18, color: c.fg3 }, style]} numberOfLines={numberOfLines} rtl={rtl}>{children}</Txt>;
}
/** Étiquette capitales espacées (.18em, 11 px). */
export function Label({ children, style, color, numberOfLines }: TxtProps) {
  const { c } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: FONT.ui, fontSize: 10.5, letterSpacing: 2.2, textTransform: 'uppercase', color: color || c.fg3 }, style]}>{children}</Text>;
}
export function H1({ children, style, color }: TxtProps) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" style={[{ fontFamily: FONT.display, fontSize: 32, lineHeight: 36, color: color || c.fg }, style]}>{children}</Text>;
}
export function H2({ children, style, color, numberOfLines }: TxtProps) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" numberOfLines={numberOfLines} style={[{ fontFamily: FONT.display, fontSize: 23, lineHeight: 28, color: color || c.fg }, style]}>{children}</Text>;
}
export function H3({ children, style, color, numberOfLines }: TxtProps) {
  const { c } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: FONT.display, fontSize: 19, lineHeight: 24, color: color || c.fg }, style]}>{children}</Text>;
}
export function Em({ children, style, color }: TxtProps) {
  const { c } = useTheme();
  return <Text style={[{ fontFamily: FONT.displayItalic, color: color || c.accent }, style]}>{children}</Text>;
}
export function Mono({ children, style, color, numberOfLines }: TxtProps) {
  const { c } = useTheme();
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: FONT.mono, fontSize: 13.5, color: color || c.fg, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}

/* ---------- Surfaces ---------- */
export function Panel({ children, style, pad = true, testID }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean; testID?: string }) {
  const { c, dark } = useTheme();
  return <View testID={testID} style={[{ backgroundColor: c.panel, borderWidth: 1, borderColor: c.line2, borderRadius: RADIUS, padding: pad ? 16 : 0, overflow: 'hidden' }, !dark && s.shadow, style]}>{children}</View>;
}
export function Line({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.line2 }, style]} />;
}
export function Section({ title, sub, action, onAction, style }: { title: string; sub?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 8, paddingHorizontal: 2 }, style]}>
      <H2>{title}</H2>
      {action ? <Pressable onPress={onAction} hitSlop={8}><Txt style={{ fontSize: 13, color: c.fg2, textDecorationLine: 'underline' }}>{action}</Txt></Pressable> : sub ? <Sub style={{ letterSpacing: 0.4 }}>{sub}</Sub> : null}
    </View>
  );
}
export function Empty({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16, gap: 10 }, style]}>
      <View style={{ width: 34, height: 44, borderWidth: 1, borderColor: c.line, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
      <Sub style={{ textAlign: 'center' }}>{children}</Sub>
    </View>
  );
}

/* ---------- Boutons ---------- */
type BtnProps = { title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; icon?: IconName | string; small?: boolean; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string; haptic?: Parameters<typeof tap>[0] | false };
export function Btn({ title, onPress, kind = 'secondary', icon, small, disabled, loading, style, testID, accessibilityLabel, haptic = 'light' }: BtnProps) {
  const { c } = useTheme();
  const primary = kind === 'primary'; const gold = kind === 'gold';
  const bg = primary ? c.fg : gold ? c.accent : kind === 'ghost' ? 'transparent' : c.panel;
  const fg = primary ? c.bg : gold ? c.accentInk : kind === 'danger' ? c.bad : c.fg;
  const border = primary ? c.fg : gold ? c.accent : kind === 'ghost' ? 'transparent' : kind === 'danger' ? c.bad : c.line;
  return (
    <Pressable
      testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} disabled={disabled || loading}
      onPress={() => { if (haptic) tap(haptic); onPress?.(); }}
      style={({ pressed }) => [{ height: small ? 36 : 46, paddingHorizontal: small ? 13 : 18, borderRadius: small ? 10 : RADIUS, borderWidth: 1, borderColor: border, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 15 : 17} color={fg} /> : null}
      <Text style={{ fontFamily: FONT.uiMedium, fontSize: small ? 13 : 14.5, color: fg, letterSpacing: 0.3 }}>{title}</Text>
    </Pressable>
  );
}
/** Pastille d'action ronde (Appeler, WhatsApp, Itinéraire…). */
export function Pill({ title, icon, onPress, dark, disabled, testID, accessibilityLabel }: { title: string; icon: IconName | string; onPress?: () => void; dark?: boolean; disabled?: boolean; testID?: string; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} disabled={disabled} onPress={() => { tap('medium'); onPress?.(); }}
      style={({ pressed }) => ({ height: 38, paddingLeft: 12, paddingRight: 14, borderRadius: 19, borderWidth: 1, borderColor: dark ? c.fg : c.line, backgroundColor: dark ? c.fg : c.panel, flexDirection: 'row', alignItems: 'center', gap: 7, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 })}>
      <Icon name={icon} size={16} color={dark ? c.bg : c.accent} />
      <Text style={{ fontFamily: FONT.uiMedium, fontSize: 13, color: dark ? c.bg : c.fg }}>{title}</Text>
    </Pressable>
  );
}
export function IconBtn({ name, onPress, size = 40, color, bg, border = true, accessibilityLabel, testID, style }: { name: IconName | string; onPress?: () => void; size?: number; color?: string; bg?: string; border?: boolean; accessibilityLabel: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { tap('select'); onPress?.(); }} hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, borderWidth: border ? 1 : 0, borderColor: c.line, backgroundColor: bg || (border ? c.panel : 'transparent'), alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 }, style]}>
      <Icon name={name} size={size * 0.46} color={color || c.fg} />
    </Pressable>
  );
}

/* ---------- Chips, avatars ---------- */
export function Chip({ text, color, dot = true, style, small }: { text: string; color?: string; dot?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, height: small ? 20 : 24, paddingHorizontal: small ? 7 : 10, borderRadius: 12, borderWidth: 1, borderColor: c.line2, alignSelf: 'flex-start' }, style]}>
      {dot ? <Dot size={6} color={color || c.fg2} /> : null}
      <Text style={{ fontFamily: FONT.ui, fontSize: small ? 10.5 : 11.5, letterSpacing: 0.4, color: color || c.fg2 }}>{text}</Text>
    </View>
  );
}
export function StatutChip({ statut, small }: { statut: string; small?: boolean }) {
  const { c } = useTheme();
  const l = (STATUTS.find((x) => x.id === statut) || { label: statut }).label;
  return <Chip text={l} color={statutColor(c, statut)} small={small} />;
}
/** Avatar « arcade » (haut arrondi, bas carré), initiale en Bodoni. */
export function Avatar({ name, id, size = 42, dark }: { name?: string; id?: string; size?: number; dark?: boolean }) {
  const { c } = useTheme();
  const solid = dark || id === 'amel' || id === 'youssouf';
  const bg = id === 'amel' ? c.fg : id === 'youssouf' ? c.fg2 : id === 'aziz' ? c.stone : solid ? c.fg : c.bg2;
  const fg = id === 'aziz' ? c.fg : solid ? c.bg : c.fg;
  return (
    <View style={{ width: size, height: size * 1.19, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: bg, borderWidth: 1, borderColor: solid ? bg : c.line, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: size * 0.5, color: fg }}>{initial(name || id)}</Text>
    </View>
  );
}
export function RoundPic({ name, size = 44 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: size * 0.43, color: c.fg }}>{initial(name)}</Text>
    </View>
  );
}

/* ---------- Lignes de liste ---------- */
export function Row({ title, sub, left, right, onPress, testID, last, chevron = true }: { title: string; sub?: string; left?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; testID?: string; last?: boolean; chevron?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress ? () => { tap('select'); onPress(); } : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line2, backgroundColor: pressed ? c.panel2 : 'transparent' })}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt numberOfLines={1} style={{ fontFamily: FONT.uiMedium }}>{title}</Txt>
        {sub ? <Sub numberOfLines={1}>{sub}</Sub> : null}
      </View>
      {right}
      {onPress && chevron ? <Icon name="right" size={16} color={c.fg3} /> : null}
    </Pressable>
  );
}

/* ---------- Saisie ---------- */
export function Input(props: Omit<TextInputProps, 'style'> & { label?: string; error?: string; style?: StyleProp<ViewStyle>; inputStyle?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const { label, error, style, inputStyle, ...rest } = props;
  return (
    <View style={[{ gap: 5 }, style]}>
      {label ? <Label>{label}</Label> : null}
      <TextInput placeholderTextColor={c.fg3} {...rest}
        style={[{ fontFamily: FONT.ui, fontSize: 15, color: c.fg, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS, borderWidth: 1, borderColor: error ? c.bad : c.line, backgroundColor: c.panel }, rest.multiline && { minHeight: 90, textAlignVertical: 'top' }, inputStyle]} />
      {error ? <Sub style={{ color: c.bad }}>{error}</Sub> : null}
    </View>
  );
}
export function Seg<T extends string>({ value, options, onChange, style }: { value: T; options: { id: T; label: string; n?: number }[]; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { tap('select'); onChange(o.id); }}
            style={{ height: 34, paddingHorizontal: 13, borderRadius: 17, borderWidth: 1, borderColor: on ? c.fg : c.line2, backgroundColor: on ? c.fg : c.panel, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontFamily: FONT.uiMedium, fontSize: 12.5, color: on ? c.bg : c.fg2 }}>{o.label}</Text>
            {o.n != null ? <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: on ? c.bg : c.fg3 }}>{o.n}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
export function Check({ checked, label, sub, onToggle, testID }: { checked: boolean; label: string; sub?: string; onToggle: () => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => { tap('select'); onToggle(); }} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: checked ? c.fg : c.line, backgroundColor: checked ? c.fg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Icon name="check" size={14} color={c.bg} stroke={2} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={checked ? { color: c.fg3, textDecorationLine: 'line-through' } : undefined}>{label}</Txt>
        {sub ? <Sub>{sub}</Sub> : null}
      </View>
    </Pressable>
  );
}

/* ---------- Écran ---------- */
export function Screen({ children, title, eyebrow, back, right, scroll = true, pad = true, testID, bottomInset = true }: { children: React.ReactNode; title?: string; eyebrow?: string; back?: boolean; right?: React.ReactNode; scroll?: boolean; pad?: boolean; testID?: string; bottomInset?: boolean }) {
  const { c } = useTheme(); const ins = useSafeAreaInsets(); const router = useRouter();
  const header = title ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 12 }}>
      {back ? <IconBtn name="left" accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Label numberOfLines={1}>{eyebrow}</Label> : null}
        <H2 numberOfLines={1}>{title}</H2>
      </View>
      {right}
    </View>
  ) : null;
  const body = scroll ? (
    <ScrollView testID={testID} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: pad ? GUTTER : 0, paddingBottom: 32 + (bottomInset ? ins.bottom : 0) }}>{children}</ScrollView>
  ) : <View testID={testID} style={{ flex: 1 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top }}>
      {header}
      {body}
    </View>
  );
}

export function Loading() {
  const { c } = useTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.accent} /></View>;
}

const s = StyleSheet.create({
  shadow: { shadowColor: '#111111', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
});
