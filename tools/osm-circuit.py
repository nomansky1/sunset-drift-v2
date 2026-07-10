# Global Drift — OSM street-circuit generator (Phase 5)
# Pulls the drivable road graph for a small city bbox from the Overpass API (OpenStreetMap,
# (c) OpenStreetMap contributors, ODbL — NEVER Google), finds a closed loop of real streets
# with a good racing length, and emits a TRACKS-style ctrl[] scaled to the +/-186 world box.
#   python tools/osm-circuit.py            # all cities
#   python tools/osm-circuit.py sanjuan    # one city
import json, math, sys, time, urllib.request, urllib.parse

CITIES = {
  # bbox = (south, west, north, east) — kept small so Overpass stays fast and loops stay raceable
  'nyc':     {'bbox':(40.7520,-73.9950,40.7650,-73.9750), 'name':'MANHATTAN GP',  'sub':'NEW YORK · STREET CIRCUIT'},
  'miami':   {'bbox':(25.7710,-80.1360,25.7860,-80.1240), 'name':'OCEAN DRIVE GP','sub':'MIAMI · SOUTH BEACH STREETS'},
  'sanjuan': {'bbox':(18.4580,-66.1250,18.4700,-66.0950), 'name':'VIEJO SAN JUAN','sub':'PUERTO RICO · OLD TOWN STREETS', 'target':(1800,6500), 'sep':42},
  'london':  {'bbox':(51.5000,-0.1350,51.5150,-0.1050), 'name':'WESTMINSTER GP','sub':'LONDON · REAL STREETS'},
  'paris':   {'bbox':(48.8650,2.2950,48.8760,2.3200),   'name':'CHAMPS CIRCUIT','sub':'PARIS · REAL STREETS'},
  'tokyo':   {'bbox':(35.6550,139.6900,35.6650,139.7100),'name':'SHIBUYA SPRINT','sub':'TOKYO · REAL STREETS'},
  'berlin':  {'bbox':(52.5120,13.3700,52.5250,13.4000), 'name':'MITTE RING','sub':'BERLIN · REAL STREETS'},
  'dubai':   {'bbox':(25.1900,55.2650,25.2050,55.2850), 'name':'DOWNTOWN DUBAI','sub':'DUBAI · REAL STREETS'},
  'rio':     {'bbox':(-22.9750,-43.1950,-22.9620,-43.1750),'name':'COPACABANA RUN','sub':'RIO · REAL STREETS'},
  'moscow':  {'bbox':(55.7550,37.5900,55.7700,37.6150), 'name':'TVERSKAYA LOOP','sub':'MOSCOW · REAL STREETS'},
  'mumbai':  {'bbox':(18.9250,72.8250,18.9400,72.8400), 'name':'FORT DISTRICT','sub':'MUMBAI · REAL STREETS'},
}
HIGHWAYS = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified'

def overpass(bbox, cachekey):
    import os
    cache=f'tools/.osm-cache-{cachekey}.json'
    if os.path.exists(cache):
        print('[osm]', cachekey, 'using cached OSM data')
        return json.load(open(cache, encoding='utf-8'))
    q = f"""[out:json][timeout:60];
(way["highway"~"^({HIGHWAYS})$"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););
(._;>;); out body;"""
    last=None
    for ep in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
        for attempt in range(2):
            try:
                req = urllib.request.Request(ep,
                    data=urllib.parse.urlencode({'data': q}).encode(),
                    headers={'User-Agent': 'GlobalDrift-circuit-gen/1.0'})
                with urllib.request.urlopen(req, timeout=90) as r:
                    data=json.load(r)
                json.dump(data, open(cache,'w', encoding='utf-8'))
                return data
            except Exception as e:
                last=e; print('[osm]', cachekey, 'retry:', e); time.sleep(25)
    raise last

