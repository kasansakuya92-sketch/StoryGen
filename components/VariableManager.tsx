
import React, { useState } from 'react';

interface VariableManagerProps {
  variables: string[];
  onUpdateVariables: (variables: string[]) => void;
  onClose: () => void;
}

const VariableManager: React.FC<VariableManagerProps> = ({ variables, onUpdateVariables, onClose }) => {
  const [newVarName, setNewVarName] = useState('');

  const handleAdd = () => {
    const trimmed = newVarName.trim();
    if (!trimmed) return;
    if (variables.includes(trimmed)) {
      alert('Variable already exists!');
      return;
    }
    // Ensure valid variable name (alphanumeric + underscore)
    const sanitized = trimmed.replace(/[^a-zA-Z0-9_]/g, '');
    if (sanitized !== trimmed) {
        alert('Variable names should only contain letters, numbers, and underscores.');
        return;
    }

    onUpdateVariables([...variables, sanitized]);
    setNewVarName('');
  };

  const handleDelete = (index: number) => {
    const newVars = [...variables];
    newVars.splice(index, 1);
    onUpdateVariables(newVars);
  };

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/90 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-md flex flex-col border border-border">
        <header className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold">Variable Manager</h2>
          <button onClick={onClose} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50">&times;</button>
        </header>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-foreground/70">Define global variables (stats) for your project here. You can use these in Choices to set requirements or apply changes.</p>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              placeholder="e.g. money, deviancy"
              className="flex-grow bg-card border border-border rounded p-2 text-sm focus:ring-1 focus:ring-ring outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button 
              onClick={handleAdd}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded hover:bg-primary/90"
            >
              Add
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 bg-card/50 rounded p-2 border border-border/50">
            {variables.length === 0 && <p className="text-xs text-foreground/50 text-center py-4">No variables defined.</p>}
            {variables.map((v, i) => (
              <div key={i} className="flex items-center justify-between bg-background p-2 rounded border border-border/50">
                <span className="font-mono text-sm text-primary">$ {v}</span>
                <button 
                  onClick={() => handleDelete(i)}
                  className="text-destructive hover:bg-destructive/10 p-1 rounded"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariableManager;
