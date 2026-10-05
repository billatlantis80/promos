import json,collections
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
GENERIQUE={'dealabs','hotukdeals','mydealz','chollometro','pepper','preisjaeger','presse','nl','pl','fr','de','es','it','pt','se','ie','gb','at','be','marchand',''}
def amz(x):
    s=(str(x.get('enseigne',''))+str(x.get('source',''))+str(x.get('marchand',''))).lower()
    return 'amazon' in s
def num(v):
    try:
        f=float(v); return f if f>0 else None
    except: return None
non=[x for x in o if not amz(x)]
print('non-Amazon total:',len(non))
deux=[x for x in non if num(x.get('prix')) and num(x.get('prixAvant'))]
print('deux prix REELLES:',len(deux))
r15=[x for x in deux if x['prixAvant']>=x['prix']*1.15 and x['prixAvant']<x['prix']*5]
print('  dont remise>=15%:',len(r15))
print('  pays:',collections.Counter(x.get('pays') for x in r15).most_common())
print('  marchands:',collections.Counter(x.get('marchand') for x in r15).most_common(12))
mrk=[x for x in non if num(x.get('prix')) and str(x.get('marchand','')).strip().lower() not in GENERIQUE and str(x.get('marchand','')).strip()]
print('prix reel + marchand nomme:',len(mrk))
avec_rem=[x for x in mrk if num(x.get('remise'))]
print('  dont remise annoncee par la source:',len(avec_rem))
print('  pays:',collections.Counter(x.get('pays') for x in avec_rem).most_common())
print('  marchands:',collections.Counter(x.get('marchand') for x in avec_rem).most_common(25))
