
// utils/docParser.ts
import { Project, Story, Scene, DialogueItem, SceneCharacter, Choice, CharactersData } from '../types.ts';

/**
 * Serializes a Project object into a human-readable text document.
 */
export const serializeProjectToDoc = (project: Project): string => {
  let doc = '';
  
  // Global Characters Section
  doc += `# PROJECT: ${project.name} (id: ${project.id})\n\n`;
  doc += `## CHARACTERS\n`;
  Object.values(project.characters).forEach(char => {
      doc += `- ${char.name} (id: ${char.id})\n`;
      doc += `  Appearance: ${char.appearance}\n`;
      doc += `  Style: ${char.talkingStyle}\n`;
      if (char.sprites.length > 0) {
          doc += `  Sprites: ${char.sprites.map(s => s.id).join(', ')}\n`;
      }
  });
  doc += `\n---\n\n`;

  for (const story of Object.values(project.stories)) {
    doc += `# STORY: ${story.name} (id: ${story.id})\n\n`;

    // A bit of a hack to order scenes by their likely sequence for readability
    const sceneOrder: string[] = [];
    const visited = new Set<string>();
    let currentId = story.startSceneId;
    while(currentId && !visited.has(currentId)) {
        sceneOrder.push(currentId);
        visited.add(currentId);
        const scene = story.scenes[currentId];
        const transition = scene?.dialogue.find(d => d.type === 'transition') as DialogueItem & {type: 'transition'};
        currentId = transition?.nextSceneId;
    }
    // Add any remaining scenes (e.g., from choice branches)
    Object.keys(story.scenes).forEach(id => {
        if (!visited.has(id)) sceneOrder.push(id);
    });


    sceneOrder.forEach((sceneId, index) => {
      const scene = story.scenes[sceneId];
      if (!scene) return;

      doc += `## SCENE: ${scene.name} (id: ${scene.id})\n`;
      if (scene.description) doc += `DESCRIPTION: ${scene.description}\n`;
      if (scene.background) doc += `BACKGROUND: ${scene.background}\n`;

      if (scene.characters.length > 0) {
        doc += 'SCENE CHARACTERS:\n';
        scene.characters.forEach(sc => {
            // We use project characters now, so just reference the ID
            const defaultSprite = project.characters[sc.characterId]?.defaultSpriteId || 'normal';
            const spritePart = sc.spriteId && sc.spriteId !== defaultSprite ? ` as ${sc.spriteId}` : '';
            doc += `- ${sc.characterId}${spritePart} at ${sc.position}\n`;
        });
      }
      doc += '\n'; // separator

      let choiceBlock: Choice[] = [];
      scene.dialogue.forEach(item => {
        if (item.type !== 'choice') {
            if (choiceBlock.length > 0) {
                choiceBlock.forEach(c => {
                    doc += `- "${c.text}" -> ${c.nextSceneId}\n`;
                });
                choiceBlock = [];
            }
        }
        switch (item.type) {
          case 'text':
            if (item.characterId) {
              const spritePart = item.spriteId ? ` (${item.spriteId})` : '';
              doc += `${item.characterId}${spritePart}: ${item.text}\n`;
            } else {
              doc += `> ${item.text}\n`;
            }
            break;
          case 'image':
            doc += `![Image](${item.url})\n`;
            break;
          case 'video':
            doc += `![Video](${item.url})\n`;
            break;
          case 'choice':
            item.choices.forEach(c => {
                doc += `- "${c.text}" -> ${c.nextSceneId}\n`;
            });
            break;
          case 'transition':
            doc += `-> ${item.nextSceneId}\n`;
            break;
          case 'end_story':
            doc += `--- END ---\n`;
            break;
        }
      });
      
      if (index < sceneOrder.length - 1) {
        doc += '\n---\n\n';
      }
    });
  }

  return doc;
};


/**
 * Parses a text document back into a Project object.
 */
export const parseDocToProject = (docText: string, originalProject: Project): Project => {
    // Start with a deep copy to preserve metadata not in the doc
    const newProject: Project = JSON.parse(JSON.stringify(originalProject));
    newProject.stories = {};
    // We will overwrite characters if defined in doc, else keep existing
    // But usually parsing replaces structure. Let's track if we found chars.
    let foundCharacters = false;

    const lines = docText.split('\n');

    let currentStory: Story | null = null;
    let currentScene: Scene | null = null;
    let parsingState: 'default' | 'characters' | 'project_characters' = 'default';

    // Helper to parse character lines
    const parseCharLine = (line: string, target: CharactersData) => {
        const match = line.match(/^- (.*) \(id: (.*)\)$/);
        if (match) {
            const [, name, id] = match;
            if (!target[id]) {
                target[id] = {
                    id,
                    name,
                    appearance: '',
                    talkingStyle: '',
                    defaultSpriteId: 'normal',
                    sprites: [{ id: 'normal', url: `https://picsum.photos/seed/${id}/600/800` }]
                };
            }
            return id;
        }
        return null;
    };

    let lastCharId: string | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('//')) continue;

        // Project Character Section
        if (trimmedLine === '## CHARACTERS') {
            parsingState = 'project_characters';
            newProject.characters = {}; // Reset if we are redefining
            foundCharacters = true;
            continue;
        }

        if (parsingState === 'project_characters') {
             if (trimmedLine.startsWith('# STORY:') || trimmedLine === '---') {
                 parsingState = 'default';
             } else {
                 if (trimmedLine.startsWith('- ')) {
                     lastCharId = parseCharLine(trimmedLine, newProject.characters);
                 } else if (lastCharId && trimmedLine.startsWith('Appearance: ')) {
                     newProject.characters[lastCharId].appearance = trimmedLine.replace('Appearance: ', '');
                 } else if (lastCharId && trimmedLine.startsWith('Style: ')) {
                     newProject.characters[lastCharId].talkingStyle = trimmedLine.replace('Style: ', '');
                 }
                 continue;
             }
        }

        // Scene Separator
        if (trimmedLine === '---') {
            currentScene = null;
            parsingState = 'default';
            continue;
        }

        // Story Definition
        const storyMatch = line.match(/^# STORY: (.*) \(id: (.*)\)$/);
        if (storyMatch) {
            const [, name, id] = storyMatch;
            const originalStory = Object.values(originalProject.stories).find(s => s.id === id);
            currentStory = {
                id,
                name,
                scenes: {},
                startSceneId: originalStory?.startSceneId || '',
                variables: originalStory?.variables || {},
            };
            newProject.stories[id] = currentStory;
            currentScene = null;
            parsingState = 'default';
            continue;
        }
        
        if (!currentStory) continue; // Must be inside a story

        // Scene Definition
        const sceneMatch = line.match(/^## SCENE: (.*) \(id: (.*)\)$/);
        if (sceneMatch) {
            const [, name, id] = sceneMatch;
            currentScene = {
                id,
                name,
                background: '',
                characters: [],
                dialogue: [],
                position: originalProject.stories[currentStory.id]?.scenes[id]?.position || {x: 100, y: 100}
            };
            currentStory.scenes[id] = currentScene;
            parsingState = 'default';
            continue;
        }

        if (!currentScene) continue; // Must be inside a scene

        const backgroundMatch = line.match(/^BACKGROUND: (.*)$/);
        if (backgroundMatch) {
            currentScene.background = backgroundMatch[1].trim();
            continue;
        }
        
        const descriptionMatch = line.match(/^DESCRIPTION: (.*)$/);
        if (descriptionMatch) {
            currentScene.description = descriptionMatch[1].trim();
            continue;
        }
        
        if (trimmedLine === 'SCENE CHARACTERS:' || trimmedLine === 'CHARACTERS:') {
            parsingState = 'characters';
            currentScene.characters = [];
            continue;
        }
        
        if (parsingState === 'characters') {
            const charMatch = trimmedLine.match(/^- (\w+)(?: as (\w+))? at (\w+)$/);
            if (charMatch) {
                const [, characterId, spriteId, position] = charMatch;
                currentScene.characters.push({
                    characterId,
                    spriteId: spriteId || newProject.characters[characterId]?.defaultSpriteId || 'normal',
                    position: position as SceneCharacter['position'],
                });
            } else {
                parsingState = 'default'; // End of character block
            }
        }
        
        if (parsingState !== 'characters') {
             // Transition
            const transitionMatch = trimmedLine.match(/^-> (.*)$/);
            if (transitionMatch) {
                currentScene.dialogue.push({ type: 'transition', nextSceneId: transitionMatch[1].trim() });
                continue;
            }

            // End Story
            if (trimmedLine === '--- END ---') {
                currentScene.dialogue.push({ type: 'end_story' });
                continue;
            }

            // Choice
            const choiceMatch = trimmedLine.match(/^- "(.*)" -> (.*)$/);
            if (choiceMatch) {
                const [, text, nextSceneId] = choiceMatch;
                const lastDialogue = currentScene.dialogue[currentScene.dialogue.length - 1];
                if (lastDialogue && lastDialogue.type === 'choice') {
                    lastDialogue.choices.push({ text, nextSceneId: nextSceneId.trim() });
                } else {
                    currentScene.dialogue.push({ type: 'choice', choices: [{ text, nextSceneId: nextSceneId.trim() }] });
                }
                continue;
            }

            // Image
            const imageMatch = trimmedLine.match(/^!\[Image\]\((.*)\)$/);
            if(imageMatch) {
                currentScene.dialogue.push({ type: 'image', url: imageMatch[1].trim() });
                continue;
            }

            // Video
            const videoMatch = trimmedLine.match(/^!\[Video\]\((.*)\)$/);
            if(videoMatch) {
                currentScene.dialogue.push({ type: 'video', url: videoMatch[1].trim() });
                continue;
            }

            // Narrator
            const narratorMatch = trimmedLine.match(/^> (.*)$/);
            if (narratorMatch) {
                currentScene.dialogue.push({ type: 'text', characterId: null, text: narratorMatch[1].trim() });
                continue;
            }

            // Character Dialogue
            const dialogueMatch = line.match(/^(\w+)(?:\s?\((.*)\))?: (.*)$/);
            if (dialogueMatch) {
                const [, characterId, spriteId, text] = dialogueMatch;
                currentScene.dialogue.push({ type: 'text', characterId, spriteId, text: text.trim() });
                continue;
            }
        }
    }
    
    return newProject;
};
