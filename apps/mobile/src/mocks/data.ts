import type { Client, Mission, Vehicule, Service, Partenaire, Conversation, Message, Activity } from '@amane/shared';
import { blankContrat } from '@/types';
import type { JournalEntry } from '@/types';
import { SERVICES, VEHICULES_DEFAUT } from '@amane/shared';

/* Jeu de données de démonstration : dates relatives à aujourd'hui pour que « Aujourd'hui » et le planning soient vivants. */
const now = new Date();
const at = (dayOff: number, h: number, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + dayOff); d.setHours(h, m, 0, 0); return d; };
const p2 = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
const iso = (d: Date) => d.toISOString();
const day = (d: Date) => local(d).slice(0, 10);

export const vehicules: (Vehicule & { journal: JournalEntry[] })[] = Object.entries(VEHICULES_DEFAUT).map(([id, v]) => ({ id, ...v, plaque: '', couleur: '', km: 0, revision: '', notes: '', journal: [] as JournalEntry[] }));
vehicules[0].plaque = 'GH-214-ZX'; vehicules[0].couleur = 'Nero Noctis'; vehicules[0].km = 12400; vehicules[0].revision = day(at(6, 9));
vehicules[0].journal = [
  { id: 'j1', dt: day(at(-12, 10)), type: 'entretien', notes: 'Révision 10 000 km, plaquettes avant.', cout: 1180, km: 11900, par: 'youssouf' },
  { id: 'j2', dt: day(at(-3, 17)), type: 'dommage', notes: 'Rayure légère pare-chocs arrière droit, constatée au retour.', cout: 0, km: 12380, par: 'youssouf' },
];
vehicules[1].plaque = 'GK-702-AB'; vehicules[1].couleur = 'Rosso Corsa'; vehicules[1].km = 6210;
vehicules[2].plaque = 'GJ-118-RT'; vehicules[2].couleur = 'Obsidienne'; vehicules[2].km = 20120; vehicules[2].statut = 'entretien'; vehicules[2].revision = day(at(1, 9));
vehicules[3].plaque = 'GL-903-MN'; vehicules[3].couleur = 'Gris Brooklyn'; vehicules[3].km = 15800;
vehicules[4].plaque = 'GM-451-VV'; vehicules[4].couleur = 'Noir Obsidienne'; vehicules[4].km = 31400;

export const services: Service[] = SERVICES.map((s) => ({ ...s }));

export const partenaires: Partenaire[] = [
  { id: 'p_karim', nom: 'Karim Benali', type: 'chauffeur', tel: '+33 6 11 22 33 44', langues: 'FR, AR, EN', adresse: '', commission: '', notes: 'Costume sombre, discret, connaît les palaces.', actif: true },
  { id: 'p_lucas', nom: 'Lucas Moreau', type: 'chauffeur', tel: '+33 6 55 66 77 88', langues: 'FR, EN', actif: true, notes: '' },
  { id: 'p_lasserre', nom: 'Lasserre', type: 'restaurant', contact: 'Maître d’hôtel', tel: '+33 1 43 59 02 13', adresse: '17 avenue Franklin-D.-Roosevelt, 75008 Paris', commission: 10, actif: true },
  { id: 'p_dior', nom: 'Dior — 30 Montaigne', type: 'boutique', contact: 'Salon privé', tel: '+33 1 40 73 73 73', adresse: '30 avenue Montaigne, 75008 Paris', commission: 8, actif: true },
  { id: 'p_garage', nom: 'Garage Prestige Neuilly', type: 'garage', tel: '+33 1 46 24 00 00', adresse: '12 rue de Chartres, 92200 Neuilly-sur-Seine', actif: true },
];

