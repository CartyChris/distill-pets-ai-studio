import { PLAY_ACTIVITIES } from './playbook.js';

// One bounded, interruptible activity at a time. Save and restore walking routes;
// the AI pipeline is independent and keeps running throughout a scenic break.
export function createPlayDirector({ companions, pathTo, advance, onComplete = () => {} }) {
  let current = null;
  function cancel(time = 0) {
    if (!current) return;
    const previous = current;
    current = null;
    for (const [id, saved] of Object.entries(previous.saved)) {
      const p = companions[id];
      p.path = saved.path;
      p.target = saved.target;
      p.stop = time + saved.wait;
      p.walking = false;
    }
  }
  function start(id, time = 0, lead = 'milo') {
    const activity = PLAY_ACTIVITIES.find(a => a.id === id);
    if (!activity || current) return false;
    const anchor = companions[lead] || companions.milo;
    const center = { x: anchor.x, y: anchor.y };
    const saved = {};
    for (const [key, p] of Object.entries(companions)) {
      saved[key] = { path: p.path.map(n => ({ ...n })), target: p.target ? { ...p.target } : null, wait: Math.max(0, p.stop - time) };
      const point = { x: center.x + (key === 'milo' ? -57 : 57), y: center.y + (key === 'milo' ? 0 : 12) };
      p.path = pathTo(p, point);
      p.path.push(point);
      p.target = p.path.shift();
      p.stop = 0;
    }
    current = { id, title: activity.title, phase: 'gathering', started: time, duration: activity.seconds, center, saved };
    return true;
  }
  function update(dt, time, paused) {
    if (!current || paused) return;
    if (current.phase === 'gathering') {
      for (const p of Object.values(companions)) advance(p, dt, 155, false);
      if (Object.values(companions).every(p => !p.target && !p.path.length)) {
        current.phase = 'playing';
        current.started = time;
        companions.milo.facing = 1;
        companions.nova.facing = -1;
      }
    } else if (time - current.started >= current.duration) {
      const id = current.id;
      cancel(time);
      onComplete(id);
    }
  }
  const status = () => current ? { id: current.id, title: current.title, phase: current.phase, started: current.started, duration: current.duration, center: { ...current.center } } : null;
  return { start, cancel, update, status };
}

// Shared props are drawn in world coordinates. All movement has a static pose.
export function drawPlayProps(ctx, activity, elapsed, motion, foreground = false) {
  if (!activity || activity.phase !== 'playing') return;
  const t = motion ? elapsed - activity.started : 1;
  const { x, y } = activity.center;
  ctx.save();
  ctx.translate(x, y);
  const ellipse = (x, y, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  const line = (x1, y1, x2, y2, color, w = 2) => { ctx.beginPath(); ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke(); };
  if (!foreground && ['picnic', 'rest', 'read'].includes(activity.id)) {
    ctx.save(); ctx.translate(0,10); ctx.scale(1,.37); ctx.rotate(-.08);
    ctx.fillStyle = activity.id === 'rest' ? '#c8bfd9' : '#f4c7b3';
    ctx.fillRect(-110,-65,220,130);
    for (let i = -100; i < 110; i += 22) line(i,-65,i,65,'#fff0cf99',8);
    for (let i = -55; i < 65; i += 22) line(-110,i,110,i,'#fff0cf88',8);
    ctx.restore();
  }
  if (!foreground) { ctx.restore(); return; }
  if (activity.id === 'picnic') {
    ellipse(0,18,27,10,'#74574435');
    ctx.fillStyle='#ae7d49';ctx.fillRect(-20,-9,40,25);
    ctx.strokeStyle='#805b3c';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,-8,15,Math.PI,0);ctx.stroke();
    for (let i=-12;i<=12;i+=12) { ellipse(i, -6, 6, 7, '#d56c74');line(i,-12,i+3,-18,'#5d8855',3); }
    if (motion) for(let i=0;i<3;i++) { const a=t*1.4+i*2.1;ellipse(Math.cos(a)*18,-26+Math.sin(a)*7,2,2,'#fff5bb'); }
  } else if (activity.id === 'read') {
    ctx.save();ctx.translate(0,-44 + (motion ? Math.sin(t*1.4)*2 : 0));
    ctx.fillStyle='#668a79';ctx.fillRect(-31,-6,62,37);
    ctx.fillStyle='#fff5d7';ctx.fillRect(-27,-11,25,36);ctx.fillRect(2,-11,25,36);
    line(0,-7,0,29,'#c49d78',3);
    for(let j=0;j<3;j++) { line(-22,j*7,-7,j*7,'#bca98c');line(7,j*7,22,j*7,'#bca98c'); }
    ctx.restore();
  } else if (activity.id === 'bubbles') {
    for (let i=0;i<11;i++) {
      const cycle = (t*.17+i*.091)%1, bx=Math.sin(i*2.4+t*.5)*105, by=-28-cycle*205;
      const r=9+(i%4)*5;
      ctx.globalAlpha=Math.min(1,(1-cycle)*3);
      ellipse(bx,by,r,r,['#bbdefc4a','#f6c7dc55','#d7efcd55'][i%3]);
      ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.strokeStyle=['#d8edff','#ffd8eb','#e5f5c7'][i%3];ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(bx-2,by-2,r*.65,3.6,4.8);ctx.strokeStyle='#fffdf0';ctx.stroke();
    }
  } else if (activity.id === 'dance') {
    ctx.font='bold 27px system-ui';ctx.textAlign='center';
    for(let i=0;i<5;i++) { ctx.fillStyle=['#f3d895','#dfadd2','#b0d4c7'][i%3];ctx.fillText(i%2?'♪':'♫', Math.sin(i*2.1+t)*105, -125-Math.cos(i+t*2)*24); }
  } else if (activity.id === 'highfive') {
    const radius=motion?14+Math.abs(Math.sin(t*3))*13:22;
    for(let i=0;i<8;i++){ const a=i*Math.PI/4;line(Math.cos(a)*radius,-98+Math.sin(a)*radius,Math.cos(a)*(radius+10),-98+Math.sin(a)*(radius+10),'#fff0a8',4); }
    ellipse(0,-98,7,7,'#f6cf81');
  } else if (activity.id === 'rest') {
    ctx.font='700 20px system-ui';ctx.fillStyle='#e7d8f4';
    ctx.fillText('z',-60,-125-(motion?Math.sin(t)*7:0));ctx.fillText('z',55,-110-(motion?Math.cos(t)*7:0));
  }
  ctx.restore();
}
