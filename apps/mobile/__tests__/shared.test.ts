import { telNorm, waLink, mapsLink, t, detectLang, devisTotals, durDays, nextStatut, prevStatut, clashes, numeroFormat, tplTasks, validate } from '@amane/shared';
import { mapsUrl, telUrl, waUrl } from '@/lib/links';

describe('règles partagées (@amane/shared)', () => {
  test('telNorm : formats français et internationaux', () => {
    expect(telNorm('06 12 34 56 78')).toBe('33612345678');
    expect(telNorm('+971 50 123 4567')).toBe('971501234567');
    expect(telNorm('0044 7700 900123')).toBe('447700900123');
    expect(telNorm('abc')).toBe('');
  });
  test('liens : tel, wa.me, plans', () => {
    expect(telUrl('06 12 34 56 78')).toBe('tel:+33612345678');
    expect(waUrl('+971 50 123 4567', 'Bonjour')).toBe('https://wa.me/971501234567?text=Bonjour');
    expect(waLink('33612345678')).toBe('https://wa.me/33612345678');
    expect(mapsLink('Plaza Athénée')).toBe('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('Plaza Athénée, Paris'));
    expect(mapsUrl('Plaza Athénée, 75008 Paris', 'ios')).toBe('https://maps.apple.com/?daddr=' + encodeURIComponent('Plaza Athénée, 75008 Paris'));
    expect(mapsUrl('Le Bristol', 'android')).toContain('google.com/maps/dir/');
    expect(mapsUrl('', 'ios')).toBe('');
  });
  test('i18n : réponses rapides par langue, variables vides retirées', () => {
    expect(t('AR', 'quick.accuse', { prenom: 'Khalid' })).toContain('Khalid');
    expect(t('FR', 'quick.accuse', { prenom: '' })).toMatch(/^Bonjour, merci/);
    expect(t('EN', 'doc.hello', { nom: 'James' })).toBe('Dear James,');
    expect(t('ES', 'doc.helloAnon')).toBe('Hola:');
    expect(t('ZZ', 'doc.quote')).toBe('Quotation');
  });
  test('detectLang', () => {
    expect(detectLang('مرحباً، أود تأكيد موعد الليلة')).toBe('AR');
    expect(detectLang('Спасибо, жду договор')).toBe('RU');
    expect(detectLang('Hello, we would like the car for the weekend')).toBe('EN');
    expect(detectLang('Bonjour, nous voulons la voiture pour le week-end')).toBe('FR');
  });
  test('devis : totaux TVA 20 %, réglé, reste', () => {
    const tot = devisTotals({ lignes: [{ d: 'Urus', q: 2, u: 'jour', pu: 1000 }], remise: 10, tva: 20, paiements: [{ date: '2026-01-01', montant: 540, moyen: 'cb' }] });
    expect(tot).toMatchObject({ ht: 2000, rem: 200, base: 1800, tva: 360, ttc: 2160, paid: 540, solde: 1620 });
    expect(numeroFormat('devis', 2026, 1)).toBe('D-2026-0001');
    expect(numeroFormat('facture', 2026, 12)).toBe('F-2026-0012');
  });
  test('durée, statuts, conflits, tâches, validation', () => {
    expect(durDays({ debut: '2026-11-03T10:00', fin: '2026-11-05T19:00' })).toBe(3);
    expect(nextStatut('nouvelle')).toBe('proposition'); expect(nextStatut('terminee')).toBeNull(); expect(prevStatut('confirmee')).toBe('proposition');
    const a: any = { id: 'a', vehiculeId: 'urus', statut: 'confirmee', debut: '2026-11-03T10:00', fin: '2026-11-05T19:00' };
    const b: any = { id: 'b', vehiculeId: 'urus', statut: 'confirmee', debut: '2026-11-04T10:00', fin: '2026-11-04T19:00' };
    expect(clashes(b, [a, b]).map((x) => x.id)).toEqual(['a']);
    expect(tplTasks({ debut: '2026-11-03T10:00', fin: '2026-11-05T19:00', service: 'location' })[0]).toMatchObject({ t: 'Préparation et lavage du véhicule', resp: 'youssouf', due: '2026-11-02', fait: false });
    expect(validate.mission({ titre: '' }).errors.titre).toBeTruthy();
    expect(validate.client({ nom: 'X', tel: '12' }).errors.tel).toBeTruthy();
  });
});