export const clients: Client[] = [
  { id: 'c_haddad', nom: 'Khalid Al-Mansoori', tel: '+971 50 123 4567', email: 'k.almansoori@example.com', langue: 'AR', pays: 'Émirats arabes unis', hotel: 'Plaza Athénée', canal: 'WhatsApp', statut: 'vip', responsable: 'amel', prefs: 'Eau plate, voiture noire, jamais de musique.', notes: 'Vient deux fois par an avec sa famille.', tags: ['vip', 'famille'], telNorm: '971501234567', entourage: [{ nom: 'Mme Al-Mansoori', lien: 'épouse' }, { nom: 'Trois enfants', lien: '8, 11 et 14 ans' }], datesImportantes: [{ date: '2026-12-02', label: 'Anniversaire de Madame' }], allergies: 'Fruits à coque (Madame)', marques: 'Dior, Hermès', attentions: ['Siège enfant 8 ans', 'Coran dans la boîte à gants'] },
  { id: 'c_whitmore', nom: 'James Whitmore', tel: '+44 7700 900123', email: 'james@example.co.uk', langue: 'EN', pays: 'Royaume-Uni', hotel: 'Le Bristol', canal: 'Palace / hôtel', statut: 'habitue', responsable: 'amel', prefs: 'Conduit lui-même, aime les supercars.', notes: '', tags: ['regulier'], telNorm: '447700900123' },
  { id: 'c_dupont', nom: 'Claire Dupont', tel: '06 12 34 56 78', email: 'claire.dupont@example.fr', langue: 'FR', pays: 'France', hotel: '', canal: 'Instagram', statut: 'client', responsable: 'amel', prefs: '', notes: 'Mariage en juin, van pour les invités.', telNorm: '33612345678' },
  { id: 'c_volkov', nom: 'Dmitri Volkov', tel: '+7 916 123 45 67', email: '', langue: 'RU', pays: 'Russie', hotel: 'Four Seasons George V', canal: 'Apporteur', statut: 'client', responsable: 'aziz', prefs: '', notes: '', telNorm: '79161234567' },
  { id: 'c_garcia', nom: 'Sofía García', tel: '+34 612 345 678', email: 'sofia@example.es', langue: 'ES', pays: 'Espagne', hotel: 'Hôtel Costes', canal: 'Site', statut: 'prospect', responsable: 'amel', prefs: '', notes: '', telNorm: '34612345678' },
];


