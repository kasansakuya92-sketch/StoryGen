



import React from 'react';
// FIX: Add file extension to fix module resolution issue.
import { Choice } from '../types.ts';

interface ChoiceButtonsProps {
  choices: Choice[];
  onChoiceSelect: (nextSceneId: string, nextStoryId?: string) => void;
}

const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({ choices, onChoiceSelect }) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-onyx/50 backdrop-blur-sm">
      <div className="space-y-4">
        {choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => onChoiceSelect(choice.nextSceneId, choice.nextStoryId)}
            className="w-full max-w-md md:w-[500px] text-lg block px-6 py-4 bg-card/70 border-2 border-border text-card-foreground font-semibold rounded-lg shadow-lg backdrop-blur-md hover:bg-card/90 hover:border-border/50 focus:outline-none focus:ring-4 focus:ring-ring transform hover:scale-105 transition-all duration-300 ease-in-out"
          >
            {choice.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChoiceButtons;