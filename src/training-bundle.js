import { zipSync, strToU8 } from 'fflate';
import { normalizeTeachingPrompt, teachingRowPrompts, teachingRowsForExport, teachingSplitConflicts } from './teaching.js';

const jsonl = rows => rows.map(row=>JSON.stringify(row)).join('\n') + (rows.length?'\n':'');
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');

/** Reviewed data + explicit provenance in one portable archive. Never contains keys. */
export async function buildTrainingBundle(state, requested) {
  if(state.developmentOverflow || teachingSplitConflicts(state.cards,state.rows,state.developmentKeys).length) throw Error('Reserved validation overlaps development data.');
  const records = teachingRowsForExport(state.rows);
  if(!records.length || JSON.stringify(records)!==JSON.stringify(requested)) throw Error('Training rows must match the reviewed live dataset.');
  const sources = records.map(record=>state.rows.find(row=>row.approved && !row.demo && !row.truncated && row.split==='train' && JSON.stringify(teachingRowsForExport([row])[0])===JSON.stringify(record)));
  if(sources.some(row=>!row)) throw Error('A training example is missing its review provenance.');
  const validation = state.cards.filter(c=>c.split==='validation'&&c.prompt.trim()).map(c=>({prompt:c.prompt,rubric:c.rubric||state.rubric,goal:state.goal,split:'validation'}));
  const trainPrompts = sources.flatMap(teachingRowPrompts).map(normalizeTeachingPrompt);
  if(validation.some(c=>trainPrompts.includes(normalizeTeachingPrompt(c.prompt)))) throw Error('A supervised conversation overlaps validation.');
  const provenance = {format:'distill-pets-provenance-v1',goal:state.goal,rubric:state.rubric,checks:state.checks,rows:await Promise.all(sources.map(async (row,index)=>({
    index,id:row.id,approved:true,demo:false,truncated:false,split:'train',origin:row.origin,model:row.model,teacherModel:row.teacherModel,runId:row.runId,created:row.created,prompts:teachingRowPrompts(row),
    recordSha256:await digest(strToU8(JSON.stringify(records[index]))),
  }))),note:'Human review is a recorded workspace decision, not an authenticated third-party quality certification. Imported sources are supplied by the user.'};
  const files = {
    'train.jsonl':strToU8(jsonl(records)),
    'validation.jsonl':strToU8(jsonl(validation)),
    'provenance.json':strToU8(JSON.stringify(provenance,null,2)+'\n'),
    'README.md':strToU8('# Distill Pets reviewed training bundle\n\nTraining contains only reviewed, complete live practice/supplied examples. Validation is separate and contains prompts without invented answers. Preserve full conversation roles.\n\nRun the offline audit from the source repository:\n\n    python3 training/audit_bundle.py distill-pets-training-bundle.zip\n\nPreview a LoRA training plan without downloads or inference:\n\n    python3 training/train_lora.py --bundle distill-pets-training-bundle.zip --model YOUR_TRAINABLE_MODEL --output training/output/my-adapter --dry-run\n\nThe source repository includes training/README.md and pinned optional training dependencies. Actual training needs a compatible local/Hugging Face causal model, its access rights, and enough compute. An OpenRouter ID is not automatically a trainable model or a fine-tuning endpoint. No keys are in this archive. Training is an explicit separate action.\n\nChecksums detect accidental changes; they do not authenticate who approved examples. Review sources and answers yourself. The app uses context chips; this archive alone does not change model weights.\n'),
  };
  const manifest = {format:'distill-pets-training-bundle-v1',appVersion:'0.4.0',created:new Date().toISOString(),trainingRows:records.length,validationRows:validation.length,files:{}};
  for(const [name,bytes] of Object.entries(files)) manifest.files[name]={bytes:bytes.length,sha256:await digest(bytes)};
  files['manifest.json']=strToU8(JSON.stringify(manifest,null,2)+'\n');
  return zipSync(files,{level:6});
}