export const missions: Mission[] = [
  {
    id: 'm_haddad', titre: 'Urus SE avec chauffeur — famille Al-Mansoori', clientId: 'c_haddad', service: 'chauffeur', vehiculeId: 'urus',
    debut: local(at(0, 20)), fin: local(at(0, 23, 30)), lieu: 'Plaza Athénée, 25 avenue Montaigne, 75008 Paris', montant: 1800, acompte: 540, statut: 'confirmee', responsable: 'amel',
    chauffeur: '', chauffeurId: 'p_karim', programme: [
      { dt: local(at(0, 20)), type: 'transfert', partenaireId: 'p_karim', lieu: 'Plaza Athénée', client: 'Votre chauffeur vous attend dans le hall.' },
      { dt: local(at(0, 20, 45)), type: 'restaurant', partenaireId: 'p_lasserre', lieu: 'Paris 8e', client: 'Table pour cinq, au calme.', notes: 'Commission 10 %' },
      { dt: local(at(1, 11)), type: 'shopping', partenaireId: 'p_dior', lieu: 'Faubourg Saint-Honoré', client: 'Rendez-vous privé, salon réservé.', notes: 'Commission 8 %' },
    ],
    taches: [
      { t: 'Confirmer le chauffeur', resp: 'youssouf', due: day(at(-2, 0)), fait: true },
      { t: 'Envoyer le nom du chauffeur au client', resp: 'amel', due: day(at(-1, 0)), fait: true },
      { t: 'Préparer eau, presse et chargeurs', resp: 'youssouf', due: day(at(0, 0)), fait: false },
      { t: 'Siège enfant dans l’Urus', resp: 'youssouf', due: day(at(0, 0)), fait: false },
    ],
    commissions: [{ partenaireId: 'p_lasserre', base: 900, pct: 10 }], paiement: 'acompte', notes: 'Famille de cinq. Madame : allergie fruits à coque — prévenir Lasserre.',
    devis: { numero: 'D-2026-0041', date: day(at(-4, 0)), statut: 'accepte', lignes: [{ d: 'Chauffeur VIP — Urus SE', q: 1, u: 'jour', pu: 1000 }, { d: 'Chauffeur privé — Karim Benali', q: 1, u: 'jour', pu: 500 }], remise: 0, tva: 20, paiements: [{ date: day(at(-3, 0)), montant: 540, moyen: 'virement' }], acceptedAt: iso(at(-3, 9)) },
    contrat: { ...blankContrat(), statut: 'signe', caution: 5000, cautionStatut: 'preautorisee', pieces: { permis: true, passeport: true, domicile: false } },
    convId: '971501234567', createdAt: iso(at(-5, 10)), updatedAt: iso(at(-1, 18)),
  },
  {
    id: 'm_whitmore', titre: 'Ferrari 296 GTB — week-end', clientId: 'c_whitmore', service: 'location', vehiculeId: 'f296',
    debut: local(at(0, 10)), fin: local(at(2, 19)), lieu: 'Le Bristol, 112 rue du Faubourg Saint-Honoré, 75008 Paris', montant: 3900, acompte: 1170, statut: 'encours', responsable: 'amel',
    chauffeur: '', chauffeurId: '', programme: [], taches: [
      { t: 'Préparation et lavage du véhicule', resp: 'youssouf', due: day(at(-1, 0)), fait: true },
      { t: 'État des lieux départ', resp: 'aziz', due: day(at(0, 0)), fait: true },
      { t: 'Retour du véhicule', resp: 'youssouf', due: day(at(2, 0)), fait: false },
      { t: 'État des lieux retour', resp: 'aziz', due: day(at(2, 0)), fait: false },
    ],
    commissions: [], paiement: 'acompte', notes: '',
    devis: { numero: 'D-2026-0039', date: day(at(-8, 0)), statut: 'accepte', lignes: [{ d: 'Voiture d’exception — Ferrari 296 GTB', q: 3, u: 'jour', pu: 1300 }], remise: 0, tva: 20, paiements: [{ date: day(at(-6, 0)), montant: 1170, moyen: 'cb' }] },
    contrat: { ...blankContrat(), statut: 'signe', caution: 15000, cautionStatut: 'preautorisee', pieces: { permis: true, passeport: true, domicile: true }, edlDepart: { fait: true, km: 6210, carburant: 'Plein', notes: 'RAS, pneus neufs.' } },
    createdAt: iso(at(-9, 10)), updatedAt: iso(at(0, 10)),
  },
  {
    id: 'm_dupont', titre: 'Van VIP — invités mariage', clientId: 'c_dupont', service: 'van', vehiculeId: 'classev',
    debut: local(at(5, 14)), fin: local(at(5, 23)), lieu: 'Mairie du 16e, 71 avenue Henri-Martin, 75116 Paris', montant: 650, acompte: 0, statut: 'proposition', responsable: 'amel',
    chauffeur: '', chauffeurId: 'p_lucas', programme: [], taches: [], commissions: [], paiement: 'non', notes: '8 invités, deux allers-retours.',
    devis: { numero: 'D-2026-0043', date: day(at(-1, 0)), statut: 'envoye', lignes: [{ d: 'Van VIP — Classe V avec chauffeur', q: 1, u: 'forfait', pu: 541.67 }], remise: 0, tva: 20, paiements: [] },
    contrat: blankContrat(), createdAt: iso(at(-2, 11)), updatedAt: iso(at(-1, 16)),
  },
  {
    id: 'm_volkov', titre: 'G 63 — semaine', clientId: 'c_volkov', service: 'location', vehiculeId: 'g63',
    debut: local(at(3, 10)), fin: local(at(9, 19)), lieu: 'Four Seasons George V, 31 avenue George V, 75008 Paris', montant: 4550, acompte: 0, statut: 'confirmee', responsable: 'aziz',
    chauffeur: '', chauffeurId: '', programme: [], taches: [{ t: 'État des lieux départ', resp: 'aziz', due: day(at(3, 0)), fait: false }], commissions: [], paiement: 'non', notes: '',
    devis: null, contrat: { ...blankContrat(), statut: 'envoye', caution: 8000 }, createdAt: iso(at(-3, 15)), updatedAt: iso(at(-1, 9)),
  },
  {
    id: 'm_garcia', titre: 'WhatsApp — Transfert CDG et shopping', clientId: 'c_garcia', service: 'transfert', vehiculeId: '',
    debut: local(at(2, 9)), fin: local(at(2, 13)), lieu: 'Aéroport CDG, terminal 2E', montant: '', acompte: '', statut: 'nouvelle', responsable: 'amel',
    chauffeur: '', chauffeurId: '', programme: [], taches: [], commissions: [], paiement: 'non', notes: 'Message d’origine : Hola, necesito un traslado desde CDG…',
    devis: null, contrat: blankContrat(), convId: '34612345678', source: 'whatsapp', canal: 'WhatsApp', createdAt: iso(at(0, 8, 40)), updatedAt: iso(at(0, 8, 41)),
  },
  {
    id: 'm_old', titre: 'M5 Touring — journée Deauville', clientId: 'c_whitmore', service: 'location', vehiculeId: 'm5',
    debut: local(at(-20, 9)), fin: local(at(-20, 21)), lieu: 'Le Bristol', montant: 450, acompte: 450, statut: 'terminee', responsable: 'amel',
    chauffeur: '', chauffeurId: '', programme: [], taches: [], commissions: [], paiement: 'solde', notes: '',
    devis: { numero: 'D-2026-0031', date: day(at(-25, 0)), statut: 'accepte', lignes: [{ d: 'Voiture d’exception — M5 Touring', q: 1, u: 'jour', pu: 450 }], remise: 0, tva: 20, paiements: [{ date: day(at(-19, 0)), montant: 540, moyen: 'cb' }], factureNumero: 'F-2026-0028', factureDate: day(at(-19, 0)) },
    contrat: { ...blankContrat(), statut: 'signe', caution: 5000, cautionStatut: 'restituee', pieces: { permis: true, passeport: true, domicile: true } }, createdAt: iso(at(-25, 10)), updatedAt: iso(at(-19, 10)),
  },
];

