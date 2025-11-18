
import React, { useState } from 'react';
import { generateStoryPlan, generateDialogueForScene } from '../utils/ai.ts';
import { ScenesData, CharactersData, TextLine, SceneCharacter, DialogueLength, SceneLength, DialogueItem, Scene, Character, Story, StoryVariable } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import AIIcon from './icons/AIIcon.tsx';
import { defaultCharacters } from '../story.ts';


interface AIStoryPlannerProps {
  onPlanGenerated: (plan: { name: string, scenes: ScenesData, characters: CharactersData, variables: Record<string, StoryVariable> }) => void;
  onClose: () => void;
}

// Slider Helper Component
interface SliderOption<T> {
  value: T;
  label: string;
  subLabel: string;
}

const SliderField = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: T;
  options: SliderOption<T>[];
  onChange: (val: T) => void;
  disabled: boolean;
}) => {
  const currentIndex = options.findIndex(o => o.value === value);
  
  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-3">
        <label className="text-sm font-bold text-foreground/80">{label}</label>
        <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
          {options[currentIndex].subLabel}
        </span>
      </div>
      <div className="relative px-2 py-1">
        {/* Track Background for visual milestones */}
        <div className="absolute top-4 left-2 right-2 h-1 flex justify-between items-center pointer-events-none z-0 px-1.5">
             {options.map((_, idx) => (
                 <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${idx <= currentIndex ? 'bg-primary' : 'bg-border'}`}></div>
             ))}
        </div>

        <input
          type="range"
          min="0"
          max={options.length - 1}
          step="1"
          value={currentIndex}
          onChange={(e) => onChange(options[parseInt(e.target.value)].value)}
          disabled={disabled}
          className="w-full h-2 bg-secondary/30 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/50 relative z-10 bg-transparent"
        />
        
        <div className="flex justify-between mt-2 -mx-3">
          {options.map((opt, idx) => (
            <div 
              key={String(opt.value)} 
              className={`flex flex-col items-center w-20 text-center cursor-pointer transition-all duration-200 group`}
              onClick={() => !disabled && onChange(opt.value)}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${idx === currentIndex ? 'text-primary scale-110' : 'text-foreground/50 group-hover:text-foreground/80'}`}>
                {opt.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


const AIStoryPlanner: React.FC<AIStoryPlannerProps> = ({ onPlanGenerated, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating...');
  const [error, setError] = useState<string | null>(null);
  const [shouldGenerateDialogue, setShouldGenerateDialogue] = useState(true);
  const [dialogueLength, setDialogueLength] = useState<DialogueLength>('Short');
  const [sceneLength, setSceneLength] = useState<SceneLength | 'Epic'>('Short');
  const [storyType, setStoryType] = useState<'branching' | 'linear'>('branching');
  const { settings } = useSettings();

  const sceneLengthOptions: SliderOption<SceneLength | 'Epic'>[] = [
    { value: 'Short', label: 'Short', subLabel: '3-4 Scenes' },
    { value: 'Medium', label: 'Medium', subLabel: '5-6 Scenes' },
    { value: 'Long', label: 'Long', subLabel: '7-8 Scenes' },
    { value: 'Epic', label: 'Epic', subLabel: '12-15 Scenes' },
  ];

  const dialogueLengthOptions: SliderOption<DialogueLength>[] = [
    { value: 'Short', label: 'Concise', subLabel: '3-5 lines/scene' },
    { value: 'Medium', label: 'Standard', subLabel: '6-8 lines/scene' },
    { value: 'Long', label: 'Detailed', subLabel: '9-12 lines/scene' },
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt for the story.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setLoadingMessage('Generating story plan...');

    try {
      const plan = await generateStoryPlan(settings, prompt, sceneLength, storyType);

      // --- SELF-CORRECTION AND VALIDATION STEP ---
      if (!plan.scenes || !Array.isArray(plan.scenes)) {
        throw new Error("AI did not return a valid 'scenes' array in the story plan.");
      }
      
      const originalSceneCount = plan.scenes.length;
      plan.scenes = plan.scenes.filter((scene: any, index: number) => {
          const isValid = typeof scene === 'object' && scene !== null && scene.id && scene.name;
          if (!isValid) {
              console.warn(`Invalid scene data at index ${index} was discarded:`, scene);
          }
          return isValid;
      });

      if (plan.scenes.length === 0 && originalSceneCount > 0) {
          throw new Error("AI returned scene data, but none of it was in a valid format. Generation aborted.");
      }
      
      // --- Character Processing (Robust Version) ---
      let processedCharacters: CharactersData = {};
      const charactersToProcess: any[] = Array.isArray(plan.characters) ? plan.characters : [];

      charactersToProcess.forEach((char: any) => {
          if (typeof char === 'object' && char !== null && typeof char.name === 'string' && char.name.trim() !== '') {
              const name = char.name.trim();
              const baseId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
              let finalId = baseId;
              let counter = 1;
              while (processedCharacters[finalId]) {
                  finalId = `${baseId}_${counter++}`;
              }

              processedCharacters[finalId] = {
                  id: finalId,
                  name: name,
                  appearance: (typeof char.appearance === 'string' && char.appearance.trim()) ? char.appearance.trim() : `A description for ${name}.`,
                  talkingStyle: (typeof char.talkingStyle === 'string' && char.talkingStyle.trim()) ? char.talkingStyle.trim() : `A standard talking style for ${name}.`,
                  defaultSpriteId: 'normal',
                  sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${finalId}/600/800` }],
              };
          }
      });
      
      let finalCharacters = processedCharacters;
      if (Object.keys(finalCharacters).length === 0) {
          console.warn("AI plan did not return any valid characters. Falling back to default characters.");
          finalCharacters = defaultCharacters;
      }

      // --- Variable Processing ---
      let processedVariables: Record<string, StoryVariable> = {};
      if (Array.isArray(plan.variables)) {
          plan.variables.forEach((v: any) => {
              if (v && v.name && v.type && v.initialValue !== undefined) {
                  const id = v.name.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
                  let finalId = id;
                  let counter = 1;
                  while(processedVariables[finalId]) finalId = `${id}_${counter++}`;
                  
                  let parsedValue = v.initialValue;
                  if (v.type === 'number') parsedValue = Number(v.initialValue);
                  if (v.type === 'boolean') parsedValue = v.initialValue === 'true' || v.initialValue === true;
                  
                  processedVariables[finalId] = {
                      id: finalId,
                      name: v.name,
                      type: v.type,
                      initialValue: parsedValue
                  };
              }
          });
      }


      // --- PROGRAMMATICALLY CREATE STORY STRUCTURE ---
      const scenesFromAI = plan.scenes;
      
      if (storyType === 'branching' && scenesFromAI.length >= 3) {
          // Creates a tree: Scene 0 -> Choice(Scene 1, Scene 2)
          // Then distributes remaining scenes across the two branches.
          scenesFromAI[0].outcome = { 
              type: 'choice', 
              choices: [
                  { text: `Go to ${scenesFromAI[1].name}`, nextSceneId: scenesFromAI[1].id }, 
                  { text: `Go to ${scenesFromAI[2].name}`, nextSceneId: scenesFromAI[2].id }
              ] 
          };
          
          let lastIdA = scenesFromAI[1].id;
          let lastIdB = scenesFromAI[2].id;
          
          // Start loop from index 3 to distribute subsequent scenes
          for (let i = 3; i < scenesFromAI.length; i++) {
              const currentScene = scenesFromAI[i];
              // Distribute evenly: Odd index to Branch A, Even to Branch B
              if (i % 2 !== 0) { 
                  const prevScene = scenesFromAI.find((s: any) => s.id === lastIdA);
                  if (prevScene) prevScene.outcome = { type: 'transition', nextSceneId: currentScene.id };
                  lastIdA = currentScene.id;
              } else { 
                  const prevScene = scenesFromAI.find((s: any) => s.id === lastIdB);
                  if (prevScene) prevScene.outcome = { type: 'transition', nextSceneId: currentScene.id };
                  lastIdB = currentScene.id;
              }
          }
          
          // Terminate ends of branches
          const finalA = scenesFromAI.find((s: any) => s.id === lastIdA);
          if (finalA) finalA.outcome = { type: 'end_story' };
          
          const finalB = scenesFromAI.find((s: any) => s.id === lastIdB);
          if (finalB) finalB.outcome = { type: 'end_story' };
          
      } else {
          // Linear Sequence
          scenesFromAI.forEach((scene: any, index: number) => {
              scene.outcome = (index < scenesFromAI.length - 1) ? { type: 'transition', nextSceneId: scenesFromAI[index + 1].id } : { type: 'end_story' };
          });
      }

      const newScenes: ScenesData = {};
      const nameToIdMap = new Map<string, string>();
      Object.values(finalCharacters).forEach(char => nameToIdMap.set(char.name, char.id));

      plan.scenes.forEach((scene: { id: string, name: string, summary: string, characterIds: string[], outcome: any }, index: number) => {
        
        const sceneCharacters: SceneCharacter[] = (scene.characterIds || [])
            .map(charName => nameToIdMap.get(charName)) // Map name to ID
            .filter((id): id is string => !!id) // Filter out names that couldn't be mapped
            .map((id, charIndex) => ({
                characterId: id,
                spriteId: 'normal',
                position: charIndex === 0 ? 'left' : 'right',
            }));

        const finalDialogueItem: DialogueItem = scene.outcome.type === 'choice' && scene.outcome.choices?.length > 0 ? { type: 'choice', choices: scene.outcome.choices }
            : scene.outcome.type === 'transition' && scene.outcome.nextSceneId ? { type: 'transition', nextSceneId: scene.outcome.nextSceneId }
            : { type: 'end_story' };

        newScenes[scene.id] = {
          id: scene.id,
          name: scene.name,
          description: scene.summary,
          background: `https://picsum.photos/seed/bg-${scene.id}/1920/1080`,
          characters: sceneCharacters,
          dialogue: [{ type: 'text', characterId: null, text: scene.summary }, finalDialogueItem],
          position: { x: 50 + index * 300, y: 100 + (index % 2) * 150 },
        };
      });

      if (shouldGenerateDialogue) {
        setLoadingMessage('Generating dialogue (0%)...');
        const scenesToProcess = Object.values(newScenes);
        const originalOutcomes: { [sceneId: string]: DialogueItem } = {};
        scenesToProcess.forEach(scene => {
            originalOutcomes[scene.id] = newScenes[scene.id].dialogue.slice(-1)[0];
        });
        
        // Note: We construct a temporary Story object to pass to the AI. 
        // Since characters are now separate, we pass them within this temporary object context
        // but the utility function will need to extract them correctly.
        const tempStoryForDialogueGen: Story = {
            id: `temp_story_${Date.now()}`,
            name: plan.title || "AI Generated Story",
            scenes: newScenes,
            startSceneId: plan.scenes[0]?.id || 'start',
            variables: processedVariables
        };

        for (let i = 0; i < scenesToProcess.length; i++) {
            const scene = scenesToProcess[i];
            const originalOutcome = originalOutcomes[scene.id];
            try {
                // Pass finalCharacters separately to the utility
                const newDialogueLines = await generateDialogueForScene(settings, tempStoryForDialogueGen, scene.id, finalCharacters, dialogueLength, false, 'text_only');
                if (Array.isArray(newDialogueLines) && newDialogueLines.every(item => item.type === 'text')) {
                    newScenes[scene.id].dialogue = [...newDialogueLines, originalOutcome];
                } else {
                     throw new Error("AI did not return a valid text-only dialogue array.");
                }
            } catch (e) {
                console.warn(`Could not generate dialogue for scene "${scene.name}", using summary as fallback:`, e);
                newScenes[scene.id].dialogue = [{ type: 'text', characterId: null, text: scene.description || '...' }, originalOutcome];
            }
            setLoadingMessage(`Generating dialogue (${Math.round((i + 1) / scenesToProcess.length * 100)}%)...`);
        }
      }

      onPlanGenerated({ 
          name: plan.title || "AI Generated Story", 
          scenes: newScenes, 
          characters: finalCharacters,
          variables: processedVariables 
      });
      onClose();

    } catch (e) {
      console.error("Failed to generate story plan:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to generate story plan. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const commonSelectClass = "mt-1 block w-full bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";
  const commonLabelClass = "block text-sm font-bold text-foreground/80 mb-1";

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-lg flex flex-col border border-border">
        <header className="p-4 border-b border-border">
          <h2 className="text-xl font-bold">AI Story Planner</h2>
        </header>
        <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
          <p className="text-sm text-foreground/70">Describe the story you want to create. The AI will generate characters, plot, and game variables.</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A sci-fi detective story on a space station."
            className="w-full h-24 bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none resize-none"
            disabled={isLoading}
          />
          
          <SliderField 
            label="Story Length" 
            value={sceneLength} 
            options={sceneLengthOptions} 
            onChange={setSceneLength} 
            disabled={isLoading} 
          />

          <SliderField 
            label="Dialogue Detail" 
            value={dialogueLength} 
            options={dialogueLengthOptions} 
            onChange={setDialogueLength} 
            disabled={isLoading} 
          />

          <div>
            <label htmlFor="story-type" className={commonLabelClass}>Story Structure</label>
            <select
                id="story-type"
                value={storyType}
                onChange={(e) => setStoryType(e.target.value as 'branching' | 'linear')}
                className={commonSelectClass}
                disabled={isLoading}
            >
                <option value="branching">Branching (with choices)</option>
                <option value="linear">Linear (no choices)</option>
            </select>
          </div>

          <div className="flex items-center pt-2">
            <input 
              type="checkbox"
              id="generate-dialogue"
              checked={shouldGenerateDialogue}
              onChange={(e) => setShouldGenerateDialogue(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring"
              disabled={isLoading}
            />
            <label htmlFor="generate-dialogue" className="ml-2 block text-sm text-foreground/80 font-medium">
              Generate initial dialogue for each scene
            </label>
          </div>
          {error && <p className="text-destructive text-xs font-bold bg-destructive/10 p-2 rounded">{error}</p>}
        </div>
        <footer className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Cancel</button>
          <button 
            onClick={handleGenerate} 
            disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded hover:bg-primary/90 disabled:opacity-50 w-40 flex items-center justify-center gap-2 shadow-md"
            title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
          >
            {isLoading ? loadingMessage : <><AIIcon className="w-4 h-4" /> Generate Plan</>}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AIStoryPlanner;
