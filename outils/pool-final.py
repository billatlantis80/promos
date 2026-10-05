import json,collections
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
def amz(x):
    s=(str(x.get('enseigne',''))+str(x.get('source',''))+str(x.get('marchand',''))).lower()
    return 'amazon' in s
def num(v):
    try:
        f=float(v); return f if f>0 else None
    except: return None
GENERIQUE={'dealabs','hotukdeals','mydealz','chollometro','pepper','preisjaeger','presse','nl','pl','fr','de','es','it','pt','se','ie','gb','at','be','marchand',''}
non=[x for x in o if not amz(x)]
# offre d'enseigne exploitable = prix reel + marchand nomme (non generique)
ens=[x for x in non if num(x.get('prix')) and str(x.get('marchand','')).strip().lower() not in GENERIQUE and str(x.get('marchand','')).strip()]
print('Offres ENSEIGNE exploitables (prix reel + marchand nomme):', len(ens))
print('  par pays:', dict(sorted(collections.Counter(x.get('pays') for x in ens).items(), key=lambda kv:-kv[1])))
print('  avec chaleur communautaire >=100:', len([x for x in ens if num(x.get('temperature')) and x['temperature']>=100]))
print('  avec chaleur >=50:', len([x for x in ens if num(x.get('temperature')) and x['temperature']>=50]))
print()
print('Top marchands (offres exploitables):')
for k,v in collections.Counter(x.get('marchand') for x in ens).most_common(30): print(f'   {v:>4} {k}')
print()
amz_ok=[]
for x in o:
    if not amz(x): continue
    p=num(x.get('prix')); pa=num(x.get('prixAvant'))
    if p and pa and pa>=p*1.15 and pa<p*5: amz_ok.append(x)
print('Amazon promos verifiees 2 prix + >=15%:', len(amz_ok))
print('  par pays:', dict(sorted(collections.Counter(x.get('pays') for x in amz_ok).items(), key=lambda kv:-kv[1])))
