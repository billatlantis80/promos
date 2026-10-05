import json, re, collections
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
def amz(x):
    s=(str(x.get('enseigne',''))+str(x.get('source',''))+str(x.get('marchand',''))).lower()
    return 'amazon' in s
non=[x for x in o if not amz(x)]
# marqueurs d'ancien prix / de remise, 9 langues
MARQ = [
 ('fr','au lieu de|auparavant|prix barré|en promo'),
 ('de','statt|vorher|früher|urspr'),
 ('it','invece di|invece|anzich|prima '),
 ('es','antes|en vez de|antes costaba|por solo'),
 ('pt','em vez de|antes|em promo'),
 ('nl','in plaats van|i.p.v|voorheen|van '),
 ('pl','zamiast|przedtem|cena '),
 ('en','instead of|was |rrp|down from|reduced from'),
 ('sv','i stället för|tidigare|istället'),
]
PAT = re.compile('(' + '|'.join(p for _,p in MARQ) + ')', re.I)
PM = re.compile(r'(\d+[.,]?\d*)\s*(€|EUR|zł|kr|£)')
hits=[]
for x in non:
    t=(str(x.get('titre') or ''))
    if PAT.search(t) and len(PM.findall(t))>=1:
        hits.append(x)
print('non-Amazon titres avec ancien prix (9 langues):', len(hits))
print('pays:', collections.Counter(x.get('pays') for x in hits).most_common())
for x in hits[:20]:
    print(' ', x.get('pays'),'|',x.get('marchand'),'|',str(x.get('titre'))[:95])
# et avec DEUX prix dans le titre
deux=[x for x in non if len(PM.findall(str(x.get('titre') or '')))>=2]
print()
print('non-Amazon avec 2 prix DANS LE TITRE:', len(deux))
print('pays:', collections.Counter(x.get('pays') for x in deux).most_common())
for x in deux[:15]:
    print(' ', x.get('pays'),'|',x.get('marchand'),'|',str(x.get('titre'))[:95])
