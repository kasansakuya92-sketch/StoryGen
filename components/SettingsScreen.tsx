
import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext.tsx';
import { exportProjectAsJson } from '../utils/export.ts';
import { Settings, ProjectsData } from '../types.ts';
import { testLocalAIEndpoint } from '../utils/localAI.ts';


interface SettingsScreenProps {
  onBack: () => void;
  projects: ProjectsData;
  onResetData: () => void;
}

const SettingsCard: React.FC<{ title: string; description: string; children: React.ReactNode; }> = ({ title, description, children }) => (
  <div className="bg-card/50 backdrop-blur-md p-6 rounded-lg border border-border">
    <h3 className="text-lg font-bold text-card-foreground">{title}</h3>
    <p className="text-sm text-card-foreground/70 mt-1 mb-4">{description}</p>
    <div className="space-y-3">{children}</div>
  </div>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, projects, onResetData }) => {
  const { settings, updateSettings } = useSettings();
  const [localAIStatus, setLocalAIStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [localAIStatusMessage, setLocalAIStatusMessage] = useState<string>('');


  const handleSettingChange = (key: keyof Settings, value: string) => {
    updateSettings({ [key]: value });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingChange('localModelUrl', e.target.value);
    setLocalAIStatus('idle');
    setLocalAIStatusMessage('');
  };

  const handleTestConnection = async () => {
    setLocalAIStatus('testing');
    setLocalAIStatusMessage('Testing connection...');
    const result = await testLocalAIEndpoint(settings.localModelUrl);
    if (result.ok) {
        setLocalAIStatus('success');
    } else {
        setLocalAIStatus('error');
    }
    setLocalAIStatusMessage(result.message);
  };

  const handleExportAll = () => {
    const allProjects = { projects };
    const jsonString = JSON.stringify(allProjects, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `visual_novel_engine_all_projects.json`;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleResetData = () => {
    onResetData();
    // Also clear settings from local storage
    localStorage.removeItem('vn_settings');
    // Reload to apply default settings
    window.location.reload();
  };

  const statusClasses = {
    idle: { container: 'hidden', dot: '', text: '' },
    testing: {
        container: 'bg-secondary/20',
        dot: 'bg-secondary animate-pulse',
        text: 'text-foreground/80'
    },
    success: {
        container: 'bg-green-500/20',
        dot: 'bg-green-500',
        text: 'text-green-800 dark:text-green-300'
    },
    error: {
        container: 'bg-destructive/20',
        dot: 'bg-destructive',
        text: 'text-red-800 dark:text-red-300'
    }
  };

  const currentStatus = statusClasses[localAIStatus];
  const commonFormElement = "mt-1 block w-full bg-background border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";


  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-12 flex items-center gap-4">
          <button onClick={onBack} className="text-sm font-semibold text-foreground/80 hover:text-foreground p-2 rounded-full hover:bg-card/50">
            &larr; Back to Hub
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Settings</h1>
        </header>

        <div className="space-y-6">
           {/* About Section */}
           <SettingsCard title="About & System Logic" description="How prompts become playable stories.">
              <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
                  <div className="bg-card p-4 rounded border border-border/50">
                      <h4 className="font-bold text-primary mb-2 text-base">1. The Core Concept</h4>
                      <p>This engine treats a Visual Novel as a <strong>Directed Graph</strong>. Each "Scene" is a Node, and every transition or choice is an Edge connecting them. The AI's primary job is to generate JSON data that describes these nodes and their connections, which the ReactFlow engine then renders visually.</p>
                  </div>

                  <div className="bg-card p-4 rounded border border-border/50">
                      <h4 className="font-bold text-primary mb-2 text-base">2. Generation Strategies</h4>
                      <div className="space-y-3">
                          <div>
                              <strong className="text-foreground">A. AI Story Planner (Top-Down)</strong>
                              <div className="text-xs text-foreground/60 font-mono mt-0.5 mb-1">Input: "A mystery in a mansion" -> Output: Full JSON Plan</div>
                              <p>The LLM generates a complete list of scenes and characters in a single pass. The app iterates through this list, creating Scene Nodes and calculating grid positions (X, Y) to layout the graph automatically.</p>
                          </div>
                          <div className="border-t border-border/30 pt-2">
                              <strong className="text-foreground">B. Structure Generator (Context-Aware)</strong>
                              <div className="text-xs text-foreground/60 font-mono mt-0.5 mb-1">Input: Source Scene + "Add a fight" -> Output: Sub-graph</div>
                              <p>The LLM reads the <em>previous</em> scene's summary to understand context. It then generates a small cluster of new nodes (e.g., a Choice Node linking to two Outcome Nodes) and stitches them onto the existing graph.</p>
                          </div>
                          <div className="border-t border-border/30 pt-2">
                              <strong className="text-foreground">C. Rule-Based Scheduler (Hybrid)</strong>
                              <div className="text-xs text-foreground/60 font-mono mt-0.5 mb-1">Input: Probabilities -> Skeleton -> Output: Flavored Content</div>
                              <p>This is the most robust method:</p>
                              <ol className="list-decimal pl-5 mt-1 space-y-1">
                                  <li><strong>Skeleton Gen:</strong> A deterministic algorithm (`utils/scheduler.ts`) builds a graph structure using pure logic (Linear vs. Split nodes). This guarantees a valid shape.</li>
                                  <li><strong>Flavoring:</strong> This blank skeleton is sent to the LLM. The LLM fills in names, descriptions, and choice text based on your prompt, without breaking the pre-calculated connections.</li>
                              </ol>
                          </div>
                      </div>
                  </div>

                  <div className="bg-card p-4 rounded border border-border/50">
                      <h4 className="font-bold text-primary mb-2 text-base">3. From Text to Gameplay</h4>
                      <p>Once nodes are generated, the <strong>Game Screen</strong> acts as an interpreter. It reads the current Scene Node's <code>dialogue</code> array line-by-line. When it hits a 'choice' object, it pauses the interpreter and waits for user input. Selecting a choice updates the <code>currentSceneId</code> pointer, moving the player to the next node in the graph.</p>
                  </div>
              </div>
           </SettingsCard>

           <SettingsCard title="AI Provider" description="Choose a service for generating story content.">
            <div>
              <label htmlFor="aiProvider" className="block text-sm font-medium text-foreground/80">Provider</label>
              <select
                id="aiProvider"
                value={settings.aiProvider}
                onChange={(e) => handleSettingChange('aiProvider', e.target.value)}
                className={commonFormElement}
              >
                <option value="google">Google AI (Cloud)</option>
                <option value="local">Local Model (GGUF)</option>
              </select>
            </div>
            {settings.aiProvider === 'local' && (
               <div>
                <label htmlFor="localModelUrl" className="block text-sm font-medium text-foreground/80">Local Model URL</label>
                <div className="mt-1 flex items-stretch gap-2">
                 <input
                  type="text"
                  id="localModelUrl"
                  value={settings.localModelUrl}
                  onChange={handleUrlChange}
                  placeholder="e.g., http://localhost:11434/v1/chat/completions"
                  className={commonFormElement}
                />
                 <button 
                    onClick={handleTestConnection} 
                    disabled={localAIStatus === 'testing' || !settings.localModelUrl}
                    className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {localAIStatus === 'testing' ? 'Testing...' : 'Test'}
                </button>
                </div>
                <p className="text-xs text-foreground/60 mt-1">The OpenAI-compatible endpoint for your local model server (like Ollama).</p>
                
                <div className={`mt-2 text-xs p-2 rounded-md flex items-center gap-2 ${currentStatus.container}`}>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${currentStatus.dot}`}></div>
                    <span className={currentStatus.text}>{localAIStatusMessage}</span>
                </div>

              </div>
            )}
          </SettingsCard>

          <SettingsCard title="Appearance" description="Customize the look and feel of the application.">
            <div>
              <label htmlFor="theme" className="block text-sm font-medium text-foreground/80">Theme</label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className={commonFormElement}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </SettingsCard>

          <SettingsCard title="Game Play" description="Adjust the in-game reading experience.">
            <div>
              <label htmlFor="typingSpeed" className="block text-sm font-medium text-foreground/80">Dialogue Typing Speed</label>
              <select
                id="typingSpeed"
                value={settings.typingSpeed}
                onChange={(e) => handleSettingChange('typingSpeed', e.target.value)}
                className={commonFormElement}
              >
                <option value="Slow">Slow</option>
                <option value="Normal">Normal</option>
                <option value="Fast">Fast</option>
              </select>
            </div>
             <div>
              <label htmlFor="textSize" className="block text-sm font-medium text-foreground/80">Dialogue Text Size</label>
              <select
                id="textSize"
                value={settings.textSize}
                onChange={(e) => handleSettingChange('textSize', e.target.value)}
                className={commonFormElement}
              >
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>
          </SettingsCard>
          
           <SettingsCard title="Data Management" description="Export your work or reset the application.">
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={handleExportAll}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90"
                    >
                        Export All Projects
                    </button>
                    <button 
                        onClick={handleResetData}
                        className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-destructive/90"
                    >
                        Reset All Data
                    </button>
                </div>
           </SettingsCard>
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
