// Global Drift — spline.js (S1b of the engine-upgrade plan)
// Verbatim port of Three.js r0.137 CatmullRomCurve3 (centripetal/chordal/uniform) plus the
// Curve arc-length machinery (getLengths / getUtoTmapping / getPointAt / getSpacedPoints).
// This pins the track-table geometry across ALL future engine versions: buildTrackTables and
// friends call GDCatmullRom3 instead of THREE.CatmullRomCurve3. Verified against the Three
// implementation with a dual-path assert (max coordinate diff < 1e-9 on all 12 tracks).
// Port of MIT-licensed three.js code (c) 2010-2022 three.js authors.

function GDCatmullRom3(points, closed, curveType, tension){
  this.points=points||[]; this.closed=closed===true;
  this.curveType=curveType||'centripetal'; this.tension=(tension!==undefined)?tension:0.5;
  this.arcLengthDivisions=200; this.cacheArcLengths=null; this.needsUpdate=false;
}
(function(){
  function V3(x,y,z){ this.x=x||0; this.y=y||0; this.z=z||0; }
  V3.prototype.distanceTo=function(v){ const dx=this.x-v.x, dy=this.y-v.y, dz=this.z-v.z;
    return Math.sqrt(dx*dx+dy*dy+dz*dz); };
  function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z; return dx*dx+dy*dy+dz*dz; }

  function CubicPoly(){ let c0=0,c1=0,c2=0,c3=0;
    function init(x0,x1,t0,t1){ c0=x0; c1=t0; c2=-3*x0+3*x1-2*t0-t1; c3=2*x0-2*x1+t0+t1; }
    return {
      initCatmullRom:function(x0,x1,x2,x3,tension){ init(x1,x2, tension*(x2-x0), tension*(x3-x1)); },
      initNonuniformCatmullRom:function(x0,x1,x2,x3,dt0,dt1,dt2){
        let t1=(x1-x0)/dt0 - (x2-x0)/(dt0+dt1) + (x2-x1)/dt1;
        let t2=(x2-x1)/dt1 - (x3-x1)/(dt1+dt2) + (x3-x2)/dt2;
        t1*=dt1; t2*=dt1; init(x1,x2,t1,t2); },
      calc:function(t){ const t2=t*t, t3=t2*t; return c0+c1*t+c2*t2+c3*t3; } };
  }
  const tmp=new V3(), px=CubicPoly(), py=CubicPoly(), pz=CubicPoly();

  GDCatmullRom3.prototype.getPoint=function(t, optionalTarget){
    const point=optionalTarget||new V3();
    const points=this.points, l=points.length;
    const p=(l-(this.closed?0:1))*t;
    let intPoint=Math.floor(p), weight=p-intPoint;
    if(this.closed){ intPoint += intPoint>0 ? 0 : (Math.floor(Math.abs(intPoint)/l)+1)*l; }
    else if(weight===0 && intPoint===l-1){ intPoint=l-2; weight=1; }
    let p0, p3;
    if(this.closed || intPoint>0){ p0=points[(intPoint-1)%l]; }
    else { tmp.x=2*points[0].x-points[1].x; tmp.y=2*points[0].y-points[1].y; tmp.z=2*points[0].z-points[1].z; p0=tmp; }
    const p1=points[intPoint%l], p2=points[(intPoint+1)%l];
    if(this.closed || intPoint+2<l){ p3=points[(intPoint+2)%l]; }
    else { tmp.x=2*points[l-1].x-points[l-2].x; tmp.y=2*points[l-1].y-points[l-2].y; tmp.z=2*points[l-1].z-points[l-2].z; p3=tmp; }
    if(this.curveType==='centripetal' || this.curveType==='chordal'){
      const pow=this.curveType==='chordal'?0.5:0.25;
      let dt0=Math.pow(dist2(p0,p1), pow);
      let dt1=Math.pow(dist2(p1,p2), pow);
      let dt2=Math.pow(dist2(p2,p3), pow);
      if(dt1<1e-4) dt1=1.0;
      if(dt0<1e-4) dt0=dt1;
      if(dt2<1e-4) dt2=dt1;
      px.initNonuniformCatmullRom(p0.x,p1.x,p2.x,p3.x, dt0,dt1,dt2);
      py.initNonuniformCatmullRom(p0.y,p1.y,p2.y,p3.y, dt0,dt1,dt2);
      pz.initNonuniformCatmullRom(p0.z,p1.z,p2.z,p3.z, dt0,dt1,dt2);
    } else {
      px.initCatmullRom(p0.x,p1.x,p2.x,p3.x, this.tension);
      py.initCatmullRom(p0.y,p1.y,p2.y,p3.y, this.tension);
      pz.initCatmullRom(p0.z,p1.z,p2.z,p3.z, this.tension);
    }
    point.x=px.calc(weight); point.y=py.calc(weight); point.z=pz.calc(weight);
    return point;
  };
  GDCatmullRom3.prototype.getLengths=function(divisions){
    if(divisions===undefined) divisions=this.arcLengthDivisions;
    if(this.cacheArcLengths && this.cacheArcLengths.length===divisions+1 && !this.needsUpdate){
      return this.cacheArcLengths; }
    this.needsUpdate=false;
    const cache=[]; let current, last=this.getPoint(0); let sum=0;
    cache.push(0);
    for(let p=1;p<=divisions;p++){ current=this.getPoint(p/divisions); sum+=current.distanceTo(last); cache.push(sum); last=current; }
    this.cacheArcLengths=cache; return cache;
  };
  GDCatmullRom3.prototype.getUtoTmapping=function(u, distance){
    const arcLengths=this.getLengths();
    let i=0; const il=arcLengths.length;
    let targetArcLength;
    if(distance){ targetArcLength=distance; } else { targetArcLength=u*arcLengths[il-1]; }
    let low=0, high=il-1, comparison;
    while(low<=high){
      i=Math.floor(low+(high-low)/2);
      comparison=arcLengths[i]-targetArcLength;
      if(comparison<0){ low=i+1; }
      else if(comparison>0){ high=i-1; }
      else { high=i; break; }
    }
    i=high;
    if(arcLengths[i]===targetArcLength) return i/(il-1);
    const lengthBefore=arcLengths[i], lengthAfter=arcLengths[i+1];
    const segmentLength=lengthAfter-lengthBefore;
    const segmentFraction=(targetArcLength-lengthBefore)/segmentLength;
    return (i+segmentFraction)/(il-1);
  };
  GDCatmullRom3.prototype.getPointAt=function(u, optionalTarget){
    return this.getPoint(this.getUtoTmapping(u), optionalTarget); };
  GDCatmullRom3.prototype.getSpacedPoints=function(divisions){
    if(divisions===undefined) divisions=5;
    const points=[];
    for(let d=0;d<=divisions;d++) points.push(this.getPointAt(d/divisions));
    return points; };
})();
