// utils/localAI.ts
import { ScenesData, CharactersData, Scene, DialogueLength, SceneLength, DialogueItem, TextLine, Character, AIGeneratedScene, AIStructureType } from '../types.ts';
import { logger } from './logger.ts';


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
          recentDialogue = `\nRECENT DIALOGUE IN THIS SCENE:\n${dialogueLines}`;
      }
  }

  return `This is a visual novel story.
CHARACTERS IN THIS STORY:
${characterDescriptions}

AVAILABLE SCENES:
${sceneList}

${sceneContext}${recentDialogue}
  `;
};

/**
 * Cleans and parses a JSON string from an LLM response.
 * Handles common issues like markdown fences, trailing commas, and truncation.
 */
function sanitizeAndParseJson(jsonString: string | undefined): any {
    if (typeof jsonString !== 'string' || !jsonString.trim()) {
        throw new SyntaxError("Received empty or invalid string from model.");
    }
    
    // 1. Remove markdown fences and trim whitespace
    let cleanedString = jsonString.replace(/```json\n?|```/g, '').trim();

    // 2. Attempt to fix trailing commas in objects and arrays
    cleanedString = cleanedString.replace(/,\s*([}\]])/g, '$1');

    // 3. Remove non-printable characters
    // eslint-disable-next-line no-control-regex
    cleanedString = cleanedString.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F]/g, '');

    // 4. Attempt to parse, and if it fails due to truncation, try to fix it.
    try {
        return JSON.parse(cleanedString);
    } catch (error) {
        let fixedString = cleanedString;
        
        // Attempt to close an unclosed array
        if (fixedString.startsWith('[') && !fixedString.endsWith(']')) {
            fixedString = fixedString.replace(/,\s*$/, '') + ']'; // remove trailing comma
        }
        // Attempt to close an unclosed object
        else if (fixedString.startsWith('{') && !fixedString.endsWith('}')) {
             fixedString = fixedString.replace(/,\s*$/, '') + '}'; // remove trailing comma
        }

        try {
            // Try parsing the fixed string
            return JSON.parse(fixedString);
        } catch (fixError) {
             // If fixing also fails, throw the original-style error with original content
            console.error("Final attempt to parse JSON failed. Cleaned content:", cleanedString);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new SyntaxError(`The local model did not return valid JSON, even after sanitization. Error: ${errorMessage}`);
        }
    }
}


async function postToLocalModel(url: string, messages: { role: string; content: string }[], source: string): Promise<any> {
    if (!url) {
        throw new Error("Local model URL is not set. Please configure it in the settings.");
    }

    let rawContent: string | undefined;

    const body: any = {
        messages,
        temperature: 0.7,
        stream: false,
    };
    logger.addLog({ type: 'request', source: `${source} (Local)`, content: { url, body } });


    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Local model server returned an error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
        }

        const jsonResponse = await response.json();
        rawContent = jsonResponse.choices?.[0]?.message?.content;
        
        const result = sanitizeAndParseJson(rawContent);
        logger.addLog({ type: 'response', source: `${source} (Local)`, content: result });
        return result;

    } catch (error) {
        const errorContent = error instanceof Error ? error.message : String(error);
        logger.addLog({ type: 'error', source: `${source} (Local)`, content: { error: errorContent, rawContent } });
        if (error instanceof TypeError) {
             throw new Error(`Could not connect to the local model server at ${url}. Is it running and is CORS configured correctly?`);
        } else if (error instanceof SyntaxError) {
            console.error("Failed to parse JSON from local model response. Raw content was:", rawContent);
            // Re-throw the rich error from sanitizeAndParseJson or a generic one
            throw new Error(error.message || "The local model did not return valid JSON. Check the model's capabilities and the server logs.");
        }
        throw error;
    }
}

