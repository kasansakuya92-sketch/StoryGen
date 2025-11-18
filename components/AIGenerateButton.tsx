import React from 'react';

// This is a placeholder component.
// The main AI generation logic is in AIStoryPlanner.tsx and AIGenerateSceneDialogueButton.tsx
const AIGenerateButton: React.FC = () => {
  return (
    <button disabled className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded cursor-not-allowed">
      AI Generate
    </button>
  );
};

export default AIGenerateButton;
