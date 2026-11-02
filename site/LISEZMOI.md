# Site Amane

Site international (français, anglais, espagnol, arabe de droite à gauche), sobre : noir, pierre, filets or.

- `index.html` : page publiée. `src.html` + `python3 build.py` la regénèrent (insère les logos de `../brand`).
- `video/` : 8 boucles Higgsfield (MP4 + WebM), chargées seulement quand elles deviennent visibles.
- `img/` : posters et photos ; `frames/` : la porte qui s'ouvre au défilement (48 images).
- Dépendance : Lenis 1.1.13 (défilement doux) depuis unpkg ; le site fonctionne sans.

À compléter dans `src.html` : `WHATSAPP_NUMBER` et l'e-mail `[E-MAIL]`, puis relancer `build.py`.
