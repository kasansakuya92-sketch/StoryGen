

// types.ts

export interface Sprite {
  id: string;
  url: string;
}

export interface Character {
  id:string;
  name: string;
  sprites: Sprite[];
  defaultSpriteId: string;
  talkingStyle: string;
  appearance: string;
  gender?: 'male' | 'female' | 'trans' | 'neutral'; 
}

export interface CharactersData {
  [key:string]: Character;
}

export interface SceneCharacter {
  characterId: string;
  spriteId: string;
  position: 'left' | 'center' | 'right';
}

export interface TextLine {
  type: 'text' | 'thought' | 'sms' | 'system';
  characterId: string | null;
  spriteId?: string; // Optional sprite change for this line
  text: string;
}

export interface StatRequirement {
  stat: string;
  threshold: number;
}

export interface Choice {
  text: string;
  nextSceneId: string;
  nextStoryId?: string;
  embedOutcome?: boolean; // If true, the next scene is defined as a variable in the current passage
  type?: 'transfer'; // Optional explicit type override
  statRequirements?: StatRequirement[];
  statChanges?: Record<string, number>;
}

export interface ChoiceLine {
  type: 'choice';
  choices: Choice[];
}

export interface Transition {
  type: 'transition';
  nextSceneId: string;
  nextStoryId?: string;
}

export interface TransferLine {
  type: 'transfer';
  nextSceneId: string;
}

export interface RandomLine {
  type: 'random';
  variants: string[]; // Array of Scene IDs to choose from
}

export interface EndStory {
  type: 'end_story';
}

export interface ImageLine {
  type: 'image';
  url: string;
}

export interface VideoLine {
  type: 'video';
  url: string;
}

export interface AIPromptLine {
  type: 'ai_prompt';
  id: string;
  config: {
    dialogueLength: DialogueLength;
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story';
    useContinuity: boolean;
    aiPrompt: string;
  };
  isLoading?: boolean;
  error?: string | null;
}

export type DialogueItem = TextLine | ChoiceLine | Transition | TransferLine | RandomLine | EndStory | AIPromptLine | ImageLine | VideoLine;


export interface Scene {
  id: string;
  name:string;
  description?: string; // High-level summary of the scene's purpose
  background: string;
  characters: SceneCharacter[];
  dialogue: DialogueItem[];
  position?: { x: number; y: number }; // For node editor
}

export interface ScenesData {
  [key: string]: Scene;
}

export interface Story {
    id: string;
    name: string;
    characters: CharactersData;
    scenes: ScenesData;
    startSceneId: string;
}

export interface Project {
    id: string;
    name: string;
    stories: {
        [storyId: string]: Story;
    };
    variables?: string[]; // Global list of variable names for this project
}

export interface ProjectsData {
    [projectId: string]: Project;
}


export type DialogueLength = 'Short' | 'Medium' | 'Long';
export type SceneLength = 'Short' | 'Medium' | 'Long';

// Settings Types
export type Theme = 'light' | 'dark';
export type TypingSpeed = 'Slow' | 'Normal' | 'Fast';
export type TextSize = 'Small' | 'Medium' | 'Large';
export type AIProvider = 'google' | 'local';

export interface Settings {
  theme: Theme;
  typingSpeed: TypingSpeed;
  textSize: TextSize;
  aiProvider: AIProvider;
  localModelUrl: string;
}

export type AIStructureType = 'choice_branch' | 'linear_sequence' | 'random_branch';

export interface AIGeneratedScene {
  // A temporary ID used by the AI to link scenes together.
  id: string; 
  name: string;
  description: string;
  // Dialogue will be just text lines for simplicity in generation.
  dialogue: TextLine[];
  // IDs of characters present in the scene.
  characterIds: string[];
}