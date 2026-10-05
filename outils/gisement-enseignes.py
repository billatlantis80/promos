import json,collections,re
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
AMZ=('amazon',)
def estAmz(x):
    s=(str(x.get('enseigne',''))+str(x.get('source',''))+str(x.get('marchand',''))).lower()
    return 'amazon' in s
def num(v):
    try:
        f=float(v); return f if f>0 else None
    except: return None
# gisement non-Amazon
pool=collections.defaultdict(lambda: [0,0,0,0])  # pays -> [total, prix, prix+remise, marchand reel]
marchands=collections.Counter()
for x in o:
    if estAmz(x): continue
    p=x.get('pays','?')
    pool[p][0]+=1
    px=num(x.get('prix'))
    rm=num(x.get('remise'))
    m=str(x.get('marchand') or '')
    src=str(x.get('source') or '')
    # marchand reel = different du nom de source et non generique
    reel = m and m.lower() not in ('','dealabs','hotukdeals','mydealz','chollometro','pepper','nl','pl','de','fr','preisjaeger','amso') and m.lower()!=src.lower()
    if px: pool[p][1]+=1
    if px and rm: pool[p][2]+=1
    if px and rm and reel: pool[p][3]+=1
    if reel: marchands[m]+=1
print('PAYS            total  avecPrix  prix+remise  +marchandReel')
for p,v in sorted(pool.items(), key=lambda kv:-kv[1][0]):
    print(f'{p:<12} {v[0]:>6} {v[1]:>9} {v[2]:>12} {v[3]:>15}')
t=[sum(v[i] for v in pool.values()) for i in range(4)]
print(f'{"TOTAL":<12} {t[0]:>6} {t[1]:>9} {t[2]:>12} {t[3]:>15}')
print()
print('--- marchands reels les plus vus (non-Amazon) ---')
for k,v in marchands.most_common(30): print(f'{v:>5} {k}')
