


import React, { useCallback, useState } from 'react';
import { Scene, ScenesData, CharactersData, DialogueItem, DialogueLength, Story, Project } from '../types.ts';
import DialogueEditor from './editorjs/Editor.tsx';
import { useSettings } from '../contexts/SettingsContext.tsx';
import AIGenerateSceneDialogueButton from './AIGenerateSceneDialogueButton.tsx';
import AIIcon from './icons/AIIcon.tsx';

// Prop Interfaces
interface SceneEditorProps {
  scene: Scene;
  story: Story;
  scenes: ScenesData;
  characters: CharactersData;
  onUpdateScene: (sceneId: string, updatedScene: Partial<Scene>) => void;
  project: Project; // Added Project to allow cross-story linking
}

const commonFormElement = "w-full bg-card/70 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

const SceneEditor: React.FC<SceneEditorProps> = ({ scene, story, scenes, characters, onUpdateScene, project }) => {
  const { settings } = useSettings();
  
  const [isAiDialoguePanelOpen, setIsAiDialoguePanelOpen] = useState(false);

  const [aiDialogueLength, setAiDialogueLength] = useState<DialogueLength>('Short');
  const [aiUseContinuity, setAiUseContinuity] = useState(true);
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  const handleDialogueUpdate = useCallback((newDialogue: DialogueItem[]) => {
      onUpdateScene(scene.id, { dialogue: newDialogue });
  }, [onUpdateScene, scene.id]);

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
        
        <div className="space-y-2 pt-4 border-t border-border mt-4">
          <h3 className="text-lg font-bold">Dialogue</h3>
          <div className="bg-card/80 backdrop-blur-sm border border-border p-2 rounded prose max-w-none prose-p:my-1 prose-headings:my-2">
             <DialogueEditor
                key={scene.id}
                scene={scene}
                story={story}
                project={project}
                scenes={scenes}
                characters={characters}
                onUpdateDialogue={handleDialogueUpdate}
                settings={settings}
            />
          </div>
        </div>
        
        <div className="border-t border-border pt-4 mt-4">
            <button
            onClick={() => setIsAiDialoguePanelOpen(prev => !prev)}
            className="w-full flex justify-between items-center text-left"
            >
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AIIcon className="w-5 h-5 text-primary" />
              AI Dialogue Extension
            </h3>
            <span className="font-bold">{isAiDialoguePanelOpen ? '−' : '+'}</span>
            </button>
            {isAiDialoguePanelOpen && (
            <div className="p-4 bg-card/50 rounded-lg space-y-4 mt-2 animate-fade-in">
                <p className="text-sm text-foreground/70">
                Generate additional dialogue lines that will be inserted before the current scene's outcome (Choice, Transition, or End). Your existing outcome will be preserved.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-1">Dialogue Detail</label>
                    <select
                        value={aiDialogueLength}
                        onChange={(e) => setAiDialogueLength(e.target.value as DialogueLength)}
                        className={commonFormElement}
                    >
                        <option value="Short">Short (3-5 lines)</option>
                        <option value="Medium">Medium (6-8 lines)</option>
                        <option value="Long">Long (9-12 lines)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-foreground/80 mb-1">Context</label>
                    <div className="flex items-center h-full">
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
                story={story}
                characters={characters}
                onUpdateScene={onUpdateScene}
                dialogueLength={aiDialogueLength}
                useContinuity={aiUseContinuity}
                aiPrompt={aiCustomPrompt}
                />
            </div>
            )}
        </div>
      </div>
    </main>
  );
};

export default SceneEditor;