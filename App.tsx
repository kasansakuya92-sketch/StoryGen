

import React, { useState, useCallback, useEffect } from 'react';
import GameScreen from './components/GameScreen.tsx';
import StartScreen from './components/StartScreen.tsx';
import EndScreen from './components/EndScreen.tsx';
import ProjectExplorer from './components/ProjectExplorer.tsx';
import SceneEditor from './components/SceneEditor.tsx';
import CharacterManager from './components/CharacterManager.tsx';
import Toolbar from './components/Toolbar.tsx';
import NodeEditorView from './components/NodeEditorView.tsx';
import AIStoryPlanner from './components/AIStoryPlanner.tsx';
import ProjectsHub from './components/ProjectsHub.tsx';
import SettingsScreen from './components/SettingsScreen.tsx';
import VariableManager from './components/VariableManager.tsx';
import { initialProjectsData } from './story.ts';
import { Scene, ScenesData, CharactersData, ProjectsData, Story, AIGeneratedScene, DialogueItem, SceneCharacter } from './types.ts';
import { SettingsProvider, useSettings } from './contexts/SettingsContext.tsx';

type GameState = 'start' | 'playing' | 'end';
type AppView = 'hub' | 'editor' | 'game' | 'settings';
type EditorMode = 'FORM' | 'NODE';

