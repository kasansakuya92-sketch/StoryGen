import React from 'react';
import { ProjectsData, Project, Story } from '../types.ts';
import ThemeToggle from './ThemeToggle.tsx';

interface ProjectsHubProps {
  projects: ProjectsData;
  onOpenEditor: (projectId: string) => void;
  onPlayProject: (projectId: string) => void;
  onAddNewProject: () => void;
  onGoToSettings: () => void;
  onDeleteProject: (projectId: string) => void;
}

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


const ProjectCard: React.FC<{ project: Project; onPlay: () => void; onEdit: () => void; onDelete: (projectId: string) => void; }> = ({ project, onPlay, onEdit, onDelete }) => {
    const storyCount = Object.keys(project.stories).length;
    const sceneCount = Object.values(project.stories).reduce((acc: number, story: Story) => acc + Object.keys(story.scenes).length, 0);

    return (
        <div className="bg-card/50 backdrop-blur-md rounded-lg border border-border flex flex-col transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 relative group">
            <button
                onClick={() => onDelete(project.id)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-card/50 text-foreground/60 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10"
                title="Delete Project"
            >
                <TrashIcon />
            </button>
            <div className="p-4 flex-grow">
                <h3 className="text-xl font-bold text-card-foreground truncate">{project.name}</h3>
                <p className="text-sm text-card-foreground/70 mt-2">{storyCount} stories, {sceneCount} scenes</p>
            </div>
            <div className="p-4 bg-transparent border-t border-border/50 flex items-center justify-end gap-3">
                <button 
                    onClick={onPlay}
                    className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={storyCount === 0}
                >
                    Play
                </button>
                <button 
                    onClick={onEdit}
                    className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-secondary/90"
                >
                    Edit
                </button>
            </div>
        </div>
    );
};

const AddProjectCard: React.FC<{ onClick: () => void; }> = ({ onClick }) => (
    <button 
        onClick={onClick}
        className="bg-card/30 backdrop-blur-md rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-foreground/60 transition-all duration-300 hover:border-primary hover:text-primary hover:bg-card/50"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
        <span className="mt-2 font-semibold">Create New Project</span>
    </button>
);


const ProjectsHub: React.FC<ProjectsHubProps> = ({ projects, onOpenEditor, onPlayProject, onAddNewProject, onGoToSettings, onDeleteProject }) => {
  return (
    <div className="w-full h-full overflow-y-auto">
        <div className="container mx-auto px-4 py-8 md:py-12 relative">
            <div className="absolute top-4 right-4 flex items-center gap-1">
                <button onClick={onGoToSettings} className="text-foreground/60 hover:text-foreground p-2 rounded-full hover:bg-card/50" title="Settings">
                    <SettingsIcon />
                </button>
                <ThemeToggle />
            </div>
            <header className="mb-8 md:mb-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground">My Projects</h1>
                <p className="text-lg text-foreground/70 mt-2">Select a project to play or edit, or start a new one.</p>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.values(projects).map((project: Project) => (
                    <ProjectCard 
                        key={project.id} 
                        project={project}
                        onPlay={() => onPlayProject(project.id)}
                        onEdit={() => onOpenEditor(project.id)}
                        onDelete={onDeleteProject}
                    />
                ))}
                <AddProjectCard onClick={onAddNewProject} />
            </div>
        </div>
    </div>
  );
};

export default ProjectsHub;