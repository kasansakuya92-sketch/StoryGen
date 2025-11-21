
import React, { useState, useRef, useEffect } from 'react';
import { exportProjectAsJson, exportStoryAsLegacyJson, exportStoryAsTwee, importStoryFromTwee } from '../utils/export.ts';
import { Project, Story, CharactersData } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';

interface ToolbarProps {
  activeProject: Project | null;
  activeStory?: Story | null; // Added activeStory
  onToggleCharManager: () => void;
  editorMode: 'FORM' | 'NODE';
  onToggleEditorMode: () => void;
  onOpenStoryPlanner: () => void;
  onGoToHub: () => void;
  onGoToSettings: () => void;
  onImportStory?: (story: Story, characters: CharactersData) => void;
}

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);


const Toolbar: React.FC<ToolbarProps> = ({ activeProject, activeStory, onToggleCharManager, editorMode, onToggleEditorMode, onOpenStoryPlanner, onGoToHub, onGoToSettings, onImportStory }) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    if (activeProject) {
      exportProjectAsJson(activeProject);
    }
    setIsExportMenuOpen(false);
  };

  const handleExportLegacy = () => {
      if (activeStory) {
          exportStoryAsLegacyJson(activeStory);
      } else {
          alert("Please select a specific story to export for the legacy engine.");
      }
      setIsExportMenuOpen(false);
  };

  const handleExportTwee = () => {
      if (activeStory) {
          exportStoryAsTwee(activeStory);
      } else {
          alert("Please select a specific story to export as Twee/SugarCube.");
      }
      setIsExportMenuOpen(false);
  };

  const handleImportTweeClick = () => {
      fileInputRef.current?.click();
      setIsExportMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeProject || !onImportStory) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const content = event.target?.result as string;
          try {
              const { story, characters } = importStoryFromTwee(content, activeProject.stories[Object.keys(activeProject.stories)[0]]?.characters || {});
              onImportStory(story, characters);
              alert("Story imported successfully!");
          } catch (err) {
              console.error(err);
              alert("Failed to import Twee file. Please check the format.");
          }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
  };

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
              setIsExportMenuOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <header className="flex-shrink-0 h-14 bg-card/60 backdrop-blur-md border-b border-border flex items-center justify-between px-4 z-30">
      <div className="flex items-center gap-4">
        <button onClick={onGoToHub} className="text-sm font-semibold text-foreground/80 hover:text-foreground">
          &larr; Back to Hub
        </button>
        <h1 className="text-xl font-bold text-foreground hidden md:block">Editor</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onOpenStoryPlanner}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50"
          disabled={!activeProject}
          title="AI Story Planner"
        >
          <span className="hidden sm:inline">✨ AI Story Planner</span>
           <span className="sm:hidden">✨ AI</span>
        </button>
        <button
          onClick={onToggleEditorMode}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90"
          title="Toggle View"
        >
          {editorMode === 'FORM' ? 'Node View' : 'Form View'}
        </button>
        <button
          onClick={onToggleCharManager}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90 disabled:opacity-50"
          disabled={!activeProject}
          title="Manage Characters"
        >
           <span className="hidden sm:inline">Characters</span>
           <span className="sm:hidden">Chars</span>
        </button>
        
        {/* Export Dropdown */}
        <div className="relative" ref={exportMenuRef}>
            <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            disabled={!activeProject}
            title="Export/Import Options"
            >
            File <span className="text-[10px]">▼</span>
            </button>
            {isExportMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-card border border-border rounded shadow-xl overflow-hidden flex flex-col z-50">
                    <button 
                        onClick={handleExportBackup} 
                        className="px-4 py-2 text-left text-sm hover:bg-secondary/30 text-foreground"
                    >
                        Export Project (.json)
                    </button>
                    <button 
                        onClick={handleExportLegacy} 
                        className="px-4 py-2 text-left text-sm hover:bg-secondary/30 text-foreground border-t border-border/50"
                    >
                        Export Legacy Engine
                    </button>
                    <button 
                        onClick={handleExportTwee} 
                        className="px-4 py-2 text-left text-sm hover:bg-secondary/30 text-foreground border-t border-border/50"
                    >
                        Export Twee
                    </button>
                     <button 
                        onClick={handleImportTweeClick} 
                        className="px-4 py-2 text-left text-sm hover:bg-secondary/30 text-foreground border-t border-border/50"
                    >
                        Import Twee
                    </button>
                </div>
            )}
        </div>
        
        <input 
            type="file" 
            accept=".twee,.tw,.txt" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
        />

        <div className="flex items-center gap-1">
          <button onClick={onGoToSettings} className="p-1.5 text-foreground/70 hover:text-foreground rounded-full hover:bg-secondary/50" title="Settings">
              <SettingsIcon />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Toolbar;
