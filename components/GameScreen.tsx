


import React, { useState, useCallback, useEffect } from 'react';
import { Scene, DialogueItem, SceneCharacter, CharactersData, Story, Condition, StoryVariable } from '../types.ts';
import CharacterSprite from './CharacterSprite.tsx';
import DialogueBox from './DialogueBox.tsx';
import ChoiceButtons from './ChoiceButtons.tsx';

interface GameScreenProps {
  scene: Scene;
  story: Story; // Need full story for variables
  characters: CharactersData; // Characters passed explicitly from project
  onNavigate: (nextSceneId: string, nextStoryId?: string) => void;
  onEnd: () => void;
  onOpenEditor: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ scene, story, characters, onNavigate, onEnd, onOpenEditor }) => {
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [activeSprites, setActiveSprites] = useState<Record<string, string>>({});
  
  // Runtime State for Variables
  const [variables, setVariables] = useState<Record<string, any>>({});

  // Initialize variables on mount
  useEffect(() => {
      const initialVars: Record<string, any> = {};
      if (story.variables) {
          Object.values(story.variables).forEach((v: StoryVariable) => {
              initialVars[v.id] = v.initialValue;
          });
      }
      setVariables(initialVars);
  }, [story.variables]);

  const currentLine = scene.dialogue[dialogueIndex] as DialogueItem | undefined;

  useEffect(() => {
    // Reset dialogue index when scene changes
    setDialogueIndex(0);
    setIsTyping(true);
  }, [scene]);

  // Handle automatic progression for logic lines (set_variable)
  useEffect(() => {
      if (currentLine?.type === 'set_variable') {
          const { variableId, operation, value } = currentLine;
          
          setVariables(prev => {
              const currentVal = prev[variableId];
              let newVal = currentVal;

              if (operation === 'set') {
                  newVal = value;
              } else if (operation === 'add') {
                  newVal = (Number(currentVal) || 0) + (Number(value) || 0);
              } else if (operation === 'subtract') {
                  newVal = (Number(currentVal) || 0) - (Number(value) || 0);
              } else if (operation === 'toggle') {
                  newVal = !currentVal;
              }
              
              return { ...prev, [variableId]: newVal };
          });

          // Move to next line automatically
          setDialogueIndex(prev => prev + 1);
      }
  }, [currentLine]);

  useEffect(() => {
    // Handle non-interactive dialogue items
    if (currentLine) {
      if (currentLine.type === 'transition') {
        onNavigate(currentLine.nextSceneId, currentLine.nextStoryId);
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
    
    // Skip clicks on set_variable lines as they auto-advance, but safety check here
    if (currentLine.type === 'set_variable') return;

    if (currentLine.type !== 'text' && currentLine.type !== 'image' && currentLine.type !== 'video') {
        return;
    }

    if (dialogueIndex < scene.dialogue.length - 1) {
      setDialogueIndex(prev => prev + 1);
    }
  }, [isTyping, dialogueIndex, scene.dialogue.length, currentLine]);

  const handleChoice = useCallback((nextSceneId: string, nextStoryId?: string) => {
    onNavigate(nextSceneId, nextStoryId);
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
  
  const checkConditions = (conditions?: Condition[]) => {
      if (!conditions || conditions.length === 0) return true;
      return conditions.every(cond => {
          const currentVal = variables[cond.variableId];
          const targetVal = cond.value;
          
          switch (cond.operator) {
              case 'eq': return currentVal == targetVal;
              case 'neq': return currentVal != targetVal;
              case 'gt': return currentVal > targetVal;
              case 'lt': return currentVal < targetVal;
              case 'gte': return currentVal >= targetVal;
              case 'lte': return currentVal <= targetVal;
              default: return true;
          }
      });
  };

  const isClickable = !isTyping && (currentLine?.type === 'text' || currentLine?.type === 'image' || currentLine.type === 'video');

  // Filter choices based on conditions
  const visibleChoices = currentLine?.type === 'choice' 
    ? currentLine.choices.filter(c => checkConditions(c.conditions))
    : [];

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
          choices={visibleChoices}
          onChoiceSelect={handleChoice}
        />
      )}
    </div>
  );
};

export default GameScreen;