
import React, { useState } from 'react';
import { Scene, CharactersData, ScenesData, DialogueLength, TextLine, Story } from '../types.ts';
import { generateDialogueFromNodes } from '../utils/ai.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import AIIcon from './icons/AIIcon.tsx';

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextScenes: Scene[];
  targetScene: Scene;
  story: Story; // Changed to accept full story
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
}

const AIGenerationModal: React.FC<AIGenerationModalProps> = ({
  isOpen,
  onClose,
  contextScenes,
  targetScene,
  story,
  onUpdateScene,
}) => {
  const [prompt, setPrompt] = useState('');
  const [dialogueLength, setDialogueLength] = useState<DialogueLength>('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  // NOTE: We are missing explicit 'characters' prop here because NodeEditorView doesn't pass it into this modal
  // However, since we did a project refactor, characters should be available.
  // For now, assuming the parent view will be updated to pass characters or we can't access them.
  // Wait, we can't access 'characters' from 'story' anymore.
  // I need to update the props of this component too. But let's check NodeEditorView.
  
  // Actually, AIGenerationModal is called from NodeEditorView which HAS characters.
  // I will update NodeEditorView to pass characters to this modal.
  
  // For this file update, I'll assume the prop is passed.
  // But I can't change the interface without updating the caller.
  // Let's check if I can access characters another way? No.
  
  // I'll skip updating this file in this XML block and include it in the NodeEditorView update block or 
  // update it here assuming I'll update the caller.
  
  // Let's stick to the plan. I will update this file to accept characters.
  return null; 
} 
// ... Actually I will rewrite this entire file content to be safe.

const AIGenerationModalReal: React.FC<AIGenerationModalProps & { characters: CharactersData }> = ({
  isOpen,
  onClose,
  contextScenes,
  targetScene,
  story,
  characters,
  onUpdateScene,
}) => {
  const [prompt, setPrompt] = useState('');
  const [dialogueLength, setDialogueLength] = useState<DialogueLength>('Medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();

  const handleGenerate = async () => {
    if (!targetScene) return;

    setIsLoading(true);
    setError(null);
    try {
      const newDialogueLines = await generateDialogueFromNodes(
        settings,
        story,
        contextScenes.map(s => s.id),
        targetScene.id,
        characters,
        prompt,
        dialogueLength
      );
      
      const originalOutcome = targetScene.dialogue.find(d => d.type !== 'text');
      
      const newDialogue = [
          ...newDialogueLines,
          ...(originalOutcome ? [originalOutcome] : [{ type: 'end_story' as const }]) // Ensure node remains connectable
      ];

      onUpdateScene(targetScene.id, { dialogue: newDialogue });
      onClose();

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
      setError(`Failed to generate dialogue: ${errorMessage}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  
  const commonFormElement = "w-full bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

  return (
    <div className="fixed inset-0 bg-onyx/70 z-50 flex items-center justify-center p-4 backdrop-blur-md" onMouseDown={onClose}>
        <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-border" onMouseDown={e => e.stopPropagation()}>
            <header className="p-4 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-bold">Generate Dialogue for "{targetScene.name}"</h2>
                <button onClick={onClose} disabled={isLoading} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 disabled:opacity-50">&times;</button>
            </header>
            <div className="p-4 space-y-4">
                <div>
                    <h3 className="text-sm font-bold mb-1 text-foreground/80">Context Scenes</h3>
                    <div className="flex flex-wrap gap-2">
                        {contextScenes.map(s => (
                            <span key={s.id} className="bg-blue-500/20 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2 py-1 rounded-full">
                                {s.name}
                            </span>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-bold mb-1">Prompt (Optional)</label>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g., Make the characters argue about the treasure map."
                        className={`${commonFormElement} h-20`}
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">Dialogue Detail</label>
                    <select value={dialogueLength} onChange={e => setDialogueLength(e.target.value as DialogueLength)} className={commonFormElement} disabled={isLoading}>
                        <option value="Short">Short (3-5 lines)</option>
                        <option value="Medium">Medium (6-8 lines)</option>
                        <option value="Long">Long (9-12 lines)</option>
                    </select>
                </div>

                {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>}
            </div>
            <footer className="p-4 border-t border-border flex justify-end gap-2">
                 <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Cancel</button>
                 <button 
                    onClick={handleGenerate} 
                    disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 w-32 flex items-center justify-center gap-2"
                    title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
                >
                    {isLoading ? 'Generating...' : <><AIIcon className="w-4 h-4" /> Generate</>}
                </button>
            </footer>
        </div>
    </div>
  );
};

export default AIGenerationModalReal;
