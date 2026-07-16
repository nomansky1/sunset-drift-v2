// Global Drift — game core (S1a of the engine-upgrade plan)
// Physics (updateCar), race progress/laps, AI driver (aiInput) + the skid-mark drop helper.
// Classic script sharing the page's global scope — extracted VERBATIM from index.html so the
// golden-frame and physics gates stay byte-identical. Engine-agnostic hardening comes later.

/* =========================================================================
   PHYSICS  — arcade vehicle with grip, drift, boost, soft walls
   ========================================================================= */

// ----- PANEL DAMAGE (visual only; physics untouched) -----
function applyDamage(c, nx, nz, impact){
  if(!c.rig||!c.rig.panels) return;
  let rel=Math.atan2(nx,nz)-c.heading;
  while(rel>Math.PI)rel-=6.283185307; while(rel<-Math.PI)rel+=6.283185307;
  const ar=Math.abs(rel);
  let keys;
  if(ar<0.7) keys=['panel_bumper_f','panel_hood'];
  else if(ar>2.44) keys=['panel_bumper_r','panel_trunk'];
  else keys=[rel>0?'panel_door_R':'panel_door_L','panel_roof'];
  c.dmgP=c.dmgP||{};
  // races: gentler + capped BELOW the tear-off stage (full deterioration is BR-only — lap-1 pileups were shredding cars)
  const br = typeof brActive!=='undefined' && brActive;
  const amt=Math.min(1.2, impact/22)*(br?1:0.55);
  keys.forEach((k,i)=>{ if(c.rig.panels[k]) c.dmgP[k]=Math.min(br?9:1.3, (c.dmgP[k]||0)+amt*(i?0.4:1)); });
}
function updatePanelDamage(c){
  if(!c.rig||!c.rig.panels||!c.dmgP) return;
  const ey=c.visY||0;
  for(const k in c.dmgP){ const m=c.rig.panels[k]; if(!m) continue; const v=c.dmgP[k];
    if(v>=1.5){ if(m.visible){ m.visible=false;                        // panel TEARS OFF: sparks + smoke + flying debris
        for(let i=0;i<8;i++) sparks.emit(c.pos.x,0.7+ey,c.pos.y,(Math.random()-.5)*8,2+Math.random()*3,(Math.random()-.5)*8,0.4,8);
        if(typeof tireSmoke!=='undefined') tireSmoke.emit(c.pos.x,0.8+ey,c.pos.y,0,1.2,0,0.7,7);
        if(typeof obSpawnDebris==='function') try{ obSpawnDebris(c.pos.x,0.8+ey,c.pos.y); }catch(e){} } continue; }
    if(v>=0.95 && m.userData._rp && (typeof brActive!=='undefined' && brActive)){   // loose panel WOBBLE is BR-ONLY:
      const rp=m.userData._rp;                                         // in races the body stays a RIGID unit (owner: parts were
      m.rotation.x=rp.r.x+Math.sin(performance.now()*0.008+v*7)*0.013*v;   // oscillating on every model once wall grazes crossed 0.95)
      m.rotation.z=rp.r.z+Math.cos(performance.now()*0.006+v*5)*0.010*v; }
    else if(m.userData._rp && !(typeof brActive!=='undefined' && brActive)){ const rp=m.userData._rp;
      m.rotation.copy(rp.r); m.position.copy(rp.p); }                  // race mode: pin every panel to its rest transform
    if(v>=0.35 && m.material && !m.userData._dented){ m.userData._dented=true;   // DENT: scuffed paint
      if(m.material.color) m.material.color.multiplyScalar(0.8);
      if('roughness' in m.material) m.material.roughness=Math.min(1,(m.material.roughness||0.4)+0.28); }
  }
}
function repairPanels(c){                                              // wrench/toolbox pickups call this (self-heal)
  if(!c.rig||!c.rig.panels) return;
  for(const k in c.rig.panels){ const m=c.rig.panels[k], rp=m.userData._rp;
    m.visible=true; m.userData._dented=false;
    if(rp){ m.rotation.copy(rp.r); if(rp.col&&m.material&&m.material.color) m.material.color.copy(rp.col); } }
  c.dmgP={};
  const ey=c.visY||0;
  for(let i=0;i<12;i++) sparks.emit(c.pos.x,0.6+ey,c.pos.y,(Math.random()-.5)*5,2.5+Math.random()*2,(Math.random()-.5)*5,0.5,6);
}

