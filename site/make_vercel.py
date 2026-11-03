# Génère vercel.html : la page du site en document HTML complet, pour un hébergement classique (Vercel).
import os
S=os.path.dirname(os.path.abspath(__file__))
src=open(os.path.join(S,'index.html'),encoding='utf-8').read()
i=src.find('<style')
head,body=src[:i],src[i:]
doc=('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
     '<meta property="og:title" content="Amane — Conciergerie privée, Paris">\n'
     '<meta property="og:description" content="Voitures d\'exception, chauffeurs et séjours sur mesure à Paris. Un seul interlocuteur.">\n'
     '<meta property="og:image" content="img/jour-montaigne-poster.jpg">\n'
     '<meta name="theme-color" content="#FAF8F4">\n'
     + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
open(os.path.join(S,'vercel.html'),'w',encoding='utf-8').write(doc)
print('vercel.html', len(doc))