const AppContent: React.FC = () => {
  const { settings } = useSettings();
   // Project-based State - using a function to read from localStorage lazily
  const [projects, setProjects] = useState<ProjectsData>(() => {
    try {
      const savedProjects = localStorage.getItem('vn_projects');
      return savedProjects ? JSON.parse(savedProjects) : initialProjectsData;
    } catch (error) {
      console.error("Could not parse projects from localStorage", error);
      return initialProjectsData;
    }
  });

  // Effect to save projects to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('vn_projects', JSON.stringify(projects));
    } catch (error) {
      console.error("Could not save projects to localStorage", error);
    }
  }, [projects]);
  
  // Safely initialize active project and story IDs
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  
  // Top-level View State
  const [appView, setAppView] = useState<AppView>('hub');
  
  // Game State
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentSceneId, setCurrentSceneId] = useState<string>(''); // Will be set on game start

  // Editor State
  const [editorMode, setEditorMode] = useState<EditorMode>('FORM');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isCharManagerOpen, setIsCharManagerOpen] = useState(false);
  const [isVariableManagerOpen, setIsVariableManagerOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState(false);

  // Derived State
  const activeProject = activeProjectId ? projects[activeProjectId] : null;
  const activeStory = activeProject && activeStoryId ? activeProject.stories[activeStoryId] : null;
  const activeScenes = activeStory?.scenes || null;
  const activeCharacters = activeStory?.characters || null;
  
  // EFFECT: Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // EFFECT: Sync active story when active project changes
  useEffect(() => {
    if (activeProject) {
      const storyExistsInProject = activeStoryId && activeProject.stories[activeStoryId];
      if (!storyExistsInProject) {
        const firstStoryId = Object.keys(activeProject.stories)[0] || null;
        setActiveStoryId(firstStoryId);
      }
    } else if (appView === 'editor') { // only nullify if we are not in hub
      setActiveStoryId(null);
    }
  }, [activeProjectId, activeProject, activeStoryId, appView]);

  // EFFECT: Sync selected scene when active story changes
  useEffect(() => {
    if (activeStory) {
      const sceneExistsInStory = selectedSceneId && activeStory.scenes[selectedSceneId];
      if (!sceneExistsInStory) {
        setSelectedSceneId(Object.keys(activeStory.scenes)[0] || null);
      }
    } else {
      // When there's no story, there's no selected scene
      setSelectedSceneId(null);
    }
  }, [activeStory, selectedSceneId]);


  // Navigation Handlers
  const handleOpenEditor = useCallback((projectId: string) => {
    setActiveProjectId(projectId);
    setAppView('editor');
  }, []);

  const handlePlayProject = useCallback((projectId: string) => {
    const project = projects[projectId];
    if (!project) return;
    const firstStoryId = Object.keys(project.stories)[0] || null;

    if (!firstStoryId) {
        alert("This project has no stories to play.");
        return;
    }

    setActiveProjectId(projectId);
    setActiveStoryId(firstStoryId);
    setGameState('start');
    setAppView('game');
  }, [projects]);
  
  const handleGoToHub = useCallback(() => {
    setActiveProjectId(null);
    setActiveStoryId(null);
    setGameState('start');
    setAppView('hub');
  }, []);
  
  const handleGoToSettings = useCallback(() => {
    setAppView('settings');
  }, []);

  const handleOpenEditorFromGame = useCallback(() => {
    setAppView('editor');
    setGameState('start');
  }, []);


  // Game Handlers
  const handleStart = useCallback(() => {
    if (activeStory) {
      setCurrentSceneId(activeStory.startSceneId);
      setGameState('playing');
    } else {
      alert("No story selected to play!");
    }
  }, [activeStory]);

  const handleEnd = useCallback(() => setGameState('end'), []);
  const handleRestart = useCallback(() => setGameState('start'), []);

  const handleNavigate = useCallback((nextSceneId: string) => {
    if (activeScenes && activeScenes[nextSceneId]) {
      setCurrentSceneId(nextSceneId);
    } else {
      console.error(`Scene with id "${nextSceneId}" not found.`);
      setGameState('end');
    }
  }, [activeScenes]);

  // Project/Story Selection Handlers
  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
  };

  const handleSelectStory = (id: string) => {
    setActiveStoryId(id);
  };


  // Editor Handlers
  const handleUpdateScene = useCallback((sceneId: string, updatedScene: Partial<Scene>) => {
    if (!activeProjectId || !activeStoryId) return;
    setProjects(prev => {
      const project = prev[activeProjectId];
      if (!project) return prev; 

      const story = project.stories[activeStoryId];
      if (!story) return prev;

      const scene = story.scenes[sceneId];
      if (!scene) return prev;
      
      const newScenes = {
          ...story.scenes,
          [sceneId]: { ...scene, ...updatedScene }
      };
      const newStory = { ...story, scenes: newScenes };
      const newStories = { ...project.stories, [activeStoryId]: newStory };
      const newProject = { ...project, stories: newStories };
      
      return {
          ...prev,
          [activeProjectId]: newProject
      };
    });
  }, [activeProjectId, activeStoryId]);

  const handleAddScene = useCallback((storyId: string) => {
    if (!activeProjectId) return;
    const newId = `scene_${Date.now()}`;
    const newScene: Scene = {
      id: newId,
      name: 'New Scene',
      background: '',
      characters: [],
      dialogue: [{ type: 'end_story' }], // Add a default end_story so it can be connected from
      position: { x: 100, y: 100 }
    };
    setProjects(prev => {
        const project = prev[activeProjectId];
        if (!project) return prev;

        const story = project.stories[storyId];
        if (!story) return prev;

        const newScenes = { ...story.scenes, [newId]: newScene };
        const newStory = { ...story, scenes: newScenes };
        const newStories = { ...project.stories, [storyId]: newStory };
        const newProject = { ...project, stories: newStories };
        return { ...prev, [activeProjectId]: newProject };
    });
    setSelectedSceneId(newId);
  }, [activeProjectId]);
  
  const handleAddStory = (projectId: string) => {
      const newId = `story_${Date.now()}`;
      const newStory: Story = {
          id: newId,
          name: 'New Story',
          characters: {},
          startSceneId: 'start',
          scenes: {
              'start': { id: 'start', name: 'Start Scene', background: '', characters: [], dialogue: [{type: 'end_story'}], position: {x: 100, y: 100}}
          }
      };
      setProjects(prev => {
          const project = prev[projectId];
          if (!project) return prev;

          const newStories = { ...project.stories, [newId]: newStory };
          const newProject = { ...project, stories: newStories };
          return { ...prev, [projectId]: newProject };
      });
      setActiveStoryId(newId);
  };
  
  const handleAddProject = () => {
    const newId = `proj_${Date.now()}`;
    const newProject = {
        id: newId,
        name: 'New Project',
        stories: {},
        variables: []
    };
    setProjects(prev => ({
        ...prev,
        [newId]: newProject
    }));
    return newId;
  };
  
  const handleAddNewProjectAndEdit = () => {
    const newId = handleAddProject();
    handleOpenEditor(newId);
  };

  const handleDeleteProject = (projectId: string) => {
    // The confirmation is handled in the UI component, here we just process the deletion.
    setProjects(prev => {
      const newProjects = { ...prev };
      delete newProjects[projectId];
      return newProjects;
    });

    // If the deleted project was the active one, clear active IDs.
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setActiveStoryId(null);
    }
  };

  const handleUpdateProjectName = (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjects(prev => {
      const project = prev[projectId];
      if (!project) return prev;
      
      const updatedProject = { ...project, name: newName };
      
      return {
        ...prev,
        [projectId]: updatedProject
      };
    });
  };
  
  const handleUpdateVariables = useCallback((variables: string[]) => {
      if(!activeProjectId) return;
      setProjects(prev => {
          const project = prev[activeProjectId];
          if(!project) return prev;
          return {
              ...prev,
              [activeProjectId]: { ...project, variables }
          };
      });
  }, [activeProjectId]);

  const handleUpdateStoryName = (storyId: string, projectId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjects(prev => {
        const project = prev[projectId];
        if (!project) return prev;

        const story = project.stories[storyId];
        if (!story) return prev;

        const newStory = { ...story, name: newName };
        const newStories = { ...project.stories, [storyId]: newStory };
        const newProject = { ...project, stories: newStories };
        return { ...prev, [projectId]: newProject };
    });
  };
  
  const handleUpdateSceneName = useCallback((sceneId: string, storyId: string, projectId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjects(prev => {
      const project = prev[projectId];
      if (!project) return prev;

      const story = project.stories[storyId];
      if (!story) return prev;

      const scene = story.scenes[sceneId];
      if (!scene) return prev;

      const newScene = { ...scene, name: newName };
      const newScenes = { ...story.scenes, [sceneId]: newScene };
      const newStory = { ...story, scenes: newScenes };
      const newStories = { ...project.stories, [storyId]: newStory };
      const newProject = { ...project, stories: newStories };

      return { ...prev, [projectId]: newProject };
    });
  }, []);

  const handleDeleteScene = useCallback((sceneId: string) => {
    if (!activeProjectId || !activeStoryId || !activeScenes || Object.keys(activeScenes).length <= 1) {
      alert("Cannot delete the last scene.");
      return;
    }
    setProjects(prev => {
        const project = prev[activeProjectId];
        if (!project) return prev;

        const story = project.stories[activeStoryId];
        if (!story) return prev;

        const newScenes = { ...story.scenes };
        delete newScenes[sceneId];

        Object.values(newScenes).forEach((scene: Scene) => {
            scene.dialogue.forEach(item => {
                if (item.type === 'transition' && item.nextSceneId === sceneId) {
                    item.nextSceneId = ''; 
                }
                if (item.type === 'choice') {
                    item.choices.forEach(choice => {
                        if (choice.nextSceneId === sceneId) {
                            choice.nextSceneId = '';
                        }
                    });
                }
            });
        });
        
        let newStory = { ...story, scenes: newScenes };
        
        if (story.startSceneId === sceneId) {
            newStory.startSceneId = Object.keys(newScenes)[0] || '';
        }

        const newStories = { ...project.stories, [activeStoryId]: newStory };
        const newProject = { ...project, stories: newStories };
        return { ...prev, [activeProjectId]: newProject };
    });

    if (sceneId === selectedSceneId) {
      const remainingScenes = activeScenes ? Object.keys(activeScenes).filter(id => id !== sceneId) : [];
      setSelectedSceneId(remainingScenes[0] || null);
    }
  }, [activeProjectId, activeStoryId, activeScenes, selectedSceneId]);
  
  const handleDeleteStory = (storyId: string, projectId: string) => {
    setProjects(prev => {
        const project = prev[projectId];
        if (!project) return prev;

        const newStories = { ...project.stories };
        delete newStories[storyId];
        
        const newProject = { ...project, stories: newStories };
        return { ...prev, [projectId]: newProject };
    });

    if (storyId === activeStoryId) {
        const project = projects[projectId];
        const remainingStoryIds = Object.keys(project.stories).filter(id => id !== storyId);
        setActiveStoryId(remainingStoryIds[0] || null);
    }
  };

  const handleUpdateCharacters = useCallback((updatedCharacters: CharactersData) => {
      if(!activeProjectId || !activeStoryId) return;
      setProjects(prev => {
          const project = prev[activeProjectId];
          if (!project) return prev;
          
          const story = project.stories[activeStoryId];
          if (!story) return prev;

          const newStory = { ...story, characters: updatedCharacters };
          const newStories = { ...project.stories, [activeStoryId]: newStory };
          const newProject = { ...project, stories: newStories };
          
          return { ...prev, [activeProjectId]: newProject };
      });
  }, [activeProjectId, activeStoryId]);

  const handlePlanGenerated = (plan: { name: string, scenes: ScenesData, characters: CharactersData }) => {
    if (!activeProjectId) return;
    const newStoryId = `story_${Date.now()}`;
    const newStory: Story = {
        id: newStoryId,
        name: plan.name || "New AI Story",
        scenes: plan.scenes,
        characters: plan.characters,
        startSceneId: Object.keys(plan.scenes)[0] || ''
    };
    setProjects(prev => {
        const project = prev[activeProjectId];
        if (!project) return prev;
        
        return {
            ...prev,
            [activeProjectId]: {
                ...project,
                stories: { ...project.stories, [newStoryId]: newStory }
            }
        };
    });
    setActiveStoryId(newStoryId);
  };
  
  const handleImportStory = (importedStory: Story, newCharacters: CharactersData) => {
      if (!activeProjectId) return;
      
      setProjects(prev => {
          const project = prev[activeProjectId];
          if (!project) return prev;

          // Merge characters
          const mergedStory = {
              ...importedStory,
              characters: { ...newCharacters } 
          };

          const newStories = { ...project.stories, [importedStory.id]: mergedStory };
          const newProject = { ...project, stories: newStories };
          return { ...prev, [activeProjectId]: newProject };
      });
      setActiveStoryId(importedStory.id);
  };

    const handleAddSceneStructure = useCallback((generated: { scenes: AIGeneratedScene[], connections: any }, sourceSceneId: string) => {
        if (!activeProjectId || !activeStoryId) return;

        setProjects(prev => {
            const project = prev[activeProjectId];
            if (!project) return prev;
            const story = project.stories[activeStoryId];
            if (!story) return prev;

            const newScenesData = { ...story.scenes };
            const sourceScene = newScenesData[sourceSceneId];
            if (!sourceScene) return prev;

            const tempIdToNewId: Record<string, string> = {};
            generated.scenes.forEach(tempScene => {
                const newId = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                tempIdToNewId[tempScene.id] = newId;
            });

            const sourcePos = sourceScene.position || { x: 0, y: 0 };
            generated.scenes.forEach((tempScene, index) => {
                const newId = tempIdToNewId[tempScene.id];
                const newScene: Scene = {
                    id: newId,
                    name: tempScene.name,
                    description: tempScene.description,
                    background: `https://picsum.photos/seed/bg-${newId}/1920/1080`,
                    characters: tempScene.characterIds
                        .filter(id => story.characters[id])
                        .map((id, charIndex) => ({
                            characterId: id,
                            spriteId: 'normal',
                            position: charIndex === 0 ? 'left' : 'right',
                        } as SceneCharacter)),
                    dialogue: [...tempScene.dialogue, { type: 'end_story' }],
                    position: { x: sourcePos.x + 300 + (index * 50), y: sourcePos.y + (index * 150) - 100 },
                };
                newScenesData[newId] = newScene;
            });
            
            const sourceConnection = generated.connections.sourceSceneConnection;
            let newSourceOutcome: DialogueItem;
            if (sourceConnection.type === 'transition') {
                newSourceOutcome = {
                    type: 'transition',
                    nextSceneId: tempIdToNewId[sourceConnection.nextSceneId],
                };
            } else { 
                newSourceOutcome = {
                    type: 'choice',
                    choices: (sourceConnection.choices || []).map((c: any) => ({
                        text: c.text,
                        nextSceneId: tempIdToNewId[c.nextSceneId]
                    }))
                };
            }
            
            const newSourceDialogue = [...sourceScene.dialogue];
            const outcomeIndex = newSourceDialogue.findIndex(d => d.type !== 'text');
            if (outcomeIndex !== -1) {
                newSourceDialogue[outcomeIndex] = newSourceOutcome;
            } else {
                newSourceDialogue.push(newSourceOutcome);
            }
            newScenesData[sourceSceneId] = { ...sourceScene, dialogue: newSourceDialogue };

            if (generated.connections.internalConnections) {
                generated.connections.internalConnections.forEach((conn: any) => {
                    const internalSourceId = tempIdToNewId[conn.sourceSceneId];
                    const internalSourceScene = newScenesData[internalSourceId];
                    if (internalSourceScene) {
                        const newDialogue = [...internalSourceScene.dialogue];
                        const outcomeIndex = newDialogue.findIndex(d => d.type === 'end_story');
                        
                        let internalOutcome: DialogueItem;
                        if (conn.outcome.type === 'transition') {
                             internalOutcome = {
                                type: 'transition',
                                nextSceneId: tempIdToNewId[conn.outcome.nextSceneId],
                             };
                        } else { 
                             internalOutcome = {
                                type: 'choice',
                                choices: (conn.outcome.choices || []).map((c: any) => ({
                                    text: c.text,
                                    nextSceneId: tempIdToNewId[c.nextSceneId]
                                }))
                            };
                        }

                        if (outcomeIndex !== -1) {
                            newDialogue[outcomeIndex] = internalOutcome;
                        } else {
                            newDialogue.push(internalOutcome);
                        }
                        newScenesData[internalSourceId] = { ...internalSourceScene, dialogue: newDialogue };
                    }
                });
            }

            const newStory = { ...story, scenes: newScenesData };
            const newStories = { ...project.stories, [activeStoryId]: newStory };
            const newProject = { ...project, stories: newStories };

            return { ...prev, [activeProjectId]: newProject };
        });
    }, [activeProjectId, activeStoryId]);


  const selectedSceneForEditor = selectedSceneId && activeScenes ? activeScenes[selectedSceneId] : null;

  const renderGame = () => {
    if (!activeStory || !activeScenes || !activeCharacters) return <StartScreen onStart={handleStart} onGoToHub={handleGoToHub} />;
    const currentScene = activeScenes[currentSceneId];
    switch (gameState) {
      case 'start':
        return <StartScreen onStart={handleStart} onGoToHub={handleGoToHub}/>;
      case 'playing':
        return currentScene ? <GameScreen scene={currentScene} characters={activeCharacters} onNavigate={handleNavigate} onEnd={handleEnd} onOpenEditor={handleOpenEditorFromGame}/> : <EndScreen onRestart={handleRestart} onGoToHub={handleGoToHub} />;
      case 'end':
        return <EndScreen onRestart={handleRestart} onGoToHub={handleGoToHub} />;
      default:
        return <StartScreen onStart={handleStart} onGoToHub={handleGoToHub} />;
    }
  };

  const renderEditor = () => (
    <div className="w-full h-full flex flex-col bg-transparent">
      <Toolbar
        activeProject={activeProject}
        activeStory={activeStory}
        onToggleCharManager={() => setIsCharManagerOpen(true)}
        onToggleVariableManager={() => setIsVariableManagerOpen(true)}
        editorMode={editorMode}
        onToggleEditorMode={() => setEditorMode(prev => prev === 'FORM' ? 'NODE' : 'FORM')}
        onOpenStoryPlanner={() => setIsPlannerOpen(true)}
        onGoToHub={handleGoToHub}
        onGoToSettings={handleGoToSettings}
        onImportStory={handleImportStory}
      />
      <div className="flex-grow flex overflow-hidden">
        <ProjectExplorer
          projects={projects}
          activeProjectId={activeProjectId}
          activeStoryId={activeStoryId}
          selectedSceneId={selectedSceneId}
          onSelectProject={handleSelectProject}
          onSelectStory={handleSelectStory}
          onSelectScene={setSelectedSceneId}
          onAddProject={() => handleAddProject()}
          onAddStory={handleAddStory}
          onAddScene={handleAddScene}
          onUpdateProjectName={handleUpdateProjectName}
          onUpdateStoryName={handleUpdateStoryName}
          onUpdateSceneName={handleUpdateSceneName}
          onDeleteScene={handleDeleteScene}
          onDeleteStory={handleDeleteStory}
          isCollapsed={isExplorerCollapsed}
          onToggleCollapse={() => setIsExplorerCollapsed(p => !p)}
        />
        {activeStory && selectedSceneForEditor && activeScenes && activeCharacters ? (
          <>
            {editorMode === 'FORM' && (
              <SceneEditor
                key={selectedSceneId}
                scene={selectedSceneForEditor}
                scenes={activeScenes}
                characters={activeCharacters}
                variables={activeProject?.variables || []}
                onUpdateScene={handleUpdateScene}
              />
            )}
            {editorMode === 'NODE' && (
              <NodeEditorView
                scenes={activeScenes}
                characters={activeCharacters}
                onUpdateScene={handleUpdateScene}
                activeStoryId={activeStoryId}
                onAddScene={handleAddScene}
                onDeleteScene={handleDeleteScene}
                onAddSceneStructure={handleAddSceneStructure}
              />
            )}
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center text-foreground/70 text-center p-4">
            <p>Select a story and scene to begin editing, or create a new project.</p>
          </div>
        )}
      </div>
      {isCharManagerOpen && activeCharacters && (
        <CharacterManager
          characters={activeCharacters}
          onUpdateCharacters={handleUpdateCharacters}
          onClose={() => setIsCharManagerOpen(false)}
          activeProject={activeProject}
        />
      )}
      {isVariableManagerOpen && activeProject && (
        <VariableManager
          variables={activeProject.variables || []}
          onUpdateVariables={handleUpdateVariables}
          onClose={() => setIsVariableManagerOpen(false)}
        />
      )}
      {isPlannerOpen && activeProject && (
        <AIStoryPlanner 
            onPlanGenerated={handlePlanGenerated} 
            onClose={() => setIsPlannerOpen(false)}
        />
      )}
    </div>
  );

  const renderAppView = () => {
    switch(appView) {
      case 'hub':
        return <ProjectsHub projects={projects} onOpenEditor={handleOpenEditor} onPlayProject={handlePlayProject} onAddNewProject={handleAddNewProjectAndEdit} onGoToSettings={handleGoToSettings} onDeleteProject={handleDeleteProject}/>;
      case 'editor':
        return renderEditor();
      case 'game':
        return renderGame();
      case 'settings':
        return <SettingsScreen onBack={handleGoToHub} projects={projects} onResetData={() => setProjects(initialProjectsData)} />;
      default:
        return <div>Error: Invalid view</div>;
    }
  };

  return (
    <main className="w-screen h-screen bg-background text-foreground font-sans">
      {renderAppView()}
    </main>
  );
};


const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};


export default App;