function updateCar(c, inp, dt){
  // progress / nearest point on track (also used for off-track + ranking)
  const prev=c.trackIdx; const nr=nearest(c.pos, prev); c.trackIdx=nr.idx; c.trackDist=nr.dist;

  _f.set(Math.sin(c.heading), Math.cos(c.heading));         // forward
  const fwdSpeed=c.vel.dot(_f);
  const speed=c.vel.length();
  const tire=c.tireLvl||0;                                  // player-only upgrade level (AI -> 0 = stock)

  // engine (ENGINE kit: standstill launch grunt that fades with speed)
  if(inp.throttle && !inp.brake){ const launch=1+0.5*(c.engLvl||0)*clamp(1-speed/18,0,1);
    const accMul = c.isPlayer ? (c.spdMul||1) : aiAccel;                      // AI gets difficulty accel power (corner-exit punch) instead of upgrades
    c.vel.addScaledVector(_f, CONFIG.engineAccel*accMul*launch*dt); }
  if(inp.brake){ const bm=(inp.brakeMul||1)*(c.isPlayer?(1+0.16*(c.brakeLvl||0)):1);   // BRAKES kit: stronger braking -> brake later into the new tight corners
    if(fwdSpeed>0.6) c.vel.addScaledVector(_f, -CONFIG.brakeAccel*bm*dt);
    else c.vel.addScaledVector(_f, -CONFIG.reverseAccel*dt);
  }

  // boost
  c.drifting = inp.drift && speed>4;
  c.boosting=false;
  if(c._padBoost>0) c._padBoost-=dt;                       // boost-pad forced-boost window
  if((inp.boost || c._padBoost>0) && c.boost>2 && fwdSpeed>-1){
    c.vel.addScaledVector(_f, CONFIG.boostForce*(c.isPlayer?(c.nosForce||1):aiAccel)*dt); c.boost-=CONFIG.boostDrain*(c.nosDrain||1)*dt; c.boosting=true;   // NITROUS: stronger + slower drain (AI uses its difficulty power)
  } else {
    c.boost += (c.drifting?CONFIG.boostDriftRefill*(c.nosFill||1):CONFIG.boostRefill*(c.isPlayer?1:2.6))*dt;   // NITROUS: drift fills faster; AI can't drift-chain so their idle refill compensates
  }
  c.boost=clamp(c.boost,0,CONFIG.boostMax*(c.nosMax||1));
  if(c.boosting && !c.wasBoost && c.isPlayer){ audio && audio.boost();
    if((c.nosMax||1)>1 && raceTime-(c._nosCue||-9)>1.5){ c._nosCue=raceTime; popup('🔥 NOS','#7ce0ff'); } } c.wasBoost=c.boosting;

  // speed clamp ( AI boosting uses a tamer scale so a chasing AI matches — not laps — a boosting player )
  let _ms=c.maxScale||1; if(!c.isPlayer && c.boosting) _ms=Math.min(_ms, 1.52);   // was 1.36: a drift-chaining player at 80 walked away from every boosting AI
  const maxSpd=(c.boosting?CONFIG.boostTopSpeed:CONFIG.topSpeed)*_ms*(c.spdMul||1)*(c.isPlayer?(c.turboMul||1):1);   // TURBO kit: higher top speed
  const sp=c.vel.length(); if(sp>maxSpd) c.vel.multiplyScalar(maxSpd/sp);

  // ----- JUMPS: cresting a hill at speed launches the car into the air (skill air-time; reuses the rolling hills, all cars) -----
  const _drop = sampleElev.length ? ((sampleElev[c.trackIdx]||0) - (sampleElev[(c.trackIdx+7)%SAMPLES]||0)) : 0;   // >0 = steep downhill crest ahead
  if((c.air||0)<=0 && (c._airV||0)<=0 && fwdSpeed>42 && _drop>8 && raceTime-(c._landT||-9)>1.1){
    c._airV = clamp(_drop*1.1 + (fwdSpeed-40)*0.06, 3, 8); c.air=0.02; c._peak=0;                // only a genuine steep crest launches (rare, gentle hop)
    if(c.isPlayer) camShake=Math.min(camShake+0.22,1);
  }
  if((c.air||0)>0 || (c._airV||0)>0){
    const wasAir=(c.air||0)>0; c._airV=(c._airV||0)-24*dt; c.air=(c.air||0)+c._airV*dt; c._peak=Math.max(c._peak||0, c.air);   // ballistic arc
    // AIRBORNE ATTITUDE: nose lifts on the way up, dips toward the landing — the car follows its arc
    const _tilt = c._airV>0 ? -0.10*Math.min(1,c._airV/6) : 0.13*Math.min(1,-c._airV/8);
    c._airTilt=(c._airTilt||0)+(_tilt-(c._airTilt||0))*Math.min(1,dt*7);
    if(c.air<=0){ const impact=Math.min(1, -(c._airV)/9); c.air=0; c._airV=0; c._landT=raceTime;   // landed (cooldown before next launch)
      if(wasAir){
        c._susYV=(c._susYV||0) - (0.12+0.45*impact);                       // SUSPENSION ABSORB: squat with the hit, damped spring below rebounds it
        c._landGrip=Math.max(0.25, 1-impact*0.75);                          // tyres take a beat to bite again — big landings squirm instead of snapping to full grip
        if(c.isPlayer){ camShake=Math.min(camShake+0.15+impact*0.55,1); audio&&audio.thud&&audio.thud(0.35+impact*0.5);
          if(typeof dust!=='undefined'&&dust&&dust.emit){ const fx2=Math.sin(c.heading), fz2=Math.cos(c.heading);   // landing dust kicked off the tyres
            for(let k=0;k<10;k++){ const sx=(Math.random()-0.5)*1.8;
              dust.emit(c.pos.x - fx2*1.3 - fz2*sx, 0.25, c.pos.y - fz2*1.3 + fx2*sx,
                (Math.random()-0.5)*3, 1.4+Math.random()*2.2, (Math.random()-0.5)*3, 0.5+Math.random()*0.35, 0.55+Math.random()*0.5); } }
          if(c._rampJump){ c._rampJump=false; c.boost=Math.min((c.boost||0)+CONFIG.boostMax*0.5, CONFIG.boostMax*(c.nosMax||1)); c._padBoost=0.5; audio&&audio.boost&&audio.boost(); popup&&popup('⚡ STOMP BOOST','#ffb14d'); }
          if((c._peak||0)>2 && raceTime-(c._airCue||-9)>1.2){ c._airCue=raceTime; addScore&&addScore(70+Math.round((c._peak||0)*22),'BIG AIR!','#7ce0ff'); } } }
      c._peak=0;
    }
  } else if(c._airTilt) c._airTilt*=(1-Math.min(1,dt*8));
  // landing suspension spring (underdamped: one soft rebound, settles ~0.4s) + grip recovery
  if(c._susY||c._susYV){ c._susYV=(c._susYV||0)+((-(c._susY||0))*95 - (c._susYV||0)*10)*dt; c._susY=(c._susY||0)+c._susYV*dt;
    if(Math.abs(c._susY)<0.001 && Math.abs(c._susYV)<0.01){ c._susY=0; c._susYV=0; } }
  if((c._landGrip||1)<1) c._landGrip=Math.min(1,(c._landGrip||1)+dt*2.2);

  // steering (needs speed; reverses when reversing; stronger while drifting)
  let steer=inp.steer*CONFIG.steerRate*dt;
  steer*=clamp(Math.abs(fwdSpeed)/CONFIG.steerSpeedFloor,0,1);
  if(fwdSpeed<-0.5) steer*=-1;
  if(c.drifting) steer*=CONFIG.driftSteerBoost;
  c.heading+=steer;

  // grip: kill lateral velocity (less when drifting → slide)
  _f.set(Math.sin(c.heading), Math.cos(c.heading));
  const fd=c.vel.dot(_f);
  _l.copy(c.vel).addScaledVector(_f, -fd);          // lateral component
  const _slip = c.isPlayer ? _l.length() : 0;        // sideways speed = drift intensity (player only)
  const gripMul = c.isPlayer ? (c.gripMul||1) : (1.30+(aiAccel-1)*1.1);   // AI grip RAISED: they were physically sliding wide in corners (read as constant drifting + slow exits); planted grip = fast clean curves
  const grip=(c.drifting?CONFIG.gripDrift*(1+0.18*tire):CONFIG.gripNormal)*gripMul*(c._landGrip||1);   // TIRES: snappier drift exit; landings briefly loosen the tyres
  _l.multiplyScalar(Math.exp(-grip*dt));            // frame-rate independent
  c.vel.copy(_f).multiplyScalar(fd).add(_l);
  // ---- DRIFT SCORING (player): style points while sliding sideways at speed; combo mult grows the longer
  //      you hold one clean slide; BANKED into the run score when you straighten out (arcade drift hook) ----
  if(c.isPlayer){
    if(c.drifting && _slip>3.2 && fwdSpeed>13){
      c._driftT=(c._driftT||0)+dt;
      c._driftMul=Math.min(1+((c._driftT/1.3)|0), 5);            // x1..x5, +1 every 1.3s of continuous drift
      c._driftPts=(c._driftPts||0) + _slip*fwdSpeed*0.26*dt;
      c._driftLive=Math.round(c._driftPts); c._driftMulLive=c._driftMul; c._driftActive=true;
    } else if((c._driftPts||0)>0){                               // slide ended -> bank it
      if((c._driftPts||0)>35 && typeof addScore==='function'){ const bank=Math.round(c._driftPts*(c._driftMul||1));
        addScore(bank, '🌀 DRIFT'+((c._driftMul>1)?' x'+c._driftMul:''), '#c79bff');
        if(typeof camShake!=='undefined') camShake=Math.min(camShake+0.1,1); }
      c._driftPts=0; c._driftMul=1; c._driftT=0; c._driftLive=0; c._driftActive=false;
    }
  }

  // rolling drag (frame-rate independent)
  c.vel.multiplyScalar(Math.exp(-CONFIG.drag*dt));

  // integrate
  c.pos.addScaledVector(c.vel, dt);

  // CUSTOM-TRACK CITY LIMITS: a soft perimeter that holds even in free roam (owner: no driving to infinity)
  if(typeof _cityLimitR!=='undefined' && _cityLimitR>0 && typeof trackCentroid!=='undefined'){
    _v.set(c.pos.x-trackCentroid.x, c.pos.y-trackCentroid.y); const dC2=_v.length();
    if(dC2>_cityLimitR-1.2){ _v.multiplyScalar(1/dC2);
      const vOut2=c.vel.dot(_v); if(vOut2>0) c.vel.addScaledVector(_v,-vOut2);
      c.pos.set(trackCentroid.x+_v.x*(_cityLimitR-1.2), trackCentroid.y+_v.y*(_cityLimitR-1.2));
      if(c.isPlayer && vOut2>10 && typeof audio!=='undefined'&&audio&&audio.thud) audio.thud(0.4); } }

  // curb barrier: SLIDE along it — cancel only the into-wall velocity, keep your speed
  // (races only — Battle Royale AND free roam are OPEN: no track barriers, cars roam the whole district)
  if((typeof brActive==='undefined' || !brActive) && !(typeof freeRoam!=='undefined' && freeRoam)){ const p=samplePts[c.trackIdx]; _v.set(c.pos.x-p.x, c.pos.y-p.y); const dd=_v.length();
    const limit=(sampleHW[c.trackIdx]||CONFIG.roadHalfWidth)-1.0;   // per-sample road edge (narrows at tight corners)
    if(dd>limit){ _v.multiplyScalar(1/dd);                 // outward normal
      const vOut=c.vel.dot(_v);                            // >0 = driving into the wall
      if(vOut>0) c.vel.addScaledVector(_v, -vOut);         // remove the into-wall part -> slide along
      c.vel.multiplyScalar(Math.exp(-1.2*(1-0.22*tire)*dt));  // light scrape (TIRES keep more speed along the wall)
      c.pos.set(p.x + _v.x*limit, p.y + _v.y*limit);       // clamp to the curb (can't climb the sidewalk)
      if(vOut>8 && typeof applyDamage==='function') applyDamage(c, _v.x, _v.y, vOut);   // panel damage on wall hits (all cars)
      if(c.isPlayer && vOut>14){ camShake=Math.min(camShake+0.45,1.0);
        sparks.emit(c.pos.x,0.5,c.pos.y,(Math.random()-.5)*4,1,(Math.random()-.5)*4,0.3,9);
        if(raceTime-(c._thudT||-1)>0.25){ c._thudT=raceTime; audio&&audio.thud(clamp(vOut/40,0.3,1)); }
        if(navigator.vibrate){ try{navigator.vibrate(20);}catch(e){} } }
      if((!c.isPlayer || autoDrive) && c.vel.length()<3){    // un-wedge a slow AI (or auto-driving player): peel off the wall toward the centerline, then nudge forward
        const t=sampleTan[c.trackIdx], p=samplePts[c.trackIdx];
        const along=Math.atan2(t.x,t.y), toCtr=Math.atan2(p.x-c.pos.x, p.y-c.pos.y);
        const aimH = c.trackDist>5 ? toCtr : along;          // pinned to the curb -> aim back to center; otherwise just realign along the track
        c.heading += angleDiff(aimH, c.heading)*Math.min(1,dt*5);
        c.vel.x += Math.sin(c.heading)*8.5*dt; c.vel.y += Math.cos(c.heading)*8.5*dt; }
    }
  }

  // OFF-ROAD RESCUE (race modes): if a car somehow ends up stranded off the road (any bug, any track), snap it back after 2.5s — nobody is EVER stuck in the void
  if(!brActive && !(typeof freeRoam!=='undefined' && freeRoam)){   // free roam: no off-road snap-back either
    if(c.trackDist > (sampleHW[c.trackIdx]||CONFIG.roadHalfWidth)+9){ c._lostT=(c._lostT||0)+dt;
      if(c._lostT>2.5){ const p=samplePts[c.trackIdx], t=sampleTan[c.trackIdx];
        c.pos.set(p.x,p.y); c.heading=Math.atan2(t.x,t.y); c.vel.set(t.x*9,t.y*9); c.air=0; c._airV=0; c._lostT=0;
        if(c.isPlayer){ _scy=null; camShake=Math.min(camShake+0.25,0.8); flash('↩ BACK ON TRACK','good'); } }
    } else c._lostT=0;
    // AI NO-PROGRESS RESCUE: an AI wedged on a hairpin (oscillating against the curb, spinning at the apex)
    // never advances its track index — after 3.5s snap it to the centerline pointing down-track
    if(!c.isPlayer){
      if(c._lastProgIdx==null) c._lastProgIdx=c.trackIdx;
      const adv=((c.trackIdx - c._lastProgIdx)%SAMPLES+SAMPLES)%SAMPLES;
      if(adv>=4 && adv<SAMPLES-60){ c._lastProgIdx=c.trackIdx; c._noProgT=0; }
      else { c._noProgT=(c._noProgT||0)+dt;
        if(c._noProgT>3.5){ const p=samplePts[c.trackIdx], t=sampleTan[c.trackIdx];
          c.pos.set(p.x,p.y); c.heading=Math.atan2(t.x,t.y); c.vel.set(t.x*11,t.y*11); c.air=0; c._airV=0;
          c._noProgT=0; c._lastProgIdx=c.trackIdx; } }
    }
  }

  // lap / checkpoint progress
  updateProgress(c, prev);

  // ----- mesh -----
  syncCarMesh(c);
  const lateral=_l.length()*Math.sign(c.vel.dot(_r.set(Math.cos(c.heading),-Math.sin(c.heading))));
  c.rig.spinAcc += fwdSpeed*dt/0.55;
  const _burn = c.drifting || (inp.throttle && Math.abs(c.vel.dot(_r.set(Math.cos(c.heading),-Math.sin(c.heading))))>2.2 && fwdSpeed<24);
  c.rig._spinX = (c.rig._spinX||0) + (_burn ? 22*dt : 0);          // WHEELSPIN: rear tyres over-rotate when traction breaks
  const _rw = c.rig.roadWheels||c.rig.wheels;
  _rw.forEach(w=>{ const oz=(w.userData._nz!==undefined ? w.userData._nz : (w.userData._oz!==undefined ? w.userData._oz : w.position.z));
    const isRear = oz < 0;                                          // +Z = front (normalized car space; align-pivot wheels sit at local 0,0,0 so _nz is authoritative)
    w.rotation.x = c.rig.spinAcc + (isRear ? c.rig._spinX : 0); });   // fronts roll true
  // visual steer is DAMPED: the auto-drive controller outputs corrective steer that can flick sign every
  // few frames — raw rotation.y snapped the front wheels side-to-side at speed (read as "wheels pointing
  // the wrong way"). A real steering rack is damped; 0.22 lerp settles in ~4 frames but kills the flicker.
  const vSteer=clamp(inp.steer,-1,1)*0.5;
  c.rig._vSteer=(c.rig._vSteer||0)+(vSteer-(c.rig._vSteer||0))*0.22;
  c.rig.front.forEach(w=> w.rotation.y=c.rig._vSteer);
  // BRAKE LIGHTS: the tail lamps FIRE while braking — bright enough to read in full daylight too
  if(c.rig.lampMats && c.rig.lampMats[1]){ const tm=c.rig.lampMats[1];
    if(tm.userData._restEI==null) tm.userData._restEI=tm.emissiveIntensity;
    const want = inp.brake ? Math.max(3.6, tm.userData._restEI*1.8) : tm.userData._restEI;
    if(tm.emissiveIntensity!==want) tm.emissiveIntensity=want; }
  // WHOLE-CAR lean: rotate the top-level GROUP so body, wheels, kit, exhausts, lights and flag all
  // tilt together as ONE rigid car. (Leaning the chassis split the body from sibling wheels on the
  // DRIFTER and from the group-mounted wing/exhausts/lights on every GLB car.)
  c._leanZ = lerp(c._leanZ||0, clamp(-lateral*0.013,-0.15,0.15), 0.14);   // weightier: a touch more roll, slower settle (reads as suspension)
  c._leanX = lerp(c._leanX||0, clamp((inp.brake?0.04:(inp.throttle?-0.028:0)),-0.06,0.06), 0.08);   // deeper brake dive / throttle squat, eased in
  c.rig.group.rotation.z = c._leanZ;
  c.rig.group.rotation.x = -(c._pitch||0) + c._leanX + (c._airTilt||0);   // road grade + brake/throttle squat + airborne arc attitude, one pivot
  // SUSPENSION GROUND-STICK (owner: turns looked odd, front wheels lifted): the BODY rolls with
  // lateral load but every WHEEL pivot counter-offsets vertically so its contact patch stays ON the
  // road — outside suspension compresses, inside extends, exactly like real travel. Road-grade pitch
  // is untouched (the road tilts with the car); only the lean/squat portions are cancelled at the tyre.
  if(c.rig.wheels && c.rig.wheels.length){
    const szr=Math.sin(c._leanZ||0), sxr=Math.sin(c._leanX||0);
    for(let wi=0; wi<c.rig.wheels.length; wi++){ const w=c.rig.wheels[wi];
      if(w.userData._py===undefined){ w.userData._py=w.position.y;
        // legacy fallback (doge/old rigs without build-time normalized coords): sum .position up the chain
        let ox=0, oz=0, node=w;
        while(node && node!==c.rig.group){ if(node.scale && (node.scale.x!==1)) break; ox+=node.position.x; oz+=node.position.z; node=node.parent; }
        w.userData._ox=ox; w.userData._oz=oz; }
      // NORMALIZED car-space coords when the rig provides them (align-pivot wheels): raw-frame sums gave
      // metre-scale models radians of camber + saturated travel = every wheel wobbled (owner report)
      const nx=(w.userData._nx!==undefined ? w.userData._nx : w.userData._ox);
      const nz=(w.userData._nz!==undefined ? w.userData._nz : w.userData._oz);
      const wS=w.userData._wS||1;                                           // local units per normalized unit
      const off=clamp(-nx*szr + nz*sxr, -0.08, 0.035);                      // ground-stick in CAR units — same cm of travel on every model
      const target=w.userData._py + off/wS;
      w.position.y += (target-w.position.y)*0.5;                            // smoothed = damped suspension travel
      // CAMBER: outboard wheels lean into the corner a hair. Applied on the ALIGN group (OUTSIDE the
      // spinning pivot) — rotation.z on the YXZ pivot itself is innermost, so the tilt PRECESSED with
      // rotation.x and every wheel wobbled like a bent axle.
      const cam=clamp(-nx*szr*0.9, -0.10, 0.10);
      if(w.parent && w.parent.userData && w.parent.userData._wheelAlign){ w.parent.rotation.z=cam; w.rotation.z=0; }
      else w.rotation.z=cam; }
  }
  if(c.rig.chassis){ c.rig.chassis.rotation.z=0; c.rig.chassis.rotation.x=0;
    if(c.rig._cx0!=null) c.rig.chassis.position.x=c.rig._cx0; }       // retire the old chassis-level lean on existing rigs

  // ----- effects: tire smoke + skid marks -----
  const slip=Math.abs(lateral), spd=c.vel.length();
  const offT=c.trackDist>CONFIG.roadHalfWidth;
  const hardBrake = inp.brake && spd>14 && c.vel.dot(_f)>0;         // locking the brakes at speed
  // BRAKE ROTORS glow with heat: builds under braking, cools gradually (thermal inertia) — the disc "animation effect"
  if(c.rig.brakeMats && c.rig.brakeMats.length){
    const load = (inp.brake && spd>5) ? (hardBrake?1:0.5) : 0;
    c._brakeHeat = Math.max(0, Math.min(1, (c._brakeHeat||0) + (load>0 ? dt*(1.5+load) : -dt*0.8)));
    const ei = c._brakeHeat*c._brakeHeat*2.8;
    for(let bi=0; bi<c.rig.brakeMats.length; bi++){ const bm=c.rig.brakeMats[bi]; bm.emissiveIntensity=ei;
      if(bm.emissive) bm.emissive.setRGB(1, 0.14+0.32*c._brakeHeat, 0.02+0.05*c._brakeHeat); } }   // deep-red -> orange as they heat

  // IDLE EXHAUST: soft grey puffs curl out of the real tailpipes while the engine idles
  if(spd<1.8 && !inp.throttle && c.rig.exhaustPts && typeof tireSmoke!=='undefined'){
    c._exhT=(c._exhT||0)-dt;
    if(c._exhT<=0){ c._exhT=0.34+Math.random()*0.22;
      const wp=new THREE.Vector3();
      for(const ep of c.rig.exhaustPts){ wp.copy(ep); c.rig.group.localToWorld(wp);
        tireSmoke.emit(wp.x, wp.y, wp.z, (Math.random()-0.5)*0.12, 0.32, -Math.sin(c.heading)*0.15, 0.11, 1); } } }
  if(spd<0.8) c._stopT=0.5; else if(c._stopT>0) c._stopT-=dt;       // "recently at a standstill" flag
  const burnout = inp.throttle && spd>2.5 && spd<8 && c._stopT>0;   // wheelspin only while pulling AWAY from a stop (not wedged at ~0)
  const aiSlide = !c.isPlayer && slip>2.6 && spd>18;                // AI corner hard on grip -> they get slide smoke too (owner request)
  const screech = (c.drifting && slip>(1.6+0.35*tire)) || hardBrake || burnout || aiSlide;   // TIRES grip harder before squealing
  if(c.isPlayer) c._skidSnd = ((c.drifting && spd>6) || hardBrake || burnout);   // audio-only flag (physics-inert): locked-brake squeal too, not just drifts
  if(c.isPlayer && tire>0 && c.drifting && slip>2.4 && raceTime-(c._gripCue||-9)>1.6){ c._gripCue=raceTime; popup('🛞 GRIP','#7ce0ff'); }
  const rx=c.pos.x-Math.sin(c.heading)*1.6, rz=c.pos.y-Math.cos(c.heading)*1.6;
  const ey=c.visY||0;                                            // ground effects ride the road elevation
  if(screech || offT || c.boosting){
    c.skidTimer-=dt;
    if(screech || offT){
      const intensity = offT?1 : clamp(slip/3 + (hardBrake?0.6:0) + (burnout?0.7:0), 0.4, 1.6);
      // PER-AXLE TYRE SMOKE (expanded tire physics): a sliding car smokes from the REAR tyres (the ones
      // breaking traction in a drift/burnout); a locked-brake car smokes from the FRONTS. Emit from the
      // actual contact patches, not a generic centreline spot.
      const dm=c.rig.dims||{W:2.3,Lz:4.6}, halfT=dm.W*0.42, fwx2=Math.sin(c.heading), fwz2=Math.cos(c.heading);
      const emitAxle=(along, weight)=>{ const ax=c.pos.x+fwx2*along, az=c.pos.y+fwz2*along, pl=c.isPlayer;
        for(let s=-1;s<=1;s+=2){ const wx=ax+Math.cos(c.heading)*halfT*s, wz=az-Math.sin(c.heading)*halfT*s;
          if(offT){ dust.emit(wx,0.35+ey,wz,(Math.random()-.5)*2,1.3+Math.random(),(Math.random()-.5)*2, pl?0.55:0.4, pl?(12+Math.random()*8):(7+Math.random()*4)); }   // AI dust: smaller + clears faster (owner: too much, hurts visibility)
          else if(Math.random()<weight*(pl?1:0.26))                                                                   // AI smoke far less often (was 0.4)
            tireSmoke.emit(wx,0.2+ey,wz,(Math.random()-.5)*0.9, 0.8+Math.random()*0.7, (Math.random()-.5)*0.9,
              pl?(0.7+intensity*0.25):(0.4+intensity*0.13), pl?(5+intensity*2.5+Math.random()*3):(3+intensity*1.1+Math.random()*1.4)); } };   // AI puffs smaller + short-lived; player drift unchanged
      const rearW = (burnout||c.drifting) ? 1 : 0.55, frontW = hardBrake ? 0.9 : (c.drifting?0.35:0.2);
      emitAxle(-dm.Lz*0.32, rearW);                                 // rear tyres = the drift smokers
      emitAxle( dm.Lz*0.30, frontW);                                // front tyres = brake-lock / scrub
      if(c.skidTimer<=0 && skidPool.length){ dropSkid(rx,rz,c.heading,ey); c.skidTimer=0.022; }
    }
    if(c.boosting && Math.random()<0.5){                          // a FEW tiny embers off the flame (not an orange cloud)
      const fwx=Math.sin(c.heading), fwz=Math.cos(c.heading);
      const bx2=c.pos.x-fwx*2.3, bz2=c.pos.y-fwz*2.3;             // rear of the car
      sparks.emit(bx2+(Math.random()-.5)*0.5, 0.55+ey, bz2+(Math.random()-.5)*0.5, -fwx*8+(Math.random()-.5), 0.5+Math.random()*0.7, -fwz*8+(Math.random()-.5), 0.16, 1.6+Math.random()*1.6);
    }
  }
  if(c.rig.flames){                                               // licking fire flares while boosting (bigger with nitrous)
    const on=c.boosting, nf=c.nosForce||1;
    for(const f of c.rig.flames){ f.visible=on; if(on){ f.scale.set((0.78+Math.random()*0.35)*nf, (0.78+Math.random()*0.35)*nf, (0.6+Math.random()*0.8)*nf);
      f.rotation.z=(Math.random()-0.5)*0.25; } }   // flicker length + lick sideways
  }
  // ----- ENGINE IDLE + EXHAUST SMOKE (visual only; physics untouched) -----
  { const stand = spd<0.8;
    const fwx=Math.sin(c.heading), fwz=Math.cos(c.heading);
    const exX=c.pos.x-fwx*2.25, exZ=c.pos.y-fwz*2.25;                       // rear bumper / exhaust line
    if(stand){
      c.rig.group.rotation.z += Math.sin(performance.now()*0.045)*0.0022;   // subtle idle tremble (engine running)
      c._exT=(c._exT||0)-dt;
      if(c.isPlayer && tireSmoke && c._exT<=0){ c._exT=0.5+Math.random()*0.25;
        tireSmoke.emit(exX+(Math.random()-.5)*0.3, 0.45+ey, exZ+(Math.random()-.5)*0.3,
          -fwx*0.5, 0.55+Math.random()*0.3, -fwz*0.5, 0.85, 2.6+Math.random()*1.2); }   // lazy idle wisps from the pipes
    }
    else if(c.isPlayer && inp && inp.throttle && spd<24 && tireSmoke){       // EXHAUST FUMES on acceleration (owner): light wisps trailing off the pipes, only the player, only when it reads
      c._exT=(c._exT||0)-dt;
      if(c._exT<=0){ c._exT=0.12+Math.random()*0.08;
        tireSmoke.emit(exX+(Math.random()-.5)*0.22, 0.4+ey, exZ+(Math.random()-.5)*0.22, -fwx*1.1, 0.35+Math.random()*0.3, -fwz*1.1, 0.4, 1.5+Math.random()*0.8); } }
    if(burnout && tireSmoke && Math.random()<0.45)                          // launch blip: a fat puff out the exhaust
      tireSmoke.emit(exX, 0.5+ey, exZ, -fwx*1.6, 0.9, -fwz*1.6, 0.9, 5+Math.random()*3);
  }
  updatePanelDamage(c);                                                     // progressive visible damage (dent -> wobble -> tear off)
  // ----- arcade: pickups + drift style score (player, racing) -----
  if(c.isPlayer && state==='race'){
    arcadePickups(c, dt); updateObstacles(c, dt);
    // ----- DRIFT CHAIN: holding a drift scores + escalates the combo multiplier; clean exit pays out -----
    if(c.drifting && slip>1.6 && spd>8){
      runScore += slip*dt*8*combo; comboTimer=2.6;
      if(c.isPlayer && !timeTrial) questDrift(spd*dt);                              // DAILY QUEST: drift distance
      c._driftT=(c._driftT||0)+dt;
      if(c._driftT>=1.2){ c._driftT=0; combo=Math.min(combo+1,12); popup('🌀 DRIFT x'+combo,'#c98aff'); }   // each ~1.2s held bumps the chain
    } else if((c._driftT||0)>0){
      if(c._driftT>0.6) addScore(45,'🌀 DRIFT','#c98aff');   // reward a clean drift on exit
      c._driftT=0;
    }
  }
}