export const generateDialogueWithLocalAI = async (
    url: string,
    scene: Scene, 
    scenes: ScenesData, 
    characters: CharactersData,
    dialogueLength: DialogueLength = 'Short',
    useContinuity: boolean = true,
    desiredOutcome: 'auto' | 'transition' | 'choice' | 'end_story' | 'text_only' = 'auto',
    userPrompt: string = ''
): Promise<DialogueItem[]> => {
    const context = getStoryContext(scenes, characters, scene, useContinuity);
  
    const lengthMap = { 'Short': '3-5', 'Medium': '6-8', 'Long': '9-12' };
    const numLines = lengthMap[dialogueLength];

    let outcomeInstruction = '';
    switch (desiredOutcome) {
        case 'transition': outcomeInstruction = `The dialogue must end with a transition to another scene.`; break;
        case 'choice': outcomeInstruction = `The dialogue must end with a choice for the player.`; break;
        case 'end_story': outcomeInstruction = `The dialogue must end the story.`; break;
        case 'text_only': outcomeInstruction = `Only generate dialogue text. Do not generate a choice, transition, or end.`; break;
        default: outcomeInstruction = `You can decide the outcome: continue the dialogue, present a choice, transition to another scene, or end the story.`;
    }

    const userInstruction = userPrompt.trim() 
        ? `\nFollow this specific instruction: "${userPrompt.trim()}"`
        : "";

    // Simplified prompt with examples instead of a verbose schema
    const prompt = `You are a visual novel writer. Based on the story context, write the next ${numLines} lines of dialogue.
${outcomeInstruction}${userInstruction}
Use the provided character descriptions (appearance, talking style) to inform their dialogue.
For descriptive text or narration that is not spoken by a character, use "characterId": null. These narrator lines should be more detailed and descriptive, like prose in a novel, describing actions, settings, or a character's internal thoughts.

Respond with a valid JSON array. Do not add any explanations or markdown.

---
STORY CONTEXT:
${context}
---

EXAMPLE DIALOGUE JSON (with a choice):
[
    {"type": "text", "characterId": "elara", "spriteId": "curious", "text": "What do you mean?"},
    {"type": "text", "characterId": "jax", "text": "It's not what it looks like..."},
    {"type": "choice", "choices": [{"text": "Press him for details", "nextSceneId": "confrontation"}, {"text": "Let it go for now", "nextSceneId": "market_explore"}]}
]

EXAMPLE TRANSITION JSON:
[
    {"type": "text", "characterId": null, "text": "The sun begins to set."},
    {"type": "transition", "nextSceneId": "sunset_scene"}
]

EXAMPLE END STORY JSON:
[
    {"type": "text", "characterId": "hero", "text": "And that was the end of our adventure."},
    {"type": "end_story"}
]
`;

    const messages = [
        { role: 'system', content: "You are an AI assistant that only responds in valid JSON format." },
        { role: 'user', content: prompt },
    ];
  
  return postToLocalModel(url, messages, 'generateDialogue');
};

// Helper to convert title to snake_case id
const titleToId = (title: string) => title.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');


/**
 * Extracts an array from a model's JSON response, handling cases where the model
 * might wrap the array in an object (e.g., {"data": [...]}). This version is stricter
 * than the previous one to provide better error messages.
 * @param response The parsed JSON response from the model.
 * @param itemValidator A type guard function to validate each item in the array.
 * @returns The extracted and validated array.
 * @throws An error if a valid array cannot be found or if items are invalid.
 */
function extractArrayFromResponse<T>(response: any, itemValidator: (item: any) => item is T): T[] {
    if (Array.isArray(response)) {
        // If the top-level response is an array, filter it.
        // This is lenient with invalid items, just filters them out.
        return response.filter(itemValidator);
    } 
    
    if (typeof response === 'object' && response !== null) {
        // Look for the first property that holds an array.
        for (const key in response) {
            if (Object.prototype.hasOwnProperty.call(response, key)) {
                const value = response[key];
                if (Array.isArray(value)) {
                    // Found an array. Now, we are strict. ALL items must be valid.
                    if (value.every(itemValidator)) {
                        return value;
                    } else {
                        // Some items are invalid. Fail fast with a specific error.
                        const invalidCount = value.length - value.filter(itemValidator).length;
                        throw new Error(`Local AI returned an array in property '${key}', but ${invalidCount} of its items did not match the expected type.`);
                    }
                }
            }
        }
        // No array property found in the object.
        throw new Error("Local AI returned an object, but it did not contain a recognizable array property.");
    }

    // The response is not an array or an object containing an array.
    throw new Error(`Local AI did not return a valid array. Instead, received type: ${typeof response}`);
}


