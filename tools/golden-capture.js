// Global Drift — golden-frame capture protocol (S0 harness for the staged Three.js upgrade)
// Paste into the console of a LOCAL serve (python -m http.server 8099) with a POST sink on :8098
// (writes each body to a file; see session notes). Goldens live in ../sunset-drift-v2-goldens/.
//
// Determinism rules discovered while building this (violating any breaks byte-identity):
//  1. AO OFF: THREE.SSAOPass seeds its sample kernel with Math.random at construction.
//     -> aoPref=false; buildComposer();
//  2. Assets ready: wait for propsReady && Object.keys(fleetRaw).length>=19, then a per-track
//     stats-stability gate (two consecutive equal {calls,tris}) — district GLBs swap in async.
//  3. Time frozen: __frozen() zeroes uTime/uT/uW/uScroll/uSpd/uBlur/uSpeed everywhere.
//  4. Env re-bake: captureEnv() AFTER freezing — the per-track PMREM cubemap otherwise bakes the
//     animated clouds at load-dependent time (glass towers on city tracks reflect the difference).
//     Residual on city tracks after re-bake: mean<0.1/255 (GPU PMREM rounding) — tolerance-gated.
//  5. Seeded build noise: makeCityGroundTexture/makeGroundGrain/flakeTex use mulberry32 (v9.55).
//
// Physics fingerprint (bit-identical across reloads, verified):
//   selectTrack(4); place player at sample 20, spdMul=gripMul=1, 400 steps of
//   updateCar(pc,{throttle:true,steer:1,drift:true},1/60)
//   => {x:-138.329258651, z:-136.596448756, h:28.933573462, v:8.959084759}

window.__frozen = function(){
  try{ if(waterMat) waterMat.uniforms.uTime.value=0; }catch(e){}
  try{ (window._flagMats||[]).forEach(m=>{ if(m.userData.shader){ m.userData.shader.uniforms.uT.value=0; m.userData.shader.uniforms.uW.value=0; } }); }catch(e){}
  scene.traverse(o=>{ if(o.isMesh&&o.material&&o.material.uniforms){ const u=o.material.uniforms;
    if(u.uTime) u.uTime.value=0; if(u.uT) u.uT.value=0; }});
  try{ if(cinePass){ cinePass.uniforms.uBlur.value=0; cinePass.uniforms.uSpeed.value=0; } }catch(e){}
  try{ if(roadMatRef&&roadMatRef.userData.shader){ roadMatRef.userData.shader.uniforms.uScroll.value=0; roadMatRef.userData.shader.uniforms.uSpd.value=0; } }catch(e){}
};
window.__stats = function(){ renderer.info.autoReset=false; renderer.info.reset();
  if(composer) composer.render(); else renderer.render(scene,camera);
  const r={calls:renderer.info.render.calls, tris:renderer.info.render.triangles};
  renderer.info.autoReset=true; return r; };
window.__goldenTrack = async function(run, t, sink){
  sink=sink||'http://127.0.0.1:8098/';
  selectTrack(t);
  let s1=null;
  for(let i=0;i<25;i++){ await new Promise(r=>setTimeout(r,600)); __frozen();
    const s2=__stats(); if(s1 && s1.calls===s2.calls && s1.tris===s2.tris) break; s1=s2; }
  __frozen(); try{ captureEnv(); }catch(e){}
  const shots=[['a',(()=>{ const s=100,p=samplePts[s],tn=sampleTan[s],e=sampleElev[s]||0;
      return {px:p.x-tn.x*20, py:e+5, pz:p.y-tn.y*20, lx:p.x+tn.x*14, ly:e+0.3, lz:p.y+tn.y*14}; })()],
    ['b',(()=>{ const s=300,p=samplePts[s],n=sampleNorm[s],e=sampleElev[s]||0;
      return {px:p.x+n.x*30, py:e+35, pz:p.y+n.y*30, lx:p.x, ly:e, lz:p.y}; })()]];
  let st=null;
  for(const [k,c] of shots){
    camera.position.set(c.px,c.py,c.pz); camera.lookAt(c.lx,c.ly,c.lz);
    camera.fov=CONFIG.fovBase; camera.updateProjectionMatrix();
    st=__stats();
    const du=renderer.domElement.toDataURL('image/png');
    await fetch(sink+run+'_t'+String(t).padStart(2,'0')+k+'.txt',{method:'POST',headers:{'Content-Type':'text/plain'},body:du});
  }
  return st; };
window.__goldenAll = async function(run){
  for(let i=0;i<60;i++){ if(typeof propsReady!=='undefined'&&propsReady && Object.keys(fleetRaw).length>=19) break;
    await new Promise(r=>setTimeout(r,500)); }
  aoPref=false; buildComposer();
  const out=[];
  for(let t=0;t<TRACKS.length;t++) out.push({t, ...(await __goldenTrack(run,t))});
  return out; };
window.__phys = function(){
  selectTrack(4);
  const pc=player, s0=20, p=samplePts[s0], t=sampleTan[s0];
  pc.pos.x=p.x; pc.pos.y=p.y; pc.heading=Math.atan2(t.x,t.y); pc.vel.set(0,0);
  pc.speed=0; pc.spdMul=1; pc.gripMul=1; pc.trackIdx=s0; pc.boost=0; pc._leanZ=0; pc._leanX=0;
  for(let k=0;k<400;k++) updateCar(pc,{throttle:true,steer:1,drift:true},1/60);
  return {x:+pc.pos.x.toFixed(9), z:+pc.pos.y.toFixed(9), h:+pc.heading.toFixed(9), v:+pc.vel.length().toFixed(9)}; };