function dropSkid(x,z,ang,ey){ ey=ey||0; for(let s=-1;s<=1;s+=2){ const m=skidPool[skidCursor]; skidCursor=(skidCursor+1)%skidPool.length;
  m.position.set(x+Math.cos(ang)*0.7*s, 0.075+ey, z-Math.sin(ang)*0.7*s); m.rotation.y=ang; m.visible=true; } }   // (cos,-sin) = true perpendicular to heading

function updateProgress(c, prev){
  const S=SAMPLES, idx=c.trackIdx;
  if(idx>S*0.45 && idx<S*0.58) c.halfPassed=true;
  if(prev>S*0.78 && idx<S*0.22){            // forward across the start line
    if(c.halfPassed && !c.finished){ onLapComplete(c); c.halfPassed=false; }
  }
}
function onLapComplete(c){
  c.lap++;
  if(typeof freeRoam!=='undefined' && freeRoam) return;               // FREE ROAM: laps tick silently, nothing ever finishes
  if(c.isPlayer){
    const lt=raceTime-c.lapStart; c.lapStart=raceTime; lapTimes.push(lt);
    if(bestLap===null || lt<bestLap){ bestLap=lt; if(c.lap>0) showBest(); }
    if(c.lap>=CONFIG.laps) finishRace();
    else if(c.lap===CONFIG.laps-1){ flash('FINAL LAP!','cd2'); }   // last-lap drama
  } else { c.lapStart=raceTime; if(c.lap>=CONFIG.laps) c.finished=true; }
}

