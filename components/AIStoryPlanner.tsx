import React, { useState } from 'react';
import { generateStoryPlan, generateDialogueForScene } from '../utils/ai.ts';
import { ScenesData, CharactersData, TextLine, SceneCharacter, DialogueLength, SceneLength, DialogueItem, Scene, Character, Story } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import AIIcon from './icons/AIIcon.tsx';
import { defaultCharacters } from '../story.ts';


interface AIStoryPlannerProps {
  onPlanGenerated: (plan: { name: string, scenes: ScenesData, characters: CharactersData }) => void;
  onClose: () => void;
}

const AIStoryPlanner: React.FC<AIStoryPlannerProps> = ({ onPlanGenerated, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Generating...');
  const [error, setError] = useState<string | null>(null);
  const [shouldGenerateDialogue, setShouldGenerateDialogue] = useState(true);
  const [dialogueLength, setDialogueLength] = useState<DialogueLength>('Short');
  const [sceneLength, setSceneLength] = useState<SceneLength>('Short');
  const [storyType, setStoryType] = useState<'branching' | 'linear'>('branching');
  const { settings } = useSettings();

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

      // --- PROGRAMMATICALLY CREATE STORY STRUCTURE ---
      const scenesFromAI = plan.scenes;
      if (storyType === 'branching' && scenesFromAI.length >= 3) {
          scenesFromAI[0].outcome = { type: 'choice', choices: [{ text: `"${scenesFromAI[1].name}"`, nextSceneId: scenesFromAI[1].id }, { text: `"${scenesFromAI[2].name}"`, nextSceneId: scenesFromAI[2].id }] };
          for (let i = 1; i < scenesFromAI.length; i++) {
              scenesFromAI[i].outcome = { type: 'end_story' }; // End branches for simplicity
          }
      } else {
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
        
        const tempStoryForDialogueGen: Story = {
            id: `temp_story_${Date.now()}`,
            name: plan.title || "AI Generated Story",
            characters: finalCharacters,
            scenes: newScenes,
            startSceneId: plan.scenes[0]?.id || 'start'
        };

        for (let i = 0; i < scenesToProcess.length; i++) {
            const scene = scenesToProcess[i];
            const originalOutcome = originalOutcomes[scene.id];
            try {
                const newDialogueLines = await generateDialogueForScene(settings, tempStoryForDialogueGen, scene.id, dialogueLength, false, 'text_only');
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

      onPlanGenerated({ name: plan.title || "AI Generated Story", scenes: newScenes, characters: finalCharacters });
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
  const commonLabelClass = "block text-sm font-medium text-foreground/80";

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-lg flex flex-col border border-border">
        <header className="p-4 border-b border-border">
          <h2 className="text-xl font-bold">AI Story Planner</h2>
        </header>
        <div className="p-4 space-y-4">
          <p className="text-sm text-foreground/70">Describe the story you want to create. The AI will generate a set of characters and scenes to get you started.</p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A sci-fi detective story on a space station."
            className="w-full h-24 bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none"
            disabled={isLoading}
          />
           <div>
            <label htmlFor="scene-length" className={commonLabelClass}>Scenes Detail</label>
            <select
                id="scene-length"
                value={sceneLength}
                onChange={(e) => setSceneLength(e.target.value as SceneLength)}
                className={commonSelectClass}
                disabled={isLoading}
            >
                <option value="Short">Short (3-4 scenes)</option>
                <option value="Medium">Medium (5-6 scenes)</option>
                <option value="Long">Long (7-8 scenes)</option>
            </select>
          </div>
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
          <div>
            <label htmlFor="dialogue-length" className={commonLabelClass}>Dialogue Detail</label>
            <select
                id="dialogue-length"
                value={dialogueLength}
                onChange={(e) => setDialogueLength(e.target.value as DialogueLength)}
                className={commonSelectClass}
                disabled={isLoading}
            >
                <option value="Short">Short (3-5 lines per scene)</option>
                <option value="Medium">Medium (6-8 lines per scene)</option>
                <option value="Long">Long (9-12 lines per scene)</option>
            </select>
          </div>
          <div className="flex items-center">
            <input 
              type="checkbox"
              id="generate-dialogue"
              checked={shouldGenerateDialogue}
              onChange={(e) => setShouldGenerateDialogue(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring"
              disabled={isLoading}
            />
            <label htmlFor="generate-dialogue" className="ml-2 block text-sm text-foreground/80">
              Generate initial dialogue for each scene
            </label>
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <footer className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Cancel</button>
          <button 
            onClick={handleGenerate} 
            disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 w-40 flex items-center justify-center gap-2"
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