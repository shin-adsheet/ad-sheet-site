from PIL import Image
import json, os
SRC='/home/claude/work/car3d/out/assets'
OUT='/home/claude/work/carlp/assets'
os.makedirs(OUT,exist_ok=True)
colors=['mint','pearl','sun','sky']
bb=None
for c in colors:
    for i in range(36):
        b=Image.open(f'{SRC}/spin/{c}/{i:02d}.png').getbbox()
        bb=b if bb is None else (min(bb[0],b[0]),min(bb[1],b[1]),max(bb[2],b[2]),max(bb[3],b[3]))
pad=4
bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(640,bb[2]+pad),min(360,bb[3]+pad))
fw,fh=bb[2]-bb[0],bb[3]-bb[1]
for c in colors:
    sheet=Image.new('RGBA',(fw*6,fh*6),(0,0,0,0))
    for i in range(36):
        sheet.paste(Image.open(f'{SRC}/spin/{c}/{i:02d}.png').crop(bb),((i%6)*fw,(i//6)*fh))
    sheet.save(f'{OUT}/spin_{c}.webp',quality=78,method=6)
json.dump({'fw':fw,'fh':fh,'cols':6,'n':36},open(f'{OUT}/spin.json','w'))
meta=json.load(open(f'{SRC}/side_mint.json'))
for c in colors:
    Image.open(f'{SRC}/side_body_{c}.png').save(f'{OUT}/side_body_{c}.webp',quality=84,method=6)
    Image.open(f'{SRC}/side_full_{c}.png').save(f'{OUT}/side_full_{c}.webp',quality=84,method=6)
cx,cy=meta['fw']['x'],meta['fw']['y']; m=int(meta['rpx']+6)
Image.open(f'{SRC}/side_wheel_raw.png').crop((int(cx-m),int(cy-m),int(cx+m),int(cy+m))).save(f'{OUT}/wheel.webp',quality=88,method=6)
for c in colors:
    im=Image.open(f'{SRC}/hero_{c}.png'); b=im.getbbox()
    im.crop((max(0,b[0]-10),max(0,b[1]-10),min(im.width,b[2]+10),min(im.height,b[3]+10))).save(f'{OUT}/hero_{c}.webp',quality=84,method=6)
json.dump(meta,open(f'{OUT}/side.json','w'))
tot=0
for f in sorted(os.listdir(OUT)):
    sz=os.path.getsize(f'{OUT}/{f}'); tot+=sz; print(f, sz//1024,'KB')
print('total',tot//1024,'KB','spin frame',fw,fh)
strip=Image.new('RGBA',(fw*4,fh*2),(240,243,240,255))
for k,i in enumerate([0,5,9,14,18,23,27,32]):
    strip.alpha_composite(Image.open(f'{SRC}/spin/sun/{i:02d}.png').crop(bb),((k%4)*fw,(k//4)*fh))
strip.convert('RGB').resize((fw*2,fh)).save('/home/claude/work/car3d/out/spin_preview.png')
