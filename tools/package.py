from pathlib import Path
import plistlib,uuid,hashlib,json,zipfile,math,re
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/'dist'
URL='https://peiyangfantasist.github.io/KiocVoca/'
for size in (192,512):
    big=1024;im=Image.new('RGB',(big,big));px=im.load()
    for y in range(big):
        t=y/(big-1)
        c=tuple(round(a*(1-t)+b*t) for a,b in zip((255,172,112),(242,107,39)))
        for x in range(big):px[x,y]=c
    draw=ImageDraw.Draw(im)
    # Original geometric K, matching the app's vector mark.
    draw.polygon([(224,216),(360,216),(360,480),(616,216),(800,216),(504,516),(816,808),(624,808),(360,560),(360,808),(224,808)],fill='white')
    im.resize((size,size),Image.Resampling.LANCZOS).save(DIST/f'icon-{size}.png')
uid=lambda name:str(uuid.uuid5(uuid.NAMESPACE_URL,URL+name)).upper()
profile={'PayloadType':'Configuration','PayloadVersion':1,'PayloadIdentifier':'app.kiocvoca.profile','PayloadUUID':uid('profile'),
         'PayloadDisplayName':'KiocVoca','PayloadDescription':'在主屏幕添加 KiocVoca 背词应用。仅包含可移除的网页图标；不安装证书、VPN 或设备管理。',
         'PayloadOrganization':'KiocVoca','PayloadRemovalDisallowed':False,
         'PayloadContent':[{'PayloadType':'com.apple.webClip.managed','PayloadVersion':1,'PayloadIdentifier':'app.kiocvoca.webclip',
           'PayloadUUID':uid('webclip'),'PayloadDisplayName':'KiocVoca','Label':'KiocVoca','URL':URL+'#learn','FullScreen':True,
           'IsRemovable':True,'Precomposed':True,'Icon':(DIST/'icon-192.png').read_bytes()}]}
(DIST/'KiocVoca.mobileconfig').write_bytes(plistlib.dumps(profile,sort_keys=False))
asset_hash=hashlib.sha256(b''.join((DIST/n).read_bytes() for n in ['app.js','engine.js','style.css','words.json'])).hexdigest()[:10]
for p in DIST.iterdir():
    if re.fullmatch(r'(?:main|scheduler|ui|words)-[0-9a-f]{10}\.(?:js|css|json)',p.name):p.unlink()
entry=f'main-{asset_hash}.js';engine=f'scheduler-{asset_hash}.js';style=f'ui-{asset_hash}.css';words=f'words-{asset_hash}.json'
(DIST/entry).write_text((DIST/'app.js').read_text(encoding='utf-8').replace("'./engine.js'",f"'./{engine}'").replace("'./words.json'",f"'./{words}'"),encoding='utf-8')
(DIST/words).write_bytes((DIST/'words.json').read_bytes())
(DIST/engine).write_bytes((DIST/'engine.js').read_bytes());(DIST/style).write_bytes((DIST/'style.css').read_bytes())
html=(DIST/'index.html').read_text(encoding='utf-8')
html=re.sub(r'href="\./(?:style|ui-[0-9a-f]{10})\.css"',f'href="./{style}"',html)
html=re.sub(r'src="\./(?:app|main-[0-9a-f]{10})\.js"',f'src="./{entry}"',html)
(DIST/'index.html').write_text(html,encoding='utf-8')
content=''.join(hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DIST.iterdir()) if p.name!='sw.js' and p.is_file())
stamp=hashlib.sha256(content.encode()).hexdigest()[:12]
worker=(ROOT/'tools/sw-template.js').read_text(encoding='utf-8').replace('__HASH__',stamp)
worker=worker.replace("'./style.css'",f"'./{style}'").replace("'./app.js'",f"'./{entry}'").replace("'./engine.js'",f"'./{engine}'")
worker=worker.replace("'./words.json'",f"'./{words}'")
(DIST/'sw.js').write_text(worker,encoding='utf-8')
print(json.dumps({'url':URL,'cacheVersion':stamp,'payloads':len(profile['PayloadContent']),'profileBytes':(DIST/'KiocVoca.mobileconfig').stat().st_size}))
