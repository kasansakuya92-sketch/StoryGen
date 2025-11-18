import React, { useState, useEffect } from 'react';
import { Project } from '../types.ts';
import { serializeProjectToDoc, parseDocToProject } from '../utils/docParser.ts';

interface DocEditorViewProps {
  activeProject: Project;
  onUpdateProject: (updatedProject: Project) => void;
}

const DocEditorView: React.FC<DocEditorViewProps> = ({ activeProject, onUpdateProject }) => {
  const [docText, setDocText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (activeProject) {
      const serializedText = serializeProjectToDoc(activeProject);
      setDocText(serializedText);
      setHasChanges(false);
      setError(null);
    }
  }, [activeProject]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDocText(e.target.value);
    setHasChanges(true);
    setError(null);
  };

  const handleSaveChanges = () => {
    try {
      const updatedProject = parseDocToProject(docText, activeProject);
      onUpdateProject(updatedProject);
      setHasChanges(false);
      setError(null);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during parsing.';
      setError(errorMessage);
      console.error(e);
    }
  };

  return (
    <main className="flex-grow bg-transparent flex flex-col overflow-hidden">
      <div className="p-4 flex-shrink-0 flex justify-between items-center border-b border-border bg-card/50">
        <div>
            <h2 className="text-lg font-bold">Document View</h2>
            <p className="text-xs text-foreground/70">Edit your entire project like a script. Use the save button to apply changes.</p>
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={!hasChanges}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasChanges ? 'Save & Apply Changes' : 'Saved'}
        </button>
      </div>
      {error && (
        <div className="p-2 text-sm text-center bg-destructive/20 text-destructive-foreground">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="flex-grow overflow-y-auto p-4 md:p-8">
        <textarea
          value={docText}
          onChange={handleTextChange}
          className="w-full h-full bg-background text-foreground p-4 rounded-md border border-border focus:ring-2 focus:ring-ring focus:border-ring outline-none resize-none font-mono text-sm leading-relaxed"
          placeholder="Start writing your story here..."
        />
      </div>
    </main>
  );
};

export default DocEditorView;