/* =========================================================================
   AI input
   ========================================================================= */
function aiInput(c){
  const speed=c.vel.length();
  // how hard the track bends over the next stretch (heading change samples +6..+30 ahead)
  const tNear=sampleTan[(c.trackIdx+6)%SAMPLES], tMid=sampleTan[(c.trackIdx+30)%SAMPLES];
  const bend=Math.abs(angleDiff(Math.atan2(tMid.x,tMid.y), Math.atan2(tNear.x,tNear.y)));
  // ADAPTIVE lookahead: far on straights, SHORT on sharp corners so we track the apex instead of aiming across it into the wall
  const aim=Math.round(clamp(15 + speed*0.5 - bend*32, 9, 44));
  const aheadI=(c.trackIdx+aim)%SAMPLES, a=samplePts[aheadI], n=sampleNorm[aheadI];
  const _off = c.isPlayer ? c.lineOffset : obstacleAvoid(c, aheadI, c.lineOffset);   // AI weaves around dumpsters/bikes/trash
  const tx=a.x+n.x*_off, tz=a.y+n.y*_off;
  const desired=Math.atan2(tx-c.pos.x, tz-c.pos.y);
  const diff=angleDiff(desired, c.heading);
  const steer=clamp(diff*2.3,-1,1);                                  // a touch more steering authority to make tight corners
  // sharpest of (the bend we measured) and (the kink just past the aim point)
  const farI=(c.trackIdx+Math.round(aim*1.6)+8)%SAMPLES, f=samplePts[farI];
  const curve=Math.max(bend, Math.abs(angleDiff(Math.atan2(f.x-tx, f.y-tz), desired)));
  // brake toward a corner-appropriate speed (sharper corner -> slower) instead of a single threshold
  const gripCarry = c.isPlayer ? (0.9+0.12*(c.gripMul||1)+0.03*(c.tireLvl||0)) : (1.07+0.45*(aiAccel-1));   // GRIP/TIRES let a car carry more corner speed; AI corner-carry scales with difficulty to match a maxed player
  const targetSpd=clamp((64 - curve*44)*aiAggro*gripCarry, 30, 80);                            // owner: AI crawled through turns — flatter curve penalty + a 30 floor keeps them HONEST-fast
  let brake = speed > targetSpd+7;                                                             // and they brake later
  if(curve>0.5 && !c._inCorner){ c._inCorner=true; c._missThis = !window.__auto && Math.random()<((c.aiMiss||0)*(c.isRival?0.25:1)); }   // decide the miss ONCE per corner; the RIVAL barely errs
  else if(curve<0.28) c._inCorner=false;
  const brakeMul = (brake && c._missThis) ? 0.5 : (curve>0.7 ? 1.1 : 0.65);   // gentler braking overall — scrub speed, don't park (owner: corners made the game too easy)
  const boostHard = (c.isRival ? 14 : 20) / aiAggro;                                          // aggression: deploy NITROUS readily (lower threshold) on hard
  // AI COMPETITORS NEVER DRIFT (by request) — they corner on planted grip only (clean, fast lines).
  // Drift is reserved for the human player + multiplayer humans (they use their own manual input, not aiInput).
  return { throttle:!brake, brake, brakeMul, steer, drift: c.isPlayer && curve>0.88 && speed>36, boost: !brake && c.boost>boostHard };
}
