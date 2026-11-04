# @amane/shared

Types, constantes métier, règles pures, i18n, jetons de design et validation partagés par l'API (`apps/api`), le back-office (`apps/web`) et l'appli mobile (`apps/mobile`). JavaScript ES modules + `index.d.ts` : importable par Node 20, Vite et Metro sans étape de build.

```js
import { STATUTS, clashes, devisTotals, t, tokens, cssVars, validate } from '@amane/shared';
```

Tests : `npm test` (node --test).

## Constantes (`constants.js`)
| Export | Description |
|---|---|
| `TEAM`, `TEAM_IDS` | Amel (Relation client), Youssouf (Tech & flotte), Aziz (Contrats & conformité) |
| `STATUTS` | nouvelle, proposition, confirmee, encours, terminee, perdue (`{id,label}`) |
| `OPEN_STATUTS`, `BOOK_STATUTS`, `OPT_STATUTS`, `ACTIVE_STATUTS` | demandes ouvertes ; qui réservent un véhicule ; en option ; comptées dans le CA |
| `CLIENT_STATUTS`, `CLIENT_TAGS` | prospect, client, habitue, vip ; vip, regulier, delegation, famille, entreprise |
| `LANGUES`, `DOC_LANGS`, `WA_LANGS` | FR EN AR RU ZH ES IT DE ; langues des documents (FR EN ES AR) ; langues WhatsApp (FR EN ES AR RU) |
| `CANAUX`, `CONTRAT_ST`, `CAUTION_ST`, `PAIEMENT_ST`, `DEVIS_ST`, `UNITES`, `MOYENS`, `PART_TYPES`, `PROG_TYPES`, `JOURNAL_T`, `CARBURANT`, `PRIORITES`, `VEHICULE_STATUTS` | listes `{id,label}` du CRM |
| `TASK_TPL` | tâches types par service `[libellé, responsable, décalage]` |
| `SERVICES`, `SERVICE_IDS`, `SERVICES_DEFAUT` | les 8 services (tableau, ids, et forme indexée de la collection) |
| `VEHICULES_DEFAUT` | flotte de départ : Urus SE, Ferrari 296 GTB, G 63, M5 Touring, Classe V VIP |
| `WA_TEMPLATES` | modèles WhatsApp approuvés (`amane_relance`, `amane_rappel`, `amane_devis`, `amane_alerte`) et leurs variables |
| `RAPPEL_TYPES`, `RELANCE_TYPES`, `MESSAGE_TYPES`, `SLOGAN` | types de rappels/relances/messages ; « Arrive as a Guest. Leave with a Story. » |
| `labelOf(list, id)` | libellé d'un id dans une liste |

## Règles (`rules.js`, fonctions pures)
| Export | Description |
|---|---|
| `parseDate`, `toLocal`, `startOfDay`, `addDays`, `pad2` | dates locales « AAAA-MM-JJTHH:MM » |
| `durDays(m)`, `overlapDays(m, from, to)` | jours calendaires d'une mission ; jours communs avec une période |
| `clashes(m, missions)` | missions confirmées/en cours sur le même véhicule et le même créneau |
| `chClashes(m, missions)` | idem pour le chauffeur |
| `vehicleOn(v, missions, a, b, excl?)` | état d'un véhicule : libre `f`, réservé `b`, option `o`, indisponible `off` |
| `freeVehicles(vehicules, missions, from, to, {strict})` | « Qui est libre ? » |
| `tplTasks(m)` | tâches types avec dates d'échéance |
| `devisTotals(devis)` | HT, remise, base, TVA 20 %, TTC, réglé, solde (arrondis à 2 décimales) |
| `numeroFormat(kind, year, n)`, `numeroKey(kind, year)` | `D-2026-0001` / `F-2026-0001` ; clé de compteur `devis-2026` |
| `paiementStatut(m)` | `non` / `acompte` / `solde` d'après les règlements du devis, sinon montant/acompte |
| `nextStatut(s)`, `prevStatut(s)`, `statutLabel(s)` | parcours des statuts |
| `telNorm(tel)`, `telPlus`, `telFmt`, `telHref` | `33612345678` (format WhatsApp) ; `+33612345678` ; `+33 6 12 34 56 78` ; `tel:` |
| `waLink(tel, text)`, `mapsLink(lieu, {apple})` | liens WhatsApp et itinéraire |
| `detectLang(text)`, `langFromPhone(digits)`, `docLang(client)`, `isRtl(lang)` | langue du texte (AR/RU/FR/EN/ES ou null), par indicatif, des documents (EN par défaut) |
| `guessService(text)`, `guessServiceOrNull` | service deviné par mots-clés (`location` par défaut) |
| `firstName(nom)`, `fillVars(text, vars)`, `windowOpen(conv)` | prénom propre ; remplissage `{var}` ; fenêtre WhatsApp 24 h |

## i18n (`i18n.js`)
| Export | Description |
|---|---|
| `t(lang, key, vars)` | texte traduit, repli EN puis FR. Clés : `doc.*` (devis, facture, programme, carnet, page de devis, espace client), `quick.*` (réponses rapides WhatsApp : accuse, dates, caution, confirmation, remerciement, itineraire, chauffeur_en_route, devis_lien, espace_lien), `rappel.*` (veille, merci, acompte), `relance.*` (proposition, habitue, anniversaire, acompte, facture), `auto.jour`/`auto.nuit` |
| `DICT`, `LOCALES`, `normLang`, `hasT` | dictionnaires FR/EN/ES/AR/RU, locales Intl |
| `QUICK_REPLY_KEYS`, `QUICK_REPLY_LABELS` | liste des réponses rapides et leurs libellés FR pour l'interface |
| `fmtMoney(n, lang)`, `fmtDate(d, lang, opts, tz)`, `fmtTime(d, lang, tz)` | formats par langue |

## Jetons (`tokens.js`)
| Export | Description |
|---|---|
| `tokens` | `colors.light/dark`, `fonts` (Bodoni Moda, Jost, IBM Plex Mono), `radius` 12, `rail` 84, `tracking`, `touch` 44, `breakpoints`, `googleFonts`, `logoPath`, `slogan` |
| `cssVars(theme)` | déclarations CSS `--bg:…;--fg:…;` |
| `cssTheme()` | feuille complète clair/sombre (`prefers-color-scheme` + `data-theme`) |
| `logoSvg({size})` | le A à serrure en SVG inline |

## Validation (`validate.js`)
`validate.client(obj)`, `validate.mission(obj)`, `validate.devis(obj)`, `validate.vehicule(obj)`, `validate.partenaire(obj)`, `validate.service(obj)` → `{ ok, errors: { champ: 'message FR' } }`.