def build_graph(osm):
    nodes = {e['id']:(e['lon'],e['lat']) for e in osm['elements'] if e['type']=='node'}
    use = {}                                    # node id -> count (intersections have >=2 ways)
    ways = [e for e in osm['elements'] if e['type']=='way']
    for w in ways:
        for n in w['nodes']: use[n] = use.get(n,0)+1
    adj = {}                                    # intersection graph: edges are street segments between intersections
    def add(a,b,pts):
        if a==b or len(pts)<2: return
        d=sum(hav(pts[i],pts[i+1]) for i in range(len(pts)-1))
        adj.setdefault(a,{}); adj.setdefault(b,{})
        if b not in adj[a] or adj[a][b][0]>d:
            adj[a][b]=(d,pts); adj[b][a]=(d,list(reversed(pts)))
    for w in ways:
        ns=w['nodes']; seg=[ns[0]]
        for n in ns[1:]:
            seg.append(n)
            if use.get(n,0)>1 or n==ns[-1]:
                add(seg[0], n, [nodes[x] for x in seg if x in nodes]); seg=[n]
    return nodes, adj

def hav(a,b):
    R=6371000; la1,la2=math.radians(a[1]),math.radians(b[1])
    dla=la2-la1; dlo=math.radians(b[0]-a[0])
    h=math.sin(dla/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2
    return 2*R*math.asin(math.sqrt(h))

def dijkstra(adj, src, dst, skip):
    import heapq
    dist={src:0}; prev={}; pq=[(0,src)]
    while pq:
        d,u=heapq.heappop(pq)
        if u==dst: break
        if d>dist.get(u,1e18): continue
        for v,(w,_) in adj.get(u,{}).items():
            if (u,v)==skip or (v,u)==skip: continue
            nd=d+w
            if nd<dist.get(v,1e18): dist[v]=nd; prev[v]=u; heapq.heappush(pq,(nd,v))
    if dst not in prev and src!=dst: return None
    path=[dst]
    while path[-1]!=src: path.append(prev[path[-1]])
    return list(reversed(path))

def dijkstra_avoid(adj, src, dst, banned):
    import heapq
    dist={src:0}; prev={}; pq=[(0,src)]
    while pq:
        d,u=heapq.heappop(pq)
        if u==dst: break
        if d>dist.get(u,1e18): continue
        for v,(w,_) in adj.get(u,{}).items():
            if (u,v) in banned or (v,u) in banned: continue
            nd=d+w
            if nd<dist.get(v,1e18): dist[v]=nd; prev[v]=u; heapq.heappush(pq,(nd,v))
    if dst not in prev and src!=dst: return None
    path=[dst]
    while path[-1]!=src: path.append(prev[path[-1]])
    return list(reversed(path))

def find_loop(adj, nodes, target=(1200,4600), sep=40):
    # TWO EDGE-DISJOINT PATHS between distant intersections = a proper area loop (single-edge
    # removal only ever found one-block cycles in grid cities)
    import random
    random.seed(7)
    ids=[n for n in adj if len(adj[n])>=3]
    if len(ids)<2: ids=list(adj)
    best=None
    for _ in range(220):
        a,b=random.sample(ids,2)
        if hav(nodes[a],nodes[b])<300: continue
        p1=dijkstra_avoid(adj,a,b,set())
        if not p1: continue
        used={(p1[i],p1[i+1]) for i in range(len(p1)-1)}
        p2=dijkstra_avoid(adj,a,b,used)
        if not p2: continue
        cyc=p1+list(reversed(p2))[1:]
        inner=cyc[1:-1]
        if len(set(inner))!=len(inner): continue             # node revisited -> figure-8 / pinch
        length=0; ok=True
        for i in range(len(cyc)-1):
            e=adj.get(cyc[i],{}).get(cyc[i+1])
            if not e: ok=False; break
            length+=e[0]
        if not ok or not(target[0]<=target[1] and target[0]<=length<=target[1]): continue
        pts=[]
        for i in range(len(cyc)-1): pts+=adj[cyc[i]][cyc[i+1]][1][:-1]
        xs=[q[0] for q in pts]; ys=[q[1] for q in pts]
        lat0=math.radians((min(ys)+max(ys))/2); mxs=111320*math.cos(lat0); mys=110540
        P=[(q[0]*mxs, q[1]*mys) for q in pts]
        half=max((max(xs)-min(xs))*mxs, (max(ys)-min(ys))*mys)/2
        mPerUnit=half/186.0
        # SELF-SEPARATION: the in-game road is 26 units wide + sidewalks; non-adjacent legs must clear 40 units.
        # arc-distance gate 250m so a hairpin's own approach doesn't count as a clash.
        step=max(1,len(P)//120); need=sep*mPerUnit; sep_ok=True
        arc=[0]
        for i in range(1,len(P)): arc.append(arc[-1]+math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]))
        total=arc[-1] or 1
        for i in range(0,len(P),step):
            for j in range(i+step,len(P),step):
                da=abs(arc[j]-arc[i]); da=min(da, total-da)
                if da<250: continue
                if math.hypot(P[i][0]-P[j][0], P[i][1]-P[j][1])<need: sep_ok=False; break
            if not sep_ok: break
        if not sep_ok: continue
        spread=(max(xs)-min(xs))*(max(ys)-min(ys))
        score=spread*min(length,3200)
        if not best or score>best[0]: best=(score, cyc, length)
    return best

