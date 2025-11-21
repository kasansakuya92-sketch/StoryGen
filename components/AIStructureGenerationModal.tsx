
import React, { useState } from 'react';
import { Scene, CharactersData, ScenesData, AIStructureType, AIGeneratedScene } from '../types.ts';
import { generateSceneStructure } from '../utils/ai.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';

interface AIStructureGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allScenes: ScenesData;
  allCharacters: CharactersData;
  onAddSceneStructure: (generated: { scenes: AIGeneratedScene[], connections: any }, sourceSceneId: string) => void;
}

const AIStructureGenerationModal: React.FC<AIStructureGenerationModalProps> = ({
  isOpen,
  onClose,
  allScenes,
  allCharacters,
  onAddSceneStructure,
}) => {
  const [sourceSceneId, setSourceSceneId] = useState<string>(Object.keys(allScenes)[0] || '');
  const [contextSceneIds, setContextSceneIds] = useState<string[]>([]);
  const [structureType, setStructureType] = useState<AIStructureType>('choice_branch');
  const [prompt, setPrompt] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSettings();
  
  const sceneOptions = Object.values(allScenes).map((s: Scene) => ({ value: s.id, label: s.name }));
  
  const handleContextChange = (sceneId: string) => {
    setContextSceneIds(prev =>
      prev.includes(sceneId) ? prev.filter(id => id !== sceneId) : [...prev, sceneId]
    );
  };
  
  const handleGenerate = async () => {
    if (!sourceSceneId || !prompt) {
        setError("Please select a source scene and provide a prompt.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const generatedData = await generateSceneStructure(
            settings,
            contextSceneIds.map(id => allScenes[id]),
            allScenes[sourceSceneId],
            allCharacters,
            prompt,
            structureType
        );
        onAddSceneStructure(generatedData, sourceSceneId);
        onClose();

    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(`Failed to generate structure: ${errorMessage}`);
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
                <h2 className="text-xl font-bold">Generate Scene Structure with AI</h2>
                <button onClick={onClose} disabled={isLoading} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 disabled:opacity-50">&times;</button>
            </header>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                    <label className="block text-sm font-bold mb-1">Connect new structure FROM</label>
                    <select value={sourceSceneId} onChange={e => setSourceSceneId(e.target.value)} className={commonFormElement} disabled={isLoading}>
                         {sceneOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">Story Context (Optional)</label>
                    <div className="max-h-24 overflow-y-auto p-2 bg-card/50 rounded border border-border">
                        {sceneOptions.map(opt => (
                           <div key={opt.value} className="flex items-center">
                                <input 
                                    type="checkbox"
                                    id={`context-${opt.value}`}
                                    checked={contextSceneIds.includes(opt.value)}
                                    onChange={() => handleContextChange(opt.value)}
                                    disabled={isLoading}
                                    className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring"
                                />
                                <label htmlFor={`context-${opt.value}`} className="ml-2 block text-sm text-foreground/80">{opt.label}</label>
                           </div>
                        ))}
                    </div>
                </div>
                <div>
                     <label className="block text-sm font-bold mb-1">Structure Type</label>
                    <select value={structureType} onChange={e => setStructureType(e.target.value as AIStructureType)} className={commonFormElement} disabled={isLoading}>
                        <option value="choice_branch">Choice Branch (1 choice -> 2 outcomes)</option>
                        <option value="linear_sequence">Linear Sequence (3 scenes in a row)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="e.g., The hero confronts the villain and must choose to fight or flee."
                        className={`${commonFormElement} h-24`}
                        disabled={isLoading}
                    />
                </div>
                 {error && <p className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</p>}
            </div>
             <footer className="p-4 border-t border-border flex justify-end gap-2">
                 <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Cancel</button>
                 <button 
                    onClick={handleGenerate} 
                    disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 w-32"
                    title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
                >
                    {isLoading ? 'Generating...' : '✨ Generate'}
                </button>
            </footer>
        </div>
    </div>
  )
};

export default AIStructureGenerationModal;
