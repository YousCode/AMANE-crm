// Textes par langue pour les documents client (devis, facture, programme, carnet : repris de `TXT` de crm/index.html),
// les réponses rapides WhatsApp, les rappels automatiques et les pages publiques (devis partagé, espace client).
// L'interface d'équipe reste en français : rien ici ne la concerne.
import { fillVars } from './rules.js';

export const LOCALES = Object.freeze({ FR: 'fr-FR', EN: 'en-GB', ES: 'es-ES', AR: 'ar', RU: 'ru-RU' });

const DOC = {
  FR: {
    quote: 'Devis', invoice: 'Facture', date: 'Date', client: 'Client', desc: 'Désignation', qty: 'Qté', unit: 'Unité', pu: 'Prix unitaire HT', total: 'Total HT', discount: 'Remise', vat: 'TVA', ttc: 'Total TTC', paid: 'Déjà réglé', due: 'Reste à payer', payments: 'Règlements', terms: 'Conditions',
    termsTxt: 'Devis valable 15 jours. Acompte de 30 % à la confirmation, solde à la remise des clés. Dépôt de garantie par pré-autorisation bancaire pour les locations.',
    bank: 'Coordonnées bancaires', prog: 'Programme de votre séjour', progIntro: 'Voici le programme préparé pour vous. Votre interlocuteur Amane reste joignable à tout moment.',
    'unit.jour': 'jour', 'unit.heure': 'heure', 'unit.forfait': 'forfait',
    'type.transfert': 'Transfert', 'type.restaurant': 'Restaurant', 'type.shopping': 'Shopping', 'type.visite': 'Visite', 'type.hotel': 'Hôtel', 'type.autre': 'Rendez-vous',
    hello: 'Bonjour {nom},', helloAnon: 'Bonjour,', sign: 'Bien à vous,\nAmane', ref: 'Référence',
    accept: 'Accepter le devis', accepted: 'Devis accepté — merci pour votre confiance. Nous revenons vers vous très vite.', acceptedAt: 'Accepté le {date}', ask: 'Poser une question', askText: 'Bonjour, j’ai une question au sujet du devis {numero}.',
    validUntil: 'Valable jusqu’au {date}', seeYou: 'À très bientôt chez Amane.',
    espace: 'Votre séjour', driver: 'Votre chauffeur', documents: 'Vos documents', balance: 'Solde', balanceDue: 'Reste à régler', balancePaid: 'Séjour réglé', contact: 'Nous écrire', call: 'Appeler', route: 'Itinéraire', nothingYet: 'Le programme vous sera communiqué prochainement.', expired: 'Ce lien n’est plus valable.',
  },
  EN: {
    quote: 'Quotation', invoice: 'Invoice', date: 'Date', client: 'Client', desc: 'Description', qty: 'Qty', unit: 'Unit', pu: 'Unit price excl. VAT', total: 'Total excl. VAT', discount: 'Discount', vat: 'VAT', ttc: 'Total incl. VAT', paid: 'Already paid', due: 'Balance due', payments: 'Payments', terms: 'Terms',
    termsTxt: 'Quotation valid for 15 days. 30% deposit on confirmation, balance on handover of the keys. Security deposit by card pre-authorisation for rentals.',
    bank: 'Bank details', prog: 'Your stay programme', progIntro: 'Here is the programme prepared for you. Your Amane contact remains available at any time.',
    'unit.jour': 'day', 'unit.heure': 'hour', 'unit.forfait': 'flat fee',
    'type.transfert': 'Transfer', 'type.restaurant': 'Restaurant', 'type.shopping': 'Shopping', 'type.visite': 'Visit', 'type.hotel': 'Hotel', 'type.autre': 'Appointment',
    hello: 'Dear {nom},', helloAnon: 'Hello,', sign: 'Kind regards,\nAmane', ref: 'Reference',
    accept: 'Accept the quotation', accepted: 'Quotation accepted — thank you for your trust. We will be in touch very shortly.', acceptedAt: 'Accepted on {date}', ask: 'Ask a question', askText: 'Hello, I have a question about quotation {numero}.',
    validUntil: 'Valid until {date}', seeYou: 'See you very soon at Amane.',
    espace: 'Your stay', driver: 'Your chauffeur', documents: 'Your documents', balance: 'Balance', balanceDue: 'Balance due', balancePaid: 'Fully paid', contact: 'Write to us', call: 'Call', route: 'Directions', nothingYet: 'Your programme will be shared with you shortly.', expired: 'This link is no longer valid.',
  },
  ES: {
    quote: 'Presupuesto', invoice: 'Factura', date: 'Fecha', client: 'Cliente', desc: 'Concepto', qty: 'Cant.', unit: 'Unidad', pu: 'Precio unitario sin IVA', total: 'Total sin IVA', discount: 'Descuento', vat: 'IVA', ttc: 'Total con IVA', paid: 'Ya abonado', due: 'Pendiente de pago', payments: 'Pagos', terms: 'Condiciones',
    termsTxt: 'Presupuesto válido 15 días. Anticipo del 30 % a la confirmación, saldo a la entrega de las llaves. Depósito de garantía mediante preautorización bancaria para los alquileres.',
    bank: 'Datos bancarios', prog: 'Programa de su estancia', progIntro: 'Este es el programa preparado para usted. Su contacto Amane sigue disponible en todo momento.',
    'unit.jour': 'día', 'unit.heure': 'hora', 'unit.forfait': 'tarifa fija',
    'type.transfert': 'Traslado', 'type.restaurant': 'Restaurante', 'type.shopping': 'Compras', 'type.visite': 'Visita', 'type.hotel': 'Hotel', 'type.autre': 'Cita',
    hello: 'Estimado/a {nom}:', helloAnon: 'Hola:', sign: 'Atentamente,\nAmane', ref: 'Referencia',
    accept: 'Aceptar el presupuesto', accepted: 'Presupuesto aceptado. Gracias por su confianza, le contactaremos muy pronto.', acceptedAt: 'Aceptado el {date}', ask: 'Hacer una pregunta', askText: 'Hola, tengo una pregunta sobre el presupuesto {numero}.',
    validUntil: 'Válido hasta el {date}', seeYou: 'Hasta muy pronto en Amane.',
    espace: 'Su estancia', driver: 'Su chófer', documents: 'Sus documentos', balance: 'Saldo', balanceDue: 'Pendiente de pago', balancePaid: 'Estancia pagada', contact: 'Escribirnos', call: 'Llamar', route: 'Cómo llegar', nothingYet: 'Le comunicaremos el programa próximamente.', expired: 'Este enlace ya no es válido.',
  },
  AR: {
    quote: 'عرض سعر', invoice: 'فاتورة', date: 'التاريخ', client: 'العميل', desc: 'البيان', qty: 'الكمية', unit: 'الوحدة', pu: 'سعر الوحدة دون ضريبة', total: 'المجموع دون ضريبة', discount: 'خصم', vat: 'ضريبة القيمة المضافة', ttc: 'المجموع شامل الضريبة', paid: 'المدفوع', due: 'المتبقي', payments: 'الدفعات', terms: 'الشروط',
    termsTxt: 'العرض صالح لمدة 15 يوماً. دفعة مقدمة 30٪ عند التأكيد، والباقي عند تسليم المفاتيح. تأمين عبر حجز مسبق على البطاقة البنكية للتأجير.',
    bank: 'البيانات البنكية', prog: 'برنامج إقامتكم', progIntro: 'إليكم البرنامج الذي أعددناه لكم. جهة تواصلكم في Amane متاحة في أي وقت.',
    'unit.jour': 'يوم', 'unit.heure': 'ساعة', 'unit.forfait': 'مبلغ ثابت',
    'type.transfert': 'تنقّل', 'type.restaurant': 'مطعم', 'type.shopping': 'تسوّق', 'type.visite': 'زيارة', 'type.hotel': 'فندق', 'type.autre': 'موعد',
    hello: 'مرحباً {nom}،', helloAnon: 'مرحباً،', sign: 'مع أطيب التحيات،\nAmane', ref: 'المرجع',
    accept: 'قبول عرض السعر', accepted: 'تم قبول عرض السعر، شكراً لثقتكم. سنعود إليكم في أقرب وقت.', acceptedAt: 'تم القبول في {date}', ask: 'طرح سؤال', askText: 'مرحباً، لديّ سؤال بخصوص عرض السعر {numero}.',
    validUntil: 'صالح حتى {date}', seeYou: 'إلى اللقاء قريباً في Amane.',
    espace: 'إقامتكم', driver: 'سائقكم', documents: 'مستنداتكم', balance: 'الرصيد', balanceDue: 'المبلغ المتبقي', balancePaid: 'تم سداد الإقامة', contact: 'راسلونا', call: 'اتصال', route: 'الاتجاهات', nothingYet: 'سنوافيكم بالبرنامج قريباً.', expired: 'هذا الرابط لم يعد صالحاً.',
  },
};

