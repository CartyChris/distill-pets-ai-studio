import assert from 'node:assert/strict';
import { cleanPlaybook, recordMoment, trailProgress, PLAY_ACTIVITIES, FIELD_STOPS, postcardCrop } from '../src/playbook.js';
import { createPlayDirector } from '../src/world-play.js';
import { createWorldEngine, generateWorld } from '../src/world-engine.js';
import { cleanAdventure } from '../src/adventure-state.js';

const book = cleanPlaybook({ visits: ['pond','pond','fake','<script>'], activities:['read','made-up'], moments:Infinity, postcards:-2, journal:[{kind:'visit',id:'pond',at:Number.MAX_SAFE_INTEGER}] });
assert.deepEqual(book.visits,['pond']); assert.deepEqual(book.activities,['read']); assert.equal(book.moments,0); assert.equal(book.postcards,0); assert.equal(book.journal.length,0);
assert.equal(cleanAdventure({panel:'play',playbook:book}).panel,'play');
const places=generateWorld('play-validation').landmarks;
assert.ok(FIELD_STOPS.every(id=>places.some(p=>p.id===id)), 'Every passport stop is a real world landmark');
assert.equal(recordMoment(book,'visit','chosen-spot'),false);
assert.equal(recordMoment(book,'visit','pond'),false,'Visits award one memory only');
recordMoment(book,'visit','flower-class');recordMoment(book,'visit','oak');
assert.equal(trailProgress(book).complete,3);assert.equal(trailProgress(book).next,null);
assert.equal(recordMoment(book,'play','script'),false);
for(let i=0;i<90;i++) recordMoment(book,'play','dance');
assert.equal(book.moments,90);assert.equal(book.journal.length,32);assert.equal(book.activities.filter(id=>id==='dance').length,1);
assert.deepEqual(cleanPlaybook(book),book,'Reload preserves bounded history');
assert.equal(recordMoment(book,'visit','camp',Infinity),false);
for (const [format,ratio] of [['landscape',16/9],['square',1],['portrait',9/16]]) {
  for(const [w,h] of [[320,568],[420,912],[1440,900]]) {
    const crop=postcardCrop(w,h,format);
    assert.ok(crop.width<=w && crop.height<=h+.001);
    assert.ok(Math.abs(crop.width/crop.height-ratio)<.001);
    assert.ok(Math.abs(crop.x*2+crop.width-w)<.001);
  }
}

function fixture() {
  const companions = {milo:{x:0,y:0,path:[{x:150,y:150}],target:{x:90,y:90},stop:2},nova:{x:60,y:20,path:[],target:null,stop:0}};
  const events=[];
  const director=createPlayDirector({companions,pathTo:()=>[],advance:(p)=>{if(p.target){p.x=p.target.x;p.y=p.target.y;p.target=p.path.shift()||null;}},onComplete:id=>events.push(id)});
  return {companions,director,events};
}
for(const activity of PLAY_ACTIVITIES) {
  const {companions,director,events}=fixture();
  const original=structuredClone(companions);
  assert.equal(director.start(activity.id,0),true);
  assert.equal(director.start('dance',1),false,'Cannot stack activities');
  director.update(1,1,true);assert.equal(director.status().phase,'gathering','Pausing stops the gathering');
  director.update(1,2,false);assert.equal(director.status().phase,'playing');
  director.update(1,100,true);assert.equal(events.length,0,'Paused scenery does not complete a break');
  director.update(1,2+activity.seconds,false);
  assert.deepEqual(events,[activity.id]);assert.equal(director.status(),null);
  assert.deepEqual(companions.milo.path,original.milo.path);assert.deepEqual(companions.milo.target,original.milo.target,'Previous walking route is restored');
  director.update(1,300,false);assert.equal(events.length,1,'Completion is emitted once');
}
const cancelled=fixture();assert.equal(cancelled.director.start('evil',0),false);
cancelled.director.start('read',0);cancelled.director.cancel(1);cancelled.director.update(1,20,false);assert.equal(cancelled.events.length,0,'Cancelled breaks never become completed memories');
const engine=createWorldEngine();engine.command('play',{kind:'dance'});assert.equal(engine.metrics().play.id,'dance');assert.equal(engine.metrics().resources,0);
engine.command('walk-to',{id:'camp'});assert.equal(engine.metrics().play,null,'Explicit walking cancels a play break');
engine.command('play',{kind:'picnic'});engine.command('regenerate',{seed:'new'});assert.equal(engine.metrics().play,null);assert.equal(engine.metrics().particles,0);
engine.destroy();assert.equal(engine.metrics().runningLoops,0);
console.log('PASS: bounded cosmetic passport, deduplicated real landmarks, six interruptible activities, route restoration, pause/cancel, no AI resources, proportional postcard crops and migration.');