def polyline(adj, cyc):
    pts=[]
    for i in range(len(cyc)-1): pts += adj[cyc[i]][cyc[i+1]][1][:-1]
    return pts

def simplify(pts, tol):
    # Douglas-Peucker on lon/lat scaled to meters
    if len(pts)<3: return pts
    lat0=math.radians(pts[0][1]); mx=111320*math.cos(lat0); my=110540
    P=[(p[0]*mx, p[1]*my) for p in pts]
    keep=[False]*len(P); keep[0]=keep[-1]=True
    st=[(0,len(P)-1)]
    while st:
        i,j=st.pop()
        if j<=i+1: continue
        ax,ay=P[i]; bx,by=P[j]; L=math.hypot(bx-ax,by-ay) or 1
        mi,md=-1,0
        for k in range(i+1,j):
            px,py=P[k]
            dd=abs((bx-ax)*(ay-py)-(ax-px)*(by-ay))/L
            if dd>md: md,mi=dd,k
        if md>tol: keep[mi]=True; st.append((i,mi)); st.append((mi,j))
    return [pts[k] for k in range(len(pts)) if keep[k]]

def to_ctrl(pts, box=186):
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    lat0=math.radians((min(ys)+max(ys))/2); mx=111320*math.cos(lat0); my=110540
    X=[(p[0]-(min(xs)+max(xs))/2)*mx for p in pts]
    Y=[((min(ys)+max(ys))/2-p[1])*my for p in pts]           # +lat (north) -> -z (game forward convention)
    s=box/max(max(map(abs,X)), max(map(abs,Y)), 1)
    return [[round(x*s,1), round(y*s,1)] for x,y in zip(X,Y)], round(1/s,2)

def run(key):
    c=CITIES[key]
    print('[osm]', key, 'fetching...')
    osm=overpass(c['bbox'], key)
    nodes,adj=build_graph(osm)
    print('[osm]', key, 'graph:', len(adj), 'intersections')
    best=find_loop(adj, nodes, target=c.get('target',(1200,4600)), sep=c.get('sep',40))
    if not best: print('[osm]', key, 'NO LOOP FOUND'); return None
    _,cyc,length=best
    pts=polyline(adj,cyc)
    simp=simplify(pts, tol=14)                               # 14m tolerance keeps corner character, kills node spam
    ctrl,mPerUnit=to_ctrl(simp)
    out={'city':key, 'name':c['name'], 'sub':c['sub'], 'lengthM':round(length),
         'metersPerUnit':mPerUnit, 'ctrl':ctrl,
         'attribution':'(c) OpenStreetMap contributors, ODbL 1.0'}
    fn=f'models/districts/{key}-circuit.json'
    json.dump(out, open(fn,'w'), separators=(',',':'))
    print('[osm]', key, 'loop', round(length), 'm,', len(ctrl), 'ctrl pts ->', fn)
    return out

if __name__=='__main__':
    keys=sys.argv[1:] or list(CITIES)
    for k in keys:
        run(k); time.sleep(2)
    print('[osm] done')
