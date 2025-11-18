import React, { useState, useEffect, useRef } from 'react';
import { Scene, CharactersData, TextLine } from '../types.ts';
import { generateVideoForScene } from '../utils/ai.ts';

interface VeoGenerationModalProps {
  scene: Scene;
  characters: CharactersData;
  onClose: () => void;
}

const constructVeoPrompt = (scene: Scene, characters: CharactersData): string => {
  const charactersInScene = scene.characters
    .map(sc => characters[sc.characterId]?.name)
    .filter(Boolean)
    .join(' and ');

  const dialogueSummary = (scene.dialogue.filter(d => d.type === 'text') as TextLine[])
    .map(d => {
      const charName = d.characterId ? characters[d.characterId]?.name : 'Narrator';
      return `${charName}: "${d.text}"`;
    })
    .join(' ');

  let prompt = `A cinematic video of a scene titled "${scene.name}".`;
  if (scene.description) {
    prompt += `\nScene summary: ${scene.description}.`;
  }
  if (charactersInScene) {
    prompt += `\nCharacters present: ${charactersInScene}.`;
  }
  if (dialogueSummary) {
    prompt += `\nThe key dialogue is: ${dialogueSummary}`;
  }
  prompt += `\nThe visual style should be anime-inspired, vibrant, and emotional.`;
  return prompt;
};


const VeoGenerationModal: React.FC<VeoGenerationModalProps> = ({ scene, characters, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeySelectionAttempted, setApiKeySelectionAttempted] = useState(false);
  const loadingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setPrompt(constructVeoPrompt(scene, characters));
    
    const checkKey = async () => {
        // @ts-ignore
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            // @ts-ignore
            const keySelected = await window.aistudio.hasSelectedApiKey();
            setHasApiKey(keySelected);
        }
    };
    checkKey();

    return () => {
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
      if (videoUrl) {
          URL.revokeObjectURL(videoUrl); // Clean up object URL
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, characters]);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setApiKeySelectionAttempted(true);
        setHasApiKey(true); // Optimistic update
    } else {
        setError("API key selection is not available in this environment.");
    }
  };

  const startLoadingMessages = () => {
    const messages = [
        "Initializing video generation...",
        "This can take a few minutes, please be patient.",
        "Composing the digital scenes...",
        "Applying visual effects...",
        "Checking generation status...",
        "Finalizing the video render...",
    ];
    let messageIndex = 0;
    setLoadingMessage(messages[messageIndex]);
    loadingIntervalRef.current = window.setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
    }, 8000);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setVideoUrl(null);
    startLoadingMessages();

    try {
        const downloadLink = await generateVideoForScene(prompt, resolution, aspectRatio);
        if (!process.env.API_KEY) {
            throw new Error("API Key is not available. Please select a key.");
        }
        
        setLoadingMessage("Generation complete! Fetching video...");
        const fetchableUrl = `${downloadLink}&key=${process.env.API_KEY}`;
        
        const response = await fetch(fetchableUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch video file from the generated link. Status: ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(errorMessage);
        if (errorMessage.includes("Requested entity was not found")) {
            setError("Your API key is invalid or not found. Please select a valid key and try again.");
            setHasApiKey(false);
            setApiKeySelectionAttempted(false);
        }
    } finally {
        setIsLoading(false);
        if (loadingIntervalRef.current) {
            clearInterval(loadingIntervalRef.current);
        }
    }
  };

  const commonFormElement = "w-full bg-card/80 border border-border rounded-md p-2 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";

  const renderContent = () => {
    if (isLoading) {
        return (
            <div className="text-center p-8">
                <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 font-semibold text-lg">{loadingMessage}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-destructive/20 text-red-800 dark:text-red-200 rounded-md">
                <p className="font-bold">Error</p>
                <p className="text-sm">{error}</p>
                 <button onClick={handleGenerate} className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm rounded">
                    Retry
                </button>
            </div>
        );
    }
    
     if (videoUrl) {
        return (
            <div className="space-y-4">
                <video controls src={videoUrl} className="w-full rounded-lg bg-black"></video>
                <div className="flex gap-2">
                    <a href={videoUrl} download={`${scene.name.replace(/\s+/g, '_')}.mp4`} className="w-full text-center px-4 py-2 bg-green-600 text-white font-semibold text-sm rounded-md shadow-sm hover:bg-green-700">
                        Download Video
                    </a>
                     <button onClick={() => setVideoUrl(null)} className="w-full px-4 py-2 bg-secondary text-secondary-foreground text-sm rounded hover:bg-secondary/90">
                        Generate Another
                    </button>
                </div>
            </div>
        );
    }

    if (!hasApiKey && !apiKeySelectionAttempted) {
        return (
            <div className="p-4 text-center bg-secondary/30 rounded-md">
                <p className="font-semibold mb-2">API Key Required for Veo</p>
                <p className="text-sm mb-4">Video generation with Veo requires a Gemini API key. Please select a key to continue. For more information, see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">billing documentation</a>.</p>
                <button onClick={handleSelectKey} className="px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-sm hover:bg-primary/90">
                    Select API Key
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold mb-1">Video Prompt</label>
                <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className={`${commonFormElement} h-32`}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold mb-1">Resolution</label>
                    <select value={resolution} onChange={e => setResolution(e.target.value as typeof resolution)} className={commonFormElement}>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1">Aspect Ratio</label>
                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as typeof aspectRatio)} className={commonFormElement}>
                        <option value="16:9">16:9 (Landscape)</option>
                        <option value="9:16">9:16 (Portrait)</option>
                    </select>
                </div>
            </div>
             <button onClick={handleGenerate} className="w-full px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-sm hover:bg-primary/90 disabled:opacity-50">
                Generate Video
            </button>
        </div>
    );
  };


  return (
    <div className="fixed inset-0 bg-onyx/70 z-50 flex items-center justify-center p-4 backdrop-blur-md" onMouseDown={onClose}>
        <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-border" onMouseDown={e => e.stopPropagation()}>
            <header className="p-4 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-bold">Generate Video for "{scene.name}"</h2>
                <button onClick={onClose} disabled={isLoading} className="text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/50 disabled:opacity-50">&times;</button>
            </header>
            <div className="p-4">
                {renderContent()}
            </div>
        </div>
    </div>
  );
};

export default VeoGenerationModal;