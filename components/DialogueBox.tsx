import React, { useState, useEffect } from 'react';
// FIX: Add file extensions to fix module resolution issues.
import { TextLine, CharactersData } from '../types.ts';
import { useSettings } from '../contexts/SettingsContext.tsx';

interface DialogueBoxProps {
  dialogueLine: TextLine;
  characters: CharactersData;
  onFinishedTyping: () => void;
  isTyping: boolean;
}

const speedMap = {
    'Slow': 50,
    'Normal': 30,
    'Fast': 15
};

const textSizeMap = {
    'Small': 'text-lg md:text-xl',
    'Medium': 'text-xl md:text-2xl',
    'Large': 'text-2xl md:text-3xl'
};

const DialogueBox: React.FC<DialogueBoxProps> = ({ dialogueLine, characters, onFinishedTyping, isTyping }) => {
  const [displayedText, setDisplayedText] = useState('');
  const { settings } = useSettings();
  
  const characterName = dialogueLine.characterId ? characters[dialogueLine.characterId]?.name : null;

  const typingSpeed = speedMap[settings.typingSpeed];
  const textSize = textSizeMap[settings.textSize];

  useEffect(() => {
    setDisplayedText(''); // Reset on new line
    if (dialogueLine.text) {
      const interval = setInterval(() => {
        setDisplayedText(prev => {
          if (prev.length < dialogueLine.text.length) {
            return dialogueLine.text.substring(0, prev.length + 1);
          } else {
            clearInterval(interval);
            onFinishedTyping();
            return prev;
          }
        });
      }, typingSpeed);

      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogueLine.text, onFinishedTyping, typingSpeed]);

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 flex flex-col">
       <div className="w-full max-w-6xl mx-auto bg-card/70 backdrop-blur-lg rounded-xl p-6 border border-border shadow-2xl">
        {characterName && (
          <div className="mb-2">
            <h3 className="inline-block bg-secondary text-secondary-foreground font-bold text-2xl px-4 py-1 rounded-md -ml-2">{characterName}</h3>
          </div>
        )}
        <p className={`${textSize} text-card-foreground min-h-[3em]`}>{displayedText}</p>
        
        {!isTyping && (
          <div className="absolute bottom-4 right-6 animate-bounce">
            <svg xmlns="http://www.w.org/2000/svg" className="h-6 w-6 text-card-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default DialogueBox;