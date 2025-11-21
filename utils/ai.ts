
// utils/ai.ts
import { GoogleGenAI, Type } from "@google/genai";
// FIX: Import `TextLine` to use for type assertion.
import { Settings, ScenesData, CharactersData, Scene, TextLine, DialogueLength, SceneLength, DialogueItem, Character, AIStructureType, AIGeneratedScene } from '../types.ts';
import { generateDialogueWithLocalAI, generateStoryPlanWithLocalAI, generateCharacterDetailsWithLocalAI, generateSceneStructureWithLocalAI } from './localAI.ts';

const getGoogleAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateVideoForScene = async (
    prompt: string,
    resolution: '720p' | '1080p',
    aspectRatio: '16:9' | '9:16'
): Promise<string> => {
    // Create new instance to get latest key, as it might have been selected just now.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio
        }
    });

    while (!operation.done) {
        // This is a long operation, so we wait.
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10s poll
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        // FIX: Property 'failedVideos' does not exist on type 'GenerateVideosResponse'.
        // Refactored error handling to first check for `operation.error`.
        // If no error is present but no link is found, throw a generic message.
        // This can happen due to safety filters or other issues.
        throw new Error("Video generation completed, but no download link was found.");
    }

    return downloadLink;
};


const getStoryContext = (scenes: ScenesData, characters: CharactersData, currentScene: Scene, useContinuity: boolean): string => {
  const characterDescriptions = Object.values(characters).map(c => 
    `- Character: ${c.name} (id: ${c.id}).\n  Appearance: ${c.appearance}\n  Talking Style: ${c.talkingStyle}`
  ).join('\n');
  const sceneList = Object.values(scenes).map(s => `- Scene Name: '${s.name}', ID: '${s.id}'`).join('\n');
  
  let sceneContext = `The current scene is '${currentScene.name}'.`;
  if(currentScene.description) {
      sceneContext += ` The scene's summary is: '${currentScene.description}'.`;
  }
  
  const charactersInScene = currentScene.characters.map(sc => {
      const char = characters[sc.characterId];
      if (!char) return null;
      const spriteIds = char.sprites.map(s => `'${s.id}'`).join(', ');
      return `${char.name} is present. Available sprite IDs for ${char.name} are: ${spriteIds}.`;
  }).filter(Boolean).join(' ');

  sceneContext += ` ${charactersInScene}`;
  
  let recentDialogue = '';
  if (useContinuity) {
      // FIX: Add a type assertion to correctly narrow the type of dialogue items to `TextLine` after filtering.
      const dialogueLines = (currentScene.dialogue.filter(d => d.type === 'text') as TextLine[]).slice(-5).map(d => {
        // FIX: Add a type guard to `d.characterId` before accessing `characters` to prevent runtime errors if `d.characterId` is `null`.
        const charName = d.characterId && characters[d.characterId] ? characters[d.characterId].name : 'Narrator';
        return `${charName}: "${d.text}"`;
      }).join('\n');

      if (dialogueLines) {
          recentDialogue = `
            RECENT DIALOGUE IN THIS SCENE:
            ${dialogueLines}
          `;
      }
  }


  return `
    CONTEXT:
    This is a visual novel story.
    
    CHARACTERS IN THIS STORY:
    ${characterDescriptions}

    AVAILABLE SCENES:
    ${sceneList}

    ${sceneContext}
    ${recentDialogue}
  `;
};

const textOnlyDialogueSchema = {
    type: Type.ARRAY,
    description: "An array of dialogue text items.",
    items: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['text'] },
            characterId: { type: Type.STRING, description: "For 'text' type: The ID of the character speaking. Use null for a narrator." },
            spriteId: { type: Type.STRING, description: "For 'text' type: Optional. The ID of the sprite to show." },
            text: { type: Type.STRING, description: "For 'text' type: The line of dialogue." },
        },
        required: ['type', 'text']
    }
};

const dialogueAndOutcomeSchema = {
    type: Type.ARRAY,
    description: "An array of dialogue items. The last item can be an outcome like a transition, choice, or end_story.",
    items: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['text', 'choice', 'transition', 'end_story'] },
            characterId: { type: Type.STRING, description: "For 'text' type: The ID of the character speaking. Use null for a narrator." },
            spriteId: { type: Type.STRING, description: "For 'text' type: Optional. The ID of the sprite to show." },
            text: { type: Type.STRING, description: "For 'text' type: The line of dialogue." },
            nextSceneId: { type: Type.STRING, description: "For 'transition' type: The ID of the scene to transition to." },
            choices: {
                type: Type.ARRAY,
                description: "For 'choice' type: An array of 2-3 choice objects.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "The text for the choice option." },
                        nextSceneId: { type: Type.STRING, description: "The ID of the scene this choice leads to. Must be a valid scene ID from the context." }
                    },
                    required: ['text', 'nextSceneId']
                }
            }
        },
        required: ['type']
    }
};


