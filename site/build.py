import re,base64,sys,os
S=os.path.dirname(os.path.abspath(__file__)); B=os.path.join(os.path.dirname(S),'brand')
src=open(os.path.join(S,'src.html'),encoding='utf-8').read()
frames=len([f for f in os.listdir(os.path.join(S,'frames'))]) if os.path.isdir(os.path.join(S,'frames')) else 0
def svg(name,cls=None):
    s=open(os.path.join(B,name+'.svg'),encoding='utf-8').read().strip()
    s=s.replace('<svg ','<svg aria-hidden="true" focusable="false" '+(f'class="{cls}" ' if cls else ''),1)
    return s
def rep(m):
    kind,rest=m.group(1),m.group(2)
    if kind=='SVG':
        parts=rest.split(':'); return svg(parts[0],parts[1] if len(parts)>1 else None)
    if kind=='B64':
        return base64.b64encode(open(os.path.join(B,rest+'.svg'),'rb').read()).decode()
three='vendor/three.min.js' if 'local' in sys.argv else 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
out=re.sub(r'\{\{(SVG|B64):([^}]+)\}\}',rep,src).replace('{{FRAME_COUNT}}',str(frames)).replace('{{THREE_SRC}}',three)
name='amane-local.html' if 'local' in sys.argv else 'amane-site.html'
open(os.path.join(S,name),'w',encoding='utf-8').write(out)
print('built',len(out),'bytes, frames',frames)