export const generateStoryPlanWithLocalAI = async (
    url: string,
    prompt: string, 
    sceneLength: SceneLength = 'Short',
    storyType: 'branching' | 'linear' = 'branching'
): Promise<any> => {
    // This function now uses a multi-step process for reliability.
    const lengthMap = { 'Short': '3-4', 'Medium': '5-6', 'Long': '7-8' };
    const numScenes = lengthMap[sceneLength];

    // STEP 1: Generate Characters
    const charactersPrompt = `You are a creative writer. Based on the user's prompt, create 2-3 main characters. Respond with a valid JSON array of character objects. Each object must have a short, lowercase 'id', a 'name', an 'appearance' description, and a 'talkingStyle' description. Do not add any explanations or markdown.
---
USER PROMPT: "${prompt}"
---
EXAMPLE JSON OUTPUT:
[
  { "id": "kai", "name": "Kai", "appearance": "Wears a worn leather jacket.", "talkingStyle": "Speaks quickly." },
  { "id": "lena", "name": "Lena", "appearance": "Has long, silver hair.", "talkingStyle": "Calm and measured." }
]`;
    const isCharacter = (item: any): item is { id: string; name: string; appearance: string; talkingStyle: string } => 
        typeof item === 'object' && item !== null && 'id' in item && 'name' in item;
    const rawCharactersResponse = await postToLocalModel(url, [{ role: 'system', content: "You only respond in valid JSON." }, { role: 'user', content: charactersPrompt }], 'generateStoryPlan-Characters');
    const characters = extractArrayFromResponse(rawCharactersResponse, isCharacter);
    const allCharacterIds = characters.map(c => c.id);

    // STEP 2: Generate Scene Outline
    const characterListForPrompt = characters.map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const sceneOutlinePrompt = `You are a story plotter. Based on the user's prompt and characters, outline a story with ${numScenes} scene titles. Respond with a valid JSON array of strings. Do not add any explanations or markdown.
---
USER PROMPT: "${prompt}"
CHARACTERS:
${characterListForPrompt}
---
EXAMPLE JSON OUTPUT: ["A Mysterious Letter", "The Crossroads", "The Forest Path"]`;
    const isString = (item: any): item is string => typeof item === 'string';
    const rawSceneTitlesResponse = await postToLocalModel(url, [{ role: 'system', content: "You only respond in valid JSON." }, { role: 'user', content: sceneOutlinePrompt }], 'generateStoryPlan-Scenes');
    const sceneTitles = extractArrayFromResponse(rawSceneTitlesResponse, isString);

    const sceneTitleToIdMap = new Map<string, string>();
    sceneTitles.forEach((title, index) => {
        const id = index === 0 ? 'start' : titleToId(title);
        sceneTitleToIdMap.set(title, id);
    });

    // STEP 3: Generate details for each scene iteratively
    const scenes: any[] = [];
    for (const currentSceneTitle of sceneTitles) {
        const sceneDetailPrompt = `You are a visual novel scene writer. For the scene titled "${currentSceneTitle}", provide a one-sentence summary and list the characters present. Respond with a single valid JSON object. Do not add any explanations or markdown.
---
OVERALL STORY PROMPT: "${prompt}"
ALL CHARACTERS IN STORY:
${characterListForPrompt}
---
TASK: Respond with a JSON object with two keys:
1. "summary": A one-sentence summary of what happens in this scene.
2. "characterIds": a JSON array of character 'id's present in this scene. Pick from: ${allCharacterIds.join(', ')}.

EXAMPLE JSON OUTPUT:
{
  "summary": "Kai finds a strange letter on his doorstep that seems to glow with a faint light.",
  "characterIds": ["kai"]
}`;
        const sceneDetails = await postToLocalModel(url, [{ role: 'system', content: "You only respond in a single valid JSON object." }, { role: 'user', content: sceneDetailPrompt }], 'generateStoryPlan-SceneDetail');
        
        const validSceneDetails = {
            summary: typeof sceneDetails?.summary === 'string' && sceneDetails.summary.trim() ? sceneDetails.summary : `A scene about "${currentSceneTitle}".`,
            characterIds: Array.isArray(sceneDetails?.characterIds) ? sceneDetails.characterIds.filter(id => allCharacterIds.includes(id)) : [],
        };

        scenes.push({
            id: sceneTitleToIdMap.get(currentSceneTitle)!,
            name: currentSceneTitle,
            summary: validSceneDetails.summary,
            characterIds: validSceneDetails.characterIds,
        });
    }

    // NOTE: Connection/outcome logic is now handled programmatically in AIStoryPlanner.tsx for consistency.
    
    // STEP 4: Assemble and return final plan
    const finalCharactersData: CharactersData = {};
    characters.forEach(c => {
        finalCharactersData[c.id] = {
            ...c,
            defaultSpriteId: 'normal',
            sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${c.id}/600/800` }],
        };
    });

    return { characters: finalCharactersData, scenes };
};


export async function testLocalAIEndpoint(url: string): Promise<{ ok: boolean; message: string }> {
  if (!url) {
    return { ok: false, message: 'URL is not provided.' };
  }

  // The user provides the completions URL, e.g., http://host/v1/chat/completions
  // We derive the base URL to check a standard health or models endpoint.
  let modelsUrl: URL;
  try {
    // Try to find a /v1/models endpoint, common in OpenAI-compatible servers
    modelsUrl = new URL(url);
    if (modelsUrl.pathname.includes('/completions')) {
        modelsUrl.pathname = modelsUrl.pathname.replace('/completions', '/models');
    } else {
        modelsUrl.pathname = '/v1/models'; // A reasonable guess
    }
  } catch(e) {
    return { ok: false, message: 'The provided URL is invalid.' };
  }
  
  try {
    const response = await fetch(modelsUrl.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        // Fallback: try a simple POST to the completions endpoint with no real prompt
        const probeResponse = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
        if (probeResponse.status === 400) { // 400 bad request is OK, means server is listening.
             return { ok: true, message: `Success! Connected to the completions endpoint.` };
        }
      return {
        ok: false,
        message: `Server responded with status ${response.status}. Is the endpoint URL correct?`,
      };
    }

    const data = await response.json();
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const modelNames = data.data.map((m: any) => m.id).slice(0, 3).join(', ');
      return { ok: true, message: `Success! Found models: ${modelNames}...` };
    } else if (data.data && Array.isArray(data.data)) {
        return { ok: true, message: 'Success! Connected, but no models found on the server.' };
    } else {
       return { ok: false, message: 'Connected, but the response format for models is unexpected.' };
    }
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, message: 'Connection failed. Is the server running and CORS configured?' };
    }
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { ok: false, message: `An error occurred: ${errorMessage}` };
  }
}

export const generateCharacterDetailsWithLocalAI = async (
    url: string, 
    prompt: string
): Promise<Omit<Character, 'id' | 'sprites' | 'defaultSpriteId'>> => {
    const fullPrompt = `You are a creative character designer for a visual novel. Based on the user's prompt, create a single, compelling character.

Respond with a single valid JSON object with three keys: "name", "appearance", and "talkingStyle". Do not add any explanations or markdown.

---
USER PROMPT:
"${prompt}"
---

EXAMPLE JSON OUTPUT:
{
  "name": "Jax 'The Fixer' Riley",
  "appearance": "A tall, wiry man with cybernetic eyes that glow a faint blue. He wears a dusty, long coat over practical, grease-stained fatigues.",
  "talkingStyle": "Speaks in short, clipped sentences. Uses a lot of technical slang and is often sarcastic."
}`;
  
  const messages = [
    { role: 'system', content: "You are an AI assistant that only responds in a single valid JSON object format." },
    { role: 'user', content: fullPrompt }
  ];

  return postToLocalModel(url, messages, 'generateCharacterDetails');
};


export const generateSceneStructureWithLocalAI = async (
    url: string,
    contextScenes: Scene[],
    sourceScene: Scene,
    characters: CharactersData,
    prompt: string,
    structureType: AIStructureType,
): Promise<{ scenes: AIGeneratedScene[], connections: any }> => {
    const characterDescriptions = Object.values(characters).map(c => `- ${c.name} (id: ${c.id})`).join('\n');
    const storySoFar = contextScenes.map((s, index) => `${index + 1}. Scene '${s.name}': ${s.description}`).join('\n');
    
    let structureDescription = '';
    let exampleStructure = '';
    if (structureType === 'choice_branch') {
        structureDescription = `The structure should be a "Choice Branch": create 3 new scenes. The source scene should transition to the first new scene, which will present a choice. The other two new scenes will be the outcomes of that choice.`;
        exampleStructure = `
EXAMPLE JSON OUTPUT for a 'choice_branch':
{
  "scenes": [
    {
      "id": "confrontation_start",
      "name": "The Confrontation",
      "description": "The hero confronts the mysterious figure about the stolen artifact.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": "hero", "text": "I know you have it. Give it back."}
      ]
    },
    {
      "id": "fight_outcome",
      "name": "A Fierce Battle",
      "description": "The hero decides to fight, and a desperate battle ensues.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": null, "text": "Sparks fly as their blades clash."}
      ]
    },
    {
      "id": "negotiate_outcome",
      "name": "A Tense Negotiation",
      "description": "The hero tries to reason with the figure, hoping to avoid bloodshed.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": "hero", "text": "There has to be another way."}
      ]
    }
  ],
  "connections": {
    "sourceSceneConnection": {
      "type": "transition",
      "nextSceneId": "confrontation_start"
    },
    "internalConnections": [
      {
        "sourceSceneId": "confrontation_start",
        "outcome": {
          "type": "choice",
          "choices": [
            {"text": "Attack the figure!", "nextSceneId": "fight_outcome"},
            {"text": "Try to negotiate.", "nextSceneId": "negotiate_outcome"}
          ]
        }
      }
    ]
  }
}
`;
    } else { // linear_sequence
        structureDescription = `The structure should be a "Linear Sequence": create 3 new scenes that follow each other in order. The source scene transitions to the first, the first to the second, and the second to the third.`;
        exampleStructure = `