// Réponses rapides WhatsApp (variables : prenom, voiture, heure, lieu, date, chauffeur, montant, lien, numero).
const QUICK = {
  FR: {
    accuse: 'Bonjour {prenom}, merci pour votre message. Nous revenons vers vous très rapidement avec une proposition. Amel — Amane',
    dates: 'Bonjour {prenom}, pourriez-vous nous préciser vos dates et l’heure souhaitée pour {voiture} ? Nous vérifions la disponibilité dès réception.',
    caution: 'Bonjour {prenom}, pour la location de {voiture}, un dépôt de garantie par pré-autorisation bancaire est demandé à la remise des clés, ainsi qu’un permis et une pièce d’identité.',
    confirmation: 'Bonjour {prenom}, votre réservation est confirmée : {voiture}, le {date} à {heure}, {lieu}. Nous nous réjouissons de vous accueillir.',
    remerciement: 'Bonjour {prenom}, toute la maison Amane vous remercie pour votre confiance. Nous espérons vous revoir très bientôt à Paris.',
    itineraire: 'Bonjour {prenom}, voici l’itinéraire vers {lieu} : {lien}',
    chauffeur_en_route: 'Bonjour {prenom}, votre chauffeur {chauffeur} est en route et vous attendra à {heure}, {lieu}.',
    devis_lien: 'Bonjour {prenom}, voici votre devis {numero} : {lien}. Vous pouvez l’accepter en un geste ou nous poser une question. Amel — Amane',
    espace_lien: 'Bonjour {prenom}, votre espace séjour est prêt : programme, chauffeur et documents, tout est ici : {lien}',
  },
  EN: {
    accuse: 'Hello {prenom}, thank you for your message. We will come back to you very shortly with a proposal. Amel — Amane',
    dates: 'Hello {prenom}, could you let us know your dates and preferred time for {voiture}? We will check availability right away.',
    caution: 'Hello {prenom}, for the rental of {voiture}, a security deposit by card pre-authorisation is required on handover of the keys, along with a driving licence and an ID.',
    confirmation: 'Hello {prenom}, your booking is confirmed: {voiture}, on {date} at {heure}, {lieu}. We look forward to welcoming you.',
    remerciement: 'Hello {prenom}, the whole house of Amane thanks you for your trust. We hope to see you again very soon in Paris.',
    itineraire: 'Hello {prenom}, here are the directions to {lieu}: {lien}',
    chauffeur_en_route: 'Hello {prenom}, your chauffeur {chauffeur} is on the way and will be waiting for you at {heure}, {lieu}.',
    devis_lien: 'Hello {prenom}, here is your quotation {numero}: {lien}. You can accept it in one tap or ask us a question. Amel — Amane',
    espace_lien: 'Hello {prenom}, your stay page is ready: programme, chauffeur and documents, all in one place: {lien}',
  },
  ES: {
    accuse: 'Hola {prenom}, gracias por su mensaje. Le responderemos muy pronto con una propuesta. Amel — Amane',
    dates: 'Hola {prenom}, ¿podría indicarnos sus fechas y la hora deseada para {voiture}? Comprobamos la disponibilidad enseguida.',
    caution: 'Hola {prenom}, para el alquiler de {voiture} se solicita un depósito de garantía mediante preautorización bancaria a la entrega de las llaves, junto con el permiso de conducir y un documento de identidad.',
    confirmation: 'Hola {prenom}, su reserva está confirmada: {voiture}, el {date} a las {heure}, {lieu}. Será un placer recibirle.',
    remerciement: 'Hola {prenom}, toda la casa Amane le agradece su confianza. Esperamos volver a verle muy pronto en París.',
    itineraire: 'Hola {prenom}, aquí tiene el itinerario hacia {lieu}: {lien}',
    chauffeur_en_route: 'Hola {prenom}, su chófer {chauffeur} está en camino y le esperará a las {heure}, {lieu}.',
    devis_lien: 'Hola {prenom}, aquí tiene su presupuesto {numero}: {lien}. Puede aceptarlo con un toque o hacernos una pregunta. Amel — Amane',
    espace_lien: 'Hola {prenom}, su espacio de estancia está listo: programa, chófer y documentos, todo aquí: {lien}',
  },
  AR: {
    accuse: 'مرحباً {prenom}، شكراً لرسالتكم. سنعود إليكم قريباً جداً بعرض. أمل — Amane',
    dates: 'مرحباً {prenom}، هل يمكنكم تحديد تواريخكم والوقت المرغوب لـ {voiture}؟ سنتحقق من التوفر فور الاستلام.',
    caution: 'مرحباً {prenom}، لتأجير {voiture} يُطلب تأمين عبر حجز مسبق على البطاقة البنكية عند تسليم المفاتيح، مع رخصة القيادة وبطاقة هوية.',
    confirmation: 'مرحباً {prenom}، تم تأكيد حجزكم: {voiture}، يوم {date} الساعة {heure}، {lieu}. يسعدنا استقبالكم.',
    remerciement: 'مرحباً {prenom}، دار Amane بأكملها تشكركم على ثقتكم. نأمل أن نراكم مجدداً قريباً في باريس.',
    itineraire: 'مرحباً {prenom}، إليكم الاتجاهات إلى {lieu}: {lien}',
    chauffeur_en_route: 'مرحباً {prenom}، سائقكم {chauffeur} في الطريق وسيكون بانتظاركم الساعة {heure} في {lieu}.',
    devis_lien: 'مرحباً {prenom}، إليكم عرض السعر {numero}: {lien}. يمكنكم قبوله بلمسة واحدة أو طرح سؤال علينا. أمل — Amane',
    espace_lien: 'مرحباً {prenom}، صفحة إقامتكم جاهزة: البرنامج والسائق والمستندات، كل شيء هنا: {lien}',
  },
  RU: {
    accuse: 'Здравствуйте, {prenom}! Благодарим за сообщение. Мы очень скоро вернёмся к вам с предложением. Амель — Amane',
    dates: 'Здравствуйте, {prenom}! Уточните, пожалуйста, даты и желаемое время для {voiture}. Мы сразу проверим доступность.',
    caution: 'Здравствуйте, {prenom}! Для аренды {voiture} при передаче ключей требуется залог в виде предавторизации по банковской карте, а также водительское удостоверение и документ, удостоверяющий личность.',
    confirmation: 'Здравствуйте, {prenom}! Ваше бронирование подтверждено: {voiture}, {date} в {heure}, {lieu}. Будем рады вас встретить.',
    remerciement: 'Здравствуйте, {prenom}! Весь дом Amane благодарит вас за доверие. Надеемся вскоре снова увидеть вас в Париже.',
    itineraire: 'Здравствуйте, {prenom}! Вот маршрут до {lieu}: {lien}',
    chauffeur_en_route: 'Здравствуйте, {prenom}! Ваш водитель {chauffeur} уже в пути и будет ждать вас в {heure}, {lieu}.',
    devis_lien: 'Здравствуйте, {prenom}! Вот ваше коммерческое предложение {numero}: {lien}. Вы можете принять его одним нажатием или задать нам вопрос. Амель — Amane',
    espace_lien: 'Здравствуйте, {prenom}! Ваша страница поездки готова: программа, водитель и документы — всё здесь: {lien}',
  },
};