export const generateDialogueForScene = async (
    settings: Settings,
    scene: Scene, 
    scenes: ScenesData, 
    characters: CharactersData,
    dialogueLength: DialogueLength = 'Short',
    useContinuity: boolean = true,
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story' | 'text_only' = 'auto',
    userPrompt: string = ''
): Promise<DialogueItem[]> => {
  if (settings.aiProvider === 'local') {
    return generateDialogueWithLocalAI(settings.localModelUrl, scene, scenes, characters, dialogueLength, useContinuity, desiredOutcome, userPrompt);
  }

  // Google AI Logic
  const ai = getGoogleAI();
  const context = getStoryContext(scenes, characters, scene, useContinuity);
  
  const lengthMap = {
      'Short': '3-5',
      'Medium': '6-8',
      'Long': '9-12',
  };
  const numLines = lengthMap[dialogueLength];

  let outcomeInstruction = '';
    switch (desiredOutcome) {
        case 'transition':
            outcomeInstruction = `The dialogue must lead to a natural continuation of the story. The very last item in the generated array MUST be a 'transition' object, pointing to a relevant 'nextSceneId' from the list of available scenes.`;
            break;
        case 'choice':
            outcomeInstruction = `The dialogue must build up to a meaningful decision for the player. The very last item in the generated array MUST be a 'choice' object with 2 compelling options. Each choice's 'nextSceneId' must be a relevant and valid ID from the list of available scenes.`;
            break;
        case 'end_story':
            outcomeInstruction = `The dialogue must bring the scene to a satisfying conclusion, ending this branch of the story. The very last item in the generated array MUST be an 'end_story' object.`;
            break;
        case 'text_only':
            outcomeInstruction = `Only generate 'text' items. Do not generate any 'choice', 'transition', or 'end_story' items. The scene will conclude with a pre-determined outcome that is handled separately.`;
            break;
        default: // 'auto'
            outcomeInstruction = `After the dialogue, decide if the scene should end. If it does, the very last item in the generated array can be a 'transition', 'choice', or 'end_story' object. If the scene should continue with more dialogue later, only generate 'text' items.`;
    }

  let userInstruction = '';
  if (userPrompt.trim()) {
      userInstruction = `
          USER INSTRUCTION for the next lines: "${userPrompt.trim()}"
          Generate the dialogue based on this specific instruction.
      `;
  }

  const prompt = `
    ${context}

    TASK:
    Based on the context, write the next ${numLines} lines of dialogue for the scene '${scene.name}'. 
    ${userInstruction}
    - The dialogue should be engaging and move the story forward.
    - Use the provided character descriptions (appearance, talking style) to inform their dialogue.
    - Assign dialogue to characters using their 'characterId'. Use null for a narrator.
    - Optionally set a 'spriteId' to show emotion.
    - ${outcomeInstruction}
    - The output must be a JSON array of dialogue objects, matching the provided schema.
  `;
  
  const config = {
      responseMimeType: "application/json",
      responseSchema: desiredOutcome === 'text_only' ? textOnlyDialogueSchema : dialogueAndOutcomeSchema,
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: config
  });
  const jsonText = response.text.trim();
  return JSON.parse(jsonText);
};