EXAMPLE JSON OUTPUT for a 'linear_sequence':
{
  "scenes": [
    {
      "id": "forest_entrance",
      "name": "Forest Entrance",
      "description": "The heroes arrive at the edge of the dark forest.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": "hero", "text": "Well, here we are."}
      ]
    },
    {
      "id": "deeper_in",
      "name": "Deeper In",
      "description": "They venture deeper, the trees closing in around them.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": "friend", "text": "It's getting dark..."}
      ]
    },
    {
      "id": "the_clearing",
      "name": "The Clearing",
      "description": "They finally reach a moonlit clearing in the center of the forest.",
      "characterIds": ["hero", "friend"],
      "dialogue": [
        {"type": "text", "characterId": null, "text": "A sense of peace fills the air."}
      ]
    }
  ],
  "connections": {
    "sourceSceneConnection": {
      "type": "transition",
      "nextSceneId": "forest_entrance"
    },
    "internalConnections": [
      {
        "sourceSceneId": "forest_entrance",
        "outcome": {"type": "transition", "nextSceneId": "deeper_in"}
      },
      {
        "sourceSceneId": "deeper_in",
        "outcome": {"type": "transition", "nextSceneId": "the_clearing"}
      }
    ]
  }
}
`;
    }

    const fullPrompt = `You are a visual novel writer. Your task is to generate a small group of interconnected scenes.

Respond with a single, valid JSON object that has two top-level keys: "scenes" and "connections". Do not add any explanations or markdown.

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
REQUESTED STRUCTURE: ${structureDescription}

INSTRUCTIONS:
- The "scenes" key must be an array of 2-3 new scene objects. Each must have a temporary 'id', 'name', 'description', 'characterIds', and a short 'dialogue' array (text only).
- The "connections" key must be an object. It needs a "sourceSceneConnection" (how the source scene connects to the new structure) and "internalConnections" (how new scenes connect to each other).
- All 'nextSceneId' and 'sourceSceneId' values in the connections MUST match the temporary 'id's of the scenes you generate.

---
${exampleStructure}
`;

    const messages = [
        { role: 'system', content: "You are an AI assistant that only responds in a single valid JSON object format." },
        { role: 'user', content: fullPrompt }
    ];

    return postToLocalModel(url, messages, 'generateSceneStructure');
};