import React, { useState, useCallback, useEffect } from 'react';
// FIX: Add file extensions to fix module resolution issues.
import { Scene, DialogueItem, SceneCharacter, CharactersData } from '../types.ts';
import CharacterSprite from './CharacterSprite';
import DialogueBox from './DialogueBox';
import ChoiceButtons from './ChoiceButtons';

interface GameScreenProps {
  scene: Scene;
  characters: CharactersData;
  onNavigate: (nextSceneId: string) => void;
  onEnd: () => void;
  onOpenEditor: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ scene, characters, onNavigate, onEnd, onOpenEditor }) => {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [activeSprites, setActiveSprites] = useState<Record<string, string>>({});

  const currentLine = scene.dialogue[dialogueIndex] as DialogueItem | undefined;

  useEffect(() => {
    // Reset dialogue index when scene changes
    setDialogueIndex(0);
    setIsTyping(true);
  }, [scene]);

  useEffect(() => {
    // Handle non-interactive dialogue items
    if (currentLine) {
      if (currentLine.type === 'transition') {
        onNavigate(currentLine.nextSceneId);
      } else if (currentLine.type === 'end_story') {
        onEnd();
      } else if (currentLine.type === 'text') {
        setIsTyping(true); // Start typing for new text line
      } else if (currentLine.type === 'image' || currentLine.type === 'video') {
        setIsTyping(false); // Images and videos are instant
      }
    }

    // Update active sprites based on the current text line
    const newActiveSprites = scene.characters.reduce((acc, char) => {
      acc[char.characterId] = char.spriteId;
      return acc;
    }, {} as Record<string, string>);

    if (currentLine?.type === 'text' && currentLine.characterId && currentLine.spriteId) {
      if (newActiveSprites.hasOwnProperty(currentLine.characterId)) {
        newActiveSprites[currentLine.characterId] = currentLine.spriteId;
      }
    }
    setActiveSprites(newActiveSprites);

  }, [scene, dialogueIndex, onNavigate, onEnd, currentLine]);

  const handleNext = useCallback(() => {
    if (isTyping || !currentLine) {
      return;
    }
    
    if (currentLine.type !== 'text' && currentLine.type !== 'image' && currentLine.type !== 'video') {
        return;
    }

    if (dialogueIndex < scene.dialogue.length - 1) {
      setDialogueIndex(prev => prev + 1);
    }
  }, [isTyping, dialogueIndex, scene.dialogue.length, currentLine]);

  const handleChoice = useCallback((nextSceneId: string) => {
    onNavigate(nextSceneId);
  }, [onNavigate]);

  const handleFinishedTyping = useCallback(() => {
    setIsTyping(false);
  }, []);

  const getSpriteUrl = (characterId: string, spriteId: string) => {
    const char = characters[characterId];
    if (!char) return '';
    const sprite = char.sprites.find(s => s.id === spriteId);
    return sprite ? sprite.url : (char.sprites.find(s=> s.id === char.defaultSpriteId)?.url || '');
  };

  const isClickable = !isTyping && (currentLine?.type === 'text' || currentLine?.type === 'image' || currentLine.type === 'video');

  return (
    <div className="relative w-full h-full overflow-hidden select-none" >
       <button
        onClick={onOpenEditor}
        className="absolute top-4 right-4 bg-card/50 backdrop-blur-sm text-card-foreground px-3 py-1.5 rounded-md text-sm z-50 hover:bg-card/70 border border-border"
      >
        Open Editor
      </button>

      <div className="absolute inset-0" onClick={isClickable ? handleNext : undefined}>
        <img src={scene.background} alt="background" className="absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000" />
        
        <div className="absolute inset-0">
          {scene.characters.map((char) => (
            <CharacterSprite
              key={char.characterId}
              src={getSpriteUrl(char.characterId, activeSprites[char.characterId] || char.spriteId)}
              alt={char.characterId}
              position={char.position}
            />
          ))}
        </div>
        
        {currentLine?.type === 'text' && (
          <DialogueBox
            key={`${scene.id}-${dialogueIndex}`}
            dialogueLine={currentLine}
            characters={characters}
            onFinishedTyping={handleFinishedTyping}
            isTyping={isTyping}
          />
        )}

        {currentLine?.type === 'image' && (
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/30 backdrop-blur-sm animate-fade-in">
              <img src={currentLine.url} alt="In-game event" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </div>
        )}
        
        {currentLine?.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center p-8 bg-black/50 backdrop-blur-sm animate-fade-in">
              <video src={currentLine.url} controls autoPlay className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </div>
        )}
      </div>

      {currentLine?.type === 'choice' && (
        <ChoiceButtons
          choices={currentLine.choices}
          onChoiceSelect={handleChoice}
        />
      )}
    </div>
  );
};

export default GameScreen;