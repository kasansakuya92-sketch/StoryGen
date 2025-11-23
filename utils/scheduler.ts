
import { AIStructureType, AIGeneratedScene } from '../types.ts';

type NodeType = 'L' | 'D' | 'S' | 'T';

interface SkeletonNode {
    id: string;
    type: NodeType;
    nextIds: string[]; // For L, T, D (merged)
    branchIds?: string[]; // For S (divergent)
    label: string;
    depth: number;
}

export interface SchedulerConfig {
    mainBranchSize: number;
    splitBranchSize: number;
    splitProbability: number; // 0-1
    decisionProbability: number; // 0-1
    prompt: string;
}

// Helper to generate a unique ID
const genId = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 5)}`;

export const generateStorySkeleton = (config: SchedulerConfig): AIGeneratedScene[] => {
    const { mainBranchSize, splitBranchSize, splitProbability, decisionProbability } = config;
    
    // 1. Create Main Chain IDs
    const mainChainIds = Array.from({ length: mainBranchSize }, (_, i) => `node_main_${i}`);
    const mainTypes: NodeType[] = Array(mainBranchSize).fill('L');
    
    // Rule: Last node is always Terminal
    mainTypes[mainBranchSize - 1] = 'T';

    // 2. Assign Types based on Probability (Emergent distribution)
    // We iterate from 1 to N-2 to avoid splitting the start or the end
    for (let i = 1; i < mainBranchSize - 1; i++) {
        const rand = Math.random();
        if (rand < splitProbability) {
            mainTypes[i] = 'S';
        } else if (rand < splitProbability + decisionProbability) {
            mainTypes[i] = 'D';
        }
    }

    // GUARANTEE: If split probability is > 0 and we have space, ensure at least one split.
    if (splitProbability > 0 && mainBranchSize >= 4) {
        if (!mainTypes.includes('S')) {
            // Force a split in the middle-ish
            const forceIndex = Math.floor(mainBranchSize / 2);
            mainTypes[forceIndex] = 'S';
        }
    }

    const allScenes: AIGeneratedScene[] = [];

    // 3. Build Main Chain Structure
    for (let i = 0; i < mainBranchSize; i++) {
        const id = mainChainIds[i];
        const type = mainTypes[i];
        
        // If it's the last node, nextId is empty/null
        const nextId = i < mainBranchSize - 1 ? mainChainIds[i + 1] : '';

        if (type === 'L') {
            allScenes.push(createLinearScene(id, nextId, `Linear Node ${i}`));
        } else if (type === 'T') {
            allScenes.push(createTerminalScene(id, `Ending Node ${i}`));
        } else if (type === 'D') {
            allScenes.push(createDecisionScene(id, nextId, `Decision Node ${i}`));
        } else if (type === 'S') {
            // Split Logic:
            // Branch A: Continues Main Story
            // Branch B: Diverges into new sub-branch
            const branchBStartId = `node_split_${i}_branch_start`;
            
            // Logic for Reconnection:
            // If the sub-branch length is shorter than the remaining main story,
            // we can optionally reconnect it to a future main node.
            // Let's say 50% chance to reconnect if possible.
            const remainingMainNodes = mainBranchSize - 1 - i;
            const canReconnect = splitBranchSize < remainingMainNodes;
            const shouldReconnect = canReconnect && Math.random() > 0.5;
            
            let reconnectTargetId = '';
            if (shouldReconnect) {
                // Reconnect to a node after the split branch would theoretically finish
                // e.g. reconnect to main node i + splitBranchSize
                // Ensuring we don't reconnect past the end
                const targetIndex = Math.min(mainBranchSize - 1, i + Math.max(1, splitBranchSize));
                reconnectTargetId = mainChainIds[targetIndex];
            }

            const branchBScenes = generateSubBranch(branchBStartId, splitBranchSize, i, reconnectTargetId);
            
            allScenes.push(...branchBScenes);

            allScenes.push(createSplitScene(id, nextId, branchBStartId, `Split Node ${i}`));
        }
    }

    return allScenes;
};

const generateSubBranch = (startId: string, length: number, parentIndex: number, reconnectId: string = ''): AIGeneratedScene[] => {
    const branchScenes: AIGeneratedScene[] = [];
    const ids = Array.from({ length }, (_, k) => k === 0 ? startId : `node_sub_${parentIndex}_${k}`);
    
    for (let k = 0; k < length; k++) {
        const id = ids[k];
        const isLast = k === length - 1;
        
        if (isLast) {
            if (reconnectId) {
                // Reconnect to main story
                branchScenes.push(createLinearScene(id, reconnectId, `Sub-Rejoin ${parentIndex}`));
            } else {
                // Terminate branch
                branchScenes.push(createTerminalScene(id, `Sub-Ending ${parentIndex}`));
            }
        } else {
            // Simple logic: 30% chance of flavor decision inside sub-branch
            const isDecision = Math.random() < 0.3;
            const nextId = ids[k + 1];
            
            if (isDecision) {
                branchScenes.push(createDecisionScene(id, nextId, `Sub-Decision ${parentIndex}-${k}`));
            } else {
                branchScenes.push(createLinearScene(id, nextId, `Sub-Linear ${parentIndex}-${k}`));
            }
        }
    }
    return branchScenes;
};

// --- Scene Factory Helpers ---

const createLinearScene = (id: string, nextId: string, label: string): AIGeneratedScene => ({
    id,
    name: `[L] ${label}`,
    description: "A linear progression scene.",
    characterIds: [], 
    dialogue: [{ type: 'text', characterId: null, text: 'The story continues...' }],
    outcome: { 
        type: 'transition',
        nextSceneId: nextId
    }
});

const createDecisionScene = (id: string, nextId: string, label: string): AIGeneratedScene => ({
    id,
    name: `[D] ${label}`,
    description: "A moment of choice.",
    characterIds: [],
    dialogue: [{ type: 'text', characterId: null, text: 'A decision must be made.' }],
    outcome: {
        type: 'choice',
        choices: [
            { text: "Option A", nextSceneId: nextId },
            { text: "Option B", nextSceneId: nextId }
        ]
    }
});

const createSplitScene = (id: string, pathAId: string, pathBId: string, label: string): AIGeneratedScene => ({
    id,
    name: `[S] ${label}`,
    description: "The path diverges here.",
    characterIds: [],
    dialogue: [{ type: 'text', characterId: null, text: 'The path splits before you.' }],
    outcome: {
        type: 'choice',
        choices: [
            { text: "Follow Main Path", nextSceneId: pathAId },
            { text: "Take Divergent Path", nextSceneId: pathBId }
        ]
    }
});

const createTerminalScene = (id: string, label: string): AIGeneratedScene => ({
    id,
    name: `[T] ${label}`,
    description: "The story ends here.",
    characterIds: [],
    dialogue: [{ type: 'text', characterId: null, text: 'The End.' }],
    outcome: {
        type: 'end_story'
    }
});