export const conversations: Conversation[] = [
  { id: '971501234567', phone: '971501234567', nom: 'Khalid', clientId: 'c_haddad', missionId: 'm_haddad', lang: 'AR', lastAt: iso(at(0, 9, 12)), lastText: 'هل يمكن إضافة مقعد للطفل في السيارة؟', lastDir: 'in', unread: 2, windowUntil: iso(at(1, 9, 12)), profil: 'Khalid A.', assigne: 'amel', aiSummary: 'Demande un siège enfant pour ce soir et confirme l’heure de 20 h.', aiDraft: 'Bonjour Monsieur Al-Mansoori, c’est noté : un siège enfant sera installé dans l’Urus. Karim vous attendra dans le hall du Plaza Athénée à 20 h précises.', aiFields: { passagers: 5, debut: local(at(0, 20)) } },
  { id: '34612345678', phone: '34612345678', nom: 'Sofía', clientId: 'c_garcia', missionId: 'm_garcia', lang: 'ES', lastAt: iso(at(0, 8, 40)), lastText: 'Hola, necesito un traslado desde CDG el jueves y luego una tarde de compras.', lastDir: 'in', unread: 1, windowUntil: iso(at(1, 8, 40)), profil: 'Sofía G.', aiSummary: 'Transfert CDG → Hôtel Costes jeudi matin, puis shopping l’après-midi, 2 personnes.', aiDraft: 'Hola Sofía, gracias por su mensaje. Nos ocupamos de su traslado desde CDG y de su tarde de compras.', aiFields: { service: 'transfert', debut: local(at(2, 9)), lieu: 'Aéroport CDG', passagers: 2 } },
  { id: '447700900123', phone: '447700900123', nom: 'James', clientId: 'c_whitmore', missionId: 'm_whitmore', lang: 'EN', lastAt: iso(at(0, 10, 25)), lastText: 'Keys received, thank you Youssouf. She sounds glorious.', lastDir: 'in', unread: 0, windowUntil: iso(at(1, 10, 25)), profil: 'James W.', assigne: 'youssouf' },
  { id: '33612345678', phone: '33612345678', nom: 'Claire', clientId: 'c_dupont', missionId: 'm_dupont', lang: 'FR', lastAt: iso(at(-1, 16, 5)), lastText: 'Vous : [Modèle amane_devis] Claire · D-2026-0043', lastDir: 'out', unread: 0, windowUntil: iso(at(-1, 9)), profil: 'Claire D.' },
  { id: '79161234567', phone: '79161234567', nom: 'Dmitri', clientId: 'c_volkov', missionId: 'm_volkov', lang: 'RU', lastAt: iso(at(-3, 18, 30)), lastText: 'Спасибо, жду договор.', lastDir: 'in', unread: 0, windowUntil: iso(at(-2, 18, 30)), profil: 'Dmitri V.', assigne: 'aziz' },
];

