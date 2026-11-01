from pathlib import Path
import plistlib,uuid,hashlib,json,zipfile,math
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
content=''.join(hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DIST.iterdir()) if p.name!='sw.js' and p.is_file())
stamp=hashlib.sha256(content.encode()).hexdigest()[:12]
(DIST/'sw.js').write_text((ROOT/'tools/sw-template.js').read_text(encoding='utf-8').replace('__HASH__',stamp),encoding='utf-8')
print(json.dumps({'url':URL,'cacheVersion':stamp,'payloads':len(profile['PayloadContent']),'profileBytes':(DIST/'KiocVoca.mobileconfig').stat().st_size}))
