# Projet Vercel dédié au CRM : copie site/crm/index.html à la racine de crm-vercel/ (Root Directory = crm-vercel).
import os,shutil
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=os.path.join(R,'site','crm','index.html');dst=os.path.join(R,'crm-vercel','index.html')
shutil.copyfile(src,dst);shutil.copyfile(os.path.join(R,'site','favicon.svg'),os.path.join(R,'crm-vercel','favicon.svg'))
print('crm-vercel/index.html',os.path.getsize(dst))
