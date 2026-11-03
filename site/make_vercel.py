# Génère les pages pour un hébergement classique (Vercel) :
#   site/vercel.html     : le site, document HTML complet
#   site/crm/index.html  : le CRM (crm/index.html), document HTML complet ; hors de claude.ai il enregistre dans le navigateur
# À relancer après toute modification de site/index.html ou de crm/index.html : python3 site/make_vercel.py
import os
S=os.path.dirname(os.path.abspath(__file__))
R=os.path.dirname(S)

src=open(os.path.join(S,'index.html'),encoding='utf-8').read()
i=src.find('<style')
head,body=src[:i],src[i:]
doc=('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
     '<meta property="og:title" content="Amane — Conciergerie privée, Paris">\n'
     '<meta property="og:description" content="Voitures d\'exception, chauffeurs et séjours sur mesure à Paris. Un seul interlocuteur.">\n'
     '<meta property="og:image" content="img/jour-montaigne-poster.jpg">\n'
     '<meta name="theme-color" content="#FAF8F4">\n'
     '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'
     + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n')
open(os.path.join(S,'vercel.html'),'w',encoding='utf-8').write(doc)
print('vercel.html', len(doc))

crm=open(os.path.join(R,'crm','index.html'),encoding='utf-8').read()
j=crm.find('</style>')+len('</style>')
chead,cbody=crm[:j],crm[j:]
cdoc=('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
      '<meta name="robots" content="noindex,nofollow">\n'
      '<meta name="theme-color" content="#FAF8F4">\n'
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'
      + chead + '\n</head>\n<body>\n' + cbody + '\n</body>\n</html>\n')
os.makedirs(os.path.join(S,'crm'),exist_ok=True)
open(os.path.join(S,'crm','index.html'),'w',encoding='utf-8').write(cdoc)
print('crm/index.html', len(cdoc))
