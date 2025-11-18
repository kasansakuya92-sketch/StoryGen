import React, { useState, useEffect, useRef } from 'react';
import { ProjectsData, Project, Story, Scene } from '../types.ts';

interface ProjectExplorerProps {
  projects: ProjectsData;
  activeProjectId: string | null;
  activeStoryId: string | null;
  selectedSceneId: string | null;
  onSelectProject: (id: string) => void;
  onSelectStory: (id: string) => void;
  onSelectScene: (id: string) => void;
  onAddProject: () => void;
  onAddStory: (projectId: string) => void;
  onAddScene: (storyId: string) => void;
  onUpdateProjectName: (id: string, newName: string) => void;
  onUpdateStoryName: (storyId: string, projectId: string, newName: string) => void;
  onUpdateSceneName: (sceneId: string, storyId: string, projectId: string, newName: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onDeleteStory: (storyId: string, projectId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);

const ChevronLeftIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>);
const ChevronRightIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>);


const ProjectExplorer: React.FC<ProjectExplorerProps> = ({
  projects,
  activeProjectId,
  activeStoryId,
  selectedSceneId,
  onSelectProject,
  onSelectStory,
  onSelectScene,
  onAddProject,
  onAddStory,
  onAddScene,
  onUpdateProjectName,
  onUpdateStoryName,
  onUpdateSceneName,
  onDeleteScene,
  onDeleteStory,
  isCollapsed,
  onToggleCollapse
}) => {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ [activeProjectId || '']: true });
  const [expandedStories, setExpandedStories] = useState<Record<string, boolean>>({ [activeStoryId || '']: true });
  
  const [editing, setEditing] = useState<{ type: 'project' | 'story' | 'scene', id: string, storyId?: string, projectId?: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEditing = (type: 'project' | 'story' | 'scene', id: string, initialValue: string, storyId?: string, projectId?: string) => {
    setEditing({ type, id, storyId, projectId });
    setEditingValue(initialValue);
  };

  const handleCancelEditing = () => {
    setEditing(null);
    setEditingValue('');
  };

  const handleSaveEdit = () => {
    if (!editing) return;

    if (editingValue.trim()) {
        if (editing.type === 'project') {
            onUpdateProjectName(editing.id, editingValue);
        } else if (editing.type === 'story' && editing.projectId) {
            onUpdateStoryName(editing.id, editing.projectId, editingValue);
        } else if (editing.type === 'scene' && editing.storyId && editing.projectId) {
            onUpdateSceneName(editing.id, editing.storyId, editing.projectId, editingValue);
        }
    }
    handleCancelEditing();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      handleCancelEditing();
    }
  };


  const toggleProject = (id: string) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStory = (id: string) => {
    setExpandedStories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className={`flex-shrink-0 bg-card/60 backdrop-blur-md border-r border-border flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-14' : 'w-72'}`}>
      <div className="p-2 border-b border-border flex justify-between items-center h-14">
        <div className="flex items-center gap-2 flex-grow overflow-hidden">
            {!isCollapsed && <h2 className="text-md font-bold px-2 whitespace-nowrap">Project Explorer</h2>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            {!isCollapsed && <button onClick={onAddProject} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90 font-bold">+</button>}
             <button 
                onClick={onToggleCollapse} 
                className="p-1.5 rounded-full hover:bg-secondary/50 text-foreground/80 hover:text-foreground" 
                title={isCollapsed ? 'Expand Explorer' : 'Collapse Explorer'}
            >
                {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </button>
        </div>
      </div>
      <div className={`flex-grow overflow-y-auto ${isCollapsed ? 'hidden' : ''}`}>
        {Object.values(projects).map((project: Project) => {
          const isEditingProject = editing?.type === 'project' && editing.id === project.id;
          return (
          <div key={project.id}>
            <div
              className={`flex items-center justify-between w-full text-left px-2 py-2 text-sm font-semibold ${activeProjectId === project.id ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-secondary/30'}`}
              onDoubleClick={() => !isEditingProject && handleStartEditing('project', project.id, project.name)}
            >
              {isEditingProject ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-background text-foreground p-0.5 text-sm rounded outline-none ring-2 ring-ring"
                  />
                ) : (
                  <button className="flex-grow text-left truncate" onClick={() => onSelectProject(project.id)}>
                    {project.name}
                  </button>
              )}
              <button onClick={() => toggleProject(project.id)} className="px-2">{expandedProjects[project.id] ? '−' : '+'}</button>
            </div>
            {expandedProjects[project.id] && (
              <div className="pl-4 border-l border-border/50">
                {Object.values(project.stories).map((story: Story) => {
                  const isEditingStory = editing?.type === 'story' && editing.id === story.id;
                  return (
                  <div key={story.id}>
                    <div 
                        className={`group flex items-center justify-between w-full text-left px-2 py-1.5 text-sm ${activeStoryId === story.id ? 'bg-accent/70 text-accent-foreground font-semibold' : 'text-foreground/80 hover:bg-secondary/30'}`}
                        onDoubleClick={() => !isEditingStory && handleStartEditing('story', story.id, story.name, undefined, project.id)}
                    >
                       {isEditingStory ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={handleKeyDown}
                            className="flex-grow bg-background text-foreground p-0.5 text-sm rounded outline-none ring-2 ring-ring"
                          />
                        ) : (
                          <button className="flex-grow text-left truncate" onClick={() => onSelectStory(story.id)}>
                            {story.name}
                          </button>
                       )}
                       <div className="flex items-center flex-shrink-0">
                            <button 
                                onClick={() => onDeleteStory(story.id, project.id)}
                                className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive p-1 rounded-full hover:bg-destructive/10"
                                title="Delete Story"
                                >
                                <TrashIcon />
                            </button>
                            <button onClick={() => toggleStory(story.id)} className="px-2">{expandedStories[story.id] ? '−' : '+'}</button>
                       </div>
                    </div>
                     {expandedStories[story.id] && activeStoryId === story.id && (
                       <div className="pl-4 border-l border-border/50">
                         {Object.values(story.scenes).map((scene: Scene) => {
                           const isEditingScene = editing?.type === 'scene' && editing.id === scene.id;
                           return (
                             <div 
                                key={scene.id}
                                className={`group flex items-center justify-between w-full text-left px-2 py-1 text-xs truncate ${selectedSceneId === scene.id ? 'bg-accent/50 text-accent-foreground' : 'text-foreground/70 hover:bg-secondary/30'}`}
                                onDoubleClick={() => !isEditingScene && handleStartEditing('scene', scene.id, scene.name, story.id, project.id)}
                              >
                                {isEditingScene ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={handleSaveEdit}
                                    onKeyDown={handleKeyDown}
                                    className="flex-grow bg-background text-foreground p-0.5 text-xs rounded outline-none ring-2 ring-ring"
                                  />
                                ) : (
                                  <button
                                    onClick={() => onSelectScene(scene.id)}
                                    className="flex-grow text-left truncate"
                                  >
                                    {scene.name}
                                  </button>
                                )}
                                <button 
                                  onClick={() => onDeleteScene(scene.id)}
                                  className="opacity-0 group-hover:opacity-100 text-destructive/70 hover:text-destructive p-1 rounded-full hover:bg-destructive/10"
                                  title="Delete Scene"
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                           );
                         })}
                         <button onClick={() => onAddScene(story.id)} className="w-full text-left px-2 py-1 text-xs text-foreground/60 font-semibold hover:bg-secondary/30">
                            + Add Scene
                        </button>
                       </div>
                     )}
                  </div>
                )})}
                <button onClick={() => onAddStory(project.id)} className="w-full text-left px-2 py-1.5 text-sm text-foreground/70 font-semibold hover:bg-secondary/30">
                    + Add Story
                </button>
              </div>
            )}
          </div>
        )})}
      </div>
    </aside>
  );
};

export default ProjectExplorer;