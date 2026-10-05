import json,collections
d=json.load(open('docs/offres.json'))
o=d['offres'] if isinstance(d,dict) else d
def n(x,*k):
    for kk in k:
        if x.get(kk) not in (None,'',0): return x[kk]
    return None
bon=[]
for x in o:
    p=n(x,'prix','prixActuel','price')
    pa=n(x,'prixAvant','prixRef','prixReference','was')
    try: p=float(p); pa=float(pa)
    except: continue
    if pa>=p*1.15 and pa<p*5:
        r=round((1-p/pa)*100)
        if r>=15: bon.append((x.get('enseigne') or x.get('source'),r,p,pa,x.get('titre','')[:60]))
print('bonnes promos total',len(bon))
c=collections.Counter(b[0] for b in bon)
print('--- par enseigne ---')
for k,v in c.most_common(40): print(v,'|',k)
print('--- exemples non-Amazon ---')
for b in [b for b in bon if 'amazon' not in str(b[0]).lower()][:20]:
    print(b[1],'%',b[2],'<-',b[3],'|',b[0],'|',b[4])
