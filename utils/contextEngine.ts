// utils/contextEngine.ts
import { Story, Scene, NodeImportanceFactors, StateDelta, StoryState, ContextChunk, ChunkType, ContextBudgets, ContextWeights, TextLine } from '../types.ts';

const TYPE_BONUS: Record<ChunkType, number> = {
  local: 1.0,
  character: 0.8,
  story: 0.7,
  global: 0.6,
};

export function computeNodeImportance(f: NodeImportanceFactors, weights = {
  decision: 0.35,
  payoff: 0.25,
  emotional: 0.25,
  lore: 0.15,
}): number {
  return (
    weights.decision  * f.decisionWeight +
    weights.payoff    * f.payoffWeight +
    weights.emotional * f.emotionalIntensity +
    weights.lore      * f.loreDensity
  );
}

export function applyStateDelta(state: StoryState, delta: StateDelta): StoryState {
  const newState = JSON.parse(JSON.stringify(state)); // Deep copy

  if (delta.chapterChange !== undefined) newState.chapter = delta.chapterChange;
  if (delta.actChange !== undefined) newState.act = delta.actChange;

  if (delta.flags) {
    for (const f of delta.flags) {
      const existing = newState.flags.find((ff: any) => ff.key === f.key);
      if (existing) existing.value = f.value;
      else newState.flags.push(f);
    }
  }

  if (delta.relations) {
    for (const rUpd of delta.relations) {
      if (!rUpd.characterId) continue;
      const existing = newState.relations.find((r: any) => r.characterId === rUpd.characterId);
      if (existing) {
        if (rUpd.trust !== undefined) existing.trust = rUpd.trust;
        if (rUpd.affection !== undefined) existing.affection = rUpd.affection;
      } else {
        newState.relations.push({
          characterId: rUpd.characterId,
          trust: rUpd.trust ?? 0.5,
          affection: rUpd.affection ?? 0.5,
        });
      }
    }
  }

  if (delta.promises) {
    for (const p of delta.promises) {
      const existing = newState.promises.find((pp: any) => pp.id === p.id);
      if (existing) {
        if (p.kept !== undefined) existing.kept = p.kept;
        if (p.description) existing.description = p.description;
      } else {
        newState.promises.push({ id: p.id, description: p.description || '', kept: p.kept });
      }
    }
  }

  return newState;
}

export function scoreChunk(c: ContextChunk, w: ContextWeights): number {
  const fGraph = Math.exp(-w.lambda * c.graphDistance);
  const fTime  = Math.exp(-w.mu * c.timeDistance);

  const R =
    w.alpha * fGraph +
    w.beta  * fTime  +
    w.gamma * c.charOverlap +
    w.delta * c.embedSim +
    w.eta   * TYPE_BONUS[c.type] +
    w.kappa * c.nodeImportance;

  // Add a small epsilon to tokens to avoid division by zero
  return R / Math.pow((c.tokens || 0) + 1e-6, w.p);
}


export function selectContext(
  chunks: ContextChunk[],
  budgets: ContextBudgets,
  weights: ContextWeights
): ContextChunk[] {
  const byType: Record<ChunkType, ContextChunk[]> = {
    local: [], character: [], story: [], global: []
  };

  for (const c of chunks) {
    byType[c.type].push(c);
  }

  const selected: ContextChunk[] = [];

  (Object.keys(byType) as ChunkType[]).forEach(type => {
    const bucket = byType[type];
    const budget = budgets[type];
    if (!budget || bucket.length === 0) return;

    const scored = bucket
      .map(c => ({ chunk: c, score: scoreChunk(c, weights) }))
      .sort((a, b) => b.score - a.score);

    let used = 0;
    for (const { chunk } of scored) {
      if (used + chunk.tokens > budget) continue;
      selected.push(chunk);
      used += chunk.tokens;
    }
  });

  return selected;
}

function estimateTokens(text: string): number {
    // A simple heuristic: average 4 characters per token.
    return Math.ceil(text.length / 4);
}

