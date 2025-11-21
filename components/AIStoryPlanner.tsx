import React, { useState } from 'react';
import { generateStoryPlan, generateDialogueForScene } from '../utils/ai.ts';
import { ScenesData, CharactersData, TextLine, SceneCharacter, DialogueLength, SceneLength, DialogueItem, Scene, Character } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import MilestoneSlider, { SliderOption } from './MilestoneSlider.tsx';

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

  const sceneLengthOptions: SliderOption[] = [
      { value: 'Short', label: 'Short', description: '3-4 scenes' },
      { value: 'Medium', label: 'Medium', description: '5-6 scenes' },
      { value: 'Long', label: 'Long', description: '7-8 scenes' }
  ];

  const dialogueLengthOptions: SliderOption[] = [
      { value: 'Short', label: 'Concise', description: '3-5 lines/scene' },
      { value: 'Medium', label: 'Balanced', description: '6-8 lines/scene' },
      { value: 'Long', label: 'Detailed', description: '9-12 lines/scene' }
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
      const sceneIds = new Set(plan.scenes.map((s: { id: string }) => s.id));
      const sceneIdList = plan.scenes.map((s: { id: string }) => s.id); // Ordered list

      plan.scenes.forEach((scene: { id: string, outcome: any }, index: number) => {
        const isLastScene = index === sceneIdList.length - 1;

        const correctNextSceneId = (currentNextSceneId: string | undefined): string | undefined => {
            if (currentNextSceneId && sceneIds.has(currentNextSceneId)) {
                return currentNextSceneId; // It's already valid
            }
            // If it's invalid or undefined, and not the last scene, point to the next one.
            if (!isLastScene) {
                return sceneIdList[index + 1];
            }
            return undefined; // Can't find a valid target
        };

        if (scene.outcome.type === 'transition') {
            const correctedId = correctNextSceneId(scene.outcome.nextSceneId);
            if (correctedId) {
                scene.outcome.nextSceneId = correctedId;
            } else {
                // If we couldn't find a valid next scene (e.g., last scene), change to end_story
                scene.outcome = { type: 'end_story' };
            }
        } else if (scene.outcome.type === 'choice' && scene.outcome.choices) {
            scene.outcome.choices.forEach((choice: { nextSceneId: string }) => {
                const correctedId = correctNextSceneId(choice.nextSceneId);
                // Assign a valid nextSceneId, even if it's a fallback.
                choice.nextSceneId = correctedId || (!isLastScene ? sceneIdList[index + 1] : '');
            });
            
            // Filter out choices that still don't have a valid target (only happens on last scene)
            scene.outcome.choices = scene.outcome.choices.filter((c: { nextSceneId: string }) => c.nextSceneId);
            
            // If after correction, there are no valid choices left, convert the outcome.
            if (scene.outcome.choices.length === 0) {
                 if (!isLastScene) {
                    scene.outcome = { type: 'transition', nextSceneId: sceneIdList[index + 1] };
                 } else {
                    scene.outcome = { type: 'end_story' };
                 }
            } else if (scene.outcome.choices.length === 1) {
                // If only one choice remains, it's not really a choice. Convert to transition.
                scene.outcome = { type: 'transition', nextSceneId: scene.outcome.choices[0].nextSceneId };
            }
        }
      });
      // --- END SELF-CORRECTION ---


      // Transform plan into StoryData and CharactersData, handling both array (Google) and object (Local) formats
      let newCharacters: CharactersData = {};
      if (plan.characters) {
          if (Array.isArray(plan.characters)) {
              // Handle Google AI's array format
              plan.characters.forEach((char: Character) => {
                  if (char && char.id) {
                    newCharacters[char.id] = {
                        ...char,
                        defaultSpriteId: 'normal',
                        sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${char.id}/600/800` }],
                    };
                  }
              });
          } else if (typeof plan.characters === 'object' && !Array.isArray(plan.characters)) {
              // Handle Local AI's pre-formatted object
              newCharacters = plan.characters;
          }
      }

      const newScenes: ScenesData = {};
      plan.scenes.forEach((scene: { id: string, name: string, summary: string, characterIds: string[], outcome: any }, index: number) => {
        
        const sceneCharacters: SceneCharacter[] = scene.characterIds
            .filter(id => newCharacters[id]) // Ensure character exists
            .map((id, charIndex) => ({
                characterId: id,
                spriteId: 'normal',
                // Basic positioning for up to 2 characters
                position: charIndex === 0 ? 'left' : 'right',
            }));

        let finalDialogueItem: DialogueItem;
        switch (scene.outcome.type) {
            case 'choice':
                if (scene.outcome.choices && scene.outcome.choices.length > 0) {
                    finalDialogueItem = { type: 'choice', choices: scene.outcome.choices };
                } else {
                    finalDialogueItem = { type: 'end_story' }; // Fallback
                }
                break;
            case 'transition':
                if (scene.outcome.nextSceneId) {
                    finalDialogueItem = { type: 'transition', nextSceneId: scene.outcome.nextSceneId };
                } else {
                    finalDialogueItem = { type: 'end_story' }; // Fallback
                }
                break;
            case 'end_story':
            default:
                finalDialogueItem = { type: 'end_story' };
                break;
        }

        newScenes[scene.id] = {
          id: scene.id,
          name: scene.name,
          description: scene.summary,
          background: `https://picsum.photos/seed/bg-${scene.id}/1920/1080`,
          characters: sceneCharacters,
          dialogue: [ // Placeholder, will be replaced
            { type: 'text', characterId: null, text: scene.summary },
            finalDialogueItem
          ],
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
        
        for (let i = 0; i < scenesToProcess.length; i++) {
            const scene = scenesToProcess[i];
            const originalOutcome = originalOutcomes[scene.id];
            try {
                const newDialogueLines = await generateDialogueForScene(settings, scene, newScenes, newCharacters, dialogueLength, false, 'text_only');
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


      onPlanGenerated({ name: prompt.substring(0, 50) || "AI Generated Story", scenes: newScenes, characters: newCharacters });
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
        <div className="p-4 space-y-6">
          <div>
            <p className="text-sm text-foreground/70 mb-2">Describe the story you want to create. The AI will generate a set of characters and scenes to get you started.</p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A sci-fi detective story on a space station."
                className="w-full h-24 bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none"
                disabled={isLoading}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <MilestoneSlider 
                label="Story Length" 
                value={sceneLength} 
                onChange={setSceneLength} 
                options={sceneLengthOptions} 
                disabled={isLoading}
            />
             <div>
                <label htmlFor="story-type" className={`${commonLabelClass} mb-2`}>Story Structure</label>
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
          </div>
          
          <div>
             <MilestoneSlider 
                label="Dialogue Detail" 
                value={dialogueLength} 
                onChange={setDialogueLength} 
                options={dialogueLengthOptions} 
                disabled={isLoading}
            />
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
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 w-32"
            title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
          >
            {isLoading ? loadingMessage : 'Generate Plan'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AIStoryPlanner;