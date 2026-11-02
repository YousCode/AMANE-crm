import re,os
S=os.path.dirname(os.path.abspath(__file__));B=os.path.join(os.path.dirname(S),'brand')
src=open(os.path.join(S,'src.html'),encoding='utf-8').read()
def svg(m):
    s=open(os.path.join(B,m.group(1)+'.svg'),encoding='utf-8').read().strip()
    return s.replace('<svg ','<svg aria-hidden="true" focusable="false" ',1)
def vid(m):
    for n in m.group(1).split('|'):
        if os.path.exists(os.path.join(S,'video',n+'.mp4')) and os.path.exists(os.path.join(S,'img',n+'-poster.jpg')): return n
    raise SystemExit('no video for '+m.group(1))
# Textes v2 (fr/en/es/ar) repris tels quels
v2=open(os.path.join(S,'src-v2.html'),encoding='utf-8').read()
a=v2.index('const I18N={');b=v2.index('\nlet LANG',a)
src=src.replace('{{I18N_V2}}',v2[a:b])
out=re.sub(r'\{\{SVG:([a-z]+)\}\}',svg,src)
out=re.sub(r'\{\{VID:([a-z|-]+)\}\}',vid,out)
assert '{{' not in out
open(os.path.join(S,'index.html'),'w',encoding='utf-8').write(out);print('built',len(out))