export const generateDialogueFromNodes = async (
    settings: Settings,
    contextScenes: Scene[],
    targetScene: Scene,
    characters: CharactersData,
    userPrompt: string,
    dialogueLength: DialogueLength
): Promise<TextLine[]> => {
    // For local AI, this feature could be simplified or use a different prompt structure.
    // For now, we focus on the Google AI implementation.
    if (settings.aiProvider === 'local') {
        // A simplified fallback for local models.
        return generateDialogueForScene(settings, targetScene, { [targetScene.id]: targetScene }, characters, dialogueLength, false, 'text_only', `The story so far: ${contextScenes.map(s => s.description).join(' ')}. Now, in this scene: ${userPrompt}`) as Promise<TextLine[]>;
    }

    const ai = getGoogleAI();
    const characterDescriptions = Object.values(characters).map(c => `- ${c.name} (id: ${c.id}). Appearance: ${c.appearance}. Talking Style: ${c.talkingStyle}`).join('\n');
    
    const storySoFar = contextScenes.map((s, index) => 
        `${index + 1}. Scene '${s.name}': ${s.description}`
    ).join('\n');

    const lengthMap = {
      'Short': '3-5',
      'Medium': '6-8',
      'Long': '9-12',
    };
    const numLines = lengthMap[dialogueLength];

    const prompt = `
        You are a visual novel writer. Your task is to write the dialogue for a specific scene based on the context of previous scenes.

        ---
        CONTEXT:
        
        CHARACTERS IN THIS STORY:
        ${characterDescriptions}

        STORY SO FAR (based on selected context scenes):
        ${storySoFar}

        CURRENT SCENE TO WRITE DIALOGUE FOR:
        Scene '${targetScene.name}' (id: ${targetScene.id}): ${targetScene.description}

        ---
        TASK:
        Write the next ${numLines} lines of dialogue for the scene '${targetScene.name}'.
        - The dialogue must logically follow the events of the previous scenes.
        - ${userPrompt ? `Follow this specific instruction from the user: "${userPrompt}"` : ''}
        - The dialogue should only consist of 'text' items. Do not generate choices, transitions, or end the story.
        - Assign dialogue to characters using their 'characterId'. Use null for a narrator.
        - Optionally set a 'spriteId' to show emotion.
        - Your output must be a valid JSON array of dialogue objects, strictly following the provided schema.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: textOnlyDialogueSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};


const storyPlanSchema = {
    type: Type.OBJECT,
    properties: {
        characters: {
            type: Type.ARRAY,
            description: "A list of all characters that appear in the story.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A short, lowercase id for the character (e.g., 'elara')." },
                    name: { type: Type.STRING, description: "The character's name (e.g., 'Elara')." },
                    appearance: { type: Type.STRING, description: "A brief description of the character's appearance." },
                    talkingStyle: { type: Type.STRING, description: "A brief description of how the character speaks." },
                    gender: { type: Type.STRING, enum: ['male', 'female', 'trans', 'neutral'], description: "The gender of the character." }
                },
                required: ['id', 'name', 'appearance', 'talkingStyle', 'gender'],
            },
        },
        scenes: {
            type: Type.ARRAY,
            description: "A list of scenes that form a short story. The 'start' scene must be first.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A short, lowercase_snake_case id for the scene (e.g., 'opening_market'). The first scene must have id 'start'." },
                    name: { type: Type.STRING, description: "A short, descriptive name for the scene (e.g., 'Opening Market')." },
                    summary: { type: Type.STRING, description: "A one-sentence summary of what happens in this scene." },
                    characterIds: { type: Type.ARRAY, description: "IDs of characters present in the scene.", items: { type: Type.STRING } },
                    outcome: {
                        type: Type.OBJECT,
                        description: "Describes what happens at the end of the scene.",
                        properties: {
                            type: { type: Type.STRING, enum: ['transition', 'choice', 'end_story'], description: "The type of outcome." },
                            nextSceneId: { type: Type.STRING, description: "For 'transition', the ID of the next scene. Must match one of the scene IDs in this plan." },
                            choices: {
                                type: Type.ARRAY,
                                description: "For 'choice', a list of 2-3 choices.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        text: { type: Type.STRING, description: "The text for the choice option." },
                                        nextSceneId: { type: Type.STRING, description: "The ID of the scene this choice leads to. Must match one of the scene IDs in this plan." }
                                    },
                                    required: ['text', 'nextSceneId']
                                }
                            }
                        },
                        required: ['type']
                    }
                },
                required: ['id', 'name', 'summary', 'characterIds', 'outcome'],
            }
        }
    },
    required: ['characters', 'scenes'],
};


export const generateStoryPlan = async (
    settings: Settings,
    prompt: string, 
    sceneLength: SceneLength = 'Short',
    storyType: 'branching' | 'linear' = 'branching'
): Promise<any> => {
    if (settings.aiProvider === 'local') {
      return generateStoryPlanWithLocalAI(settings.localModelUrl, prompt, sceneLength, storyType);
    }

    // Google AI Logic
    const ai = getGoogleAI();
    const lengthMap = {
      'Short': '3-4',
      'Medium': '5-6',
      'Long': '7-8',
    };
    const numScenes = lengthMap[sceneLength];

    const structureInstruction = storyType === 'branching'
      ? "The story must have at least one choice that leads to different scenes."
      : "The story must be linear and should not contain any choices. All scene outcomes must be 'transition' or 'end_story'.";

    const fullPrompt = `
        You are a creative writer designing a short, branching visual novel.
        Based on the user's prompt, create a basic story plan.
        The plan should include all characters that appear in the story (with appearance, talking style, and gender) and a list of ${numScenes} scenes that form a cohesive narrative.
        ${structureInstruction}
        The first scene must have the id 'start'.
        For each scene, define its outcome:
        - 'transition': leads directly to one other scene.
        - 'choice': presents the player with multiple options, each leading to a different scene. (Only use if the story is branching).
        - 'end_story': concludes a branch of the story.

        IMPORTANT RULE: All 'nextSceneId' values used in 'transition' or 'choice' outcomes MUST correspond to an 'id' of another scene within this same generated plan. Do not create branches that lead to non-existent scenes.

        USER PROMPT: "${prompt}"

        Your output must be a single JSON object that strictly follows the provided schema.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: fullPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: storyPlanSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

const characterGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "The character's full name. Should be creative and fitting for the prompt." },
    appearance: { type: Type.STRING, description: "A detailed 2-3 sentence description of the character's physical appearance, clothing, and overall look." },
    talkingStyle: { type: Type.STRING, description: "A 1-2 sentence description of the character's voice, speech patterns, and common phrases." },
    gender: { type: Type.STRING, enum: ['male', 'female', 'trans', 'neutral'], description: "The gender of the character." }
  },
  required: ['name', 'appearance', 'talkingStyle', 'gender']
};

