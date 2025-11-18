
import React, { useState } from 'react';
import { Background, BackgroundsData } from '../types.ts';

interface AssetManagerProps {
  backgrounds: BackgroundsData;
  onUpdateBackgrounds: (backgrounds: BackgroundsData) => void;
  onClose: () => void;
}

const commonInputClass = "w-full bg-card/50 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

const AssetManager: React.FC<AssetManagerProps> = ({ backgrounds, onUpdateBackgrounds, onClose }) => {
  const [newBgName, setNewBgName] = useState('');
  const [newBgUrl, setNewBgUrl] = useState('');

  const handleAddBackground = () => {
    if (!newBgName.trim() || !newBgUrl.trim()) return;
    const id = `bg_${Date.now()}`;
    
    const newBg: Background = {
        id,
        name: newBgName.trim(),
        url: newBgUrl.trim()
    };

    onUpdateBackgrounds({ ...backgrounds, [id]: newBg });
    setNewBgName('');
    setNewBgUrl('');
  };

  const handleDeleteBackground = (id: string) => {
    const newBgs = { ...backgrounds };
    delete newBgs[id];
    onUpdateBackgrounds(newBgs);
  };

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-3xl h-[70vh] flex flex-col border border-border">
        <header className="p-4 border-b border-border flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">Asset Manager: Backgrounds</h2>
          <button onClick={onClose} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50">&times;</button>
        </header>

        <div className="flex-grow overflow-y-auto p-4">
           {/* Add New Section */}
           <div className="mb-6 p-4 bg-card/50 rounded-lg border border-border">
               <h3 className="text-sm font-bold mb-2 uppercase text-foreground/70">Add New Background</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                   <input 
                        type="text" 
                        placeholder="Name (e.g., Forest Day)" 
                        value={newBgName} 
                        onChange={e => setNewBgName(e.target.value)}
                        className={commonInputClass}
                   />
                   <input 
                        type="text" 
                        placeholder="Image URL" 
                        value={newBgUrl} 
                        onChange={e => setNewBgUrl(e.target.value)}
                        className={commonInputClass}
                   />
                   <button 
                        onClick={handleAddBackground}
                        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 whitespace-nowrap h-full"
                   >
                       + Add Background
                   </button>
               </div>
               <p className="text-xs text-foreground/50 mt-2">Use URLs to external images (Unsplash, Imgur, etc.) for now.</p>
           </div>

           {/* Grid List */}
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {Object.values(backgrounds).map((bg: Background) => (
                   <div key={bg.id} className="group relative bg-card/80 border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                       <div className="aspect-video bg-black/10 relative">
                            <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                            <button 
                                onClick={() => handleDeleteBackground(bg.id)}
                                className="absolute top-2 right-2 p-1.5 bg-destructive/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                title="Delete Background"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                       </div>
                       <div className="p-2">
                           <div className="font-bold text-sm truncate">{bg.name}</div>
                           <div className="text-xs text-foreground/60 font-mono truncate" title={bg.url}>{bg.url}</div>
                       </div>
                   </div>
               ))}
           </div>
           
            {Object.keys(backgrounds).length === 0 && (
                <div className="text-center py-10 text-foreground/50">
                    No backgrounds added yet.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AssetManager;
