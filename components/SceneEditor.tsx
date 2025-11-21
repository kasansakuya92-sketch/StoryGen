
import React, { useCallback, useState } from 'react';
import { Scene, ScenesData, CharactersData, DialogueItem, DialogueLength } from '../types.ts';
import VeoGenerationModal from './VeoGenerationModal.tsx';
import DialogueEditor from './editorjs/Editor.tsx';
import { useSettings } from '../contexts/SettingsContext.tsx';
import AIGenerateSceneDialogueButton from './AIGenerateSceneDialogueButton.tsx';
import MilestoneSlider, { SliderOption } from './MilestoneSlider.tsx';

// Prop Interfaces
interface SceneEditorProps {
  scene: Scene;
  scenes: ScenesData;
  characters: CharactersData;
  variables: string[];
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
}

const commonFormElement = "w-full bg-card/70 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

const SceneEditor: React.FC<SceneEditorProps> = ({ scene, scenes, characters, variables, onUpdateScene }) => {
  const [isVeoModalOpen, setIsVeoModalOpen] = useState(false);
  const { settings } = useSettings();
  
  // State for AI Dialogue Generation panel
  const [isAiDialoguePanelOpen, setIsAiDialoguePanelOpen] = useState(false);
  const [aiDialogueLength, setAiDialogueLength] = useState<DialogueLength>('Short');
  const [aiUseContinuity, setAiUseContinuity] = useState(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  const handleDialogueUpdate = useCallback((newDialogue: DialogueItem[]) => {
      onUpdateScene(scene.id, { dialogue: newDialogue });
  }, [onUpdateScene, scene.id]);

  const dialogueLengthOptions: SliderOption[] = [
      { value: 'Short', label: 'Concise', description: '3-5 lines' },
      { value: 'Medium', label: 'Balanced', description: '6-8 lines' },
      { value: 'Long', label: 'Detailed', description: '9-12 lines' }
  ];

  return (
    <main className="flex-grow bg-transparent overflow-y-auto p-4 space-y-4">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-bold">Scene Description</label>
          <textarea
            value={scene.description || ''}
            onChange={(e) => onUpdateScene(scene.id, { description: e.target.value })}
            placeholder="A high-level summary of what happens in this scene. Used by the AI to generate dialogue."
            className={`${commonFormElement} h-20 resize-y`}
          />
        </div>
        <div>
          <label className="text-sm font-bold">Background URL</label>
          <input 
            type="text"
            value={scene.background}
            onChange={(e) => onUpdateScene(scene.id, { background: e.target.value })}
            className={commonFormElement}
          />
        </div>
        
        {/* AI Media Generation Section */}
        <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-lg font-bold mb-2">Scene Media Generation</h3>
              <button
                onClick={() => setIsVeoModalOpen(true)}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2-2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" />
                </svg>
                Generate Scene Video with AI
            </button>
        </div>

        {/* Dialogue Block Editor */}
        <div className="space-y-2 pt-4 border-t border-border mt-4">
          <h3 className="text-lg font-bold">Dialogue</h3>
          <div className="bg-card/80 backdrop-blur-sm border border-border p-2 rounded prose max-w-none prose-p:my-1 prose-headings:my-2">
             <DialogueEditor
                key={scene.id} // Re-initialize editor when scene changes
                scene={scene}
                scenes={scenes}
                characters={characters}
                variables={variables}
                onUpdateDialogue={handleDialogueUpdate}
                settings={settings}
            />
          </div>
        </div>
        
        {/* New AI Dialogue Generation Panel */}
        <div className="border-t border-border pt-4 mt-4">
            <button
            onClick={() => setIsAiDialoguePanelOpen(prev => !prev)}
            className="w-full flex justify-between items-center text-left"
            >
            <h3 className="text-lg font-bold">AI Dialogue Extension</h3>
            <span className="font-bold">{isAiDialoguePanelOpen ? '−' : '+'}</span>
            </button>
            {isAiDialoguePanelOpen && (
            <div className="p-4 bg-card/50 rounded-lg space-y-4 mt-2 animate-fade-in">
                <p className="text-sm text-foreground/70">
                Generate additional dialogue lines that will be inserted before the current scene's outcome (Choice, Transition, or End). Your existing outcome will be preserved.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <MilestoneSlider 
                        label="Dialogue Detail" 
                        value={aiDialogueLength} 
                        onChange={setAiDialogueLength} 
                        options={dialogueLengthOptions} 
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-1">Context</label>
                    <div className="flex items-center h-full pt-2">
                    <input
                        type="checkbox"
                        id="ai-continuity"
                        checked={aiUseContinuity}
                        onChange={(e) => setAiUseContinuity(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring"
                        />
                        <label htmlFor="ai-continuity" className="ml-2 block text-sm text-foreground/80">
                        Use existing dialogue
                        </label>
                    </div>
                </div>
                </div>
                <div>
                <label className="block text-sm font-bold text-foreground/80 mb-1">Prompt (Optional)</label>
                <textarea
                    value={aiCustomPrompt}
                    onChange={(e) => setAiCustomPrompt(e.target.value)}
                    placeholder="e.g., The hero reveals a hidden secret."
                    className={`${commonFormElement} h-16 resize-y text-sm`}
                />
                </div>
                <AIGenerateSceneDialogueButton
                scene={scene}
                scenes={scenes}
                characters={characters}
                onUpdateScene={onUpdateScene}
                dialogueLength={aiDialogueLength}
                useContinuity={aiUseContinuity}
                aiPrompt={aiCustomPrompt}
                />
            </div>
            )}
        </div>
        
        {isVeoModalOpen && (
          <VeoGenerationModal
              scene={scene}
              characters={characters}
              onClose={() => setIsVeoModalOpen(false)}
          />
        )}
      </div>
    </main>
  );
};

export default SceneEditor;
