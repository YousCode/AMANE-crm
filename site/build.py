import re,os,sys
S=os.path.dirname(os.path.abspath(__file__));B=os.path.join(os.path.dirname(S),'brand')
if not os.path.isdir(B): B=os.path.join(S,'..','brand')
src=open(os.path.join(S,'src.html'),encoding='utf-8').read()
def svg(m):
    s=open(os.path.join(B,m.group(1)+'.svg'),encoding='utf-8').read().strip()
    return s.replace('<svg ','<svg aria-hidden="true" focusable="false" ',1)
out=re.sub(r'\{\{SVG:([a-z]+)\}\}',svg,src)
assert '{{' not in out
open(os.path.join(S,'index.html'),'w',encoding='utf-8').write(out);print('built',len(out))
