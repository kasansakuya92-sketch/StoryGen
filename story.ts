// story.ts
import { ProjectsData, ScenesData, CharactersData } from './types.ts';

export const defaultCharacters: CharactersData = {
  'hero': {
    id: 'hero',
    name: 'Hero',
    defaultSpriteId: 'normal',
    sprites: [
      { id: 'normal', url: 'https://picsum.photos/seed/hero-normal/600/800' },
      { id: 'happy', url: 'https://picsum.photos/seed/hero-happy/600/800' },
    ],
    talkingStyle: 'Confident and optimistic.',
    appearance: 'A young adventurer with bright eyes and a ready smile, wearing practical leather armor.'
  },
  'friend': {
    id: 'friend',
    name: 'Friend',
    defaultSpriteId: 'normal',
    sprites: [
      { id: 'normal', url: 'https://picsum.photos/seed/friend-normal/600/800' },
      { id: 'surprised', url: 'https://picsum.photos/seed/friend-surprised/600/800' },
    ],
    talkingStyle: 'Slightly cautious but warm and friendly.',
    appearance: 'Dressed in comfortable, casual clothes, with a thoughtful expression.'
  },
};

const scenes: ScenesData = {
  'start': {
    id: 'start',
    name: 'The Adventure Begins',
    description: 'The hero decides to start their day by looking for their friend.',
    background: 'https://picsum.photos/seed/bg-start/1920/1080',
    characters: [
      { characterId: 'hero', spriteId: 'normal', position: 'left' },
    ],
    dialogue: [
      { type: 'text', characterId: 'hero', text: 'What a beautiful day! I should go find my friend.' },
      { type: 'transition', nextSceneId: 'meet_friend' },
    ],
    position: { x: 50, y: 50 },
  },
  'meet_friend': {
    id: 'meet_friend',
    name: 'Meeting a Friend',
    description: 'The hero meets their friend in the park and proposes an adventure.',
    background: 'https://picsum.photos/seed/bg-park/1920/1080',
    characters: [
      { characterId: 'hero', spriteId: 'happy', position: 'left' },
      { characterId: 'friend', spriteId: 'normal', position: 'right' },
    ],
    dialogue: [
      { type: 'text', characterId: 'hero', text: 'Hey there! Fancy seeing you here.' },
      { type: 'text', characterId: 'friend', spriteId: 'surprised', text: 'Oh! You startled me. What are you up to?' },
      { 
        type: 'choice', 
        choices: [
          { text: '"Want to go on an adventure?"', nextSceneId: 'adventure_yes' },
          { text: '"Just enjoying the weather."', nextSceneId: 'adventure_no' },
        ]
      },
    ],
    position: { x: 350, y: 50 },
  },
  'adventure_yes': {
    id: 'adventure_yes',
    name: 'Adventure Accepted',
    description: 'The friend enthusiastically agrees to go on an adventure.',
    background: 'https://picsum.photos/seed/bg-park/1920/1080',
    characters: [
      { characterId: 'friend', spriteId: 'normal', position: 'right' },
    ],
    dialogue: [
      { type: 'text', characterId: 'friend', text: 'An adventure? I\'m in!' },
      { type: 'end_story' },
    ],
    position: { x: 650, y: 0 },
  },
  'adventure_no': {
    id: 'adventure_no',
    name: 'Adventure Declined',
    description: 'The friend politely declines the adventure, preferring to enjoy the weather.',
    background: 'https://picsum.photos/seed/bg-park/1920/1080',
    characters: [
      { characterId: 'friend', spriteId: 'normal', position: 'right' },
    ],
    dialogue: [
      { type: 'text', characterId: 'friend', text: 'Same here. It\'s a lovely day.' },
      { type: 'end_story' },
    ],
    position: { x: 650, y: 150 },
  },
};


export const initialProjectsData: ProjectsData = {
    'proj_1': {
        id: 'proj_1',
        name: 'My First Project',
        stories: {
            'story_1': {
                id: 'story_1',
                name: 'A Simple Adventure',
                characters: defaultCharacters,
                startSceneId: 'start',
                scenes: scenes,
            }
        }
    }
};