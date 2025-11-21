import React, { useState } from 'react';
import { Scene, ScenesData, CharactersData, DialogueLength, DialogueItem } from '../types.ts';
import { generateDialogueForScene } from '../utils/ai.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';

interface AIGenerateSceneDialogueButtonProps {
  scene: Scene;
  scenes: ScenesData;
  characters: CharactersData;
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
  dialogueLength: DialogueLength;
  useContinuity: boolean;
  aiPrompt: string;
}

const AIGenerateSceneDialogueButton: React.FC<AIGenerateSceneDialogueButtonProps> = ({ scene, scenes, characters, onUpdateScene, dialogueLength, useContinuity, aiPrompt }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // We only want to generate text lines to extend the dialogue, not create a new outcome.
      const newDialogueItems = await generateDialogueForScene(settings, scene, scenes, characters, dialogueLength, useContinuity, 'text_only', aiPrompt);
      
      if (Array.isArray(newDialogueItems)) {
         // Find if an outcome block already exists and preserve it.
         const outcomeIndex = scene.dialogue.findIndex(d => d.type === 'choice' || d.type === 'transition' || d.type === 'end_story');
         
         let dialogueBeforeOutcome: DialogueItem[];
         let outcomeBlock: DialogueItem | undefined;

         if (outcomeIndex !== -1) {
            dialogueBeforeOutcome = scene.dialogue.slice(0, outcomeIndex);
            outcomeBlock = scene.dialogue[outcomeIndex];
         } else {
            dialogueBeforeOutcome = scene.dialogue;
            outcomeBlock = undefined;
         }

         const finalDialogue = [...dialogueBeforeOutcome, ...newDialogueItems];
         if(outcomeBlock) {
            finalDialogue.push(outcomeBlock);
         }

         onUpdateScene(scene.id, {
            dialogue: finalDialogue,
         });
      } else {
        throw new Error("AI did not return a valid dialogue array.");
      }

    } catch (e) {
      console.error("Failed to generate dialogue:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to generate dialogue. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-2">
      <button
        onClick={handleClick}
        disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
        className="w-full px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
      >
        {isLoading ? 'Generating...' : '✨ Generate & Append Dialogue'}
      </button>
      {error && <p className="text-destructive text-xs mt-2">{error}</p>}
    </div>
  );
};

export default AIGenerateSceneDialogueButton;