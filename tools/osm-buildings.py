# Global Drift — OSM BUILDING FOOTPRINTS, projected into the SAME game frame as the road circuit so
# buildings line up with the real streets. Reuses osm-circuit.py's exact loop + projection (deterministic
# from the cached road data). (c) OpenStreetMap contributors, ODbL — NEVER Google.
#   python tools/osm-buildings.py miami barcelona tokyo nyc
import json, math, os, sys, time, importlib.util, urllib.request, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location('osmcirc', os.path.join(HERE,'osm-circuit.py'))
oc=importlib.util.module_from_spec(spec); spec.loader.exec_module(oc)   # reuse CITIES/build_graph/find_loop/polyline/simplify

def loop_projection(key):
    cache=os.path.join(HERE, f'.osm-cache-{key}.json')
    roads=json.load(open(cache, encoding='utf-8'))
    nodes,adj=oc.build_graph(roads)
    c=oc.CITIES[key]
    best=oc.find_loop(adj,nodes,target=c.get('target',(1200,4600)),sep=c.get('sep',40))
    if not best: return None
    _,cyc,length=best
    pts=oc.simplify(oc.polyline(adj,cyc), tol=14)          # SAME simplified loop to_ctrl projected
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    cLon=(min(xs)+max(xs))/2; cLat=(min(ys)+max(ys))/2
    lat0=math.radians(cLat); mx=111320*math.cos(lat0); my=110540
    X=[(p[0]-cLon)*mx for p in pts]; Y=[(cLat-p[1])*my for p in pts]
    s=186.0/max(max(map(abs,X)),max(map(abs,Y)),1)         # SAME scale as to_ctrl (box=186)
    return dict(cLon=cLon,cLat=cLat,mx=mx,my=my,s=s)

def fetch_buildings(bbox,key):
    cache=os.path.join(HERE, f'.osm-bld-cache-{key}.json')
    if os.path.exists(cache): print('[bld]',key,'cached'); return json.load(open(cache,encoding='utf-8'))
    q=f'[out:json][timeout:120];(way["building"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}););(._;>;);out body;'
    last=None
    for ep in ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']:
        for _ in range(2):
            try:
                req=urllib.request.Request(ep,data=urllib.parse.urlencode({'data':q}).encode(),headers={'User-Agent':'GlobalDrift-buildings/1.0'})
                with urllib.request.urlopen(req,timeout=150) as r: data=json.load(r)
                json.dump(data,open(cache,'w')); return data
            except Exception as e: last=e; print('[bld]',key,'retry',e); time.sleep(20)
    raise last

def bldg_h(tags):   # metres
    if 'height' in tags:
        try: return max(3.0,float(str(tags['height']).replace('m','').strip()))
        except: pass
    if 'building:levels' in tags:
        try: return max(3.0,float(str(tags['building:levels']).split(';')[0])*3.2)
        except: pass
    return 4*3.2

def run(key):
    c=oc.CITIES[key]; pj=loop_projection(key)
    if not pj: print('[bld]',key,'NO LOOP'); return
    osm=fetch_buildings(c['bbox'],key)
    nodes={e['id']:(e['lon'],e['lat']) for e in osm['elements'] if e['type']=='node'}
    out=[]
    for e in osm['elements']:
        if e.get('type')!='way' or 'nodes' not in e: continue
        tags=e.get('tags',{})
        if 'building' not in tags: continue
        ring=[nodes[n] for n in e['nodes'] if n in nodes]
        if len(ring)>1 and ring[0]==ring[-1]: ring=ring[:-1]
        if len(ring)<3: continue
        poly=[[round((lon-pj['cLon'])*pj['mx']*pj['s'],1), round((pj['cLat']-lat)*pj['my']*pj['s'],1)] for lon,lat in ring]
        # footprint size sanity: drop degenerate slivers
        xs=[p[0] for p in poly]; zs=[p[1] for p in poly]
        if (max(xs)-min(xs))<1.2 and (max(zs)-min(zs))<1.2: continue
        out.append({'p':poly,'h':round(bldg_h(tags)*pj['s'],1)})
    fn=os.path.join(HERE,'..','models','districts',f'{key}-buildings.json')
    json.dump({'city':key,'metersPerUnit':round(1/pj['s'],2),'n':len(out),'buildings':out,
               'attribution':'(c) OpenStreetMap contributors, ODbL 1.0'}, open(fn,'w'), separators=(',',':'))
    # report coord spread so we can confirm alignment (~+/-186 near the track)
    allx=[v for b in out for v in [p[0] for p in b['p']]]; allz=[v for b in out for v in [p[1] for p in b['p']]]
    print('[bld] %-10s %4d buildings  x[%.0f,%.0f] z[%.0f,%.0f]  m/unit %.2f -> %s' % (
        key, len(out), min(allx), max(allx), min(allz), max(allz), 1/pj['s'], os.path.relpath(fn)))

if __name__=='__main__':
    for k in (sys.argv[1:] or ['miami']):
        run(k); time.sleep(1)