// Rappels automatiques (variables : prenom, service, date, heure, lieu, montant, voiture).
const RAPPEL = {
  FR: {
    veille: 'Bonjour {prenom}, nous vous attendons demain {date} à {heure}, {lieu}. Toute la maison Amane se réjouit de vous accueillir.',
    merci: 'Bonjour {prenom}, merci pour ce moment passé avec Amane. Nous espérons vous revoir très bientôt. Un mot, une envie : nous sommes là.',
    acompte: 'Bonjour {prenom}, votre réservation du {date} approche. Pour la confirmer définitivement, nous attendons l’acompte de {montant}. Nous restons à votre disposition.',
  },
  EN: {
    veille: 'Hello {prenom}, we look forward to seeing you tomorrow, {date} at {heure}, {lieu}. The whole house of Amane is delighted to welcome you.',
    merci: 'Hello {prenom}, thank you for the time spent with Amane. We hope to see you again very soon. A word, a wish: we are here.',
    acompte: 'Hello {prenom}, your booking on {date} is approaching. To confirm it definitively, we are expecting the deposit of {montant}. We remain at your disposal.',
  },
  ES: {
    veille: 'Hola {prenom}, le esperamos mañana {date} a las {heure}, {lieu}. Toda la casa Amane se alegra de recibirle.',
    merci: 'Hola {prenom}, gracias por el tiempo compartido con Amane. Esperamos volver a verle muy pronto. Para cualquier deseo, aquí estamos.',
    acompte: 'Hola {prenom}, su reserva del {date} se acerca. Para confirmarla definitivamente, esperamos el anticipo de {montant}. Quedamos a su disposición.',
  },
  AR: {
    veille: 'مرحباً {prenom}، ننتظركم غداً {date} الساعة {heure} في {lieu}. دار Amane بأكملها يسعدها استقبالكم.',
    merci: 'مرحباً {prenom}، شكراً لكم على هذا الوقت مع Amane. نأمل أن نراكم مجدداً قريباً. لأي طلب، نحن هنا.',
    acompte: 'مرحباً {prenom}، موعد حجزكم في {date} يقترب. لتأكيده نهائياً، ننتظر الدفعة المقدمة البالغة {montant}. نبقى في خدمتكم.',
  },
  RU: {
    veille: 'Здравствуйте, {prenom}! Ждём вас завтра, {date} в {heure}, {lieu}. Весь дом Amane будет рад вас встретить.',
    merci: 'Здравствуйте, {prenom}! Благодарим за время, проведённое с Amane. Надеемся вскоре увидеть вас снова. Любое пожелание — мы рядом.',
    acompte: 'Здравствуйте, {prenom}! Приближается дата вашего бронирования {date}. Для окончательного подтверждения мы ожидаем аванс в размере {montant}. Мы в вашем распоряжении.',
  },
};

