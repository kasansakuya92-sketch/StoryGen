

import React, { useRef, useEffect, useMemo } from 'react';
// FIX: Add `Character` to imports to be used for explicit typing.
import { DialogueItem, Scene, ScenesData, CharactersData, Settings, TextLine, ChoiceLine, Transition, EndStory, AIPromptLine, ImageLine, VideoLine, Character, TransferLine, RandomLine } from '../../types.ts';
import { TextTool, ChoiceTool, TransitionTool, EndStoryTool, AIPromptTool, ImageTool, VideoTool, TransferTool, RandomTool, ConditionTool } from './tools.ts';
import { generateDialogueForScene } from '../../utils/ai.ts';

// Make EditorJS globally available for TS
declare const EditorJS: any;

interface DialogueEditorProps {
  scene: Scene;
  scenes: ScenesData;
  characters: CharactersData;
  variables: string[];
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
            case 'transfer':
                return { type: 'transfer', data: { nextSceneId: item.nextSceneId } };
            case 'random':
                return { type: 'random', data: { variants: item.variants } };
            case 'condition':
                return { type: 'condition', data: { conditions: item.conditions, branches: item.branches } };
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
            case 'transfer':
                return { type: 'transfer', nextSceneId: block.data.nextSceneId || '' };
            case 'random':
                return { type: 'random', variants: block.data.variants || [] };
            case 'condition':
                return { type: 'condition', conditions: block.data.conditions || [], branches: block.data.branches || { true: '', false: '' } };
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

const DialogueEditor: React.FC<DialogueEditorProps> = ({ scene, scenes, characters, variables, onUpdateDialogue, settings }) => {
    const editorInstance = useRef<any>(null);
    const holderId = `editorjs-holder-${scene.id}`;
    const isInternalChange = useRef(false);

    // Create stable dependency strings for characters and scenes.
    // This prevents the editor from re-initializing on every keystroke.
    const characterDeps = useMemo(() => {
        return Object.values(characters).map((c: Character) => `${c.id}:${c.name}`).sort().join(',');
    }, [characters]);

    const sceneDeps = useMemo(() => {
        return Object.values(scenes).map((s: Scene) => `${s.id}:${s.name}`).sort().join(',');
    }, [scenes]);
    
    const varDeps = useMemo(() => variables.join(','), [variables]);

    // Effect to handle external updates to dialogue (e.g. from AI generator outside editor)
    useEffect(() => {
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }

        if (editorInstance.current && editorInstance.current.render) {
            editorInstance.current.render(toEditorJSData(scene.dialogue));
        }
    }, [scene.dialogue]);

    useEffect(() => {
        // Destroy the previous instance if it exists.
        if (editorInstance.current && editorInstance.current.destroy) {
            editorInstance.current.destroy();
            editorInstance.current = null;
        }

        const handleGenerate = async (config: AIPromptLine['config'], block: any) => {
            const promptBlockIndex = editorInstance.current.blocks.getCurrentBlockIndex();

            try {
                // Note: Passing 'false' for choreographed as it's not exposed in this specific inline tool config yet.
                const newItems = await generateDialogueForScene(settings, scene, scenes, characters, config.dialogueLength, config.useContinuity, config.desiredOutcome, config.aiPrompt, false);
                
                const newEditorBlocks = toEditorJSData(newItems).blocks;
                
                if (newEditorBlocks.length > 0) {
                    // Replace the current block with the new ones
                    editorInstance.current.blocks.delete(promptBlockIndex);
                    editorInstance.current.blocks.insert(newEditorBlocks[0].type, newEditorBlocks[0].data, {}, promptBlockIndex, true);
                    for(let i = 1; i < newEditorBlocks.length; i++) {
                            editorInstance.current.blocks.insert(newEditorBlocks[i].type, newEditorBlocks[i].data, {}, promptBlockIndex + i, true);
                    }
                    
                    // Trigger save to update state immediately after generation
                    const savedData = await editorInstance.current.save();
                    const newDialogue = fromEditorJSData(savedData);
                    isInternalChange.current = true;
                    onUpdateDialogue(newDialogue);
                    
                } else {
                        editorInstance.current.blocks.delete(promptBlockIndex);
                }
                
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
                console.error("AI Error:", errorMessage);
                // Optionally show an error in the UI
            }
        };


        const editor = new EditorJS({
            holder: holderId,
            autofocus: false,
            data: toEditorJSData(scene.dialogue),
            tools: {
                text: {
                    class: TextTool,
                    config: { characters },
                },
                choice: {
                    class: ChoiceTool,
                    config: { scenes, variables },
                },
                transition: {
                    class: TransitionTool,
                    config: { scenes },
                },
                transfer: {
                    class: TransferTool,
                    config: { scenes },
                },
                random: {
                    class: RandomTool,
                    config: { scenes },
                },
                condition: {
                    class: ConditionTool,
                    config: { scenes, variables }
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
                isInternalChange.current = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characterDeps, sceneDeps, varDeps, settings, holderId]); 

    return <div id={holderId} className="prose text-foreground" />;
};

export default DialogueEditor;