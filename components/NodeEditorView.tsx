


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
import { ScenesData, Scene, CharactersData, AIGeneratedScene, Story, BackgroundsData, Background as BackgroundType, SceneStatus, SceneCharacter, Character } from '../types.ts';
import AIGenerationModal from './AIGenerationModal.tsx';
import AIStructureGenerationModal from './AIStructureGenerationModal.tsx';
import AIIcon from './icons/AIIcon.tsx';

// Prop Interfaces
interface NodeEditorViewProps {
  story: Story;
  scenes: ScenesData;
  characters: CharactersData;
  backgrounds: BackgroundsData;
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
  onAddScene: (storyId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  activeStoryId: string | null;
  onAddSceneStructure: (generated: { scenes: AIGeneratedScene[], connections: any }, sourceSceneId: string) => void;
}

type LensMode = 'default' | 'background' | 'logic' | 'character' | 'status';

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
    characters: CharactersData,
    backgrounds: BackgroundsData,
    incomingConditions: string[],
    onUpdateScene: NodeEditorViewProps['onUpdateScene'], 
    onDeleteScene: NodeEditorViewProps['onDeleteScene'],
    isSelectionMode: boolean,
    selectionState: 'context' | 'target' | 'none',
    activeLens: LensMode,
    onNodeClick: (sceneId: string) => void,
} }> = ({ data }) => {
  const { scene, characters, backgrounds, incomingConditions, onUpdateScene, onDeleteScene, isSelectionMode, selectionState, activeLens, onNodeClick } = data;

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

  const handleBackgroundChange = (bgUrl: string) => {
      onUpdateScene(scene.id, { background: bgUrl });
  };

  const handleStatusChange = (status: SceneStatus) => {
      onUpdateScene(scene.id, { status });
  };
  
  const handleCharacterToggle = (charId: string) => {
      const exists = scene.characters.some(c => c.characterId === charId);
      let newCharacters = [...scene.characters];
      if (exists) {
          newCharacters = newCharacters.filter(c => c.characterId !== charId);
      } else {
          newCharacters.push({ characterId: charId, spriteId: 'normal', position: 'center' });
      }
      onUpdateScene(scene.id, { characters: newCharacters });
  };


  const handleDelete = () => {
      onDeleteScene(scene.id);
  };


  // Calculate the total number of output ports (transitions + choices) to space them evenly
  const outputPortCount = scene.dialogue.reduce((count, item) => {
    if (item.type === 'transition') return count + 1;
    if (item.type === 'choice') return count + item.choices.length;
    return count;
  }, 0);

  let portIndex = 0;
  
  const selectionClasses = {
      context: 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30',
      target: 'ring-2 ring-green-500 shadow-lg shadow-green-500/30',
      none: '',
  };
  
  const statusColors = {
      draft: 'bg-secondary text-secondary-foreground border-secondary',
      written: 'bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-300',
      polished: 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300',
      final: 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300',
  };
  
  const statusColorClass = activeLens === 'status' && scene.status 
    ? statusColors[scene.status] 
    : 'bg-secondary text-secondary-foreground border-border';

  const nodeClasses = `bg-card/90 backdrop-blur-md border rounded-lg shadow-xl w-64 group relative transition-all duration-200 ${isSelectionMode ? `cursor-pointer ${selectionClasses[selectionState]}` : activeLens === 'status' && scene.status ? statusColors[scene.status].split(' ')[2] : 'border-border'}`;

  return (
    <div className={nodeClasses} onClick={() => isSelectionMode && onNodeClick(scene.id)}>
       <button 
        onClick={handleDelete}
        className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Delete Scene"
       >
        <TrashIcon />
      </button>

      <div className={`${statusColorClass.split(' ').slice(0,2).join(' ')} px-3 py-1.5 font-bold text-sm rounded-t-md truncate flex justify-between items-center`} onDoubleClick={() => !isSelectionMode && setIsEditingName(true)}>
        {isEditingName ? (
            <input
                ref={nameInputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                className="w-full bg-background text-foreground p-0 m-0 border-0 outline-none ring-1 ring-ring rounded"
            />
        ) : (
            <span className="truncate">{scene.name}</span>
        )}
        {activeLens === 'status' && (
             <span className="text-[10px] uppercase tracking-widest opacity-70 ml-2">{scene.status || 'DRAFT'}</span>
        )}
      </div>
      
      {/* Content Area based on Active Lens */}
      <div className="min-h-[40px]">
          {activeLens === 'default' && (
              <div className="p-3 text-xs text-foreground/80 border-b border-border/50" onDoubleClick={() => !isSelectionMode && setIsEditingDesc(true)}>
                {isEditingDesc ? (
                    <textarea
                        ref={descTextareaRef}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        onBlur={handleDescSave}
                        className="w-full h-20 bg-background text-foreground p-1 m-0 border-0 outline-none ring-1 ring-ring rounded resize-none text-xs"
                    />
                ) : (
                    scene.description || <span className="italic text-foreground/50">Double-click to add description</span>
                )}
              </div>
          )}
          
          {activeLens === 'background' && (
               <div className="relative w-full h-32 bg-black/10 group/bg">
                   {scene.background ? (
                       <img src={scene.background} alt="bg-preview" className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center text-xs text-foreground/40">No Background</div>
                   )}
                   
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/bg:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm p-2">
                       <select 
                            className="w-full bg-card/90 text-xs p-1 rounded border-none outline-none"
                            value={scene.background}
                            onChange={(e) => handleBackgroundChange(e.target.value)}
                        >
                           <option value="">Select Background...</option>
                           {Object.values(backgrounds).map((bg: BackgroundType) => (
                               <option key={bg.id} value={bg.url}>{bg.name}</option>
                           ))}
                           {scene.background && !Object.values(backgrounds).some((b: BackgroundType) => b.url === scene.background) && (
                               <option value={scene.background}>Custom URL (Legacy)</option>
                           )}
                       </select>
                   </div>
               </div>
          )}

          {activeLens === 'logic' && (
              <div className="p-3 text-xs">
                  {/* Incoming Conditions */}
                  {incomingConditions.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-border/30">
                          <div className="font-bold text-foreground/70 mb-1 uppercase text-[10px]">Conditions to Enter</div>
                          {incomingConditions.map((cond, idx) => (
                              <div key={idx} className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded mb-1 flex items-center gap-1">
                                  <span className="font-mono">🔒 {cond}</span>
                              </div>
                          ))}
                      </div>
                  )}
                  
                  {/* Internal Effects */}
                  <div className="font-bold text-foreground/70 mb-1 uppercase text-[10px]">Effects</div>
                  {scene.dialogue.filter(d => d.type === 'set_variable').length > 0 ? (
                      scene.dialogue.filter(d => d.type === 'set_variable').map((item: any, idx) => (
                          <div key={idx} className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded mb-1 font-mono">
                              {item.variableId} {item.operation === 'set' ? '=' : (item.operation === 'add' ? '+=' : (item.operation === 'subtract' ? '-=' : 'toggle'))} {String(item.value)}
                          </div>
                      ))
                  ) : (
                      <div className="text-foreground/30 italic">No effects</div>
                  )}
              </div>
          )}

          {activeLens === 'character' && (
              <div className="p-3">
                  <div className="flex flex-wrap gap-1 mb-2 min-h-[32px]">
                      {scene.characters.map((sc, idx) => {
                          const char = characters[sc.characterId];
                          return (
                              <div key={idx} className="w-8 h-8 rounded-full overflow-hidden border border-border bg-secondary" title={char?.name || sc.characterId}>
                                  {char?.sprites[0]?.url ? (
                                      <img src={char.sprites[0].url} alt={char.name} className="w-full h-full object-cover" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">{char?.name?.substring(0,2) || '?'}</div>
                                  )}
                              </div>
                          );
                      })}
                      {scene.characters.length === 0 && <span className="text-xs text-foreground/40 italic self-center">No characters</span>}
                  </div>
                  <div className="relative group/char">
                      <button className="w-full text-xs bg-secondary/50 hover:bg-secondary text-secondary-foreground py-1 rounded">
                          Manage Characters
                      </button>
                      <div className="absolute top-full left-0 w-full bg-card border border-border shadow-xl rounded p-2 z-20 hidden group-hover/char:block max-h-48 overflow-y-auto">
                          {Object.values(characters).map((char: Character) => (
                              <label key={char.id} className="flex items-center gap-2 p-1 hover:bg-secondary/20 rounded cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={scene.characters.some(sc => sc.characterId === char.id)}
                                    onChange={() => handleCharacterToggle(char.id)}
                                    className="rounded border-border text-primary focus:ring-primary"
                                  />
                                  <span className="text-xs truncate">{char.name}</span>
                              </label>
                          ))}
                      </div>
                  </div>
              </div>
          )}

          {activeLens === 'status' && (
              <div className="p-3 flex flex-col items-center justify-center h-32 gap-2">
                  <div className={`text-xs font-bold uppercase px-3 py-1 rounded-full border ${
                      scene.status === 'final' ? 'bg-green-500/20 border-green-500 text-green-600' :
                      scene.status === 'polished' ? 'bg-blue-500/20 border-blue-500 text-blue-600' :
                      scene.status === 'written' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-600' :
                      'bg-gray-500/20 border-gray-500 text-gray-600'
                  }`}>
                      {scene.status || 'Draft'}
                  </div>
                  <select 
                    value={scene.status || 'draft'} 
                    onChange={(e) => handleStatusChange(e.target.value as SceneStatus)}
                    className="text-xs bg-card border border-border rounded p-1 outline-none focus:ring-1 focus:ring-primary"
                  >
                      <option value="draft">Draft</option>
                      <option value="written">Written</option>
                      <option value="polished">Polished</option>
                      <option value="final">Final</option>
                  </select>
              </div>
          )}
      </div>

      {/* A single target handle for all incoming connections */}
      <Handle type="target" position={Position.Left} className="!bg-primary" style={handleStyle}/>

      {/* Dynamically create a source handle for each transition or choice */}
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
            if (item.type === 'choice') {
            return item.choices.map((choice, choiceIndex) => {
                if (!choice.nextSceneId) return null;
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
            });
            }
            return null;
        })}

        {/* Generic output handle */}
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
const NodeEditorView: React.FC<NodeEditorViewProps> = ({ story, scenes, characters, backgrounds, onUpdateScene, onAddScene, onDeleteScene, activeStoryId, onAddSceneStructure }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // State for AI Generation
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(false);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  
  // Lens State
  const [activeLens, setActiveLens] = useState<LensMode>('default');


  const scenesRef = useRef(scenes);
  const backgroundsRef = useRef(backgrounds); 
  const charactersRef = useRef(characters);
  const onUpdateSceneRef = useRef(onUpdateScene);
  const edgesRef = useRef(edges);

  useEffect(() => { scenesRef.current = scenes; }, [scenes]);
  useEffect(() => { backgroundsRef.current = backgrounds; }, [backgrounds]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);
  useEffect(() => { onUpdateSceneRef.current = onUpdateScene; }, [onUpdateScene]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  
  // Open modal when target is selected
  useEffect(() => {
    if (targetId) {
      setSelectionMode(false); // This will trigger the modal to open
    }
  }, [targetId]);
  
  // Calculate incoming logic conditions map
  const incomingConditionsMap = useMemo(() => {
      const map: Record<string, string[]> = {};
      Object.values(scenes).forEach((sourceScene: Scene) => {
        sourceScene.dialogue.forEach(item => {
            if (item.type === 'choice') {
                item.choices.forEach(choice => {
                    if (choice.nextSceneId && choice.conditions && choice.conditions.length > 0) {
                        if (!map[choice.nextSceneId]) map[choice.nextSceneId] = [];
                        const condStrings = choice.conditions.map(c => `${c.variableId} ${c.operator} ${c.value}`);
                        map[choice.nextSceneId].push(...condStrings);
                    }
                });
            }
        });
    });
    return map;
  }, [scenes]);


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
    const outcomeIndex = newDialogue.findIndex(d => ['transition', 'choice'].includes(d.type));

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
        }
        currentOnUpdateScene(source, { dialogue: newDialogue });
    }
  }, []);
  
  const onConnect = useCallback((connection) => {
    const currentScenes = scenesRef.current;
    const currentOnUpdateScene = onUpdateSceneRef.current;

    const { source, target } = connection;
    if (!source || !target) return;

    const sourceScene = currentScenes[source];
    const targetScene = currentScenes[target];
    if (!sourceScene || !targetScene) return;
    
    const newDialogue = [...sourceScene.dialogue];
    const outcomeIndex = newDialogue.findIndex(d => ['transition', 'choice', 'end_story'].includes(d.type));

    if (outcomeIndex !== -1) {
        const outcome = newDialogue[outcomeIndex];
        if (outcome.type === 'transition') {
            if (outcome.nextSceneId === target) return; 
            
            const existingTargetScene = currentScenes[outcome.nextSceneId];
            newDialogue[outcomeIndex] = {
                type: 'choice',
                choices: [
                    { text: `Go to ${existingTargetScene?.name || '...'}`, nextSceneId: outcome.nextSceneId },
                    { text: `Go to ${targetScene.name}`, nextSceneId: target },
                ]
            };
        } else if (outcome.type === 'choice') {
            if (!outcome.choices.some(c => c.nextSceneId === target)) {
                 outcome.choices.push({ text: `Go to ${targetScene.name}`, nextSceneId: target });
            }
        } else if (outcome.type === 'end_story') {
            newDialogue[outcomeIndex] = { type: 'transition', nextSceneId: target };
        }
    } else {
        newDialogue.push({ type: 'transition', nextSceneId: target });
    }
    
    currentOnUpdateScene(source, { dialogue: newDialogue });

  }, []);

  useEffect(() => {
    const newNodes: Node[] = Object.values(scenes).map((scene: Scene) => ({
      id: scene.id,
      type: 'sceneNode',
      position: scene.position || { x: 50, y: 50 },
      data: { 
        scene, 
        characters,
        backgrounds, 
        incomingConditions: incomingConditionsMap[scene.id] || [],
        onUpdateScene, 
        onDeleteScene,
        isSelectionMode: !!selectionMode,
        selectionState: contextIds.includes(scene.id) ? 'context' : (targetId === scene.id ? 'target' : 'none'),
        activeLens, 
        onNodeClick: handleNodeClick,
       },
    }));

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
        }
      });
    });
    setNodes(newNodes);
    setEdges(newEdges);
  }, [scenes, characters, backgrounds, incomingConditionsMap, onUpdateScene, onDeleteScene, onDeleteEdge, selectionMode, contextIds, targetId, activeLens]);
  
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
       <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 items-start">
          <div className="flex gap-2">
              <button
                onClick={handleAddNode}
                className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-secondary/90"
              >
                + Add Scene
              </button>
               <button
                onClick={() => setIsStructureModalOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <AIIcon className="w-4 h-4" />
                Generate Structure
              </button>
              <button
                onClick={handleToggleSelectionMode}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {selectionMode ? 'Cancel Selection' : <><AIIcon className="w-4 h-4" /> Generate Dialogue</>}
              </button>
          </div>
          
          {/* Lens Selector */}
          <div className="bg-card/80 backdrop-blur-md border border-border rounded-md p-1 flex gap-1 shadow-lg">
              {['default', 'background', 'logic', 'character', 'status'].map(lens => (
                  <button 
                    key={lens}
                    onClick={() => setActiveLens(lens as LensMode)}
                    className={`px-3 py-1 text-xs rounded transition-colors capitalize ${activeLens === lens ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary/50'}`}
                  >
                      {lens === 'default' ? 'Summary' : lens}
                  </button>
              ))}
          </div>
       </div>
       
       {isStructureModalOpen && activeStoryId && (
        <AIStructureGenerationModal 
            isOpen={isStructureModalOpen}
            onClose={() => setIsStructureModalOpen(false)}
            story={story}
            characters={characters}
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
            story={story}
            characters={characters}
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