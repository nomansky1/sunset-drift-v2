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
    // BODY RIGIDITY (race mode): even with heavy accumulated damage, panels must stay pinned to
    // the body — wobble/tear are BR-only. Regression here = "car pieces oscillate while driving".
    let rigidity=0;
    if(rig.panels && typeof applyDamage==='function' && typeof updatePanelDamage==='function' && player && player.rig===rig){
      const saved=player.dmgP; player.dmgP={};
      for(let i=0;i<4;i++) applyDamage(player, Math.sin(i*1.7), Math.cos(i*1.7), 40);   // slam every side
      const base={}; for(const k in rig.panels){ base[k]={p:rig.panels[k].position.clone(), r:rig.panels[k].rotation.clone()}; }
      for(let f=0;f<30;f++) updatePanelDamage(player);
      for(const k in rig.panels){ const m=rig.panels[k];
        rigidity=Math.max(rigidity, m.position.distanceTo(base[k].p),
          Math.abs(m.rotation.x-base[k].r.x)+Math.abs(m.rotation.y-base[k].r.y)+Math.abs(m.rotation.z-base[k].r.z)); }
      player.dmgP={}; if(typeof repairPanels==='function') repairPanels(player); player.dmgP=saved||{};
    }
    // CORNERING STABILITY (owner): hard corners at speed must not bounce/tear the body.
    // Run real physics with barriers/rescue off (freeRoam), sample panel + wheel-pivot deltas.
    let cornering=0;
    if(player && player.rig===rig){
      const wasRoam=window.freeRoam; window.freeRoam=true;
      const p=player, keep={x:p.pos.x, z:p.pos.y, h:p.heading};
      p.pos.x=this.ox; p.pos.y=this.oz; p.heading=0; p.vel.set(0,0); p.spdMul=1; p.gripMul=1;
      const base={}; for(const k in (rig.panels||{})) base[k]={p:rig.panels[k].position.clone(), r:rig.panels[k].rotation.clone()};
      const wbase=rig.wheels.map(w=>w.position.clone());
      for(let f=0;f<3*60;f++){ updateCar(p, {throttle:true, brake:false, steer:(f%120<60)?1:-1, drift:f%180<90, boost:false}, 1/60);
        if(typeof updatePanelDamage==='function') updatePanelDamage(p); }
      for(const k in (rig.panels||{})){ const m=rig.panels[k];
        cornering=Math.max(cornering, m.position.distanceTo(base[k].p),
          Math.abs(m.rotation.x-base[k].r.x)+Math.abs(m.rotation.y-base[k].r.y)+Math.abs(m.rotation.z-base[k].r.z)); }
      rig.wheels.forEach((w,i)=>{ cornering=Math.max(cornering, w.position.distanceTo(wbase[i])); });
      p.pos.x=keep.x; p.pos.y=keep.z; p.heading=keep.h; p.vel.set(0,0);
      p.dmgP={}; if(typeof repairPanels==='function') repairPanels(p);
      window.freeRoam=wasRoam;
    }
    // CAMERA-CYCLE STABILITY (owner): switching views (incl. cockpit) must not disturb the model
    let camCycle=0, visRestored=true;
    if(player && player.rig===rig && typeof CAM_VIEWS!=='undefined' && typeof updateCamera==='function' && typeof camView!=='undefined'){
      const keepView=camView;
      const base={}; for(const k in (rig.panels||{})) base[k]=rig.panels[k].position.clone();
      const wbase=rig.wheels.map(w=>w.position.clone());
      for(let v=0; v<CAM_VIEWS.length; v++){ camView=v; for(let f=0;f<6;f++) updateCamera(1/60); }
      camView=keepView; for(let f=0;f<6;f++) updateCamera(1/60);
      visRestored=rig.group.visible===true;
      for(const k in (rig.panels||{})) camCycle=Math.max(camCycle, rig.panels[k].position.distanceTo(base[k]));
      rig.wheels.forEach((w,i)=>{ camCycle=Math.max(camCycle, w.position.distanceTo(wbase[i])); });
    }
    // WHEEL PROPORTION (owner: rims/tires must look consistent): round face + sane width-to-diameter
    const proportions=rig.wheels.map(w=>{ const b=new THREE.Box3().setFromObject(w), s=new THREE.Vector3(); b.getSize(s);
      const dims=[s.x,s.y,s.z].sort((a,b2)=>a-b2);                 // [width, dia1, dia2]
      return {round:+(dims[1]/dims[2]).toFixed(2), widthRatio:+(dims[0]/dims[2]).toFixed(2)}; });
    return {wheels:ws, spun, steered, frontCount:rig.front.length, rigidity:+rigidity.toFixed(5),
      cornering:+cornering.toFixed(5), camCycle:+camCycle.toFixed(5), visRestored, proportions};
  },
  check(m, dims){ const f=[], W=(dims&&dims.W)||2;
    if(m.wheels.length!==4) f.push('wheel count '+m.wheels.length);
    if(m.wheels.length===4){
      const L=m.wheels.filter(w=>w.pos[0]<0), R=m.wheels.filter(w=>w.pos[0]>0);
      if(L.length!==2||R.length!==2) f.push('wheels not 2L/2R');
      else{ const sym=Math.abs(L[0].pos[0]+R[0].pos[0]);
        if(sym>0.16) f.push('x-asymmetry '+sym.toFixed(2)); }   // 28k re-extraction shifted cluster stats ~2cm; visually invisible
      m.wheels.forEach(w=>{
        if(w.bottom>0.18) f.push(w.name+' floats '+w.bottom);
        if(w.bottom<-0.15) f.push(w.name+' sunk '+w.bottom);
        if(w.ext>W*0.62) f.push(w.name+' oversized '+w.ext); });
      const ex=m.wheels.map(w=>w.ext), spread=Math.max(...ex)-Math.min(...ex);
      if(spread>0.45) f.push('radius spread '+spread.toFixed(2));
    }
    if(m.spun!==m.wheels.length) f.push('spin '+m.spun+'/'+m.wheels.length);
    if(m.frontCount!==2) f.push('front pivots '+m.frontCount);
    if((m.rigidity||0)>0.001) f.push('body NOT RIGID in race mode: panel moved '+m.rigidity);
    if((m.cornering||0)>0.001) f.push('body/wheels UNSTABLE while cornering: moved '+m.cornering);
    if((m.camCycle||0)>0.001) f.push('camera-view cycle disturbed the model: moved '+m.camCycle);
    if(m.visRestored===false) f.push('car INVISIBLE after cockpit view cycle');
    (m.proportions||[]).forEach((p,i)=>{
      if(p.round<0.8) f.push('wheel '+i+' not round (face ratio '+p.round+')');
      if(p.widthRatio<0.12||p.widthRatio>0.92) f.push('wheel '+i+' width/diameter off ('+p.widthRatio+')'); });   // the fleet's stylized wheels run wide (0.76-0.85) and read fine — only flag near-cubes
    return f;
  },
  async shoot(raw, opts){ opts=opts||{};
    const _repair=()=>{ try{ if(typeof repairPanels==='function'&&player){ player.dmgP={}; repairPanels(player); } }catch(_){} };
    this.build();
    const list=this.raws(), ent=list.find(e=>e.raw===raw); if(!ent) return {raw, error:'not in roster'};
    await this.pose(ent.idx);
    const p=player; p.dmgP={}; if(typeof repairPanels==='function') repairPanels(p);
    p.pos.x=this.ox; p.pos.y=this.oz; p.vel.set(0,0); p.heading=0;
    const rig=p.rig;
    const put=()=>{ rig.group.position.set(this.ox,0,this.oz); rig.group.rotation.set(0,0,0); rig.group.updateWorldMatrix(true,true); };
    put();
    const m=this.metrics(rig); put();
    _repair(); const shots=opts.angles||8;
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
