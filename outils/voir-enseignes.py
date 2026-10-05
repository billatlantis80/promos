import json
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
seen={}
for x in o:
    e=str(x.get('enseigne') or x.get('source'))
    for k in ('Dealabs','HotUKDeals','MyDealz','Chollometro','Pepper','Preisjäger','Coolblue','Presse BE (fr) 1'):
        if k.lower() in e.lower() and k not in seen:
            seen[k]=x
for k,x in seen.items():
    print('='*70)
    print(k)
    for kk,vv in x.items():
        s=str(vv)
        if len(s)>200: s=s[:200]+'…'
        print('   ',kk,'=',s)
