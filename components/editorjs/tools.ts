import { Character, CharactersData, Choice, Scene, ScenesData, DialogueLength, AIPromptLine } from '../../types.ts';

const commonInputClass = "bg-card/80 border-border rounded p-1 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none w-full";
const commonSelectClass = "bg-card/80 border-border rounded p-1 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";
const commonButtonClass = "text-xs bg-secondary/70 text-secondary-foreground p-1 rounded hover:bg-secondary/90";

export class TextTool {
    private data: { characterId: string | null; spriteId?: string; text: string; };
    private characters: CharactersData;
    private wrapper: HTMLDivElement | null = null;
    private characterSelect: HTMLSelectElement | null = null;
    private spriteSelect: HTMLSelectElement | null = null;
    private textInput: HTMLDivElement | null = null;

    static get isInline() { return false; }
    static get toolbox() { return { title: 'Dialogue Text', icon: '💬' }; }

    constructor({ data, config }: { data: any, config: { characters: CharactersData } }) {
        this.data = {
            characterId: data.characterId || null,
            spriteId: data.spriteId || undefined,
            text: data.text || ''
        };
        this.characters = config.characters;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'flex gap-2 items-start p-2 border border-border/20 rounded-md';

        const controls = document.createElement('div');
        controls.className = 'w-1/4 space-y-2';

        // Character Select
        this.characterSelect = document.createElement('select');
        this.characterSelect.className = commonSelectClass;
        const narratorOption = new Option('Narrator', '');
        this.characterSelect.add(narratorOption);
        Object.values(this.characters).forEach((c: Character) => {
            const option = new Option(c.name, c.id);
            this.characterSelect.add(option);
        });
        this.characterSelect.value = this.data.characterId || '';
        this.characterSelect.onchange = () => this.updateSpriteSelect();
        controls.appendChild(this.characterSelect);
        
        // Sprite Select
        this.spriteSelect = document.createElement('select');
        this.spriteSelect.className = commonSelectClass;
        controls.appendChild(this.spriteSelect);

        // Text Input
        this.textInput = document.createElement('div');
        this.textInput.contentEditable = 'true';
        this.textInput.className = `${commonInputClass} min-h-[2.5rem] p-2`;
        this.textInput.innerText = this.data.text;
        
        this.wrapper.appendChild(controls);
        this.wrapper.appendChild(this.textInput);

        this.updateSpriteSelect();
        return this.wrapper;
    }

    updateSpriteSelect() {
        if (!this.characterSelect || !this.spriteSelect) return;
        const charId = this.characterSelect.value;
        const character = this.characters[charId];
        
        this.spriteSelect.innerHTML = ''; // Clear options
        const defaultOption = new Option('Default Sprite', '');
        this.spriteSelect.add(defaultOption);

        if (character) {
            this.spriteSelect.disabled = false;
            character.sprites.forEach(sprite => {
                const option = new Option(sprite.id, sprite.id);
                this.spriteSelect.add(option);
            });
            this.spriteSelect.value = this.data.characterId === charId ? (this.data.spriteId || '') : '';
        } else {
            this.spriteSelect.disabled = true;
        }
    }

    save() {
        if (!this.characterSelect || !this.spriteSelect || !this.textInput) {
            return this.data;
        }
        return {
            characterId: this.characterSelect.value || null,
            spriteId: this.spriteSelect.value || undefined,
            text: this.textInput.innerText,
        };
    }
}


export class ChoiceTool {
    private data: { choices: Choice[] };
    private scenes: ScenesData;
    private wrapper: HTMLDivElement | null = null;
    private choicesContainer: HTMLDivElement | null = null;
    
    static get isInline() { return false; }
    static get toolbox() { return { title: 'Choice', icon: '❔' }; }

    constructor({ data, config }: { data: { choices: Choice[] }, config: { scenes: ScenesData }}) {
        this.data = { choices: data.choices || [{ text: '', nextSceneId: '' }] };
        this.scenes = config.scenes;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'pl-4 border-l-2 border-border/50 space-y-2 p-2';

        this.choicesContainer = document.createElement('div');
        this.choicesContainer.className = 'space-y-2';
        this.data.choices.forEach(choice => this.addChoiceRow(choice));
        
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.innerText = '+ Add Option';
        addButton.className = commonButtonClass;
        addButton.onclick = () => this.addChoiceRow({ text: '', nextSceneId: '' });

        this.wrapper.appendChild(this.choicesContainer);
        this.wrapper.appendChild(addButton);
        return this.wrapper;
    }