export const generateCharacterDetailsWithGoogleAI = async (prompt: string): Promise<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>> => {
    const ai = getGoogleAI();
    const fullPrompt = `You are a creative character designer for a visual novel.
    Based on the user's prompt, create a single, compelling character.
    Generate a creative name, a detailed appearance, a distinctive talking style, and their gender.

    USER PROMPT: "${prompt}"

    Your output must be a single JSON object that strictly follows the provided schema.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: characterGenerationSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateCharacterDetails = async (
    settings: Settings, 
    prompt: string
): Promise<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>> => {
    if (settings.aiProvider === 'local') {
        return generateCharacterDetailsWithLocalAI(settings.localModelUrl, prompt);
    }
    return generateCharacterDetailsWithGoogleAI(prompt);
};

const sceneStructureSchema = {
    type: Type.OBJECT,
    properties: {
        scenes: {
            type: Type.ARRAY,
            description: "An array of 2-3 new scenes to be created.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A temporary, unique, lowercase_snake_case id for this new scene (e.g., 'choice_point', 'outcome_a')." },
                    name: { type: Type.STRING, description: "A short, descriptive name for the scene." },
                    description: { type: Type.STRING, description: "A one or two-sentence summary of what happens in this scene." },
                    characterIds: {
                        type: Type.ARRAY,
                        description: "An array of character IDs present in this scene. Must be from the provided character list.",
                        items: { type: Type.STRING }
                    },
                    dialogue: {
                        type: Type.ARRAY,
                        description: "An array of 2-4 dialogue text lines for this scene.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['text'] },
                                characterId: { type: Type.STRING, description: "The ID of the character speaking. Use null for a narrator." },
                                spriteId: { type: Type.STRING, description: "Optional. The ID of the sprite to show." },
                                text: { type: Type.STRING, description: "The line of dialogue." },
                            },
                            required: ['type', 'text', 'characterId']
                        }
                    }
                },
                required: ['id', 'name', 'description', 'characterIds', 'dialogue']
            }
        },
        connections: {
            type: Type.OBJECT,
            description: "Defines how the new scenes connect to the source scene and to each other.",
            properties: {
                sourceSceneConnection: {
                    type: Type.OBJECT,
                    description: "How the source scene connects to the new structure. Will be either a transition or a choice.",
                    properties: {
                         type: { type: Type.STRING, enum: ['transition', 'choice'] },
                         nextSceneId: { type: Type.STRING, description: "For a 'transition', the temporary ID of the first new scene." },
                         choices: {
                            type: Type.ARRAY,
                            description: "For a 'choice', an array of choices. The number of choices must match the number of new outcome scenes.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING, description: "The text for the choice option." },
                                    nextSceneId: { type: Type.STRING, description: "The temporary ID of the scene this choice leads to." }
                                },
                                required: ['text', 'nextSceneId']
                            }
                         }
                    },
                    required: ['type']
                },
                internalConnections: {
                    type: Type.ARRAY,
                    description: "An array defining connections between the newly generated scenes.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            sourceSceneId: { type: Type.STRING, description: "The temporary ID of the source scene for this connection." },
                            outcome: {
                                type: Type.OBJECT,
                                description: "The outcome object to add to the source scene's dialogue.",
                                properties: {
                                    type: { type: Type.STRING, enum: ['transition', 'choice'] },
                                    nextSceneId: { type: Type.STRING, description: "For a 'transition', the temporary ID of the target scene." },
                                    // FIX: Add the missing `choices` property definition to guide the AI.
                                    choices: {
                                        type: Type.ARRAY,
                                        description: "For a 'choice', an array of choices.",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                text: { type: Type.STRING, description: "The text for the choice option." },
                                                nextSceneId: { type: Type.STRING, description: "The temporary ID of the scene this choice leads to." }
                                            },
                                            required: ['text', 'nextSceneId']
                                        }
                                    }
                                },
                                required: ['type']
                            }
                        },
                        required: ['sourceSceneId', 'outcome']
                    }
                }
            },
            required: ['sourceSceneConnection']
        }
    },
    required: ['scenes', 'connections']
};


export const generateSceneStructure = async (
    settings: Settings,
    contextScenes: Scene[],
    sourceScene: Scene,
    characters: CharactersData,
    prompt: string,
    structureType: AIStructureType,
): Promise<{ scenes: AIGeneratedScene[], connections: any }> => {
    if (settings.aiProvider === 'local') {
        return generateSceneStructureWithLocalAI(settings.localModelUrl, contextScenes, sourceScene, characters, prompt, structureType);
    }

    const ai = getGoogleAI();
    const characterDescriptions = Object.values(characters).map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const storySoFar = contextScenes.map((s, index) => `${index + 1}. Scene '${s.name}': ${s.description}`).join('\n');
    
    let structureDescription = '';
    let exampleStructure = '';
    if (structureType === 'choice_branch') {
        structureDescription = `
            The structure should be a "Choice Branch":
            1.  One new scene that introduces a choice.
            2.  Two new scenes representing the different outcomes of that choice.
            Total scenes to generate: 3.
            The source scene ('${sourceScene.name}') should transition to the new choice scene. The choice scene should then offer two choices, each leading to one of the new outcome scenes.
        `;
        exampleStructure = `For example, a 'choice_branch' would have a 'sourceSceneConnection' of type 'transition' pointing to the new choice scene, and the choice scene's outcome would be defined in 'internalConnections'.`;
    } else { // linear_sequence
        structureDescription = `
            The structure should be a "Linear Sequence":
            1.  Three new scenes that follow each other in order.
            Total scenes to generate: 3.
            The source scene ('${sourceScene.name}') should transition to the first new scene. The first new scene should transition to the second, and the second to the third.
        `;
        exampleStructure = `For example, a 'linear_sequence' would have a 'sourceSceneConnection' of type 'transition' pointing to the first new scene, and 'internalConnections' would define the transition from the first to the second, and second to the third.`;
    }


    const fullPrompt = `
        You are a visual novel writer. Your task is to generate a small group of interconnected scenes based on a prompt and a requested structure, which will be added after a specified "source scene".

        ---
        CONTEXT:
        
        CHARACTERS IN THIS STORY:
        ${characterDescriptions}

        STORY SO FAR (based on selected context scenes):
        ${storySoFar}

        The new scenes will connect FROM this scene:
        - Source Scene: '${sourceScene.name}' (id: ${sourceScene.id}): ${sourceScene.description}

        ---
        TASK:
        Based on the user's prompt, generate a new scene structure.

        USER PROMPT: "${prompt}"

        REQUESTED STRUCTURE:
        ${structureDescription}

        INSTRUCTIONS:
        - Create all the scenes and the connections between them.
        - Each scene needs a temporary unique ID, a name, a description, a list of character IDs present, and 2-4 lines of dialogue.
        - Define how the source scene connects to the new structure, and how the new scenes connect to each other. ${exampleStructure}
        - The dialogue should only consist of 'text' items.
        - Ensure all IDs used in connections match the temporary IDs of the generated scenes.
        - Your output must be a single, valid JSON object that strictly follows the provided schema.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro', // Use a more powerful model for this complex task
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: sceneStructureSchema,
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};