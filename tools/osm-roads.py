# Global Drift — OSM ROAD network -> game-coords, SAME projection as osm-circuit/osm-buildings so the paved
# streets line up with the buildings + circuit. (c) OpenStreetMap contributors, ODbL.
#   python tools/osm-roads.py miami barcelona tokyo nyc
import json, math, os, sys, importlib.util
HERE=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location('osmcirc', os.path.join(HERE,'osm-circuit.py'))
oc=importlib.util.module_from_spec(spec); spec.loader.exec_module(oc)
def loop_projection(key):
    roads=json.load(open(os.path.join(HERE,f'.osm-cache-{key}.json'),encoding='utf-8'))
    nodes,adj=oc.build_graph(roads); c=oc.CITIES[key]
    best=oc.find_loop(adj,nodes,target=c.get('target',(1200,4600)),sep=c.get('sep',40))
    if not best: return None,None
    _,cyc,length=best
    pts=oc.simplify(oc.polyline(adj,cyc), tol=14)
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    cLon=(min(xs)+max(xs))/2; cLat=(min(ys)+max(ys))/2
    lat0=math.radians(cLat); mx=111320*math.cos(lat0); my=110540
    X=[(p[0]-cLon)*mx for p in pts]; Y=[(cLat-p[1])*my for p in pts]
    s=186.0/max(max(map(abs,X)),max(map(abs,Y)),1)
    return dict(cLon=cLon,cLat=cLat,mx=mx,my=my,s=s), roads
HW={'motorway':6,'trunk':6,'primary':5.5,'secondary':4.5,'tertiary':4,'residential':3.2,'unclassified':3,'service':2.4}
def run(key):
    pj,roads=loop_projection(key)
    if not pj: print('[road]',key,'no loop'); return
    nodes={e['id']:(e['lon'],e['lat']) for e in roads['elements'] if e['type']=='node'}
    out=[]
    for e in roads['elements']:
        if e.get('type')!='way' or 'nodes' not in e: continue
        hw=e.get('tags',{}).get('highway'); w=HW.get(hw)
        if not w: continue
        pts=[]
        for n in e['nodes']:
            if n not in nodes: continue
            lon,lat=nodes[n]
            pts.append([round((lon-pj['cLon'])*pj['mx']*pj['s'],1), round((pj['cLat']-lat)*pj['my']*pj['s'],1)])
        if len(pts)<2: continue
        out.append({'p':pts,'w':w})
    fn=os.path.join(HERE,'..','models','districts',f'{key}-roads.json')
    json.dump({'city':key,'roads':out,'attribution':'(c) OpenStreetMap contributors, ODbL 1.0'},open(fn,'w'),separators=(',',':'))
    print('[road] %-10s %4d ways -> %s' % (key, len(out), os.path.relpath(fn)))
if __name__=='__main__':
    for k in (sys.argv[1:] or ['miami']): run(k)
