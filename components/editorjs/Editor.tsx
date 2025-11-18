import React, { useRef, useEffect, useMemo } from 'react';
import { DialogueItem, Scene, ScenesData, CharactersData, Settings, TextLine, ChoiceLine, Transition, EndStory, AIPromptLine, ImageLine, VideoLine, Character, Story } from '../../types.ts';
import { TextTool, ChoiceTool, TransitionTool, EndStoryTool, AIPromptTool, ImageTool, VideoTool } from './tools.ts';
import { generateDialogueForScene } from '../../utils/ai.ts';

// Make EditorJS globally available for TS
declare const EditorJS: any;

interface DialogueEditorProps {
  scene: Scene;
  story: Story;
  scenes: ScenesData;
  characters: CharactersData;
  onUpdateDialogue: (dialogue: DialogueItem[]) => void;
  settings: Settings;
}

// Data Conversion
const toEditorJSData = (dialogue: DialogueItem[]) => {
    const blocks = dialogue.map(item => {
        switch (item.type) {
            case 'text':
                return { type: 'text', data: { characterId: item.characterId, spriteId: item.spriteId, text: item.text } };
            case 'choice':
                return { type: 'choice', data: { choices: item.choices } };
            case 'transition':
                return { type: 'transition', data: { nextSceneId: item.nextSceneId } };
            case 'end_story':
                return { type: 'endStory', data: {} };
            case 'ai_prompt':
                return { type: 'aiPrompt', data: { id: item.id, config: item.config }};
            case 'image':
                return { type: 'image', data: { url: item.url } };
            case 'video':
                return { type: 'video', data: { url: item.url } };
            default:
                return null;
        }
    }).filter(Boolean);

    return {
        time: Date.now(),
        blocks: blocks,
        version: "2.22.2" // Replace with your editorjs version
    };
};

const fromEditorJSData = (editorData: any): DialogueItem[] => {
    return editorData.blocks.map((block: any): DialogueItem | null => {
        switch (block.type) {
            case 'text':
                return { type: 'text', ...block.data };
            case 'choice':
                return { type: 'choice', choices: block.data.choices || [] };
            case 'transition':
                return { type: 'transition', nextSceneId: block.data.nextSceneId || '' };
            case 'endStory':
                return { type: 'end_story' };
            case 'aiPrompt':
                return { type: 'ai_prompt', id: block.data.id, config: block.data.config };
            case 'image':
                return { type: 'image', url: block.data.url || '' };
            case 'video':
                return { type: 'video', url: block.data.url || '' };
            default:
                return null;
        }
    }).filter((item: DialogueItem | null): item is DialogueItem => item !== null);
};

const DialogueEditor: React.FC<DialogueEditorProps> = ({ scene, story, scenes, characters, onUpdateDialogue, settings }) => {
    const editorInstance = useRef<any>(null);
    const holderId = `editorjs-holder-${scene.id}`;

    // Create stable dependency strings for characters and scenes.
    // This prevents the editor from re-initializing on every keystroke,
    // which was causing the editor to lose focus and "refresh".
    const characterDeps = useMemo(() => {
        return Object.values(characters).map((c: Character) => `${c.id}:${c.name}`).sort().join(',');
    }, [characters]);

    const sceneDeps = useMemo(() => {
        return Object.values(scenes).map((s: Scene) => `${s.id}:${s.name}`).sort().join(',');
    }, [scenes]);

    useEffect(() => {
        // Destroy the previous instance if it exists. This is crucial for re-initializing
        // the editor with fresh props (like an updated character list) when they change.
        if (editorInstance.current && editorInstance.current.destroy) {
            editorInstance.current.destroy();
            editorInstance.current = null;
        }

        const handleGenerate = async (config: AIPromptLine['config'], block: any) => {
            const promptBlockIndex = editorInstance.current.blocks.getCurrentBlockIndex();

            try {
                // Get the latest dialogue state directly from the editor to avoid stale closures
                const currentEditorData = await editorInstance.current.save();
                const currentDialogue = fromEditorJSData(currentEditorData);
                const currentSceneState = { ...scene, dialogue: currentDialogue };

                const currentStoryState: Story = {
                    ...story,
                    scenes: {
                        ...story.scenes,
                        [scene.id]: currentSceneState,
                    }
                };

                // The AI Prompt tool now only generates text to continue the scene.
                const newItems = await generateDialogueForScene(settings, currentStoryState, scene.id, config.dialogueLength, config.useContinuity, 'text_only', config.aiPrompt);
                
                const newEditorBlocks = toEditorJSData(newItems).blocks;
                
                if (newEditorBlocks.length > 0) {
                    // Insert the new blocks *before* the AI Prompt block.
                    for(let i = 0; i < newEditorBlocks.length; i++) {
                        editorInstance.current.blocks.insert(newEditorBlocks[i].type, newEditorBlocks[i].data, {}, promptBlockIndex + i, true);
                    }
                }
                
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                console.error("AI Error:", errorMessage);
                // Optionally show an error in the UI
            }
        };


        const editor = new EditorJS({
            holder: holderId,
            autofocus: false, // Disabled to prevent a `getLayoutMap()` permission error in sandboxed environments.
            data: toEditorJSData(scene.dialogue),
            tools: {
                text: {
                    class: TextTool,
                    config: { characters },
                },
                choice: {
                    class: ChoiceTool,
                    config: { scenes },
                },
                transition: {
                    class: TransitionTool,
                    config: { scenes },
                },
                endStory: EndStoryTool,
                image: ImageTool,
                video: VideoTool,
                aiPrompt: {
                    class: AIPromptTool,
                    config: {
                        onGenerate: handleGenerate,
                    },
                },
            },
            onChange: async () => {
                const savedData = await editor.save();
                const newDialogue = fromEditorJSData(savedData);
                onUpdateDialogue(newDialogue);
            },
        });
        editorInstance.current = editor;

        return () => {
            if (editorInstance.current && editorInstance.current.destroy) {
                editorInstance.current.destroy();
                editorInstance.current = null;
            }
        };
    // The component's `key` prop handles remounting when the scene changes.
    // This dependency array ensures the editor re-initializes ONLY if the character or scene
    // lists are updated (e.g., via Character Manager), not on every dialogue change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characterDeps, sceneDeps, settings, onUpdateDialogue, holderId, story]);

    return <div id={holderId} className="prose text-foreground" />;
};

export default DialogueEditor;