    addChoiceRow(choice: Choice) {
        if (!this.choicesContainer) return;
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'Choice text...';
        textInput.value = choice.text;
        textInput.className = `${commonInputClass} flex-grow`;
        
        const sceneSelect = document.createElement('select');
        sceneSelect.className = `${commonSelectClass} w-1/3`;
        const defaultOption = new Option('Select Scene...', '');
        sceneSelect.add(defaultOption);
        Object.values(this.scenes).forEach((s: Scene) => {
            const option = new Option(s.name, s.id);
            sceneSelect.add(option);
        });
        sceneSelect.value = choice.nextSceneId;

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.innerHTML = '&times;';
        deleteButton.className = 'text-destructive/70 hover:text-destructive font-bold text-xl';
        deleteButton.onclick = () => row.remove();

        row.appendChild(textInput);
        row.appendChild(sceneSelect);
        row.appendChild(deleteButton);
        this.choicesContainer.appendChild(row);
    }
    
    save() {
        if (!this.choicesContainer) return { choices: [] };
        const newChoices: Choice[] = [];
        this.choicesContainer.querySelectorAll('.flex.gap-2').forEach(row => {
            const textInput = row.querySelector('input[type="text"]') as HTMLInputElement;
            const sceneSelect = row.querySelector('select') as HTMLSelectElement;
            if (textInput && sceneSelect) {
                newChoices.push({
                    text: textInput.value,
                    nextSceneId: sceneSelect.value
                });
            }
        });
        return { choices: newChoices };
    }
}

export class TransitionTool {
    private data: { nextSceneId: string };
    private scenes: ScenesData;
    
    static get isInline() { return false; }
    static get toolbox() { return { title: 'Transition', icon: '➔' }; }

    constructor({ data, config }: { data: { nextSceneId: string }, config: { scenes: ScenesData }}) {
        this.data = { nextSceneId: data.nextSceneId || '' };
        this.scenes = config.scenes;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex gap-2 items-center p-2';
        
        const label = document.createElement('span');
        label.innerText = 'Transition to:';
        label.className = 'text-sm';

        const sceneSelect = document.createElement('select');
        sceneSelect.className = `${commonSelectClass} flex-grow`;
        const defaultOption = new Option('Select Scene...', '');
        sceneSelect.add(defaultOption);
        Object.values(this.scenes).forEach((s: Scene) => {
            const option = new Option(s.name, s.id);
            sceneSelect.add(option);
        });
        sceneSelect.value = this.data.nextSceneId;
        sceneSelect.id = 'scene-select';

        wrapper.appendChild(label);
        wrapper.appendChild(sceneSelect);
        return wrapper;
    }

    save(blockElement: HTMLDivElement) {
        const select = blockElement.querySelector('#scene-select') as HTMLSelectElement;
        return { nextSceneId: select.value };
    }
}

export class EndStoryTool {
    static get isInline() { return false; }
    static get toolbox() { return { title: 'End Story', icon: '🛑' }; }

    render() {
        const el = document.createElement('p');
        el.className = 'text-sm text-center text-destructive font-bold p-2 bg-destructive/10 rounded';
        el.innerText = '--- END OF STORY ---';
        return el;
    }

    save() { return {}; }
}

export class ImageTool {
    private data: { url: string };
    private wrapper: HTMLDivElement | null = null;
    private ui: {
        imageContainer: HTMLDivElement | null;
        urlInput: HTMLInputElement | null;
        uploadInput: HTMLInputElement | null;
    } = { imageContainer: null, urlInput: null, uploadInput: null };

    static get isInline() { return false; }
    static get toolbox() { return { title: 'Image', icon: '🖼️' }; }