export const messages: Message[] = [
  // Fil arabe (Khalid)
  { id: 'w1', convId: '971501234567', dir: 'in', type: 'text', text: 'مرحباً، أود تأكيد موعد الليلة في الساعة الثامنة مساءً من فندق بلازا أتينيه.', translation: 'Bonjour, je voudrais confirmer le rendez-vous de ce soir à 20 h depuis l’hôtel Plaza Athénée.', at: iso(at(-1, 18, 2)), status: 'recu', by: 'client' },
  { id: 'w2', convId: '971501234567', dir: 'out', type: 'text', text: 'مرحباً سيد المنصوري، تم التأكيد: سيكون سائقكم كريم بانتظاركم في بهو الفندق في الساعة الثامنة تماماً.', translation: 'Bonjour Monsieur Al-Mansoori, c’est confirmé : votre chauffeur Karim vous attendra dans le hall de l’hôtel à 20 h précises.', at: iso(at(-1, 18, 20)), status: 'lu', by: 'amel' },
  { id: 'w3', convId: '971501234567', dir: 'note', type: 'text', text: 'Youssouf : vérifier qu’il y a bien un siège enfant dans l’Urus avant 19 h.', at: iso(at(-1, 18, 22)), status: 'recu', by: 'amel' },
  { id: 'w4', convId: '971501234567', dir: 'in', type: 'audio', text: '', media: { id: 'media_audio_1', mime: 'audio/ogg', duration: 42 } as Message['media'], transcript: 'شكراً جزيلاً. زوجتي تسأل إن كان بإمكانكم حجز طاولة لخمسة أشخاص بعد ذلك، في مكان هادئ.', translation: 'Merci beaucoup. Ma femme demande si vous pouvez réserver une table pour cinq ensuite, dans un endroit calme.', at: iso(at(0, 9, 5)), status: 'recu', by: 'client' },
  { id: 'w5', convId: '971501234567', dir: 'in', type: 'image', text: '', media: { id: 'media_img_1', mime: 'image/jpeg', caption: 'صورة جواز السفر' }, translation: 'Photo du passeport', at: iso(at(0, 9, 8)), status: 'recu', by: 'client' },
  { id: 'w6', convId: '971501234567', dir: 'in', type: 'text', text: 'هل يمكن إضافة مقعد للطفل في السيارة؟', translation: 'Est-il possible d’ajouter un siège enfant dans la voiture ?', at: iso(at(0, 9, 12)), status: 'recu', by: 'client' },
  // Fil espagnol (Sofía)
  { id: 's1', convId: '34612345678', dir: 'in', type: 'text', text: 'Hola, necesito un traslado desde CDG el jueves y luego una tarde de compras.', translation: 'Bonjour, j’ai besoin d’un transfert depuis CDG jeudi puis d’un après-midi shopping.', at: iso(at(0, 8, 40)), status: 'recu', by: 'client' },
  { id: 's2', convId: '34612345678', dir: 'out', type: 'text', text: 'Hola Sofía, gracias por su mensaje. Nos ocupamos de su solicitud y le respondemos muy pronto.', at: iso(at(0, 8, 41)), status: 'distribue', by: 'auto' },
  // Fil anglais (James)
  { id: 'e1', convId: '447700900123', dir: 'out', type: 'document', text: '', media: { id: 'media_pdf_1', mime: 'application/pdf', filename: 'contrat-D-2026-0039.pdf' }, at: iso(at(-1, 15)), status: 'lu', by: 'aziz' },
  { id: 'e2', convId: '447700900123', dir: 'in', type: 'document', text: '', media: { id: 'media_pdf_2', mime: 'application/pdf', filename: 'passport.pdf' }, at: iso(at(-1, 15, 30)), status: 'recu', by: 'client' },
  { id: 'e3', convId: '447700900123', dir: 'out', type: 'location', text: '', location: { lat: 48.8718, lng: 2.3147, name: 'Le Bristol', address: '112 rue du Faubourg Saint-Honoré, 75008 Paris' }, at: iso(at(0, 9, 30)), status: 'lu', by: 'youssouf' },
  { id: 'e4', convId: '447700900123', dir: 'in', type: 'text', text: 'Keys received, thank you Youssouf. She sounds glorious.', translation: 'Clés reçues, merci Youssouf. Elle a un son magnifique.', at: iso(at(0, 10, 25)), status: 'recu', by: 'client', emoji: '🔥' },
  // Fil français (Claire)
  { id: 'f1', convId: '33612345678', dir: 'in', type: 'text', text: 'Bonjour, est-ce que le van peut faire deux allers-retours entre la mairie et le lieu de réception ?', at: iso(at(-2, 9)), status: 'recu', by: 'client' },
  { id: 'f2', convId: '33612345678', dir: 'out', type: 'text', text: 'Bonjour Claire, tout à fait : Lucas assurera deux rotations, nous l’avons prévu dans le devis.', at: iso(at(-2, 9, 20)), status: 'lu', by: 'amel' },
  { id: 'f3', convId: '33612345678', dir: 'out', type: 'template', text: '[Modèle amane_devis] Claire · D-2026-0043', template: { name: 'amane_devis', lang: 'fr', params: ['Claire', 'D-2026-0043'] }, at: iso(at(-1, 16, 5)), status: 'distribue', by: 'amel' },
  // Fil russe (Dmitri)
  { id: 'r1', convId: '79161234567', dir: 'in', type: 'text', text: 'Спасибо, жду договор.', translation: 'Merci, j’attends le contrat.', at: iso(at(-3, 18, 30)), status: 'recu', by: 'client' },
];

