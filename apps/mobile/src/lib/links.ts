import { Linking, Platform } from 'react-native';
import { telNorm, waLink, mapsLink } from '@amane/shared';

/** `tel:+33612345678` ou '' si le numéro est inexploitable. */
export function telUrl(tel: unknown): string {
  const n = telNorm(tel);
  return n ? `tel:+${n}` : '';
}
/** `https://wa.me/33612345678?text=…` ou '' sans numéro. */
export function waUrl(tel: unknown, text?: string): string {
  const n = telNorm(tel);
  return n ? waLink(n, text) : '';
}
/** Apple Plans sur iOS, Google Maps ailleurs (web, Android). */
export function mapsUrl(lieu: unknown, os: string = Platform.OS): string {
  const q0 = String(lieu || '').trim(); if (!q0) return '';
  return mapsLink(q0, { apple: os === 'ios' });
}
export const smsUrl = (tel: unknown) => { const n = telNorm(tel); return n ? `sms:+${n}` : ''; };
export const mailUrl = (email: unknown) => (/@/.test(String(email || '')) ? `mailto:${String(email).trim()}` : '');

export async function open(url: string): Promise<boolean> {
  if (!url) return false;
  try { await Linking.openURL(url); return true; } catch { return false; }
}
