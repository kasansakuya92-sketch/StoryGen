import React, { useState, useEffect } from 'react';
import { CharactersData, Character, Sprite } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';
import { generateCharacterDetails } from '../utils/ai.ts';
import AIIcon from './icons/AIIcon.tsx';


interface CharacterManagerProps {
  characters: CharactersData;
  onUpdateCharacters: (characters: CharactersData) => void;
  onClose: () => void;
}

const commonInputClass = "mt-1 block w-full bg-card/50 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";
type View = 'editor' | 'generator';

const AICharacterGenerator: React.FC<{
    onCharacterGenerated: (charData: Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>) => void
}> = ({ onCharacterGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { settings } = useSettings();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a description for the character.');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const charDetails = await generateCharacterDetails(settings, prompt);
            onCharacterGenerated(charDetails);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`Failed to generate character. ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 flex flex-col h-full">
            <h3 className="text-lg font-bold">AI Character Generator</h3>
            <p className="text-sm text-foreground/70 mt-1 mb-4">Describe the character you want to create. The AI will generate their name, appearance, and talking style.</p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A cynical space pirate with a secret heart of gold."
                className={`${commonInputClass} h-24 resize-y`}
                disabled={isLoading}
            />
            <button
                onClick={handleGenerate}
                disabled={isLoading || (settings.aiProvider === 'local' && !settings.localModelUrl)}
                className="mt-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50 w-full flex items-center justify-center gap-2"
                title={settings.aiProvider === 'local' && !settings.localModelUrl ? 'Please set the Local Model URL in settings.' : ''}
            >
                {isLoading ? 'Generating...' : <><AIIcon className="w-4 h-4" /> Generate Character</>}
            </button>
            {error && <p className="text-destructive text-xs mt-2">{error}</p>}
        </div>
    );
};


const CharacterManager: React.FC<CharacterManagerProps> = ({ characters, onUpdateCharacters, onClose }) => {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(Object.keys(characters)[0] || null);
  const [view, setView] = useState<View>('editor');
  const [generatedChar, setGeneratedChar] = useState<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'> | null>(null);
  
  const selectedChar = selectedCharId ? characters[selectedCharId] : null;

  // If the selected character is deleted externally, select the first one available
  useEffect(() => {
    if (selectedCharId && !characters[selectedCharId]) {
      setSelectedCharId(Object.keys(characters)[0] || null);
    }
  }, [characters, selectedCharId]);

  const handleUpdateCharacter = (charId: string, field: keyof Character, value: any) => {
    const newCharacters = { ...characters };
    newCharacters[charId] = { ...newCharacters[charId], [field]: value };
    onUpdateCharacters(newCharacters);
  };

  const handleUpdateSprite = (charId: string, spriteIndex: number, field: keyof Sprite, value: string) => {
    const newCharacters = { ...characters };
    const newSprites = [...newCharacters[charId].sprites];
    newSprites[spriteIndex] = { ...newSprites[spriteIndex], [field]: value };
    newCharacters[charId] = { ...newCharacters[charId], sprites: newSprites };
    onUpdateCharacters(newCharacters);
  };
  
  const handleAddSprite = (charId: string) => {
    const newCharacters = { ...characters };
    const newSprites = [...newCharacters[charId].sprites, { id: `sprite_${Date.now()}`, url: '' }];
    newCharacters[charId] = { ...newCharacters[charId], sprites: newSprites };
    onUpdateCharacters(newCharacters);
  };

  const handleDeleteSprite = (charId: string, spriteIndex: number) => {
    if (characters[charId].sprites.length <= 1) {
      alert("Cannot delete the last sprite.");
      return;
    }
    const newCharacters = { ...characters };
    const newSprites = [...newCharacters[charId].sprites];
    newSprites.splice(spriteIndex, 1);
    newCharacters[charId] = { ...newCharacters[charId], sprites: newSprites };
    onUpdateCharacters(newCharacters);
  };

  const handleAddCharacter = () => {
    const newId = `char_${Date.now()}`;
    const newChar: Character = {
        id: newId,
        name: 'New Character',
        defaultSpriteId: 'normal',
        sprites: [{ id: 'normal', url: '' }],
        talkingStyle: '',
        appearance: ''
    };
    const newCharacters = { ...characters, [newId]: newChar };
    onUpdateCharacters(newCharacters);
    setSelectedCharId(newId);
    setView('editor');
  };

  const handleDeleteCharacter = (charId: string) => {
    const newCharacters = { ...characters };
    delete newCharacters[charId];
    onUpdateCharacters(newCharacters);
    if (selectedCharId === charId) {
        setSelectedCharId(Object.keys(newCharacters)[0] || null);
    }
  };
  
  const handleSelectCharacter = (id: string) => {
      setSelectedCharId(id);
      setView('editor');
      setGeneratedChar(null);
  };
  
  const handleSwitchToGenerator = () => {
      setView('generator');
      setSelectedCharId(null);
  };

  const handleCharacterGenerated = (charData: Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>) => {
    setGeneratedChar(charData);
  };

  const handleAddGeneratedCharacter = () => {
      if (!generatedChar) return;
      const newId = `char_${Date.now()}`;
      const newChar: Character = {
          ...generatedChar,
          id: newId,
          defaultSpriteId: 'normal',
          sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${newId}/600/800` }],
      };
      const newCharacters = { ...characters, [newId]: newChar };
      onUpdateCharacters(newCharacters);
      setGeneratedChar(null);
      setSelectedCharId(newId);
      setView('editor');
  };

  const renderEditorView = () => (
    selectedChar ? (
      <div className="space-y-4 p-4">
        <div>
          <label className="text-sm font-medium">Character Name</label>
          <input 
            type="text"
            value={selectedChar.name}
            onChange={(e) => handleUpdateCharacter(selectedChar.id, 'name', e.target.value)}
            className={commonInputClass}
          />
        </div>
         <div>
          <label className="text-sm font-medium">Appearance Description</label>
          <textarea
            value={selectedChar.appearance}
            onChange={(e) => handleUpdateCharacter(selectedChar.id, 'appearance', e.target.value)}
            placeholder="e.g., Tall with spiky blue hair and a long red coat."
            className={`${commonInputClass} h-20 resize-y`}
          />
        </div>
         <div>
          <label className="text-sm font-medium">Talking Style</label>
          <textarea
            value={selectedChar.talkingStyle}
            onChange={(e) => handleUpdateCharacter(selectedChar.id, 'talkingStyle', e.target.value)}
            placeholder="e.g., Speaks in short, direct sentences. Often sounds sarcastic."
            className={`${commonInputClass} h-20 resize-y`}
          />
        </div>

        <h3 className="text-lg font-bold mt-4 border-t border-border pt-4">Sprites</h3>
        <div className="space-y-3">
          {selectedChar.sprites.map((sprite, index) => (
            <div key={index} className="flex items-center gap-2 bg-card/50 p-2 rounded">
              <input 
                type="text"
                placeholder="Sprite ID (e.g., happy)"
                value={sprite.id}
                onChange={(e) => handleUpdateSprite(selectedChar.id, index, 'id', e.target.value)}
                className="flex-1 bg-background rounded p-1.5 text-sm border border-border focus:ring-1 focus:ring-ring focus:border-ring outline-none"
              />
              <input 
                type="text"
                placeholder="Sprite URL"
                value={sprite.url}
                onChange={(e) => handleUpdateSprite(selectedChar.id, index, 'url', e.target.value)}
                className="flex-2 bg-background rounded p-1.5 text-sm w-2/3 border border-border focus:ring-1 focus:ring-ring focus:border-ring outline-none"
              />
              <button onClick={() => handleDeleteSprite(selectedChar.id, index)} className="p-1.5 text-destructive/70 hover:text-destructive rounded-full hover:bg-destructive/10" title="Delete Sprite">&times;</button>
            </div>
          ))}
        </div>
        <button onClick={() => handleAddSprite(selectedChar.id)} className="mt-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">
          + Add Sprite
        </button>
         <div className="border-t border-destructive/30 pt-4 mt-6">
            <button 
                onClick={() => handleDeleteCharacter(selectedChar.id)} 
                className="px-4 py-2 bg-destructive/80 text-destructive-foreground text-sm font-semibold rounded-md shadow-sm hover:bg-destructive"
            >
                Delete Character
            </button>
         </div>
      </div>
    ) : (
      <div className="text-foreground/70 h-full flex items-center justify-center p-4 text-center">Select a character to edit, or create a new one.</div>
    )
  );
  
  const renderGeneratorView = () => (
    generatedChar ? (
      <div className="p-4 space-y-4">
          <h3 className="text-lg font-bold">Generated Character</h3>
          <div>
            <label className="text-sm font-medium text-foreground/80">Name</label>
            <p className="p-2 bg-card/50 rounded-md">{generatedChar.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80">Appearance</label>
            <p className="p-2 bg-card/50 rounded-md text-sm">{generatedChar.appearance}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80">Talking Style</label>
            <p className="p-2 bg-card/50 rounded-md text-sm">{generatedChar.talkingStyle}</p>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
              <button onClick={handleAddGeneratedCharacter} className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90">
                Add to Story
              </button>
              <button onClick={() => setGeneratedChar(null)} className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">
                Discard & Generate New
              </button>
          </div>
      </div>
    ) : (
      <AICharacterGenerator onCharacterGenerated={handleCharacterGenerated} />
    )
  );

  return (
    <div className="fixed inset-0 bg-onyx/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-border">
        <header className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold">Character Manager</h2>
          <button onClick={onClose} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50">&times;</button>
        </header>
        
        <div className="flex flex-grow overflow-hidden">
          {/* Character List */}
          <div className="w-1/4 border-r border-border overflow-y-auto flex flex-col">
             <div className="flex-grow">
              {Object.values(characters).map((char: Character) => (
                <button 
                  key={char.id}
                  onClick={() => handleSelectCharacter(char.id)}
                  className={`w-full text-left p-3 text-sm font-semibold truncate ${selectedCharId === char.id && view === 'editor' ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary/30'}`}
                >
                  {char.name}
                </button>
              ))}
             </div>
             <div className="p-2 border-t border-border space-y-2">
                 <button onClick={handleSwitchToGenerator} className={`w-full text-center p-2 text-sm font-semibold rounded flex items-center justify-center gap-2 ${view === 'generator' ? 'bg-primary/20 text-primary' : 'text-primary hover:bg-primary/10'}`}>
                    <AIIcon className="w-4 h-4" /> AI Character
                </button>
                <button onClick={handleAddCharacter} className="w-full text-center p-2 text-sm font-semibold text-primary hover:bg-primary/10 rounded">
                    + New Character
                </button>
             </div>
          </div>

          {/* Main Content */}
          <div className="w-3/4 overflow-y-auto bg-transparent">
            {view === 'editor' ? renderEditorView() : renderGeneratorView()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterManager;