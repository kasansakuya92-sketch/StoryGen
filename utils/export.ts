
// utils/export.ts
import { Project, Story, Scene, DialogueItem, CharactersData, Character, SceneCharacter } from '../types.ts';

// Standard Backup Export
export const exportProjectAsJson = (project: Project) => {
  const jsonString = JSON.stringify(project, null, 2);
  downloadFile(jsonString, `${project.name.replace(/\s+/g, '_')}_backup.json`);
};

// --- Legacy Engine Export Logic ---

// Helper to replace single quotes with <punc>
const formatText = (text: string): string => {
    return text.replace(/'/g, "<punc>");
};

// Helper to format legacy structure
const convertSceneToLegacy = (scene: Scene, characters: CharactersData) => {
    const legacyArray: any[] = [];

    scene.dialogue.forEach(item => {
        // Map Character Data
        let charName = "";
        let gender = "female"; // Default fallback
        
        if ('characterId' in item && item.characterId) {
            const char = characters[item.characterId];
            if (char) {
                charName = char.name;
                gender = char.gender || "female";
            }
        } else {
            // Narrator defaults
            charName = ""; 
            gender = "neutral";
        }

        switch (item.type) {
            case 'text':
            case 'thought':
                legacyArray.push({
                    character: charName,
                    gender: gender,
                    type: item.type === 'thought' ? 'thought' : 'speech',
                    text: formatText(item.text),
                    choices: []
                });
                break;
            
            case 'sms':
                legacyArray.push({
                    character: charName,
                    gender: gender,
                    type: "speech", 
                    text: `(SMS) ${formatText(item.text)}`,
                    choices: []
                });
                break;

             case 'system':
                legacyArray.push({
                    character: "",
                    gender: "neutral",
                    type: "narrative", 
                    text: formatText(item.text),
                    choices: []
                });
                break;

            case 'image':
                legacyArray.push({
                    character: "",
                    gender: "neutral",
                    type: "image",
                    text: item.url,
                    choices: []
                });
                break;

            case 'video':
                legacyArray.push({
                    character: "",
                    gender: "na",
                    type: "video",
                    text: item.url,
                    choices: []
                });
                break;

            case 'choice':
                const legacyChoices = item.choices.map(c => ({
                    text: formatText(c.text),
                    type: "transfer", 
                    result: `[[${c.nextSceneId}]]`, 
                    statRequirements: null,
                    statChanges: {}
                }));

                legacyArray.push({
                    character: "",
                    gender: "neutral",
                    type: "choice",
                    text: formatText("Choose an option:"), 
                    choices: legacyChoices
                });
                break;

            case 'transition':
                legacyArray.push({
                    character: "",
                    gender: "neutral",
                    type: "choice",
                    text: "",
                    choices: [{
                        text: "Continue...",
                        type: "transfer",
                        result: `[[${item.nextSceneId}]]`,
                        statRequirements: null,
                        statChanges: {}
                    }]
                });
                break;
                
             case 'end_story':
                 legacyArray.push({
                    character: "",
                    gender: "neutral",
                    type: "narrative",
                    text: "--- THE END ---",
                    choices: []
                });
                break;
        }
    });

    return legacyArray;
};

export const exportStoryAsLegacyJson = (story: Story) => {
    const exportData: Record<string, any[]> = {};
    
    Object.values(story.scenes).forEach(scene => {
        exportData[scene.id] = convertSceneToLegacy(scene, story.characters);
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    downloadFile(jsonString, `${story.name.replace(/\s+/g, '_')}_legacy_export.json`);
};


// --- Twee / SugarCube Export Logic ---

export const exportStoryAsTwee = (story: Story) => {
    // 1. Header
    let output = `:: StoryData\n${JSON.stringify({ "ifid": "2A2A2A2A-2A2A-2A2A-2A2A-2A2A2A2A2A2A", "format": "SugarCube", "format-version": "2.36.1" }, null, 2)}\n\n`;
    output += `:: StoryTitle\n${story.name}\n\n`;

    // 2. Assign a Unique Variable Name to EVERY scene
    const varMap = new Map<string, string>();
    Object.values(story.scenes).forEach(scene => {
        // Sanitize name for variable: $SceneName_ShortID
        const safeName = scene.name.replace(/[^a-zA-Z0-9]/g, '') || 'Scene';
        const uniqueSuffix = scene.id.slice(-5).replace(/[^a-zA-Z0-9]/g, ''); 
        varMap.set(scene.id, `$${safeName}_${uniqueSuffix}`);
    });

    // 3. Topological Sort (Dependencies first)
    const visited = new Set<string>();
    const sortedSceneIds: string[] = [];
    const visiting = new Set<string>(); // To detect cycles

    const visit = (sceneId: string) => {
        if (visited.has(sceneId)) return;
        if (visiting.has(sceneId)) return; // Cycle detected, break
        
        visiting.add(sceneId);
        const scene = story.scenes[sceneId];
        if (scene) {
             scene.dialogue.forEach(item => {
                if (item.type === 'transition' && item.nextSceneId) {
                     visit(item.nextSceneId);
                }
                if (item.type === 'choice') {
                    item.choices.forEach(c => {
                        if (c.nextSceneId) visit(c.nextSceneId);
                    });
                }
             });
        }
        visiting.delete(sceneId);
        visited.add(sceneId);
        sortedSceneIds.push(sceneId);
    };

    if (story.startSceneId) visit(story.startSceneId);
    Object.keys(story.scenes).forEach(id => visit(id));

    // 4. Generate Single Passage Content
    let content = `:: Start\n<<nobr>>\n\n`;
    
    sortedSceneIds.forEach(sceneId => {
        const scene = story.scenes[sceneId];
        const varName = varMap.get(sceneId);
        
        if (scene && varName) {
            const serialized = serializeSceneForTwee(scene, story, varMap);
            content += `<<set ${varName} = ${serialized}>>\n\n`;
        }
    });

    const startVar = story.startSceneId ? varMap.get(story.startSceneId) : null;

    content += `<div id="chat-container"></div>\n`;
    content += `<</nobr>>\n`;
    content += `<<do>>\n`;
    
    if (startVar) {
        content += `<<script>>\n`;
        content += `$(document).ready(function() {\n`;
        content += `    window.scrollTo(0, 0);\n`;
        content += `    $("#chat-container").html(window.renderConversation(State.variables.${startVar.substring(1)}));\n`;
        content += `});\n`;
        content += `<</script>>\n\n`;
    } else {
        content += `// No start scene defined\n`;
    }

    output += content;
    downloadFile(output, `${story.name.replace(/\s+/g, '_')}.twee`);
};

const serializeSceneForTwee = (scene: Scene, story: Story, varMap: Map<string, string>): string => {
    const data: any[] = [];
    
    scene.dialogue.forEach(item => {
        let charName = "", gender = "neutral";
        const characterId = 'characterId' in item ? item.characterId : null;
        if (characterId) {
            const char = story.characters[characterId];
            if (char) { 
                charName = char.name; 
                gender = char.gender || "female";
                if (gender === 'neutral') gender = 'na';
            }
        }
        
        // Special handling for Narration vs Empty character
        if (!characterId) {
            if (item.type === 'video') {
                charName = ""; // Strictly empty for video
                gender = "na"; // Special flag for video
            } else if (item.type === 'image') {
                charName = "";
                gender = "na";
            } else if (!charName) {
                charName = "Narrator"; 
                gender = "na"; 
            }
        }

        const base = { character: charName, gender: gender };

        switch(item.type) {
            case 'text':
            case 'thought':
                data.push({ ...base, type: item.type === 'thought' ? 'thought' : 'speech', text: formatText(item.text), choices: [] });
                break;
            case 'sms':
                data.push({ ...base, type: 'speech', text: `(SMS) ${formatText(item.text)}`, choices: [] });
                break;
             case 'system':
                data.push({ ...base, type: 'narrative', text: formatText(item.text), choices: [] });
                break;
             case 'image':
                data.push({ ...base, type: 'image', text: item.url, choices: [] });
                break;
             case 'video':
                data.push({ ...base, type: 'video', text: item.url, choices: [] });
                break;
             case 'choice':
                const choices = item.choices.map(c => {
                    const nextVar = c.nextSceneId ? varMap.get(c.nextSceneId) : null;
                    return { text: formatText(c.text), result: nextVar || "null" };
                });
                data.push({ ...base, type: 'choice', text: formatText("..."), choices });
                break;
             case 'transition':
                const nextVar = item.nextSceneId ? varMap.get(item.nextSceneId) : null;
                data.push({ ...base, type: 'choice', text: "", choices: [{ text: "Continue", result: nextVar || "null" }] });
                break;
             case 'end_story':
                data.push({ ...base, type: 'narrative', text: "--- THE END ---", choices: [] });
                break;
        }
    });

    return customStringify(data);
};

const customStringify = (obj: any): string => {
    if (Array.isArray(obj)) {
        const items = obj.map(customStringify).join(', ');
        return `[${items}]`;
    } else if (typeof obj === 'object' && obj !== null) {
        const props = Object.entries(obj).map(([key, value]) => {
            if (key === 'result' && typeof value === 'string' && value.startsWith('$')) {
                 return `${key}: ${value}`;
            }
             return `${key}: ${customStringify(value)}`;
        }).join(', ');
        return `{ ${props} }`;
    } else if (typeof obj === 'string') {
        return JSON.stringify(obj); 
    } else {
        return String(obj);
    }
};

// --- IMPORT LOGIC ---

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

export const importStoryFromTwee = (tweeContent: string, currentProjectCharacters: CharactersData): { story: Story, characters: CharactersData } => {
    const lines = tweeContent.split('\n');
    let storyName = 'Imported Story';
    const scenes: Record<string, Scene> = {};
    const varMap = new Map<string, string>(); // Maps variable name ($Scene...) to internal Scene ID
    
    // 1. Detect Story Title
    const titleIndex = lines.findIndex(l => l.startsWith(':: StoryTitle'));
    if (titleIndex !== -1 && lines[titleIndex + 1]) {
        storyName = lines[titleIndex + 1].trim();
    }

    // 2. Identify Format: Engine-Specific (Variables) or Standard (Passages)
    const isEngineFormat = tweeContent.includes('<<set $');

    // 3. Characters map (Name -> ID) to avoid duplicates
    const charNameMap = new Map<string, string>();
    Object.values(currentProjectCharacters).forEach(c => charNameMap.set(c.name.toLowerCase(), c.id));
    
    const newCharacters = { ...currentProjectCharacters };
    
    const getOrCreateCharacterId = (name: string, genderHint?: string): string | null => {
        if (!name || name === 'Narrator') return null;
        const lowerName = name.toLowerCase();
        if (charNameMap.has(lowerName)) return charNameMap.get(lowerName) || null;
        
        const newId = generateId('char');
        newCharacters[newId] = {
            id: newId,
            name: name,
            defaultSpriteId: 'normal',
            sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${newId}/600/800` }],
            talkingStyle: 'Imported character.',
            appearance: 'No description available.',
            gender: (genderHint as any) || 'neutral'
        };
        charNameMap.set(lowerName, newId);
        return newId;
    };


    if (isEngineFormat) {
        // --- PARSE ENGINE FORMAT ---
        // Look for <<set $VarName = [...]>>
        const variableRegex = /<<set\s+(\$[\w\d_]+)\s*=\s*(\[[\s\S]*?\])>>/g;
        let match;

        while ((match = variableRegex.exec(tweeContent)) !== null) {
            const varName = match[1];
            let jsonString = match[2];
            
            // Fix unquoted variables in JSON: result: $Var -> result: "$Var"
            jsonString = jsonString.replace(/(result:\s*)(\$[\w\d_]+)/g, '$1"$2"');
            
            // Fix loose keys if necessary (export produces valid keys, but just in case)
            jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

            try {
                const data = JSON.parse(jsonString);
                const sceneId = generateId('scene');
                varMap.set(varName, sceneId);

                // Convert data back to DialogueItems
                const dialogue: DialogueItem[] = [];
                const sceneCharacters = new Set<string>();

                if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                        const charId = getOrCreateCharacterId(item.character, item.gender);
                        if (charId) sceneCharacters.add(charId);

                        const type = item.type;
                        if (type === 'speech' || type === 'thought') {
                            dialogue.push({
                                type: type === 'thought' ? 'thought' : 'text',
                                characterId: charId,
                                text: (item.text || '').replace(/<punc>/g, "'")
                            });
                        } else if (type === 'narrative') {
                            if (item.text === '--- THE END ---') {
                                dialogue.push({ type: 'end_story' });
                            } else {
                                dialogue.push({ type: 'system', text: (item.text || '').replace(/<punc>/g, "'"), characterId: null });
                            }
                        } else if (type === 'image') {
                            dialogue.push({ type: 'image', url: item.text });
                        } else if (type === 'video') {
                            dialogue.push({ type: 'video', url: item.text });
                        } else if (type === 'choice') {
                            if (item.text) {
                                // "Transition" exported as choice with empty text? No, transition has text "".
                                if (item.text === "") {
                                     // It's a transition
                                     const targetVar = item.choices?.[0]?.result;
                                     dialogue.push({ type: 'transition', nextSceneId: targetVar }); // Placeholder, resolve later
                                } else {
                                     // It's a choice block
                                     const choices = (item.choices || []).map((c: any) => ({
                                         text: (c.text || '').replace(/<punc>/g, "'"),
                                         nextSceneId: c.result // Placeholder
                                     }));
                                     dialogue.push({ type: 'choice', choices });
                                }
                            }
                        }
                    });
                }
                
                scenes[sceneId] = {
                    id: sceneId,
                    name: varName.replace(/^\$Scene/, '').replace(/_\w+$/, '') || 'Imported Scene', // Try to recover name
                    background: `https://picsum.photos/seed/${sceneId}/1920/1080`,
                    characters: Array.from(sceneCharacters).map((cid, i) => ({
                        characterId: cid,
                        spriteId: 'normal',
                        position: i % 2 === 0 ? 'left' : 'right'
                    })),
                    dialogue,
                    position: { x: 0, y: 0 } // Layout later
                };

            } catch (e) {
                console.warn("Failed to parse scene data for variable", varName, e);
            }
        }

        // Post-processing: Resolve variable names to Scene IDs in transitions/choices
        Object.values(scenes).forEach(scene => {
            scene.dialogue.forEach(item => {
                if (item.type === 'transition' && item.nextSceneId) {
                    item.nextSceneId = varMap.get(item.nextSceneId) || '';
                } else if (item.type === 'choice') {
                    item.choices.forEach(c => {
                        if (c.nextSceneId) c.nextSceneId = varMap.get(c.nextSceneId) || '';
                    });
                }
            });
        });

    } else {
        // --- PARSE STANDARD TWEE ---
        // Split by :: 
        const passages = tweeContent.split(/^::\s*(.*)/m).slice(1); // [Title, Content, Title, Content...]
        const passageMap = new Map<string, string>(); // Name -> ID

        // First pass: Create scenes and map names to IDs
        for (let i = 0; i < passages.length; i += 2) {
            let title = passages[i].trim();
            // Remove tags/metadata if present (e.g. "Start [tag] {meta}")
            title = title.replace(/\[.*?\]/, '').replace(/\{.*?\}/, '').trim();
            if (title === 'StoryTitle' || title === 'StoryData') continue;

            const id = generateId('scene');
            passageMap.set(title, id);
            
            scenes[id] = {
                id,
                name: title,
                background: `https://picsum.photos/seed/${id}/1920/1080`,
                characters: [],
                dialogue: [], // Fill in second pass
                position: { x: 0, y: 0 }
            };
        }

        // Second pass: Parse content
        for (let i = 0; i < passages.length; i += 2) {
            let title = passages[i].trim();
            title = title.replace(/\[.*?\]/, '').replace(/\{.*?\}/, '').trim();
            if (title === 'StoryTitle' || title === 'StoryData') continue;

            const content = passages[i + 1].trim();
            const id = passageMap.get(title);
            if (!id) continue;

            const dialogue: DialogueItem[] = [];
            const sceneContentLines = content.split('\n');

            sceneContentLines.forEach(line => {
                line = line.trim();
                if (!line) return;

                // Check for links [[Link]] or [[Text|Link]]
                const linkRegex = /\[\[(.*?)\]\]/g;
                let match;
                const choices: any[] = [];
                let hasLinks = false;
                
                if (line.startsWith('[[')) {
                    hasLinks = true;
                    let linkMatch;
                    while ((linkMatch = linkRegex.exec(line)) !== null) {
                        const content = linkMatch[1];
                        const parts = content.split('|');
                        const text = parts[0];
                        const targetName = parts.length > 1 ? parts[1] : parts[0];
                        const targetId = passageMap.get(targetName) || '';
                        
                        choices.push({ text, nextSceneId: targetId });
                    }
                }

                if (hasLinks) {
                    if (choices.length === 1 && choices[0].text === choices[0].nextSceneId) {
                         dialogue.push({ type: 'choice', choices });
                    } else {
                         dialogue.push({ type: 'choice', choices });
                    }
                } else {
                    const speakerMatch = line.match(/^([^:]+):\s*(.*)/);
                    if (speakerMatch) {
                        const name = speakerMatch[1].trim();
                        const text = speakerMatch[2].trim();
                        const charId = getOrCreateCharacterId(name);
                        dialogue.push({ type: 'text', characterId: charId, text });
                    } else {
                        dialogue.push({ type: 'text', characterId: null, text: line });
                    }
                }
            });
            
            const last = dialogue[dialogue.length - 1];
            if (!last || (last.type !== 'choice' && last.type !== 'transition')) {
                dialogue.push({ type: 'end_story' });
            }

            scenes[id].dialogue = dialogue;
        }
    }

    // Auto-layout nodes in a grid
    const sceneValues = Object.values(scenes);
    const cols = Math.ceil(Math.sqrt(sceneValues.length));
    sceneValues.forEach((s, i) => {
        s.position = { x: (i % cols) * 350, y: Math.floor(i / cols) * 200 };
    });

    const startSceneId = Object.keys(scenes)[0] || '';

    return {
        story: {
            id: generateId('story'),
            name: storyName,
            characters: {}, 
            scenes: scenes,
            startSceneId: startSceneId
        },
        characters: newCharacters
    };
};

// --- Shared Download Helper ---
const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
