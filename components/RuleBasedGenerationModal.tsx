
import React, { useState } from 'react';
import { ScenesData, CharactersData, AIGeneratedScene, Character } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import { generateStorySkeleton } from '../utils/scheduler.ts';
import { fillStorySkeleton, generateCast } from '../utils/ai.ts';
import MilestoneSlider, { SliderOption } from './MilestoneSlider.tsx';

interface RuleBasedGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharactersData;
  onAddSceneStructure: (generated: { scenes: AIGeneratedScene[], connections: any, newCharacters?: Character[] }, sourceSceneId: string) => void;
  sourceSceneId: string;
}

const RuleBasedGenerationModal: React.FC<RuleBasedGenerationModalProps> = ({
  isOpen,
  onClose,
  characters,
  onAddSceneStructure,
  sourceSceneId
}) => {
  const { settings } = useSettings();
  const [prompt, setPrompt] = useState('');
  const [mainBranchSize, setMainBranchSize] = useState('10');
  const [splitBranchSize, setSplitBranchSize] = useState('3');
  const [splitProbability, setSplitProbability] = useState('1'); // Low
  const [decisionProbability, setDecisionProbability] = useState('1'); // Low
  const [shouldGenerateCast, setShouldGenerateCast] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const branchSizeOptions: SliderOption[] = [
      { value: '5', label: '5', description: 'Short' },
      { value: '10', label: '10', description: 'Standard' },
      { value: '15', label: '15', description: 'Long' },
      { value: '20', label: '20', description: 'Epic' },
  ];

  const subBranchOptions: SliderOption[] = [
      { value: '2', label: '2', description: 'Quick Detour' },
      { value: '3', label: '3', description: 'Short Arc' },
      { value: '5', label: '5', description: 'Full Sub-plot' },
  ];

  const probOptions: SliderOption[] = [
      { value: '0', label: 'None', description: '0%' },
      { value: '1', label: 'Low', description: '~10%' },
      { value: '2', label: 'Med', description: '~30%' },
      { value: '3', label: 'High', description: '~50%' },
  ];

  const mapProb = (val: string) => {
      switch(val) {
          case '0': return 0;
          case '1': return 0.15;
          case '2': return 0.35;
          case '3': return 0.55;
          default: return 0.15;
      }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
        setError("Please enter a story prompt/theme.");
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setStatus('Generating Structure Skeleton...');

    try {
        // 0. Generate Cast if requested
        let generatedCast: Character[] = [];
        let contextCharacters = { ...characters };

        if (shouldGenerateCast) {
             setStatus('Generating Cast...');
             generatedCast = await generateCast(settings, prompt);
             generatedCast.forEach(c => {
                 contextCharacters[c.id] = c;
             });
        }

        // 1. Generate Skeleton (Local Logic)
        setStatus('Scheduling Scenes...');
        const skeleton = generateStorySkeleton({
            mainBranchSize: parseInt(mainBranchSize),
            splitBranchSize: parseInt(splitBranchSize),
            splitProbability: mapProb(splitProbability),
            decisionProbability: mapProb(decisionProbability),
            prompt
        });

        // 2. Fill Content (AI)
        setStatus(`Generated ${skeleton.length} nodes. Flavoring content with AI...`);
        const enrichedScenes = await fillStorySkeleton(settings, skeleton, contextCharacters, prompt);

        // 3. Format for ingestion
        const firstSceneId = enrichedScenes[0].id;

        // We need to build the connections object manually from the skeleton
        const internalConnections = enrichedScenes
            .filter(scene => scene.outcome.type !== 'end_story') // App.tsx handles end_story automatically by appending default
            .map(scene => ({
                sourceSceneId: scene.id,
                outcome: scene.outcome
            }));

        const connections = {
            sourceSceneConnection: {
                type: 'transition',
                nextSceneId: firstSceneId
            },
            internalConnections: internalConnections
        };

        onAddSceneStructure({ scenes: enrichedScenes, connections, newCharacters: generatedCast }, sourceSceneId);
        onClose();

    } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
        setIsLoading(false);
    }
  };

  const commonFormElement = "w-full bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

  return (
    <div className="fixed inset-0 bg-onyx/70 z-50 flex items-center justify-center p-4 backdrop-blur-md" onMouseDown={onClose}>
        <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-border max-h-[90vh]" onMouseDown={e => e.stopPropagation()}>
            <header className="p-4 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="text-xl">📐</span>
                    <h2 className="text-xl font-bold">Rules-Based Story Scheduler</h2>
                </div>
                <button onClick={onClose} disabled={isLoading} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 disabled:opacity-50">&times;</button>
            </header>
            
            <div className="p-6 overflow-y-auto space-y-6">
                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded text-sm text-blue-800 dark:text-blue-200">
                    <p><strong>Emergent Story Engine:</strong> This tool generates a rigid story skeleton based on structural rules (Linear, Decision, Split, Terminal nodes) before filling it with AI content. This creates more consistent, structured narratives.</p>
                </div>

                <div>
                    <label className="block text-sm font-bold mb-1">Story Theme / Prompt</label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className={`${commonFormElement} h-20`}
                        placeholder="e.g. A cyberpunk detective story focusing on corporate corruption."
                        disabled={isLoading}
                    />
                </div>
                
                <div className="flex items-center bg-card/50 p-2 rounded border border-border">
                    <input 
                        type="checkbox"
                        id="gen-cast"
                        checked={shouldGenerateCast}
                        onChange={(e) => setShouldGenerateCast(e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring"
                        disabled={isLoading}
                    />
                    <label htmlFor="gen-cast" className="ml-2 block text-sm font-semibold text-foreground/90 cursor-pointer">
                        Generate New Cast based on Theme
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <MilestoneSlider 
                        label="Main Arc Length (Nodes)" 
                        value={mainBranchSize} 
                        onChange={setMainBranchSize} 
                        options={branchSizeOptions} 
                        disabled={isLoading}
                    />
                     <MilestoneSlider 
                        label="Split Branch Length" 
                        value={splitBranchSize} 
                        onChange={setSplitBranchSize} 
                        options={subBranchOptions} 
                        disabled={isLoading}
                    />
                     <MilestoneSlider 
                        label="Split Probability (Branching)" 
                        value={splitProbability} 
                        onChange={setSplitProbability} 
                        options={probOptions} 
                        disabled={isLoading}
                    />
                     <MilestoneSlider 
                        label="Decision Probability (Stats)" 
                        value={decisionProbability} 
                        onChange={setDecisionProbability} 
                        options={probOptions} 
                        disabled={isLoading}
                    />
                </div>

                {isLoading && (
                    <div className="text-center py-4 space-y-2">
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-sm font-semibold">{status}</p>
                    </div>
                )}
                
                {error && <p className="text-destructive text-sm font-semibold bg-destructive/10 p-2 rounded">{error}</p>}
            </div>

            <footer className="p-4 border-t border-border flex justify-end gap-2">
                <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">Cancel</button>
                <button 
                    onClick={handleGenerate} 
                    disabled={isLoading}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                    Generate Skeleton
                </button>
            </footer>
        </div>
    </div>
  );
};

export default RuleBasedGenerationModal;
