
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Settings, ScenesData, CharactersData, Scene, TextLine, DialogueLength, SceneLength, DialogueItem, Character, AIStructureType, AIGeneratedScene, Story, StoryVariable } from '../types.ts';
import { generateDialogueWithLocalAI, generateStoryPlanWithLocalAI, generateCharacterDetailsWithLocalAI, generateSceneStructureWithLocalAI } from './localAI.ts';
import { logger } from './logger.ts';

const getGoogleAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const sceneStructureSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        scenes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    dialogue: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT, 
                            properties: {
                                type: { type: Type.STRING }, // "text"
                                characterId: { type: Type.STRING, nullable: true },
                                text: { type: Type.STRING }
                            }
                        } 
                    }
                }
            }
        },
        connections: {
            type: Type.OBJECT,
            properties: {
                sourceSceneConnection: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        nextSceneId: { type: Type.STRING, nullable: true },
                        choices: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    nextSceneId: { type: Type.STRING }
                                }
                            },
                            nullable: true
                        }
                    }
                },
                internalConnections: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            sourceSceneId: { type: Type.STRING },
                            outcome: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    nextSceneId: { type: Type.STRING, nullable: true },
                                    choices: {
                                        type: Type.ARRAY,
                                        items: {
                                             type: Type.OBJECT,
                                             properties: {
                                                 text: { type: Type.STRING },
                                                 nextSceneId: { type: Type.STRING }
                                             }
                                        },
                                        nullable: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

const buildPromptContext = (scenes: ScenesData, characters: CharactersData, currentScene: Scene, useContinuity: boolean): string => {
    const characterDescriptions = Object.values(characters).map(c => 
      `- ${c.name} (id: ${c.id}): ${c.appearance}. Style: ${c.talkingStyle}`
    ).join('\n');
  
    const sceneList = Object.values(scenes).map(s => `- ${s.name} (id: ${s.id})`).join('\n');
    
    let sceneContext = `Current Scene: '${currentScene.name}'\nSummary: ${currentScene.description || 'N/A'}`;
    
    const charsInScene = currentScene.characters
        .map(sc => characters[sc.characterId]?.name)
        .filter(Boolean)
        .join(', ');
    
    if (charsInScene) {
        sceneContext += `\nCharacters Present: ${charsInScene}`;
    }
    
    let recentDialogue = '';
    if (useContinuity) {
        const lines = (currentScene.dialogue.filter(d => d.type === 'text') as TextLine[]).slice(-8);
        if (lines.length > 0) {
            recentDialogue = `\nRecent Dialogue:\n` + lines.map(d => {
                const charName = d.characterId ? characters[d.characterId]?.name : 'Narrator';
                return `${charName}: "${d.text}"`;
            }).join('\n');
        }
    }
  
    return `
  Characters:
  ${characterDescriptions}
  
  Scenes:
  ${sceneList}
  
  ${sceneContext}
  ${recentDialogue}
    `;
};

export const generateDialogueForScene = async (
    settings: Settings,
    story: Story,
    sceneId: string,
    characters: CharactersData,
    dialogueLength: DialogueLength,
    useContinuity: boolean,
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story' | 'text_only' = 'auto',
    userPrompt: string = ''
): Promise<DialogueItem[]> => {
    const scene = story.scenes[sceneId];
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    if (settings.aiProvider === 'local') {
        return generateDialogueWithLocalAI(settings.localModelUrl, scene, story.scenes, characters, dialogueLength, useContinuity, desiredOutcome, userPrompt);
    }

    const ai = getGoogleAI();
    const context = buildPromptContext(story.scenes, characters, scene, useContinuity);
    const lengthMap = { 'Short': '3-5', 'Medium': '6-8', 'Long': '9-12' };
    const numLines = lengthMap[dialogueLength];

    let outcomeInstruction = '';
    switch (desiredOutcome) {
        case 'transition': outcomeInstruction = `End with a transition.`; break;
        case 'choice': outcomeInstruction = `End with a choice.`; break;
        case 'end_story': outcomeInstruction = `End the story.`; break;
        case 'text_only': outcomeInstruction = `Only generate text dialogue. Do not include choices or transitions.`; break;
        default: outcomeInstruction = `You choose the outcome (continue, choice, or transition).`;
    }

    const prompt = `Write the next ${numLines} lines of dialogue for a visual novel.
${outcomeInstruction}
${userPrompt ? `Extra instruction: ${userPrompt}` : ''}
Context:
${context}`;

    // Define schema for dialogue items
    const dialogueSchema: Schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['text', 'choice', 'transition', 'end_story'] },
                characterId: { type: Type.STRING, nullable: true },
                spriteId: { type: Type.STRING, nullable: true },
                text: { type: Type.STRING, nullable: true },
                nextSceneId: { type: Type.STRING, nullable: true },
                choices: {
                    type: Type.ARRAY,
                    nullable: true,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            nextSceneId: { type: Type.STRING }
                        }
                    }
                }
            },
            required: ['type']
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: dialogueSchema,
            systemInstruction: "You are a visual novel writer. Output a valid JSON array of dialogue objects.",
        }
    });

    const items = JSON.parse(response.text || '[]') as DialogueItem[];
    // Post-process to ensure valid structure if needed
    return items;
};

