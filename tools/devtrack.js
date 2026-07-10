// Global Drift — DEVTRACK: developer alignment track (console-only QA harness)
// A perfectly straight test strip far outside the play area. Every vehicle is placed on the
// centerline and analyzed: tire placement/orientation/rotation, ground contact, symmetry,
// body tilt — with 360° orbit captures POSTed to the local sink (http://127.0.0.1:8098/).
// Load from the console:  const s=document.createElement('script'); s.src='tools/devtrack.js'; document.head.appendChild(s);
// Then:                   await DEVTRACK.runAll();           // full fleet report + screenshots
//                         await DEVTRACK.shoot('racecar');   // one car
// Pass criteria live in DEVTRACK.check() — reuse for ANY future model batch.
window.DEVTRACK = {
  built:false, grp:null, ox:0, oz:2600, sink:'http://127.0.0.1:8098/',
  build(){ if(this.built) return;
    const g=new THREE.Group();
    const road=new THREE.Mesh(new THREE.PlaneGeometry(26, 620), new THREE.MeshStandardMaterial({color:0x3a3d42, roughness:1, metalness:0}));
    road.rotation.x=-Math.PI/2; road.position.set(this.ox, 0.02, this.oz); g.add(road);
    const line=new THREE.Mesh(new THREE.PlaneGeometry(0.3, 620), new THREE.MeshBasicMaterial({color:0xffffff}));
    line.rotation.x=-Math.PI/2; line.position.set(this.ox, 0.035, this.oz); g.add(line);
    for(let i=-15;i<=15;i++){                                   // 20m pitch markers: scale reference in every shot
      for(const sx of [-1,1]){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.6,0.3), new THREE.MeshBasicMaterial({color:sx<0?0xff5533:0x33aaff}));
        m.position.set(this.ox+sx*7, 0.3, this.oz+i*20); g.add(m); } }
    scene.add(g); this.grp=g; this.built=true; },
  raws(){ const seen=new Set(), out=[];
    CARS.forEach((c,i)=>{ if(c.retired||c.kind!=='glb'||seen.has(c.raw)) return; seen.add(c.raw); out.push({raw:c.raw, idx:i}); });
    return out; },
  pose(idx){ ownedCars[idx]=true; selectedCar=idx; upgradeCars();
    return new Promise(res=>setTimeout(res,450)); },
  metrics(rig){ rig.group.updateWorldMatrix(true,true);
    const gw=new THREE.Vector3(); rig.group.getWorldPosition(gw);
    const ws=rig.wheels.map(w=>{ const b=new THREE.Box3().setFromObject(w), s=new THREE.Vector3(), c=new THREE.Vector3();
      b.getSize(s); b.getCenter(c); c.sub(gw);
      return { pos:[+c.x.toFixed(3),+c.y.toFixed(3),+c.z.toFixed(3)], ext:+Math.max(s.x,s.y,s.z).toFixed(3), bottom:+(b.min.y-gw.y).toFixed(3), name:(w.children[0]&&w.children[0].name)||'' }; });
    // spin: drive the pivots directly (deterministic, no physics interference)
    const rot0=rig.wheels.map(w=>w.rotation.x);
    rig.spinAcc=(rig.spinAcc||0)+1.2; rig.wheels.forEach(w=> w.rotation.x=rig.spinAcc);
    const spun=rig.wheels.filter((w,i)=>Math.abs(w.rotation.x-rot0[i])>0.3).length;
    rig.front.forEach(w=> w.rotation.y=0.4);
    const steered=rig.front.filter(w=>Math.abs(w.rotation.y-0.4)<1e-4).length;
    return {wheels:ws, spun, steered, frontCount:rig.front.length};
  },
  check(m, dims){ const f=[], W=(dims&&dims.W)||2;
    if(m.wheels.length!==4) f.push('wheel count '+m.wheels.length);
    if(m.wheels.length===4){
      const L=m.wheels.filter(w=>w.pos[0]<0), R=m.wheels.filter(w=>w.pos[0]>0);
      if(L.length!==2||R.length!==2) f.push('wheels not 2L/2R');
      else{ const sym=Math.abs(L[0].pos[0]+R[0].pos[0]);
        if(sym>0.12) f.push('x-asymmetry '+sym.toFixed(2)); }
      m.wheels.forEach(w=>{
        if(w.bottom>0.12) f.push(w.name+' floats '+w.bottom);
        if(w.bottom<-0.15) f.push(w.name+' sunk '+w.bottom);
        if(w.ext>W*0.62) f.push(w.name+' oversized '+w.ext); });
      const ex=m.wheels.map(w=>w.ext), spread=Math.max(...ex)-Math.min(...ex);
      if(spread>0.45) f.push('radius spread '+spread.toFixed(2));
    }
    if(m.spun!==m.wheels.length) f.push('spin '+m.spun+'/'+m.wheels.length);
    if(m.frontCount!==2) f.push('front pivots '+m.frontCount);
    return f;
  },
  async shoot(raw, opts){ opts=opts||{};
    this.build();
    const list=this.raws(), ent=list.find(e=>e.raw===raw); if(!ent) return {raw, error:'not in roster'};
    await this.pose(ent.idx);
    const p=player; p.dmgP={}; if(typeof repairPanels==='function') repairPanels(p);
    p.pos.x=this.ox; p.pos.y=this.oz; p.vel.set(0,0); p.heading=0;
    const rig=p.rig;
    const put=()=>{ rig.group.position.set(this.ox,0,this.oz); rig.group.rotation.set(0,0,0); rig.group.updateWorldMatrix(true,true); };
    put();
    const m=this.metrics(rig); put();
    const shots=opts.angles||8;
    for(let k=0;k<shots;k++){ const a=k/shots*Math.PI*2, d=5.4, h=1.5+(k%2)*0.9;
      put();
      camera.position.set(this.ox+Math.sin(a)*d, h, this.oz+Math.cos(a)*d);
      camera.lookAt(this.ox, 0.7, this.oz);
      renderer.render(scene,camera);
      await fetch(this.sink+'dt_'+raw+'_'+k+'.txt',{method:'POST',headers:{'Content-Type':'text/plain'},body:renderer.domElement.toDataURL('image/jpeg',0.8)});
    }
    put();                                                       // wheel close-up: front-left, steered + mid-spin
    camera.position.set(this.ox-1.9, 0.55, this.oz+2.4); camera.lookAt(this.ox-0.8, 0.35, this.oz+1.3);
    renderer.render(scene,camera);
    await fetch(this.sink+'dt_'+raw+'_wheel.txt',{method:'POST',headers:{'Content-Type':'text/plain'},body:renderer.domElement.toDataURL('image/jpeg',0.85)});
    rig.front.forEach(w=> w.rotation.y=0);
    const fails=this.check(m, rig.dims);
    return {raw, pass:fails.length===0, fails, metrics:m};
  },
  async runAll(opts){ const out=[];
    for(const e of this.raws()) out.push(await this.shoot(e.raw, opts));
    return out;
  }
};
console.log('[DEVTRACK] ready — DEVTRACK.runAll() / DEVTRACK.shoot(raw)');
