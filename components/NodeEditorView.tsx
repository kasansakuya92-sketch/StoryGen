
import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  Node,
  Edge,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
} from 'reactflow';
import { ScenesData, Scene, CharactersData, AIGeneratedScene, DialogueItem, ChoiceLine, RandomLine, ConditionLine } from '../types.ts';
import AIGenerationModal from './AIGenerationModal.tsx';
import AIStructureGenerationModal from './AIStructureGenerationModal.tsx';

// Prop Interfaces
interface NodeEditorViewProps {
  scenes: ScenesData;
  characters: CharactersData;
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
  onAddScene: (storyId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  activeStoryId: string | null;
  onAddSceneStructure: (generated: { scenes: AIGeneratedScene[], connections: any }, sourceSceneId: string) => void;
  onSceneSelect: (sceneId: string) => void;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

// Custom Edge with a delete button
const CustomEdge: React.FC<any> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDelete = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    data.onDeleteEdge(id);
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan group"
        >
          <button
            className="w-5 h-5 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            onClick={onDelete}
            title="Delete connection"
          >
            &times;
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}


// Custom Node Component for displaying a scene
const FlowSceneNode: React.FC<{ data: { 
    scene: Scene, 
    onUpdateScene: NodeEditorViewProps['onUpdateScene'], 
    onDeleteScene: NodeEditorViewProps['onDeleteScene'],
    isSelectionMode: boolean,
    selectionState: 'context' | 'target' | 'none',
    showLogicLens: boolean,
    onNodeClick: (sceneId: string) => void,
    onSceneSelect: (sceneId: string) => void,
    onSwapEntryType: (sceneId: string, dialogueIndex: number, newType: string) => void;
} }> = ({ data }) => {
  const { scene, onUpdateScene, onDeleteScene, isSelectionMode, selectionState, showLogicLens, onNodeClick, onSceneSelect, onSwapEntryType } = data;

  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(scene.name);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [description, setDescription] = useState(scene.description || '');
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStyle = { width: 12, height: 12, border: '2px solid rgb(var(--background-rgb))' };

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
        nameInputRef.current.focus();
        nameInputRef.current.select();
    }
  }, [isEditingName]);
  
  useEffect(() => {
    if (isEditingDesc && descTextareaRef.current) {
        descTextareaRef.current.focus();
        descTextareaRef.current.select();
    }
  }, [isEditingDesc]);

  // Calculate Logic Summary for Lens
  const logicSummary = useMemo(() => {
      const reqs: string[] = [];
      const effects: string[] = [];
      
      scene.dialogue.forEach(item => {
          if (item.type === 'condition') {
              item.conditions.forEach(c => reqs.push(`IF $${c.variable} ${c.operator} ${c.value}`));
          }
          if (item.type === 'choice') {
              item.choices.forEach(c => {
                  if (c.statRequirements) {
                       c.statRequirements.forEach(r => reqs.push(`Req: $${r.stat} >= ${r.threshold}`));
                  }
                  if (c.statChanges) {
                      Object.entries(c.statChanges).forEach(([k, v]) => {
                          const val = v as number;
                          effects.push(`$${k} ${val >= 0 ? '+' : ''}${val}`)
                      });
                  }
              });
          }
      });
      return { reqs, effects };
  }, [scene.dialogue]);

  const hasLogic = logicSummary.reqs.length > 0 || logicSummary.effects.length > 0;

  const handleNameSave = () => {
    setIsEditingName(false);
    if (name.trim() && name.trim() !== scene.name) {
        onUpdateScene(scene.id, { name: name.trim() });
    } else {
        setName(scene.name); // Revert if empty or unchanged
    }
  };

  const handleDescSave = () => {
    setIsEditingDesc(false);
    if (description.trim() !== (scene.description || '')) {
        onUpdateScene(scene.id, { description: description.trim() });
    } else {
        setDescription(scene.description || ''); // Revert if unchanged
    }
  };


  const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteScene(scene.id);
  };

  const handleClick = (e: React.MouseEvent) => {
      if (isSelectionMode) {
          onNodeClick(scene.id);
      } else {
          onSceneSelect(scene.id);
      }
  };

  // Calculate the total number of output ports
  const outputPortCount = scene.dialogue.reduce((count, item) => {
    if (item.type === 'transition') return count + 1;
    if (item.type === 'choice') return count + item.choices.length;
    if (item.type === 'random') return count + item.variants.length;
    if (item.type === 'condition') return count + 2; // True + False
    return count;
  }, 0);

  let portIndex = 0;
  
  const selectionClasses = {
      context: 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30',
      target: 'ring-2 ring-green-500 shadow-lg shadow-green-500/30',
      none: '',
  };
  const nodeClasses = `bg-card/90 backdrop-blur-md border rounded-lg shadow-xl w-64 group relative transition-all duration-200 cursor-pointer ${isSelectionMode ? selectionClasses[selectionState] : 'border-border hover:border-primary'}`;


  return (
    <div className={nodeClasses} onClick={handleClick}>
       <button 
        onClick={handleDelete}
        className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Delete Scene"
       >
        <TrashIcon />
      </button>

      <div className="bg-secondary text-secondary-foreground px-3 py-1.5 font-bold text-sm rounded-t-md truncate" onDoubleClick={() => !isSelectionMode && setIsEditingName(true)}>
        {isEditingName ? (
            <input
                ref={nameInputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                className="w-full bg-background text-foreground p-0 m-0 border-0 outline-none ring-1 ring-ring rounded"
                onClick={e => e.stopPropagation()}
            />
        ) : (
            scene.name
        )}
      </div>
      
      <div className="relative p-3 text-xs text-foreground/80 border-b border-border/50 min-h-[40px]" onDoubleClick={() => !isSelectionMode && setIsEditingDesc(true)}>
        {isEditingDesc ? (
            <textarea
                ref={descTextareaRef}
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={handleDescSave}
                className="w-full h-20 bg-background text-foreground p-1 m-0 border-0 outline-none ring-1 ring-ring rounded resize-none text-xs"
                onClick={e => e.stopPropagation()}
            />
        ) : (
            scene.description || <span className="italic text-foreground/50">Double-click to add description</span>
        )}

        {/* Logic Lens Overlay */}
        {showLogicLens && (
            <div className="absolute inset-0 bg-card z-10 p-2 overflow-y-auto text-[10px] font-mono border-b border-border/50">
                {hasLogic ? (
                    <div className="space-y-1.5">
                        {logicSummary.reqs.length > 0 && (
                            <div>
                                <div className="font-bold text-yellow-600 dark:text-yellow-500 text-[9px] uppercase tracking-wider mb-0.5">Conditions</div>
                                {logicSummary.reqs.map((r, i) => <div key={i} className="truncate text-foreground/90 bg-yellow-500/10 rounded px-1 mb-0.5" title={r}>{r}</div>)}
                            </div>
                        )}
                        {logicSummary.effects.length > 0 && (
                            <div>
                                <div className="font-bold text-blue-600 dark:text-blue-400 text-[9px] uppercase tracking-wider mb-0.5">Effects</div>
                                {logicSummary.effects.map((e, i) => <div key={i} className="truncate text-foreground/90 bg-blue-500/10 rounded px-1 mb-0.5" title={e}>{e}</div>)}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-foreground/40 italic text-[10px]">No Logic</div>
                )}
            </div>
        )}
      </div>

      {/* A single target handle for all incoming connections */}
      <Handle type="target" position={Position.Left} className="!bg-primary" style={handleStyle}/>

      {/* Dynamically create a source handle for each transition, choice, random or condition */}
      <div className="py-1">
        {scene.dialogue.map((item, index) => {
            if (item.type === 'transition' && item.nextSceneId) {
                const portId = `dialogue-${index}`;
                const currentPortIndex = portIndex++;
                return (
                    <div key={portId} className="relative">
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={portId}
                        className="!bg-accent"
                        style={{ ...handleStyle, top: `${(100 / (outputPortCount + 1)) * (currentPortIndex + 1)}%` }}
                    />
                    <div className="text-xs text-right pr-8 py-0.5 text-foreground/60 truncate" title={`Transition to scene`}>➔ Transition</div>
                    </div>
                );
            }
            
            // Render Dropdown Header for swappable types
            const isBranching = item.type === 'choice' || item.type === 'random' || item.type === 'condition';
            const typeColor = item.type === 'random' ? 'text-purple-500' : (item.type === 'condition' ? 'text-yellow-600' : 'text-foreground/80');
            
            if (isBranching) {
                return (
                    <div key={`group-${index}`} className="relative group/block pb-2 mb-2 border-b border-border/30 last:border-0 last:mb-0">
                         {/* Permanent Type Swap Dropdown (Integrated into header) */}
                         <div className="flex items-center justify-between px-2 pb-1">
                             <div className={`text-[10px] font-bold uppercase tracking-wider ${typeColor}`}>
                                {item.type}
                             </div>
                             <select 
                                className="text-[10px] bg-card border border-border rounded shadow-sm py-0.5 px-1 outline-none cursor-pointer opacity-50 hover:opacity-100 focus:opacity-100 transition-opacity"
                                value={item.type}
                                onChange={(e) => onSwapEntryType(scene.id, index, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                             >
                                 <option value="choice">Choice</option>
                                 <option value="random">Random</option>
                                 <option value="condition">Condition</option>
                             </select>
                         </div>

                        {/* Outputs */}
                        {item.type === 'choice' && (
                             item.choices.map((choice, choiceIndex) => {
                                const portId = `dialogue-${index}-choice-${choiceIndex}`;
                                const currentPortIndex = portIndex++;
                                return (
                                    <div key={portId} className="relative">
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={portId}
                                            className="!bg-accent"
                                            style={{ ...handleStyle, top: `${(100 / (outputPortCount + 1)) * (currentPortIndex + 1)}%` }}
                                        />
                                        <div className="text-xs text-right pr-8 py-0.5 text-foreground/60 truncate" title={choice.text}>? {choice.text || 'Choice'}</div>
                                    </div>
                                );
                            })
                        )}

                        {item.type === 'random' && (
                            item.variants.map((_, vIndex) => {
                                const portId = `dialogue-${index}-random-${vIndex}`;
                                const currentPortIndex = portIndex++;
                                return (
                                    <div key={portId} className="relative">
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={portId}
                                            className="!bg-purple-500"
                                            style={{ ...handleStyle, top: `${(100 / (outputPortCount + 1)) * (currentPortIndex + 1)}%` }}
                                        />
                                        <div className="text-xs text-right pr-8 py-0.5 text-purple-500 truncate">🎲 Variant {vIndex + 1}</div>
                                    </div>
                                );
                            })
                        )}

                        {item.type === 'condition' && (
                            <>
                                 <div className="relative">
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={`dialogue-${index}-condition-true`}
                                        className="!bg-green-500"
                                        style={{ ...handleStyle, top: `${(100 / (outputPortCount + 1)) * (portIndex + 1)}%` }}
                                    />
                                    <div className="text-xs text-right pr-8 py-0.5 text-green-600 dark:text-green-400 font-semibold">True →</div>
                                </div>
                                {(() => { portIndex++; return null; })()}
                                <div className="relative">
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={`dialogue-${index}-condition-false`}
                                        className="!bg-red-500"
                                        style={{ ...handleStyle, top: `${(100 / (outputPortCount + 1)) * (portIndex + 1)}%` }}
                                    />
                                    <div className="text-xs text-right pr-8 py-0.5 text-red-600 dark:text-red-400 font-semibold">False →</div>
                                </div>
                                {(() => { portIndex++; return null; })()}
                            </>
                        )}
                    </div>
                );
            }

            return null;
        })}

        {outputPortCount === 0 && (
           <div className="relative">
                <Handle
                    type="source"
                    position={Position.Right}
                    id="source-new"
                    className="!bg-gray-400"
                    style={{ ...handleStyle, top: '50%' }}
                />
                <div className="text-xs text-right pr-8 py-0.5 text-foreground/60 truncate" title="Create new connection">...</div>
            </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { sceneNode: FlowSceneNode };
const edgeTypes = { default: CustomEdge };

type SelectionMode = false | 'context' | 'target';

// Main Component
const NodeEditorView: React.FC<NodeEditorViewProps> = ({ scenes, characters, onUpdateScene, onAddScene, onDeleteScene, activeStoryId, onAddSceneStructure, onSceneSelect }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // State for AI Generation
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(false);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  
  // State for Logic Lens
  const [showLogicLens, setShowLogicLens] = useState(false);


  const scenesRef = useRef(scenes);
  const onUpdateSceneRef = useRef(onUpdateScene);
  const edgesRef = useRef(edges);

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { onUpdateSceneRef.current = onUpdateScene; }, [onUpdateScene]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  
  // Open modal when target is selected
  useEffect(() => {
    if (targetId) {
      setSelectionMode(false); // This will trigger the modal to open
    }
  }, [targetId]);

  const onDeleteEdge = useCallback((edgeId: string) => {
    const currentEdges = edgesRef.current;
    const currentScenes = scenesRef.current;
    const currentOnUpdateScene = onUpdateSceneRef.current;

    const edgeToDelete = currentEdges.find(e => e.id === edgeId);
    if (!edgeToDelete) return;

    const { source, target } = edgeToDelete;
    const sourceScene = currentScenes[source];
    if (!sourceScene) return;

    const newDialogue = [...sourceScene.dialogue];
    const outcomeIndex = newDialogue.findIndex(d => ['transition', 'choice', 'random', 'condition'].includes(d.type));

    if (outcomeIndex !== -1) {
        const outcome = newDialogue[outcomeIndex];

        if (outcome.type === 'transition' && outcome.nextSceneId === target) {
            newDialogue[outcomeIndex] = { type: 'end_story' };
        } else if (outcome.type === 'choice') {
            const updatedChoices = outcome.choices.filter(c => c.nextSceneId !== target);
            if (updatedChoices.length > 1) {
                newDialogue[outcomeIndex] = { ...outcome, choices: updatedChoices };
            } else if (updatedChoices.length === 1) {
                newDialogue[outcomeIndex] = { type: 'transition', nextSceneId: updatedChoices[0].nextSceneId };
            } else {
                newDialogue[outcomeIndex] = { type: 'end_story' };
            }
        } else if (outcome.type === 'random') {
             const updatedVariants = outcome.variants.filter(v => v !== target);
             if (updatedVariants.length === 0) {
                 newDialogue[outcomeIndex] = { type: 'end_story' };
             } else {
                 newDialogue[outcomeIndex] = { ...outcome, variants: updatedVariants };
             }
        } else if (outcome.type === 'condition') {
            // If deleting a branch, clear it
             const newBranches = { ...outcome.branches };
             if (outcome.branches.true === target) newBranches.true = '';
             if (outcome.branches.false === target) newBranches.false = '';
             newDialogue[outcomeIndex] = { ...outcome, branches: newBranches };
        }
        currentOnUpdateScene(source, { dialogue: newDialogue });
    }
  }, []);
  
  const onConnect = useCallback((connection) => {
    const currentScenes = scenesRef.current;
    const currentOnUpdateScene = onUpdateSceneRef.current;

    const { source, target, sourceHandle } = connection;
    if (!source || !target) return;

    const sourceScene = currentScenes[source];
    const targetScene = currentScenes[target];
    if (!sourceScene || !targetScene) return;
    
    const newDialogue = [...sourceScene.dialogue];
    
    // Determine which block we are connecting from based on handle ID
    // Format: dialogue-{index} or dialogue-{index}-{type}-{sub}
    let outcomeIndex = -1;
    if (sourceHandle === 'source-new') {
        // Appending new
    } else if (sourceHandle) {
        const parts = sourceHandle.split('-');
        if (parts[0] === 'dialogue') {
            outcomeIndex = parseInt(parts[1]);
        }
    }

    // Logic for connecting existing blocks (Conditions, specific choice slots, etc)
    if (outcomeIndex !== -1) {
        const outcome = newDialogue[outcomeIndex];
        
        if (outcome.type === 'condition') {
            const isTrueBranch = sourceHandle?.includes('true');
            const newBranches = { ...outcome.branches };
            if (isTrueBranch) newBranches.true = target;
            else newBranches.false = target;
            newDialogue[outcomeIndex] = { ...outcome, branches: newBranches };
        } 
        // For Choice/Random, ReactFlow handles usually map 1:1, but if we dragged from a specific handle, we might want to update THAT choice.
        // However, standard behavior often appends if simple connection.
        // Let's stick to appending/updating logic:
        else if (outcome.type === 'choice') {
             // If connecting from generic or new handle, add choice.
             // If connecting from existing handle, update it? 
             // Simplified: Check if target exists. If not, add.
            if (!outcome.choices.some(c => c.nextSceneId === target)) {
                 outcome.choices.push({ text: `Go to ${targetScene.name}`, nextSceneId: target });
            }
        } else if (outcome.type === 'random') {
             if (!outcome.variants.includes(target)) {
                 outcome.variants.push(target);
             }
        } else if (outcome.type === 'transition') {
             // Convert transition to choice if dragging elsewhere? Or just update?
             // Let's update connection if existing, or create choice if dragging to NEW target (handled by "source-new" usually)
             if (outcome.nextSceneId !== target) {
                 // User wants a choice presumably
                 newDialogue[outcomeIndex] = {
                    type: 'choice',
                    choices: [
                        { text: `Go to ${currentScenes[outcome.nextSceneId]?.name || '...'}`, nextSceneId: outcome.nextSceneId },
                        { text: `Go to ${targetScene.name}`, nextSceneId: target },
                    ]
                };
             }
        }
    } else {
        // Creating new connection from "..." handle
        // Check if last item is end_story or we should append
        const lastIdx = newDialogue.length - 1;
        const lastItem = newDialogue[lastIdx];
        
        if (lastItem && (lastItem.type === 'end_story' || lastItem.type === 'text')) {
             // Replace end_story or append to text
             if (lastItem.type === 'end_story') newDialogue.pop();
             newDialogue.push({ type: 'transition', nextSceneId: target });
        } else {
             newDialogue.push({ type: 'transition', nextSceneId: target });
        }
    }
    
    currentOnUpdateScene(source, { dialogue: newDialogue });

  }, []);

  const onSwapEntryType = useCallback((sceneId: string, dialogueIndex: number, newType: string) => {
        const currentScenes = scenesRef.current;
        const scene = currentScenes[sceneId];
        if (!scene) return;
        const item = scene.dialogue[dialogueIndex];
        
        let newItem: DialogueItem;
        
        // Helper to extract existing targets to preserve connections
        const getTargets = (): string[] => {
            if (item.type === 'choice') return item.choices.map(c => c.nextSceneId);
            if (item.type === 'random') return item.variants;
            if (item.type === 'condition') return [item.branches.true, item.branches.false].filter(Boolean);
            return [];
        };
        
        const targets = getTargets();
        // Pad targets if needed
        while(targets.length < 2) targets.push('');

        if (newType === 'choice') {
            newItem = { 
                type: 'choice', 
                choices: targets.map((t, i) => ({ text: `Option ${i+1}`, nextSceneId: t })) 
            };
        } else if (newType === 'random') {
             newItem = { type: 'random', variants: targets };
        } else if (newType === 'condition') {
             // NEW FORMAT INITIALIZATION
             newItem = { 
                 type: 'condition', 
                 conditions: [{ variable: '', operator: '>=', value: 0 }], 
                 branches: { true: targets[0], false: targets[1] } 
             };
        } else {
            return;
        }
        
        // Update Scene Data
        const newDialogue = [...scene.dialogue];
        newDialogue[dialogueIndex] = newItem;
        onUpdateScene(sceneId, { dialogue: newDialogue });

        // Force edge refresh logic is handled by ReactFlow diffing usually, 
        // but we might need to ensure handles update correctly.
        // The `setNodes` in `useEffect` will handle re-rendering handles.
  }, [onUpdateScene]);

  useEffect(() => {
    const newNodes: Node[] = Object.values(scenes).map((scene: Scene) => ({
      id: scene.id,
      type: 'sceneNode',
      position: scene.position || { x: 50, y: 50 },
      data: { 
        scene, 
        onUpdateScene, 
        onDeleteScene,
        isSelectionMode: !!selectionMode,
        selectionState: contextIds.includes(scene.id) ? 'context' : (targetId === scene.id ? 'target' : 'none'),
        showLogicLens,
        onNodeClick: handleNodeClick,
        onSceneSelect,
        onSwapEntryType
       },
    }));

    // Reconstruct edges
    const newEdges: Edge[] = [];
    Object.values(scenes).forEach((scene: Scene) => {
      scene.dialogue.forEach((item, index) => {
        if (item.type === 'transition' && item.nextSceneId) {
          const portId = `dialogue-${index}`;
          newEdges.push({
            id: `e-${scene.id}-${portId}-${item.nextSceneId}`,
            source: scene.id,
            target: item.nextSceneId,
            sourceHandle: portId,
            type: 'default',
            data: { onDeleteEdge },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(var(--primary-rgb))' },
            style: { strokeWidth: 2, stroke: 'rgb(var(--primary-rgb))' }
          });
        } else if (item.type === 'choice') {
          item.choices.forEach((choice, choiceIndex) => {
            if (choice.nextSceneId) {
              const portId = `dialogue-${index}-choice-${choiceIndex}`;
              newEdges.push({
                id: `e-${scene.id}-${portId}-${choice.nextSceneId}`,
                source: scene.id,
                target: choice.nextSceneId,
                sourceHandle: portId,
                type: 'default',
                data: { onDeleteEdge },
                markerEnd: { type: MarkerType.ArrowClosed, color: 'rgb(var(--accent-rgb))' },
                style: { strokeWidth: 2, stroke: 'rgb(var(--accent-rgb))' }
              });
            }
          });
        } else if (item.type === 'random') {
            item.variants.forEach((variantId, vIndex) => {
                if (variantId) {
                    const portId = `dialogue-${index}-random-${vIndex}`;
                    newEdges.push({
                        id: `e-${scene.id}-${portId}-${variantId}`,
                        source: scene.id,
                        target: variantId,
                        sourceHandle: portId,
                        type: 'default',
                        data: { onDeleteEdge },
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }, // Purple
                        style: { strokeWidth: 2, stroke: '#a855f7', strokeDasharray: '5,5' } // Dashed line
                    });
                }
            });
        } else if (item.type === 'condition') {
            if (item.branches.true) {
                const portId = `dialogue-${index}-condition-true`;
                newEdges.push({
                    id: `e-${scene.id}-${portId}-${item.branches.true}`,
                    source: scene.id,
                    target: item.branches.true,
                    sourceHandle: portId,
                    type: 'default',
                    data: { onDeleteEdge },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' }, // Green
                    style: { strokeWidth: 2, stroke: '#22c55e' }
                });
            }
            if (item.branches.false) {
                const portId = `dialogue-${index}-condition-false`;
                newEdges.push({
                    id: `e-${scene.id}-${portId}-${item.branches.false}`,
                    source: scene.id,
                    target: item.branches.false,
                    sourceHandle: portId,
                    type: 'default',
                    data: { onDeleteEdge },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' }, // Red
                    style: { strokeWidth: 2, stroke: '#ef4444' }
                });
            }
        }
      });
    });
    setNodes(newNodes);
    setEdges(newEdges);
  }, [scenes, onUpdateScene, onDeleteScene, onDeleteEdge, selectionMode, contextIds, targetId, onSwapEntryType, onSceneSelect, showLogicLens]);
  
  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    onUpdateScene(node.id, { position: node.position });
  }, [onUpdateScene]);
  
  const handleAddNode = () => {
    if (activeStoryId) {
      onAddScene(activeStoryId);
    }
  };

  const handleNodeClick = (sceneId: string) => {
      if (selectionMode === 'context') {
          setContextIds(prev => 
              prev.includes(sceneId) ? prev.filter(id => id !== sceneId) : [...prev, sceneId]
          );
      } else if (selectionMode === 'target') {
          if (!contextIds.includes(sceneId)) {
              setTargetId(sceneId);
          }
      }
  };

  const handleToggleSelectionMode = () => {
      if (selectionMode) {
          // Cancel
          setSelectionMode(false);
          setContextIds([]);
          setTargetId(null);
      } else {
          // Start
          setSelectionMode('context');
      }
  };
  
  const resetAIGeneration = () => {
    setContextIds([]);
    setTargetId(null);
  };
  
  const renderSelectionPanel = () => {
      if (!selectionMode) return null;
      
      const isContextSelection = selectionMode === 'context';
      
      return (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-card/80 backdrop-blur-md border border-border p-3 rounded-lg shadow-2xl flex items-center gap-4 animate-fade-in">
              <p className="text-sm font-semibold text-foreground">
                  {isContextSelection 
                      ? `Select 1+ context scenes (${contextIds.length} selected)`
                      : `Select 1 target scene (cannot be a context scene)`
                  }
              </p>
              <button 
                  onClick={() => setSelectionMode(isContextSelection ? 'target' : 'context')}
                  disabled={isContextSelection && contextIds.length === 0}
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90 disabled:opacity-50"
              >
                 {isContextSelection ? 'Select Target Scene →' : '← Select Context Scenes'}
              </button>
               <button onClick={handleToggleSelectionMode} className="text-xs font-bold text-destructive hover:underline">
                  Cancel
              </button>
          </div>
      );
  };

  return (
    <div className="flex-grow bg-transparent w-full h-full relative">
       <div className="absolute top-4 left-4 z-10 flex gap-2 flex-wrap">
          <button
            onClick={handleAddNode}
            className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-secondary/90"
          >
            + Add Scene
          </button>
           <button
            onClick={() => setIsStructureModalOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-primary/90"
          >
            ✨ Generate Structure
          </button>
          <button
            onClick={handleToggleSelectionMode}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-primary/90"
          >
            {selectionMode ? 'Cancel Selection' : 'Generate Dialogue'}
          </button>
          <button
             onClick={() => setShowLogicLens(!showLogicLens)}
             className={`px-4 py-2 text-sm font-semibold rounded-md shadow-lg hover:opacity-90 transition-colors ${showLogicLens ? 'bg-purple-600 text-white' : 'bg-secondary text-secondary-foreground'}`}
          >
             {showLogicLens ? '👁️ Hide Logic' : '👁️ Logic Lens'}
          </button>
       </div>
       
       {isStructureModalOpen && activeStoryId && (
        <AIStructureGenerationModal 
            isOpen={isStructureModalOpen}
            onClose={() => setIsStructureModalOpen(false)}
            allScenes={scenes}
            allCharacters={characters}
            onAddSceneStructure={onAddSceneStructure}
        />
       )}
       
       {renderSelectionPanel()}
       
       {targetId && (
        <AIGenerationModal 
            isOpen={!!targetId}
            onClose={resetAIGeneration}
            contextScenes={contextIds.map(id => scenes[id])}
            targetScene={scenes[targetId]}
            allScenes={scenes}
            allCharacters={characters}
            onUpdateScene={onUpdateScene}
        />
       )}
       
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!selectionMode}
        fitView
        className="bg-background"
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
};

export default NodeEditorView;