// Relances (variables : prenom, voiture, date, montant, numero, objet).
const RELANCE = {
  FR: {
    proposition: 'Bonjour {prenom}, avez-vous pu consulter notre proposition pour {objet} ? Nous restons à votre disposition pour l’ajuster. Amel — Amane',
    habitue: 'Bonjour {prenom}, cela fait un moment que nous n’avons pas eu le plaisir de vous accueillir. Paris vous attend : dites-nous vos prochaines dates et nous préparons tout. Amel — Amane',
    anniversaire: 'Bonjour {prenom}, toute la maison Amane pense à vous en cette occasion ({objet}) et vous adresse ses vœux les plus chaleureux.',
    acompte: 'Bonjour {prenom}, votre réservation du {date} approche. Pour la confirmer définitivement, nous attendons l’acompte de {montant}. Nous restons à votre disposition.',
    facture: 'Bonjour {prenom}, sauf erreur de notre part, la facture {numero} ({montant}) reste à régler. Merci de nous indiquer si un détail vous retient. Amane',
  },
  EN: {
    proposition: 'Hello {prenom}, have you had a chance to look at our proposal for {objet}? We would be glad to adjust it. Amel — Amane',
    habitue: 'Hello {prenom}, it has been a while since we last had the pleasure of welcoming you. Paris awaits: share your next dates and we will prepare everything. Amel — Amane',
    anniversaire: 'Hello {prenom}, the whole house of Amane is thinking of you on this occasion ({objet}) and sends you its warmest wishes.',
    acompte: 'Hello {prenom}, your booking on {date} is approaching. To confirm it definitively, we are expecting the deposit of {montant}. We remain at your disposal.',
    facture: 'Hello {prenom}, unless we are mistaken, invoice {numero} ({montant}) remains outstanding. Please let us know if anything is holding you back. Amane',
  },
  ES: {
    proposition: 'Hola {prenom}, ¿ha podido consultar nuestra propuesta para {objet}? Quedamos a su disposición para ajustarla. Amel — Amane',
    habitue: 'Hola {prenom}, hace tiempo que no tenemos el placer de recibirle. París le espera: indíquenos sus próximas fechas y lo preparamos todo. Amel — Amane',
    anniversaire: 'Hola {prenom}, toda la casa Amane piensa en usted en esta ocasión ({objet}) y le envía sus mejores deseos.',
    acompte: 'Hola {prenom}, su reserva del {date} se acerca. Para confirmarla definitivamente, esperamos el anticipo de {montant}. Quedamos a su disposición.',
    facture: 'Hola {prenom}, salvo error por nuestra parte, la factura {numero} ({montant}) sigue pendiente. Indíquenos si algo le retiene. Amane',
  },
  AR: {
    proposition: 'مرحباً {prenom}، هل اطلعتم على عرضنا بخصوص {objet}؟ نبقى في خدمتكم لتعديله. أمل — Amane',
    habitue: 'مرحباً {prenom}، مضى وقت منذ أن تشرفنا باستقبالكم. باريس بانتظاركم: أخبرونا بتواريخكم القادمة وسنُعدّ كل شيء. أمل — Amane',
    anniversaire: 'مرحباً {prenom}، دار Amane بأكملها تفكر بكم في هذه المناسبة ({objet}) وتتقدم إليكم بأحرّ التهاني.',
    acompte: 'مرحباً {prenom}، موعد حجزكم في {date} يقترب. لتأكيده نهائياً، ننتظر الدفعة المقدمة البالغة {montant}. نبقى في خدمتكم.',
    facture: 'مرحباً {prenom}، ما لم نكن مخطئين، لا تزال الفاتورة {numero} ({montant}) قيد السداد. يُرجى إعلامنا إن كان هناك ما يعيقكم. Amane',
  },
  RU: {
    proposition: 'Здравствуйте, {prenom}! Удалось ли вам ознакомиться с нашим предложением по {objet}? Мы с радостью скорректируем его. Амель — Amane',
    habitue: 'Здравствуйте, {prenom}! Давно не имели удовольствия принимать вас. Париж ждёт: сообщите ваши ближайшие даты, и мы всё подготовим. Амель — Amane',
    anniversaire: 'Здравствуйте, {prenom}! Весь дом Amane думает о вас по этому случаю ({objet}) и шлёт самые тёплые пожелания.',
    acompte: 'Здравствуйте, {prenom}! Приближается дата вашего бронирования {date}. Для окончательного подтверждения мы ожидаем аванс в размере {montant}. Мы в вашем распоряжении.',
    facture: 'Здравствуйте, {prenom}! Если мы не ошибаемся, счёт {numero} ({montant}) ещё не оплачен. Сообщите, пожалуйста, если что-то вас останавливает. Amane',
  },
};

