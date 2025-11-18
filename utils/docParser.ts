// utils/docParser.ts
import { Project, Story, Scene, DialogueItem, SceneCharacter, Choice } from '../types.ts';

/**
 * Serializes a Project object into a human-readable text document.
 */
export const serializeProjectToDoc = (project: Project): string => {
  let doc = '';

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
        doc += 'CHARACTERS:\n';
        scene.characters.forEach(sc => {
          const char = story.characters[sc.characterId];
          if (char) {
            const defaultSprite = char.defaultSpriteId;
            const spritePart = sc.spriteId && sc.spriteId !== defaultSprite ? ` as ${sc.spriteId}` : '';
            doc += `- ${sc.characterId}${spritePart} at ${sc.position}\n`;
          }
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

    const lines = docText.split('\n');

    let currentStory: Story | null = null;
    let currentScene: Scene | null = null;
    let parsingState: 'default' | 'characters' = 'default';

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('//')) continue;

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
                characters: originalStory?.characters || {},
                startSceneId: originalStory?.startSceneId || '',
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
        
        if (trimmedLine === 'CHARACTERS:') {
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
                    spriteId: spriteId || currentStory.characters[characterId]?.defaultSpriteId || 'normal',
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
    
    // Final validation
    if (Object.keys(newProject.stories).length === 0 && docText.trim() !== '') {
        throw new Error("Could not find any valid '# STORY:' definitions in the document.");
    }

    return newProject;
};
