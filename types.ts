



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
}

export interface CharactersData {
  [key:string]: Character;
}

export interface Background {
  id: string;
  name: string;
  url: string;
}

export interface BackgroundsData {
  [key: string]: Background;
}

export interface SceneCharacter {
  characterId: string;
  spriteId: string;
  position: 'left' | 'center' | 'right';
}

export interface TextLine {
  type: 'text';
  characterId: string | null;
  spriteId?: string; // Optional sprite change for this line
  text: string;
}

export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte';

export interface Condition {
  variableId: string;
  operator: ConditionOperator;
  value: any;
}

export interface Choice {
  text: string;
  nextSceneId: string;
  nextStoryId?: string; // Optional: if present, switch story
  conditions?: Condition[];
}

export interface ChoiceLine {
  type: 'choice';
  choices: Choice[];
}

export interface Transition {
  type: 'transition';
  nextSceneId: string;
  nextStoryId?: string; // Optional: if present, switch story
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
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story' | 'text_only';
    useContinuity: boolean;
    aiPrompt: string;
  };
  isLoading?: boolean;
  error?: string | null;
}

export type VariableOperation = 'set' | 'add' | 'subtract' | 'toggle';

export interface SetVariableLine {
  type: 'set_variable';
  variableId: string;
  operation: VariableOperation;
  value?: any;
}

export type DialogueItem = TextLine | ChoiceLine | Transition | EndStory | AIPromptLine | ImageLine | VideoLine | SetVariableLine;

export type SceneStatus = 'draft' | 'written' | 'polished' | 'final';

// Updates to existing types
export interface Scene {
  id: string;
  name:string;
  description?: string; // High-level summary of the scene's purpose
  background: string;
  characters: SceneCharacter[];
  dialogue: DialogueItem[];
  position?: { x: number; y: number }; // For node editor
  importance?: NodeImportanceFactors;
  isCheckpoint?: boolean;
  status?: SceneStatus;
}

export interface ScenesData {
  [key: string]: Scene;
}

export type VariableType = 'boolean' | 'number' | 'string';

export interface StoryVariable {
  id: string;
  name: string;
  type: VariableType;
  initialValue: any;
}

export interface Story {
    id: string;
    name: string;
    // characters: CharactersData; // Moved to Project
    scenes: ScenesData;
    startSceneId: string;
    variables: Record<string, StoryVariable>;
    checkpointSummaries?: Record<string, { text: string; tokens: number }>;
}

export interface Project {
    id: string;
    name: string;
    characters: CharactersData; // Added to Project
    backgrounds: BackgroundsData; // Added Backgrounds registry
    stories: {
        [storyId: string]: Story;
    };
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

export type AIStructureType = 'choice_branch' | 'linear_sequence';

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
// FIX: Add types for context engine
export interface NodeImportanceFactors {
  decisionWeight: number;
  payoffWeight: number;
  emotionalIntensity: number;
  loreDensity: number;
}

export interface StoryFlag {
  key: string;
  value: string | number | boolean;
}

export interface CharacterRelation {
  characterId: string;
  trust: number;
  affection: number;
}

export interface StoryPromise {
  id: string;
  description: string;
  kept: boolean | null;
}

export interface StoryState {
  chapter: number;
  act: number;
  currentFaction: string;
  flags: StoryFlag[];
  relations: CharacterRelation[];
  promises: StoryPromise[];
}

export interface StateDelta {
  chapterChange?: number;
  actChange?: number;
  flags?: StoryFlag[];
  relations?: Partial<CharacterRelation>[];
  promises?: Partial<StoryPromise>[];
}

export type ChunkType = 'local' | 'character' | 'story' | 'global';

export interface ContextChunk {
  id: string;
  text: string;
  type: ChunkType;
  tokens: number;
  graphDistance: number;
  timeDistance: number;
  charOverlap: number;
  embedSim: number;
  nodeImportance: number;
}

export type ContextBudgets = Record<ChunkType, number>;

export interface ContextWeights {
  lambda: number;
  mu: number;
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
  eta: number;
  kappa: number;
  p: number;
}