    constructor({ data }: { data: { url: string } }) {
        this.data = {
            url: data.url || ''
        };
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'border border-border/20 rounded-md p-2 space-y-2';

        // Image preview container
        this.ui.imageContainer = document.createElement('div');
        this.ui.imageContainer.className = 'w-full min-h-[100px] bg-card/50 flex items-center justify-center rounded';
        if (this.data.url) {
            this.createImagePreview(this.data.url);
        } else {
            this.ui.imageContainer.innerText = 'No image set';
            this.ui.imageContainer.className += ' text-foreground/50 text-sm';
        }

        // URL input group
        const urlGroup = document.createElement('div');
        urlGroup.className = 'flex gap-2';
        this.ui.urlInput = document.createElement('input');
        this.ui.urlInput.type = 'text';
        this.ui.urlInput.placeholder = 'Paste image URL...';
        this.ui.urlInput.className = `${commonInputClass} flex-grow`;
        this.ui.urlInput.value = this.data.url.startsWith('http') ? this.data.url : '';
        const urlButton = document.createElement('button');
        urlButton.type = 'button';
        urlButton.innerText = 'Set';
        urlButton.className = commonButtonClass;
        urlButton.onclick = () => this.setImageFromUrl();
        urlGroup.appendChild(this.ui.urlInput);
        urlGroup.appendChild(urlButton);

        // Upload input
        const uploadLabel = document.createElement('label');
        uploadLabel.className = `${commonButtonClass} cursor-pointer w-full text-center block`;
        uploadLabel.innerText = 'or Upload an Image (PNG, JPG, GIF)';
        this.ui.uploadInput = document.createElement('input');
        this.ui.uploadInput.type = 'file';
        this.ui.uploadInput.accept = 'image/png, image/jpeg, image/gif';
        this.ui.uploadInput.className = 'hidden';
        this.ui.uploadInput.onchange = (e) => this.handleFileUpload(e);
        uploadLabel.appendChild(this.ui.uploadInput);

        this.wrapper.appendChild(this.ui.imageContainer);
        this.wrapper.appendChild(urlGroup);
        this.wrapper.appendChild(uploadLabel);

        return this.wrapper;
    }
    
    createImagePreview(url: string) {
        if (!this.ui.imageContainer) return;
        this.ui.imageContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.className = 'max-w-full max-h-48 rounded';
        this.ui.imageContainer.appendChild(img);
        this.ui.imageContainer.classList.remove('text-foreground/50', 'text-sm');
    }
    
    setImageFromUrl() {
        if (this.ui.urlInput && this.ui.urlInput.value) {
            this.data.url = this.ui.urlInput.value;
            this.createImagePreview(this.data.url);
        }
    }
    
    handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                if (result) {
                    this.data.url = result;
                    this.createImagePreview(result);
                }
            };
            reader.readAsDataURL(file);
        }
    }

    save() {
        return this.data;
    }
}


export class VideoTool {
    private data: { url: string };
    private wrapper: HTMLDivElement | null = null;
    private ui: {
        videoContainer: HTMLDivElement | null;
        urlInput: HTMLInputElement | null;
    } = { videoContainer: null, urlInput: null };

    static get isInline() { return false; }
    static get toolbox() { return { title: 'Video', icon: '🎬' }; }

    constructor({ data }: { data: { url: string } }) {
        this.data = { url: data.url || '' };
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'border border-border/20 rounded-md p-2 space-y-2';

        this.ui.videoContainer = document.createElement('div');
        this.ui.videoContainer.className = 'w-full min-h-[100px] bg-card/50 flex items-center justify-center rounded text-foreground/50 text-sm';
        this.updateVideoPreview();

        const urlGroup = document.createElement('div');
        urlGroup.className = 'flex gap-2';
        this.ui.urlInput = document.createElement('input');
        this.ui.urlInput.type = 'text';
        this.ui.urlInput.placeholder = 'Paste video URL...';
        this.ui.urlInput.className = `${commonInputClass} flex-grow`;
        this.ui.urlInput.value = this.data.url;

        const urlButton = document.createElement('button');
        urlButton.type = 'button';
        urlButton.innerText = 'Set';
        urlButton.className = commonButtonClass;
        urlButton.onclick = () => this.setVideoFromUrl();

        urlGroup.appendChild(this.ui.urlInput);
        urlGroup.appendChild(urlButton);

        this.wrapper.appendChild(this.ui.videoContainer);
        this.wrapper.appendChild(urlGroup);

        return this.wrapper;
    }

    updateVideoPreview() {
        if (!this.ui.videoContainer) return;
        this.ui.videoContainer.innerHTML = '';
        if (this.data.url) {
            const video = document.createElement('video');
            video.src = this.data.url;
            video.className = 'max-w-full max-h-48 rounded';
            video.controls = true;
            this.ui.videoContainer.appendChild(video);
        } else {
            this.ui.videoContainer.innerText = 'No video set';
        }
    }
    
