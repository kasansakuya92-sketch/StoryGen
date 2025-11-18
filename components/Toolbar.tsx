

import React from 'react';
import { exportProjectAsJson } from '../utils/export.ts';
import { Project } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';
import AIIcon from './icons/AIIcon.tsx';

interface ToolbarProps {
  activeProject: Project | null;
  onToggleCharManager: () => void;
  onToggleVarManager: () => void;
  onToggleAssetManager: () => void;
  editorMode: 'FORM' | 'NODE' | 'DOC';
  onToggleEditorMode: () => void;
  onOpenStoryPlanner: () => void;
  onGoToHub: () => void;
  onGoToSettings: () => void;
}

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);


const Toolbar: React.FC<ToolbarProps> = ({ activeProject, onToggleCharManager, onToggleVarManager, onToggleAssetManager, editorMode, onToggleEditorMode, onOpenStoryPlanner, onGoToHub, onGoToSettings }) => {
  const handleExport = () => {
    if (activeProject) {
      exportProjectAsJson(activeProject);
    } else {
      alert("No active project to export.");
    }
  };

  const getNextViewName = () => {
    if (editorMode === 'FORM') return 'Node View';
    if (editorMode === 'NODE') return 'Doc View';
    return 'Form View';
  };
  
  return (
    <header className="flex-shrink-0 h-14 bg-card/60 backdrop-blur-md border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <button onClick={onGoToHub} className="text-sm font-semibold text-foreground/80 hover:text-foreground">
          &larr; Back to Hub
        </button>
        <h1 className="text-xl font-bold text-foreground hidden md:block">Editor</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={onOpenStoryPlanner}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
          disabled={!activeProject}
          title="AI Story Planner"
        >
          <AIIcon className="w-4 h-4" />
          <span className="hidden sm:inline">AI Story Planner</span>
           <span className="sm:hidden">AI</span>
        </button>
        <button
          onClick={onToggleEditorMode}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90"
          title="Toggle View"
        >
          {getNextViewName()}
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
        <button
          onClick={onToggleVarManager}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90 disabled:opacity-50"
          disabled={!activeProject}
          title="Manage Variables"
        >
           <span className="hidden sm:inline">Variables</span>
           <span className="sm:hidden">Vars</span>
        </button>
        <button
          onClick={onToggleAssetManager}
          className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs rounded hover:bg-secondary/90 disabled:opacity-50"
          disabled={!activeProject}
          title="Manage Backgrounds"
        >
           <span className="hidden sm:inline">Assets</span>
           <span className="sm:hidden">Img</span>
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 disabled:opacity-50"
          disabled={!activeProject}
          title="Export Project as JSON"
        >
          Export
        </button>
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
