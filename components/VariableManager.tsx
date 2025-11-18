
import React, { useState } from 'react';
import { StoryVariable, VariableType } from '../types.ts';

interface VariableManagerProps {
  variables: Record<string, StoryVariable>;
  onUpdateVariables: (variables: Record<string, StoryVariable>) => void;
  onClose: () => void;
}

const commonInputClass = "bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none w-full";
const commonSelectClass = "bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none w-full";

const VariableManager: React.FC<VariableManagerProps> = ({ variables, onUpdateVariables, onClose }) => {
  const [newVarName, setNewVarName] = useState('');
  const [newVarType, setNewVarType] = useState<VariableType>('boolean');

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;
    const id = newVarName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    
    if (variables[id]) {
        alert('A variable with this ID already exists.');
        return;
    }

    const newVar: StoryVariable = {
        id,
        name: newVarName.trim(),
        type: newVarType,
        initialValue: newVarType === 'boolean' ? false : (newVarType === 'number' ? 0 : '')
    };

    onUpdateVariables({ ...variables, [id]: newVar });
    setNewVarName('');
  };

  const handleDeleteVariable = (id: string) => {
    const newVars = { ...variables };
    delete newVars[id];
    onUpdateVariables(newVars);
  };

  const handleUpdateInitialValue = (id: string, value: any) => {
      const newVars = { ...variables };
      if (newVars[id].type === 'number') {
          newVars[id].initialValue = parseFloat(value) || 0;
      } else if (newVars[id].type === 'boolean') {
          newVars[id].initialValue = value;
      } else {
          newVars[id].initialValue = value;
      }
      onUpdateVariables(newVars);
  };

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-3xl h-[70vh] flex flex-col border border-border">
        <header className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">Variable Manager</h2>
          <button onClick={onClose} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50">&times;</button>
        </header>

        <div className="flex-grow overflow-y-auto p-4">
           {/* Add New Variable Section */}
           <div className="mb-6 p-4 bg-card/50 rounded-lg border border-border">
               <h3 className="text-sm font-bold mb-2 uppercase text-foreground/70">Create New Variable</h3>
               <div className="flex gap-2 flex-col md:flex-row">
                   <input 
                        type="text" 
                        placeholder="Variable Name (e.g., Has Key)" 
                        value={newVarName} 
                        onChange={e => setNewVarName(e.target.value)}
                        className={commonInputClass}
                   />
                   <select 
                        value={newVarType} 
                        onChange={e => setNewVarType(e.target.value as VariableType)}
                        className={`${commonSelectClass} md:w-1/4`}
                   >
                       <option value="boolean">Boolean (True/False)</option>
                       <option value="number">Number</option>
                       <option value="string">String</option>
                   </select>
                   <button 
                        onClick={handleAddVariable}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 whitespace-nowrap"
                   >
                       + Add
                   </button>
               </div>
           </div>

           {/* Variable List */}
           <div className="space-y-2">
               <h3 className="text-sm font-bold mb-2 uppercase text-foreground/70 px-1">Story Variables</h3>
               {Object.keys(variables).length === 0 && <p className="text-center text-foreground/50 py-8">No variables defined yet.</p>}
               
               {Object.values(variables).map((variable: StoryVariable) => (
                   <div key={variable.id} className="flex items-center gap-4 p-3 bg-card/80 border border-border rounded-lg">
                       <div className="flex-grow">
                           <div className="font-bold text-sm">{variable.name}</div>
                           <div className="text-xs text-foreground/60 font-mono">{variable.id}</div>
                       </div>
                       <div className="text-xs font-semibold px-2 py-1 bg-secondary/30 rounded uppercase">{variable.type}</div>
                       
                       <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-foreground/70">Initial:</span>
                           {variable.type === 'boolean' ? (
                               <input 
                                    type="checkbox" 
                                    checked={variable.initialValue} 
                                    onChange={e => handleUpdateInitialValue(variable.id, e.target.checked)}
                                    className="h-5 w-5 rounded border-border text-primary focus:ring-ring"
                               />
                           ) : variable.type === 'number' ? (
                               <input 
                                    type="number" 
                                    value={variable.initialValue}
                                    onChange={e => handleUpdateInitialValue(variable.id, e.target.value)}
                                    className={`${commonInputClass} w-24 py-1`}
                               />
                           ) : (
                               <input 
                                    type="text" 
                                    value={variable.initialValue}
                                    onChange={e => handleUpdateInitialValue(variable.id, e.target.value)}
                                    className={`${commonInputClass} w-32 py-1`}
                               />
                           )}
                       </div>
                       
                       <button 
                            onClick={() => handleDeleteVariable(variable.id)}
                            className="p-2 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-full"
                            title="Delete Variable"
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