export const activity: Activity[] = [
  { id: 'a1', at: iso(at(0, 8, 41)), user: 'whatsapp', col: 'missions', docId: 'm_garcia', action: 'whatsapp', resume: 'Nouvelle demande WhatsApp : Sofía García (nouveau client)' },
  { id: 'a2', at: iso(at(0, 10, 2)), user: 'aziz', col: 'missions', docId: 'm_whitmore', action: 'update', resume: 'statut : Confirmée → En cours ; modifié : contrat' },
  { id: 'a3', at: iso(at(-1, 16, 5)), user: 'amel', col: 'missions', docId: 'm_dupont', action: 'update', resume: 'statut : Nouvelle → Proposition' },
];

export const reglages = [
  { id: 'general', autoReply: true, horaires: { debut: '09:00', fin: '21:00' }, fuseau: 'Europe/Paris' },
  { id: 'templates', templates: [{ name: 'amane_relance', label: 'Reprise de contact', params: ['prénom'] }, { name: 'amane_rappel', label: 'Rappel de mission', params: ['prénom', 'heure', 'lieu'] }, { name: 'amane_devis', label: 'Envoi du devis', params: ['prénom', 'numéro'] }, { name: 'amane_alerte', label: 'Alerte équipe', params: ['nom', 'extrait'] }] },
  { id: 'rappels', veille: true, merci: true, acompte: true },
];