export function buildContextChunks(story: Story, targetSceneId: string): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    const targetScene = story.scenes[targetSceneId];
    if (!targetScene) return [];

    // --- Build Graph for distance calculation ---
    const parentMap: Record<string, string[]> = {};
    Object.values(story.scenes).forEach(scene => {
        scene.dialogue.forEach(item => {
            if (item.type === 'transition' && item.nextSceneId) {
                if (!parentMap[item.nextSceneId]) parentMap[item.nextSceneId] = [];
                parentMap[item.nextSceneId].push(scene.id);
            } else if (item.type === 'choice' && Array.isArray(item.choices)) {
                // FIX: Add safety checks to prevent crashes from malformed choice data.
                item.choices.forEach(c => {
                    if (c && c.nextSceneId) {
                        if (!parentMap[c.nextSceneId]) parentMap[c.nextSceneId] = [];
                        parentMap[c.nextSceneId].push(scene.id);
                    }
                });
            }
        });
    });

    const graphDistances: Record<string, number> = {};
    const queue: [string, number][] = [[targetSceneId, 0]];
    const visited = new Set([targetSceneId]);
    while (queue.length > 0) {
        const [currentId, distance] = queue.shift()!;
        graphDistances[currentId] = distance;
        const parents = parentMap[currentId] || [];
        parents.forEach(parentId => {
            if (!visited.has(parentId)) {
                visited.add(parentId);
                queue.push([parentId, distance + 1]);
            }
        });
    }

    // --- Create Chunks from each scene ---
    Object.values(story.scenes).forEach(scene => {
        const distance = graphDistances[scene.id];
        // Only include chunks from scenes that are reachable (have a distance)
        if (distance === undefined) return;

        const importanceScore = scene.importance ? computeNodeImportance(scene.importance) : 0.2;
        const targetChars = new Set(targetScene.characters.map(c => c.characterId));
        const sceneChars = new Set(scene.characters.map(c => c.characterId));
        const intersection = new Set([...targetChars].filter(x => sceneChars.has(x)));
        const union = new Set([...targetChars, ...sceneChars]);
        const charOverlap = union.size > 0 ? intersection.size / union.size : 0;


        // Local Chunks (from target scene only)
        if (scene.id === targetSceneId) {
            const textLines = (scene.dialogue.filter(d => d.type === 'text') as TextLine[]).slice(-5);
            textLines.forEach((line, i) => {
                const text = `${story.characters[line.characterId || '']?.name || 'Narrator'}: ${line.text}`;
                chunks.push({
                    id: `${scene.id}-local-${i}`, text, type: 'local', tokens: estimateTokens(text),
                    graphDistance: 0, timeDistance: textLines.length - i, charOverlap: 1, embedSim: 0, nodeImportance: importanceScore
                });
            });
        }

        // Checkpoint Summary (Story Chunk)
        if (scene.isCheckpoint && story.checkpointSummaries && story.checkpointSummaries[scene.id]) {
            const summary = story.checkpointSummaries[scene.id];
            chunks.push({
                id: `${scene.id}-summary`, text: summary.text, type: 'story', tokens: summary.tokens,
                graphDistance: distance, timeDistance: 0, charOverlap, embedSim: 0, nodeImportance: importanceScore
            });
        }
    });

    // --- Character Chunks ---
    const presentChars = new Set(targetScene.characters.map(c => c.characterId));
    Object.values(story.characters).forEach(char => {
        if(presentChars.has(char.id)){
            const text = `Character: ${char.name}. Appearance: ${char.appearance}. Talking style: ${char.talkingStyle}.`;
            chunks.push({
                id: `char-${char.id}`, text, type: 'character', tokens: estimateTokens(text),
                graphDistance: 0, timeDistance: 0, charOverlap: 1, embedSim: 0, nodeImportance: 1.0 // Character info is always important
            });
        }
    });
    
    return chunks;
}


export function renderStateToText(state: StoryState): string {
    let text = `CURRENT STATE:
- Chapter ${state.chapter}, Act ${state.act}
- Faction: ${state.currentFaction}`;

    if (state.flags.length > 0) {
        text += '\n- Flags: ' + state.flags.map(f => `${f.key}=${f.value}`).join(', ');
    }
    if (state.relations.length > 0) {
        text += '\n- Relations: ' + state.relations.map(r => `${r.characterId} (Trust: ${r.trust.toFixed(1)})`).join(', ');
    }
    if (state.promises.length > 0) {
        text += '\n- Promises: ' + state.promises.map(p => `${p.description} (${p.kept === null ? 'unresolved' : (p.kept ? 'kept' : 'broken')})`).join(', ');
    }
    return text;
}