export const generateDialogueFromNodes = async (
    settings: Settings,
    story: Story,
    contextSceneIds: string[],
    targetSceneId: string,
    characters: CharactersData,
    prompt: string,
    dialogueLength: DialogueLength
): Promise<DialogueItem[]> => {
    // This is essentially a variation of generateDialogueForScene but with specific context scenes
    // For simplicity, we can reuse the same logic or build a custom context
    // Here we use the target scene as the main context but inject info from context scenes
    
    const targetScene = story.scenes[targetSceneId];
    const contextInfo = contextSceneIds.map(id => {
        const s = story.scenes[id];
        return `Context Scene: ${s.name}\n${s.description}`;
    }).join('\n\n');

    const customPrompt = `Considering these previous scenes:\n${contextInfo}\n\n${prompt}`;
    
    return generateDialogueForScene(
        settings, 
        story, 
        targetSceneId, 
        characters, 
        dialogueLength, 
        false, // Don't auto-include recent lines from target scene since we are generating from scratch or specific context
        'text_only', // Usually we just want the content, outcome is handled by the editor
        customPrompt
    );
};


export const generateStoryPlan = async (
    settings: Settings,
    prompt: string,
    sceneLength: SceneLength | 'Epic',
    storyType: 'branching' | 'linear'
): Promise<{ title: string; scenes: any[]; characters: any[]; variables: any[] }> => {
    if (settings.aiProvider === 'local') {
        return generateStoryPlanWithLocalAI(settings.localModelUrl, prompt, sceneLength, storyType);
    }

    const ai = getGoogleAI();
    const lengthMap = { 'Short': '3-4', 'Medium': '5-6', 'Long': '7-8', 'Epic': '12-15' };
    const numScenes = lengthMap[sceneLength];

    const fullPrompt = `Create a visual novel story plan based on this prompt: "${prompt}".
    Length: ${numScenes} scenes. Structure: ${storyType}.
    
    Output JSON with:
    1. title (string)
    2. characters (array of { name, appearance, talkingStyle })
    3. variables (array of { name, type: "boolean"|"number", initialValue })
    4. scenes (array of { id, name, summary, characterIds (use names temporarily), outcome: { type: "transition"|"choice"|"end_story", choices?: [{text, nextSceneId}], nextSceneId? } })
    
    Make sure scene IDs are snake_case strings.`;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            characters: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        appearance: { type: Type.STRING },
                        talkingStyle: { type: Type.STRING }
                    }
                }
            },
            variables: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        type: { type: Type.STRING, enum: ["boolean", "number", "string"] },
                        initialValue: { type: Type.STRING } // Simplify as string for schema, parse later
                    }
                }
            },
            scenes: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                        outcome: {
                             type: Type.OBJECT,
                             properties: {
                                 type: { type: Type.STRING },
                                 nextSceneId: { type: Type.STRING, nullable: true },
                                 choices: {
                                     type: Type.ARRAY,
                                     items: {
                                         type: Type.OBJECT,
                                         properties: {
                                             text: { type: Type.STRING },
                                             nextSceneId: { type: Type.STRING }
                                         }
                                     },
                                     nullable: true
                                 }
                             }
                        }
                    }
                }
            }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "You are a creative director for a game studio."
        }
    });

    return JSON.parse(response.text || '{}');
};

export const generateCharacterDetails = async (
    settings: Settings,
    prompt: string
): Promise<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>> => {
    if (settings.aiProvider === 'local') {
        return generateCharacterDetailsWithLocalAI(settings.localModelUrl, prompt);
    }

    const ai = getGoogleAI();
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            appearance: { type: Type.STRING },
            talkingStyle: { type: Type.STRING }
        }
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a character based on: "${prompt}"`,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });
    
    return JSON.parse(response.text || '{}');
};

export const generateVideoForScene = async (
    prompt: string,
    resolution: '720p' | '1080p',
    aspectRatio: '16:9' | '9:16'
): Promise<string> => {
    const ai = getGoogleAI();
    
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
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed to return a URI.");
    return downloadLink;
};

export const generateSceneStructure = async (
    settings: Settings,
    story: Story,
    contextSceneIds: string[],
    sourceSceneId: string,
    characters: CharactersData,
    prompt: string,
    structureType: AIStructureType,
): Promise<{ scenes: AIGeneratedScene[], connections: any }> => {
    if (settings.aiProvider === 'local') {
        return generateSceneStructureWithLocalAI(settings.localModelUrl, contextSceneIds.map(id => story.scenes[id]), story.scenes[sourceSceneId], characters, prompt, structureType);
    }

    const ai = getGoogleAI();
    const characterDescriptions = Object.values(characters).map(c => `- ${c.name} (id: ${c.id})`).join('\n');
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
        model: 'gemini-3-pro-preview', // Using pro for complex structural tasks
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: sceneStructureSchema,
        },
    };
    logger.addLog({ type: 'request', source: 'generateSceneStructure (Google)', content: requestPayload });

    try {
        const response = await ai.models.generateContent(requestPayload);
        const jsonText = response.text || '{}';
        const result = JSON.parse(jsonText);
        logger.addLog({ type: 'response', source: 'generateSceneStructure (Google)', content: result });
        return result;
    } catch(e) {
        const errorContent = e instanceof Error ? e.message : String(e);
        logger.addLog({ type: 'error', source: 'generateSceneStructure (Google)', content: errorContent });
        throw e;
    }
};
