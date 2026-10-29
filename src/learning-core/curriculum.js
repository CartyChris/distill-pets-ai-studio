// Deterministic starters: no model call, automatic approval, or replacement of saved work.
export const CURRICULA = [
  { id:'explain', name:'The patient explainer', icon:'🌻', goal:'Explain unfamiliar ideas accurately for a beginner.', rubric:'Use plain language, one labeled analogy, and acknowledge its limits.',
    tasks:[['Explain how a seed becomes a plant to a ten-year-old.','Mention water, oxygen, warmth and later light.'],['Explain why seasons change without saying Earth is closer to the Sun in summer.','Use axial tilt and differences between hemispheres.'],['Explain why the sky usually looks blue.','Explain scattering simply; do not invent a false source.']] },
  { id:'grounded', name:'The careful researcher', icon:'🔎', goal:'Use supplied evidence and separate known facts from uncertainty.', rubric:'Use only supplied facts. Cite the supplied source labels. Say when evidence is missing.',
    tasks:[['[A] The trial had 40 volunteers. [B] Twelve reported a headache. Summarize the evidence; can it prove the treatment caused headaches?','Name both sources and avoid a causal claim.'],['[A] The garden opened in 1998. [B] Its archive lists 120 plant species. Write a visitor note and say whether it has orchids.','Do not invent an orchid collection.'],['[A] The bus runs hourly from 08:00 to 18:00. [B] The fare is €3. Answer whether bicycles are allowed.','Identify what is known and what needs checking.']] },
  { id:'structured', name:'The tidy data keeper', icon:'🧩', goal:'Extract reliable structured data from a supplied passage.', rubric:'Return only valid JSON. Use null for missing facts. Do not invent information.', checks:{format:'json',jsonKeys:['name','city'],required:[],forbidden:[],minChars:0,maxChars:0},
    tasks:[['Return {name, city} from: Ada lives in Lisbon.','Name Ada and city Lisbon.'],['Return {name, city} from: Rowan booked a train; no home city was given.','Name Rowan and city null.'],['Return {name, city} from: Jun moved to Osaka last spring.','Name Jun and city Osaka.']] },
];
export function prioritizeCurriculum(cards, runs, demo) {
  return cards.filter(c => c.split === 'train' && c.prompt.trim()).map((card,index) => {
    const latest = runs.filter(r => r.demo === demo).slice().reverse().flatMap(r => r.items).find(item => item.cardId === card.id);
    const final = latest?.rounds?.at(-1)?.revision || latest?.revision;
    const diagnostics = final?.diagnostics;
    const priority = !latest ? 1 : !final?.text || final?.status !== 'complete' ? 3 : diagnostics?.failedChecks ? 2 : 0;
    return {id:card.id,priority,index};
  }).sort((a,b) => b.priority-a.priority || a.index-b.index).slice(0,3).map(c => c.id);
}