// Réponses automatiques jour/nuit (valeurs par défaut de reglages/general).
const AUTO = {
  FR: { jour: 'Bonjour {prenom}, merci pour votre message. Amel, de la maison Amane, vous répond personnellement dans quelques minutes.', nuit: 'Bonjour {prenom}, merci pour votre message. Nous vous répondons personnellement dès 9 h demain matin. Pour une urgence, appelez-nous.' },
  EN: { jour: 'Hello {prenom}, thank you for your message. Amel, from the house of Amane, will reply to you personally within a few minutes.', nuit: 'Hello {prenom}, thank you for your message. We will reply to you personally from 9 a.m. tomorrow morning. For anything urgent, please call us.' },
  AR: { jour: 'مرحباً {prenom}، شكراً لرسالتكم. ستردّ عليكم أمل من دار Amane شخصياً خلال دقائق.', nuit: 'مرحباً {prenom}، شكراً لرسالتكم. سنردّ عليكم شخصياً ابتداءً من الساعة التاسعة صباح الغد. للحالات العاجلة، يُرجى الاتصال بنا.' },
  ES: { jour: 'Hola {prenom}, gracias por su mensaje. Amel, de la casa Amane, le responderá personalmente en unos minutos.', nuit: 'Hola {prenom}, gracias por su mensaje. Le responderemos personalmente mañana a partir de las 9 h. Para cualquier urgencia, llámenos.' },
  RU: { jour: 'Здравствуйте, {prenom}! Благодарим вас за сообщение. Амель из дома Amane лично ответит вам в течение нескольких минут.', nuit: 'Здравствуйте, {prenom}! Благодарим вас за сообщение. Мы лично ответим вам завтра с 9 утра. В срочных случаях, пожалуйста, позвоните нам.' },
};

