import assert from 'node:assert/strict';
import * as world from '../src/world-engine.js';
import { cleanAdventure } from '../src/adventure-state.js';

assert.equal(cleanAdventure(null).practice, false, 'student practice must be opt-in');
assert.equal(cleanAdventure(null).practiceRounds, 1, 'one practice round is the default');
assert.equal(cleanAdventure({practice:true,practiceRounds:99}).practiceRounds, 3, 'practice rounds are bounded');
assert.equal(cleanAdventure({practice:'yes',practiceRounds:-4}).practice, false, 'imported opt-in requires a boolean');
assert.equal(cleanAdventure({practice:true,practiceRounds:-4}).practiceRounds, 1);
assert.equal(typeof world.routeForOuting, 'function', 'teaching routes follow the selected biome');
const generated=world.generateWorld('trail-test');
for(const biome of ['meadow','archive','coast','workshop']){
  const route=world.routeForOuting({kind:'teach',biome});
  assert.ok(route.length>=3);
  assert.ok(route.filter(id=>id!=='camp').every(id=>generated.landmarks.find(l=>l.id===id)?.biome===biome), 'teaching stops belong to '+biome);
}
const engine=world.createWorldEngine({getState:()=>({seed:'trail-test',motion:'reduced'})});
assert.equal(typeof engine.directory,'function','world places are accessible outside the canvas');
const directory=engine.directory();
assert.equal(directory.filter(p=>p.type==='landmark').length,17);
assert.equal(directory.filter(p=>p.type==='npc').length,7);
const walking=engine.command('walk-to',{id:'flower-class',agent:'nova'});
assert.equal(walking.navigation.targetId,'flower-class');
assert.equal(walking.navigation.actor,'nova');
assert.equal(walking.resources,0,'a scenic walk creates no actual model resources');
const preview=engine.command('travel',{id:'lighthouse'});
assert.equal(preview.camera.x,generated.landmarks.find(l=>l.id==='lighthouse').x);
assert.equal(preview.navigation.targetId,'flower-class','camera travel preserves a chosen walking route');
const invalid=engine.command('walk-to',{id:'unknown'});
assert.equal(invalid.navigation.targetId,'flower-class','invalid landmarks do not replace a valid route');
assert.equal(engine.command('resume-walk').navigation,null);
engine.destroy();
console.log('World evolution unit checks passed: opt-in bounded practice, biome routes, accessible directory, scenic navigation and camera independence.');