    setVideoFromUrl() {
        if (this.ui.urlInput && this.ui.urlInput.value) {
            this.data.url = this.ui.urlInput.value;
            this.updateVideoPreview();
        }
    }

    save() {
        return this.data;
    }
}


export class AIPromptTool {
    private api: any;
    private block: any;
    private config: { onGenerate: (config: AIPromptLine['config'], block: any) => void };
    private data: { id: string; config: AIPromptLine['config'] };
    private wrapper: HTMLDivElement | null = null;
    
    static get isInline() { return false; }
    static get toolbox() { return { title: 'AI Prompt', icon: '🧠' }; }

    constructor({ data, config, api, block }: any) {
        this.api = api;
        this.block = block;
        this.config = config;
        this.data = {
            id: data.id || `prompt_${Date.now()}`,
            config: data.config || {
                dialogueLength: 'Short',
                desiredOutcome: 'auto',
                useContinuity: true,
                aiPrompt: ''
            }
        };
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3';
        
        const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/><circle cx="16" cy="13" r=".5"/><circle cx="18" cy="3" r=".5"/><circle cx="20" cy="21" r=".5"/><circle cx="20" cy="8" r=".5"/></svg>`;

        this.wrapper.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-primary">${iconSVG.replace('width="16" height="16"', 'width="18" height="18"')}</span>
                <span class="text-primary font-bold text-sm">AI Assistant</span>
            </div>
            <div>
                <label class="block text-xs font-bold text-foreground/80 mb-1">Dialogue Detail</label>
                <select id="dialogueLength" class="${commonSelectClass}">
                    <option value="Short">Short (3-5 lines)</option>
                    <option value="Medium">Medium (6-8 lines)</option>
                    <option value="Long">Long (9-12 lines)</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-foreground/80 mb-1">Prompt (Optional)</label>
                <textarea id="aiPrompt" placeholder="e.g., The hero reveals a hidden secret." class="${commonInputClass} h-16 resize-y text-xs"></textarea>
            </div>
            <div class="flex items-center">
                <input type="checkbox" id="useContinuity-${this.data.id}" class="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring" />
                <label for="useContinuity-${this.data.id}" class="ml-2 block text-sm text-foreground/80">Use existing dialogue as context</label>
            </div>
            <button id="generateBtn" type="button" class="w-full mt-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-sm hover:bg-primary/90 flex items-center justify-center gap-2">
                ${iconSVG}
                Continue Dialogue
            </button>
        `;

        // Set initial values
        (this.wrapper.querySelector('#dialogueLength') as HTMLSelectElement).value = this.data.config.dialogueLength;
        (this.wrapper.querySelector('#aiPrompt') as HTMLTextAreaElement).value = this.data.config.aiPrompt;
        (this.wrapper.querySelector(`#useContinuity-${this.data.id}`) as HTMLInputElement).checked = this.data.config.useContinuity;

        // Add event listener
        const generateBtn = this.wrapper.querySelector('#generateBtn') as HTMLButtonElement;
        generateBtn.onclick = () => {
            const btn = this.wrapper.querySelector('#generateBtn') as HTMLButtonElement;
            btn.disabled = true;
            btn.innerText = 'Generating...';
            this.config.onGenerate(this.save().config, this.block);
            // Re-enable the button after a short delay to allow the editor to update.
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = `${iconSVG} Continue Dialogue`;
            }, 1000);
        };

        return this.wrapper;
    }

    save() {
        if (!this.wrapper) return this.data;
        const dialogueLength = (this.wrapper.querySelector('#dialogueLength') as HTMLSelectElement).value as DialogueLength;
        const aiPrompt = (this.wrapper.querySelector('#aiPrompt') as HTMLTextAreaElement).value;
        const useContinuity = (this.wrapper.querySelector(`#useContinuity-${this.data.id}`) as HTMLInputElement).checked;

        const newConfig: AIPromptLine['config'] = {
            dialogueLength,
            desiredOutcome: 'text_only',
            aiPrompt,
            useContinuity
        };
        return {
            id: this.data.id,
            config: newConfig,
        };
    }
}