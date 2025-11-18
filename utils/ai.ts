// utils/ai.ts
import { GoogleGenAI, Type } from "@google/genai";
import { Settings, ScenesData, CharactersData, Scene, TextLine, DialogueLength, SceneLength, DialogueItem, Character, AIStructureType, AIGeneratedScene, Story } from '../types.ts';
import { generateDialogueWithLocalAI, generateStoryPlanWithLocalAI, generateCharacterDetailsWithLocalAI, generateSceneStructureWithLocalAI } from './localAI.ts';
import { logger } from './logger.ts';


const getGoogleAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateVideoForScene = async (
    prompt: string,
    resolution: '720p' | '1080p',
    aspectRatio: '16:9' | '9:16'
): Promise<string> => {
    // Create new instance to get latest key, as it might have been selected just now.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const requestPayload = {
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio
        }
    };
    logger.addLog({ type: 'request', source: 'generateVideoForScene (Google)', content: requestPayload });

    try {
        let operation = await ai.models.generateVideos(requestPayload);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10s poll
            operation = await ai.operations.getVideosOperation({ operation: operation });
            logger.addLog({ type: 'response', source: 'generateVideoForScene (Polling)', content: { done: operation.done, name: operation.name } });
        }

        if (operation.error) {
            throw new Error(`Video generation failed: ${operation.error.message}`);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }
        logger.addLog({ type: 'response', source: 'generateVideoForScene (Success)', content: { downloadLink } });
        return downloadLink;
    } catch (e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateVideoForScene (Google)', content: errorContent });
        throw e;
    }
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
      const dialogueLines = (currentScene.dialogue.filter(d => d.type === 'text') as TextLine[]).slice(-5).map(d => {
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
    story: Story,
    sceneId: string,
    dialogueLength: DialogueLength = 'Short',
    useContinuity: boolean = true,
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story' | 'text_only' = 'auto',
    userPrompt: string = ''
): Promise<DialogueItem[]> => {
  const scene = story.scenes[sceneId];
  if (!scene) throw new Error(`Scene with id "${sceneId}" not found.`);

  if (settings.aiProvider === 'local') {
    return generateDialogueWithLocalAI(settings.localModelUrl, scene, story.scenes, story.characters, dialogueLength, useContinuity, desiredOutcome, userPrompt);
  }

  // Google AI Logic
  const ai = getGoogleAI();
  
  const lengthMap = { 'Short': '3-5', 'Medium': '6-8', 'Long': '9-12' };
  const numLines = lengthMap[dialogueLength];

  const context = getStoryContext(story.scenes, story.characters, scene, useContinuity);
  const prompt = `${context}\nTASK: Based on the context, write the next ${numLines} lines of dialogue for the scene '${scene.name}'.\n${userPrompt ? `USER INSTRUCTION: "${userPrompt}"\n` : ''}The output must be a JSON array of dialogue objects.`;
  
  const config = {
      responseMimeType: "application/json",
      responseSchema: desiredOutcome === 'text_only' ? textOnlyDialogueSchema : dialogueAndOutcomeSchema,
  };

  const requestPayload = {
    model: "gemini-2.5-flash",
    contents: prompt,
    config: config
  };
  logger.addLog({ type: 'request', source: 'generateDialogueForScene (Google)', content: requestPayload });

  try {
    const response = await ai.models.generateContent(requestPayload);
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    logger.addLog({ type: 'response', source: 'generateDialogueForScene (Google)', content: result });
    return result;
  } catch(e) {
    const errorContent = e instanceof Error ? e.message : String(e);
    logger.addLog({ type: 'error', source: 'generateDialogueForScene (Google)', content: errorContent });
    throw e;
  }
};

export const generateDialogueFromNodes = async (
    settings: Settings,
    story: Story,
    contextSceneIds: string[],
    targetSceneId: string,
    userPrompt: string,
    dialogueLength: DialogueLength
): Promise<TextLine[]> => {
    if (settings.aiProvider === 'local') {
        // Local AI can reuse the main dialogue function with a constructed prompt
        const storySoFar = contextSceneIds.map(id => story.scenes[id]?.description).filter(Boolean).join(' ');
        const combinedPrompt = `The story so far: ${storySoFar}. Now, in this scene: ${userPrompt}`;
        const result = await generateDialogueWithLocalAI(settings.localModelUrl, story.scenes[targetSceneId], story.scenes, story.characters, dialogueLength, false, 'text_only', combinedPrompt);
        return result.filter(item => item.type === 'text') as TextLine[];
    }

    const ai = getGoogleAI();
    const characterDescriptions = Object.values(story.characters).map(c => `- ${c.name} (id: ${c.id}). Appearance: ${c.appearance}. Talking Style: ${c.talkingStyle}`).join('\n');
    const targetScene = story.scenes[targetSceneId];
    
    const storySoFar = contextSceneIds.map((id, index) => 
        `${index + 1}. Scene '${story.scenes[id]?.name}': ${story.scenes[id]?.description}`
    ).join('\n');

    const lengthMap = { 'Short': '3-5', 'Medium': '6-8', 'Long': '9-12', };
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
        - The dialogue should only consist of 'text' items.
        - Your output must be a valid JSON array of dialogue objects.
    `;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: textOnlyDialogueSchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateDialogueFromNodes (Google)', content: requestPayload });

    try {
        const response = await ai.models.generateContent(requestPayload);
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        logger.addLog({ type: 'response', source: 'generateDialogueFromNodes (Google)', content: result });
        return result;
    } catch(e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateDialogueFromNodes (Google)', content: errorContent });
        throw e;
    }
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
    
    const ai = getGoogleAI();
    const lengthMap = { 'Short': '3-4', 'Medium': '5-6', 'Long': '7-8' };
    const numScenes = lengthMap[sceneLength];
    const structureInstruction = storyType === 'branching' 
        ? "The story must have at least one choice that leads to different scenes." 
        : "The story must be linear and should not contain any choices.";

    // STEP 1: Generate Characters with a strict schema to ensure they are objects.
    const characterArraySchema = {
        type: Type.ARRAY,
        description: "An array of 2-3 main characters for the story.",
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "The character's full name." },
                appearance: { type: Type.STRING, description: "A short description of the character's physical appearance." },
                talkingStyle: { type: Type.STRING, description: "A short description of how the character speaks." }
            },
            required: ['name', 'appearance', 'talkingStyle']
        }
    };

    const charPrompt = `You are a creative writer. Based on the user's prompt, create 2-3 main characters for a visual novel. Respond with a valid JSON array of character objects.
USER PROMPT: "${prompt}"`;
    
    const charRequestPayload = {
        model: 'gemini-2.5-flash',
        contents: charPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: characterArraySchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateStoryPlan (Google - Step 1: Chars)', content: charRequestPayload });

    let characters: Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>[];
    try {
        const charResponse = await ai.models.generateContent(charRequestPayload);
        const charJsonText = charResponse.text.trim();
        characters = JSON.parse(charJsonText);
        logger.addLog({ type: 'response', source: 'generateStoryPlan (Google - Step 1: Chars)', content: characters });
    } catch (e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateStoryPlan (Google - Step 1: Chars)', content: errorContent });
        throw e;
    }

    if (!characters || characters.length === 0) {
        throw new Error("AI failed to generate characters.");
    }
    const characterContext = characters.map(c => `- ${c.name}: ${c.appearance}`).join('\n');
    const characterNames = characters.map(c => c.name);

    // STEP 2: Generate Scenes, using the characters from Step 1 as context.
    const scenePlanSchema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'A creative title for the story.' },
            scenes: {
                type: Type.ARRAY,
                description: 'An array of scene objects.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: 'A unique, lowercase_snake_case ID for the scene.' },
                        name: { type: Type.STRING, description: 'A short, descriptive name for the scene.' },
                        summary: { type: Type.STRING, description: 'A one-sentence summary of what happens in this scene.' },
                        characterIds: {
                            type: Type.ARRAY,
                            description: 'An array of character names present in the scene.',
                            items: { type: Type.STRING, enum: characterNames }
                        }
                    },
                    required: ['id', 'name', 'summary', 'characterIds']
                }
            }
        },
        required: ['title', 'scenes']
    };

    const scenePrompt = `You are a visual novel writer. Based on the user's prompt and the provided characters, create a story plan with a title and ${numScenes} scenes. ${structureInstruction} The first scene must have the id 'start'.
---
USER PROMPT: "${prompt}"
---
CHARACTERS:
${characterContext}
---
TASK: Respond with a single JSON object containing a 'title' and a 'scenes' array. For each scene, provide an 'id', 'name', 'summary', and a 'characterIds' array listing the names of characters present. The character names MUST be one of: ${characterNames.join(', ')}.`;

    const sceneRequestPayload = {
        model: 'gemini-2.5-pro',
        contents: scenePrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: scenePlanSchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateStoryPlan (Google - Step 2: Scenes)', content: sceneRequestPayload });

    try {
        const sceneResponse = await ai.models.generateContent(sceneRequestPayload);
        const sceneJsonText = sceneResponse.text.trim();
        const scenePlan = JSON.parse(sceneJsonText);
        
        // Combine the results from both steps into a single, well-structured plan
        const finalPlan = {
            ...scenePlan,
            characters: characters
        };

        logger.addLog({ type: 'response', source: 'generateStoryPlan (Google - Combined)', content: finalPlan });
        return finalPlan;
    } catch(e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateStoryPlan (Google - Step 2: Scenes)', content: errorContent });
        throw e;
    }
};

const characterGenerationSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The character's full name." },
        appearance: { type: Type.STRING, description: "A detailed description of the character's physical appearance." },
        talkingStyle: { type: Type.STRING, description: "A description of the character's speech patterns and style." }
    },
    required: ['name', 'appearance', 'talkingStyle']
};

export const generateCharacterDetailsWithGoogleAI = async (prompt: string): Promise<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>> => {
    const ai = getGoogleAI();
    const fullPrompt = `You are a creative character designer. Based on the user's prompt, create a single character with a creative name, detailed appearance, and distinctive talking style. USER PROMPT: "${prompt}". Your output must be a single JSON object.`;

    const requestPayload = {
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: characterGenerationSchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateCharacterDetails (Google)', content: requestPayload });

    try {
        const response = await ai.models.generateContent(requestPayload);
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        logger.addLog({ type: 'response', source: 'generateCharacterDetails (Google)', content: result });
        return result;
    } catch(e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateCharacterDetails (Google)', content: errorContent });
        throw e;
    }
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
            description: "An array of 2-3 new scene objects.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A temporary unique ID for the scene (e.g., 'new_scene_1')." },
                    name: { type: Type.STRING, description: "A descriptive name for the scene." },
                    description: { type: Type.STRING, description: "A one-sentence summary of the scene." },
                    characterIds: {
                        type: Type.ARRAY,
                        description: "An array of character IDs present in this scene.",
                        items: { type: Type.STRING }
                    },
                    dialogue: {
                        type: Type.ARRAY,
                        description: "A few lines of starting dialogue for the scene.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['text'] },
                                characterId: { type: Type.STRING, description: "The ID of the speaking character, or null for narrator." },
                                text: { type: Type.STRING, description: "The dialogue line." }
                            },
                            required: ['type', 'text']
                        }
                    }
                },
                required: ['id', 'name', 'description', 'characterIds', 'dialogue']
            }
        },
        connections: {
            type: Type.OBJECT,
            description: "An object describing how the new scenes connect to the story and each other.",
            properties: {
                sourceSceneConnection: {
                    type: Type.OBJECT,
                    description: "How the original source scene should connect to the new scenes.",
                    properties: {
                        type: { type: Type.STRING, enum: ['transition', 'choice'] },
                        nextSceneId: { type: Type.STRING, description: "For 'transition' type, the ID of the first new scene." },
                        choices: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    nextSceneId: { type: Type.STRING }
                                },
                                required: ['text', 'nextSceneId']
                            }
                        }
                    },
                    required: ['type']
                },
                internalConnections: {
                    type: Type.ARRAY,
                    description: "How the new scenes connect to each other.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            sourceSceneId: { type: Type.STRING },
                            outcome: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING, enum: ['transition', 'choice'] },
                                    nextSceneId: { type: Type.STRING },
                                    choices: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                text: { type: Type.STRING },
                                                nextSceneId: { type: Type.STRING }
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
    story: Story,
    contextSceneIds: string[],
    sourceSceneId: string,
    prompt: string,
    structureType: AIStructureType,
): Promise<{ scenes: AIGeneratedScene[], connections: any }> => {
    if (settings.aiProvider === 'local') {
        return generateSceneStructureWithLocalAI(settings.localModelUrl, contextSceneIds.map(id => story.scenes[id]), story.scenes[sourceSceneId], story.characters, prompt, structureType);
    }

    const ai = getGoogleAI();
    const characterDescriptions = Object.values(story.characters).map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const storySoFar = contextSceneIds.map((id, index) => `${index + 1}. Scene '${story.scenes[id].name}': ${story.scenes[id].description}`).join('\n');
    const sourceScene = story.scenes[sourceSceneId];

    let structureDescription = '';
    if (structureType === 'choice_branch') {
        structureDescription = `Create a "Choice Branch": 1 new scene that introduces a choice, and 2 new scenes representing the outcomes. Total: 3 scenes.`;
    } else {
        structureDescription = `Create a "Linear Sequence": 3 new scenes that follow each other in order.`;
    }

    const fullPrompt = `You are a visual novel writer. Generate a small group of interconnected scenes.
CONTEXT:
CHARACTERS:
${characterDescriptions}
STORY SO FAR:
${storySoFar}
The new scenes will connect FROM:
- Source Scene: '${sourceScene.name}' (id: ${sourceScene.id}): ${sourceScene.description}
TASK:
USER PROMPT: "${prompt}"
REQUESTED STRUCTURE: ${structureDescription}
INSTRUCTIONS: Create all scenes and connections. Use temporary unique IDs. Dialogue should be text-only. Output must be a single, valid JSON object.
`;

    const requestPayload = {
        model: 'gemini-2.5-pro',
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: sceneStructureSchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateSceneStructure (Google)', content: requestPayload });

    try {
        const response = await ai.models.generateContent(requestPayload);
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        logger.addLog({ type: 'response', source: 'generateSceneStructure (Google)', content: result });
        return result;
    } catch(e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateSceneStructure (Google)', content: errorContent });
        throw e;
    }
};