/** Dictionnaires complets, clés préfixées : doc.*, quick.*, rappel.*, relance.*, auto.* */
export const DICT = Object.freeze(Object.fromEntries(['FR', 'EN', 'ES', 'AR', 'RU'].map((L) => [L, Object.freeze({
  ...Object.fromEntries(Object.entries(DOC[L] || {}).map(([k, v]) => ['doc.' + k, v])),
  ...Object.fromEntries(Object.entries(QUICK[L] || {}).map(([k, v]) => ['quick.' + k, v])),
  ...Object.fromEntries(Object.entries(RAPPEL[L] || {}).map(([k, v]) => ['rappel.' + k, v])),
  ...Object.fromEntries(Object.entries(RELANCE[L] || {}).map(([k, v]) => ['relance.' + k, v])),
  ...Object.fromEntries(Object.entries(AUTO[L] || {}).map(([k, v]) => ['auto.' + k, v])),
})])));

export const QUICK_REPLY_KEYS = Object.freeze(Object.keys(QUICK.FR));
export const QUICK_REPLY_LABELS = Object.freeze({
  accuse: 'Accusé de réception', dates: 'Demander les dates', caution: 'Caution et pièces', confirmation: 'Confirmation', remerciement: 'Remerciement',
  itineraire: 'Itinéraire', chauffeur_en_route: 'Chauffeur en route', devis_lien: 'Lien du devis', espace_lien: 'Lien de l’espace client',
});

export function normLang(lang) {
  const L = String(lang || '').toUpperCase().slice(0, 2);
  return DICT[L] ? L : null;
}

/**
 * t(lang, key, vars) : texte traduit, variables `{x}` remplacées (absentes → retirées proprement).
 * Repli : langue demandée → EN → FR → la clé elle-même.
 */
export function t(lang, key, vars) {
  const L = normLang(lang) || 'EN';
  const raw = DICT[L][key] ?? DICT.EN[key] ?? DICT.FR[key];
  if (raw === undefined) return key;
  return vars ? fillVars(raw, vars) : raw;
}

/** Vrai si la langue a une traduction propre de la clé. */
export const hasT = (lang, key) => { const L = normLang(lang); return Boolean(L && DICT[L][key] !== undefined); };

/** Montant en euros dans la locale de la langue (« 1 300,00 € », « €1,300.00 »). */
export function fmtMoney(n, lang = 'FR', { decimals = 2 } = {}) {
  return new Intl.NumberFormat(LOCALES[normLang(lang) || 'FR'] || 'fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(+n || 0);
}

/** Date lisible dans la langue (« jeudi 20 novembre 2026 »). */
export function fmtDate(d, lang = 'FR', opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, timeZone) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[normLang(lang) || 'FR'] || 'fr-FR', { ...opts, ...(timeZone ? { timeZone } : {}) }).format(x);
}
export function fmtTime(d, lang = 'FR', timeZone) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[normLang(lang) || 'FR'] || 'fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(timeZone ? { timeZone } : {}) }).format(x);
}
