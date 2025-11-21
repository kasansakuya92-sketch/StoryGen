
import { Character, CharactersData, Choice, Scene, ScenesData, DialogueLength, AIPromptLine, StatRequirement } from '../../types.ts';

const commonInputClass = "bg-card/80 border-border rounded p-1 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none w-full";
const commonSelectClass = "bg-card/80 border-border rounded p-1 text-sm focus:ring-1 focus:ring-ring focus:border-ring outline-none";
const commonButtonClass = "text-xs bg-secondary/70 text-secondary-foreground p-1 rounded hover:bg-secondary/90";


export class TextTool {
    private data: { type: 'text' | 'thought' | 'sms' | 'system'; characterId: string | null; spriteId?: string; text: string; };
    private characters: CharactersData;
    private wrapper: HTMLDivElement | null = null;
    private characterSelect: HTMLSelectElement | null = null;
    private spriteSelect: HTMLSelectElement | null = null;
    private textInput: HTMLDivElement | null = null;
    private modeButton: HTMLButtonElement | null = null;

    static get isInline() { return false; }
    static get toolbox() { return { title: 'Dialogue Text', icon: '💬' }; }

    constructor({ data, config }: { data: any, config: { characters: CharactersData } }) {
        this.data = {
            type: data.type || 'text',
            characterId: data.characterId || null,
            spriteId: data.spriteId || undefined,
            text: data.text || ''
        };
        this.characters = config.characters;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'flex gap-2 items-start p-2 border border-border/20 rounded-md relative';
        
        // Apply visual styles based on type
        this.updateWrapperStyle();

        const controls = document.createElement('div');
        controls.className = 'w-1/4 space-y-2 flex flex-col';

        // Mode Toggle
        this.modeButton = document.createElement('button');
        this.modeButton.type = 'button';
        this.modeButton.className = 'text-xs font-bold uppercase tracking-wider border border-border rounded px-2 py-1 text-center hover:bg-secondary';
        this.updateModeButton();
        this.modeButton.onclick = () => this.toggleMode();
        controls.appendChild(this.modeButton);

        // Character Select
        this.characterSelect = document.createElement('select');
        this.characterSelect.className = commonSelectClass;
        this.characterSelect.tabIndex = -1;
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
        this.spriteSelect.tabIndex = -1;
        controls.appendChild(this.spriteSelect);

        // Text Input
        this.textInput = document.createElement('div');
        this.textInput.contentEditable = 'true';
        this.textInput.className = `${commonInputClass} min-h-[2.5rem] p-2`;
        this.textInput.innerText = this.data.text;
        this.textInput.tabIndex = -1;
        
        this.wrapper.appendChild(controls);
        this.wrapper.appendChild(this.textInput);

        this.updateSpriteSelect();
        this.updateVisibility();
        return this.wrapper;
    }

    toggleMode() {
        const modes: ('text' | 'thought' | 'sms' | 'system')[] = ['text', 'thought', 'sms', 'system'];
        const currentIndex = modes.indexOf(this.data.type);
        this.data.type = modes[(currentIndex + 1) % modes.length];
        this.updateModeButton();
        this.updateVisibility();
        this.updateWrapperStyle();
    }

    updateWrapperStyle() {
        if (this.wrapper) {
            this.wrapper.classList.remove('bg-blue-500/10', 'bg-gray-500/10', 'bg-purple-500/10');
            if (this.data.type === 'sms') this.wrapper.classList.add('bg-blue-500/10');
            if (this.data.type === 'system') this.wrapper.classList.add('bg-gray-500/10');
            if (this.data.type === 'thought') this.wrapper.classList.add('bg-purple-500/10');
        }
    }

    updateModeButton() {
        if (this.modeButton) {
            this.modeButton.innerText = this.data.type;
        }
    }

    updateVisibility() {
        if (this.data.type === 'system') {
            if (this.characterSelect) this.characterSelect.style.display = 'none';
            if (this.spriteSelect) this.spriteSelect.style.display = 'none';
        } else {
            if (this.characterSelect) this.characterSelect.style.display = 'block';
            if (this.spriteSelect) this.spriteSelect.style.display = 'block';
        }
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
            type: this.data.type,
            characterId: this.data.type === 'system' ? null : (this.characterSelect.value || null),
            spriteId: this.data.type === 'system' ? undefined : (this.spriteSelect.value || undefined),
            text: this.textInput.innerText,
        };
    }
}


export class ChoiceTool {
    private data: { choices: Choice[] };
    private scenes: ScenesData;
    private variables: string[];
    private wrapper: HTMLDivElement | null = null;
    private choicesContainer: HTMLDivElement | null = null;
    
    static get isInline() { return false; }
    static get toolbox() { return { title: 'Choice', icon: '❔' }; }

    constructor({ data, config }: { data: { choices: Choice[] }, config: { scenes: ScenesData, variables?: string[] }}) {
        this.data = { choices: data.choices || [{ text: '', nextSceneId: '' }] };
        this.scenes = config.scenes;
        this.variables = config.variables || [];
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'pl-4 border-l-2 border-border/50 space-y-2 p-2';

        this.choicesContainer = document.createElement('div');
        this.choicesContainer.className = 'space-y-4';
        this.data.choices.forEach(choice => this.addChoiceRow(choice));
        
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.innerText = '+ Add Option';
        addButton.className = commonButtonClass;
        addButton.onclick = () => this.addChoiceRow({ text: '', nextSceneId: '' });
        addButton.tabIndex = -1;

        this.wrapper.appendChild(this.choicesContainer);
        this.wrapper.appendChild(addButton);
        return this.wrapper;
    }

    addChoiceRow(choice: Choice) {
        if (!this.choicesContainer) return;
        const rowContainer = document.createElement('div');
        rowContainer.className = "bg-card/30 p-2 rounded border border-border/30";
        rowContainer.setAttribute('data-choice-row', 'true'); // Data attribute for robust selection
        
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center mb-2';

        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.placeholder = 'Choice text...';
        textInput.value = choice.text;
        textInput.className = `${commonInputClass} flex-grow`;
        textInput.tabIndex = -1;
        
        const sceneSelect = document.createElement('select');
        sceneSelect.className = `${commonSelectClass} w-1/3`;
        sceneSelect.tabIndex = -1;
        const defaultOption = new Option('Select Scene...', '');
        sceneSelect.add(defaultOption);
        Object.values(this.scenes).forEach((s: Scene) => {
            const option = new Option(s.name, s.id);
            sceneSelect.add(option);
        });
        sceneSelect.value = choice.nextSceneId;

        // Embed Toggle
        const embedContainer = document.createElement('div');
        embedContainer.className = "flex items-center gap-1 text-xs ml-1";
        embedContainer.title = "Embed outcome as a variable";
        const embedCheckbox = document.createElement('input');
        embedCheckbox.type = 'checkbox';
        embedCheckbox.className = 'h-3 w-3 rounded border-border';
        embedCheckbox.checked = !!choice.embedOutcome;
        const embedLabel = document.createElement('span');
        embedLabel.innerText = 'Embed';
        embedLabel.className = "text-foreground/70";
        embedContainer.appendChild(embedCheckbox);
        embedContainer.appendChild(embedLabel);

        // Transfer Toggle
        const transferContainer = document.createElement('div');
        transferContainer.className = "flex items-center gap-1 text-xs ml-2";
        transferContainer.title = "Export as Transfer type";
        const transferCheckbox = document.createElement('input');
        transferCheckbox.type = 'checkbox';
        transferCheckbox.className = 'h-3 w-3 rounded border-border';
        transferCheckbox.checked = choice.type === 'transfer';
        const transferLabel = document.createElement('span');
        transferLabel.innerText = 'Transfer';
        transferLabel.className = "text-foreground/70";
        transferContainer.appendChild(transferCheckbox);
        transferContainer.appendChild(transferLabel);

        // Toggle logic block
        const toggleLogicBtn = document.createElement('button');
        toggleLogicBtn.type = 'button';
        toggleLogicBtn.innerText = 'Logic';
        toggleLogicBtn.className = 'text-xs bg-secondary/70 text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90 ml-2';
        
        const logicContainer = document.createElement('div');
        logicContainer.className = 'hidden mt-2 p-2 bg-background/50 rounded text-xs border border-border/20';
        
        toggleLogicBtn.onclick = () => {
            logicContainer.classList.toggle('hidden');
        };

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.innerHTML = '&times;';
        deleteButton.className = 'text-destructive/70 hover:text-destructive font-bold text-xl ml-2';
        deleteButton.onclick = () => rowContainer.remove();
        deleteButton.tabIndex = -1;

        row.appendChild(textInput);
        row.appendChild(sceneSelect);
        row.appendChild(embedContainer);
        row.appendChild(transferContainer);
        row.appendChild(toggleLogicBtn);
        row.appendChild(deleteButton);
        rowContainer.appendChild(row);
        rowContainer.appendChild(logicContainer);

        // --- Logic Builder ---
        
        // 1. Requirements
        const reqTitle = document.createElement('div');
        reqTitle.className = "font-bold mb-1 flex justify-between items-center";
        reqTitle.innerHTML = `<span>Requirements</span> <button type="button" class="${commonButtonClass}">+</button>`;
        const reqList = document.createElement('div');
        reqList.className = "space-y-1 mb-2";
        reqList.setAttribute('data-req-list', 'true');
        
        const renderReq = (r?: StatRequirement) => {
             const div = document.createElement('div');
             div.className = "flex gap-1 items-center";
             div.setAttribute('data-req-item', 'true');
             
             const statSelect = document.createElement('select');
             statSelect.className = "bg-background border border-border rounded px-1 py-0.5 w-1/2";
             if (this.variables.length === 0) {
                 statSelect.add(new Option('No vars defined', ''));
                 statSelect.disabled = true;
             } else {
                 this.variables.forEach(v => statSelect.add(new Option(v, v)));
             }
             if (r) statSelect.value = r.stat;

             const opLabel = document.createElement('span');
             opLabel.innerText = '≥'; // Currently assuming threshold implies >=

             const valInput = document.createElement('input');
             valInput.type = 'number';
             valInput.className = "bg-background border border-border rounded px-1 py-0.5 w-1/4";
             valInput.placeholder = "0";
             if (r) valInput.value = r.threshold.toString();

             const del = document.createElement('button');
             del.type = 'button';
             del.innerHTML = '&times;';
             del.className = "text-destructive ml-1";
             del.onclick = () => div.remove();

             div.appendChild(statSelect);
             div.appendChild(opLabel);
             div.appendChild(valInput);
             div.appendChild(del);
             reqList.appendChild(div);
        };

        (choice.statRequirements || []).forEach(r => renderReq(r));
        (reqTitle.querySelector('button') as HTMLButtonElement).onclick = () => renderReq();

        // 2. Changes
        const chgTitle = document.createElement('div');
        chgTitle.className = "font-bold mb-1 flex justify-between items-center";
        chgTitle.innerHTML = `<span>Effects</span> <button type="button" class="${commonButtonClass}">+</button>`;
        const chgList = document.createElement('div');
        chgList.className = "space-y-1";
        chgList.setAttribute('data-chg-list', 'true');

         const renderChg = (stat?: string, val?: number) => {
             const div = document.createElement('div');
             div.className = "flex gap-1 items-center";
             div.setAttribute('data-chg-item', 'true');

             const statSelect = document.createElement('select');
             statSelect.className = "bg-background border border-border rounded px-1 py-0.5 w-1/2";
             if (this.variables.length === 0) {
                 statSelect.add(new Option('No vars defined', ''));
                 statSelect.disabled = true;
             } else {
                 this.variables.forEach(v => statSelect.add(new Option(v, v)));
             }
             if (stat) statSelect.value = stat;

             const opLabel = document.createElement('span');
             opLabel.innerText = '+='; 

             const valInput = document.createElement('input');
             valInput.type = 'number';
             valInput.className = "bg-background border border-border rounded px-1 py-0.5 w-1/4";
             valInput.placeholder = "0";
             if (val !== undefined) valInput.value = val.toString();

             const del = document.createElement('button');
             del.type = 'button';
             del.innerHTML = '&times;';
             del.className = "text-destructive ml-1";
             del.onclick = () => div.remove();

             div.appendChild(statSelect);
             div.appendChild(opLabel);
             div.appendChild(valInput);
             div.appendChild(del);
             chgList.appendChild(div);
        };
        
        if (choice.statChanges) {
            Object.entries(choice.statChanges).forEach(([k, v]) => renderChg(k, v));
        }
        (chgTitle.querySelector('button') as HTMLButtonElement).onclick = () => renderChg();

        logicContainer.appendChild(reqTitle);
        logicContainer.appendChild(reqList);
        logicContainer.appendChild(chgTitle);
        logicContainer.appendChild(chgList);

        this.choicesContainer.appendChild(rowContainer);
    }
    
    save() {
        if (!this.choicesContainer) return { choices: [] };
        const newChoices: Choice[] = [];
        
        // Iterate over row containers using the data attribute
        this.choicesContainer.querySelectorAll('[data-choice-row="true"]').forEach(rowContainer => {
            const textInput = rowContainer.querySelector('input[type="text"]') as HTMLInputElement;
            const sceneSelect = rowContainer.querySelector('select') as HTMLSelectElement; // The first select is the scene select
            const checkboxes = rowContainer.querySelectorAll('input[type="checkbox"]');
            const embedCheckbox = checkboxes[0] as HTMLInputElement;
            const transferCheckbox = checkboxes[1] as HTMLInputElement;
            
            if (textInput && sceneSelect) {
                // Parse Logic
                const statRequirements: StatRequirement[] = [];
                const statChanges: Record<string, number> = {};

                const reqList = rowContainer.querySelector('[data-req-list="true"]');
                if (reqList) {
                    reqList.querySelectorAll('[data-req-item="true"]').forEach(div => {
                        const sel = div.querySelector('select') as HTMLSelectElement;
                        const inp = div.querySelector('input') as HTMLInputElement;
                        if (sel.value && inp.value && !isNaN(parseFloat(inp.value))) {
                            statRequirements.push({ stat: sel.value, threshold: parseFloat(inp.value) });
                        }
                    });
                }

                const chgList = rowContainer.querySelector('[data-chg-list="true"]');
                if (chgList) {
                     chgList.querySelectorAll('[data-chg-item="true"]').forEach(div => {
                        const sel = div.querySelector('select') as HTMLSelectElement;
                        const inp = div.querySelector('input') as HTMLInputElement;
                        if (sel.value && inp.value && !isNaN(parseFloat(inp.value))) {
                            statChanges[sel.value] = parseFloat(inp.value);
                        }
                    });
                }

                newChoices.push({
                    text: textInput.value,
                    nextSceneId: sceneSelect.value,
                    embedOutcome: embedCheckbox.checked,
                    type: transferCheckbox.checked ? 'transfer' : undefined,
                    statRequirements: statRequirements.length > 0 ? statRequirements : undefined,
                    statChanges: Object.keys(statChanges).length > 0 ? statChanges : undefined
                });
            }
        });
        return { choices: newChoices };
    }
}

export class RandomTool {
    private data: { variants: string[] };
    private scenes: ScenesData;
    private wrapper: HTMLDivElement | null = null;
    private variantsContainer: HTMLDivElement | null = null;

    static get isInline() { return false; }
    static get toolbox() { return { title: 'Random Logic', icon: '🎲' }; }

    constructor({ data, config }: { data: { variants: string[] }, config: { scenes: ScenesData }}) {
        this.data = { variants: data.variants || [] };
        this.scenes = config.scenes;
    }

    render() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'pl-4 border-l-4 border-purple-500/50 space-y-2 p-2 bg-purple-500/5';

        const header = document.createElement('div');
        header.className = "text-sm font-bold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2";
        header.innerHTML = `<span>🎲 Random Branching</span> <span class="text-xs font-normal opacity-70">(Picks one at random)</span>`;
        this.wrapper.appendChild(header);

        this.variantsContainer = document.createElement('div');
        this.variantsContainer.className = 'space-y-2';
        
        if (this.data.variants.length === 0) {
            this.addVariantRow('');
            this.addVariantRow('');
        } else {
            this.data.variants.forEach(v => this.addVariantRow(v));
        }

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.innerText = '+ Add Variant';
        addButton.className = commonButtonClass;
        addButton.onclick = () => this.addVariantRow('');
        addButton.tabIndex = -1;

        this.wrapper.appendChild(this.variantsContainer);
        this.wrapper.appendChild(addButton);
        return this.wrapper;
    }

    addVariantRow(sceneId: string) {
        if (!this.variantsContainer) return;
        
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-center';
        row.setAttribute('data-variant-row', 'true');

        const label = document.createElement('span');
        label.className = "text-xs font-mono text-foreground/60 w-16 text-right";
        label.innerText = `Variant:`;

        const sceneSelect = document.createElement('select');
        sceneSelect.className = `${commonSelectClass} flex-grow`;
        sceneSelect.tabIndex = -1;
        const defaultOption = new Option('Select Scene...', '');
        sceneSelect.add(defaultOption);
        Object.values(this.scenes).forEach((s: Scene) => {
            const option = new Option(s.name, s.id);
            sceneSelect.add(option);
        });
        sceneSelect.value = sceneId;

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = 'Remove Variant';
        deleteButton.className = 'text-destructive/70 hover:text-destructive font-bold text-lg px-2';
        deleteButton.onclick = () => row.remove();
        deleteButton.tabIndex = -1;

        row.appendChild(label);
        row.appendChild(sceneSelect);
        row.appendChild(deleteButton);
        this.variantsContainer.appendChild(row);
    }

    save() {
        if (!this.variantsContainer) return { variants: [] };
        const variants: string[] = [];
        
        this.variantsContainer.querySelectorAll('[data-variant-row="true"]').forEach(row => {
            const select = row.querySelector('select') as HTMLSelectElement;
            if (select && select.value) {
                variants.push(select.value);
            }
        });
        return { variants };
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
        sceneSelect.tabIndex = -1;
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

export class TransferTool {
    private data: { nextSceneId: string };
    private scenes: ScenesData;
    
    static get isInline() { return false; }
    static get toolbox() { return { title: 'Transfer (Direct)', icon: '⏭️' }; }

    constructor({ data, config }: { data: { nextSceneId: string }, config: { scenes: ScenesData }}) {
        this.data = { nextSceneId: data.nextSceneId || '' };
        this.scenes = config.scenes;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex gap-2 items-center p-2 bg-purple-500/10 rounded border border-purple-500/30';
        
        const label = document.createElement('span');
        label.innerText = 'Direct Transfer to:';
        label.className = 'text-sm font-bold text-purple-700 dark:text-purple-300';

        const sceneSelect = document.createElement('select');
        sceneSelect.className = `${commonSelectClass} flex-grow`;
        sceneSelect.tabIndex = -1;
        const defaultOption = new Option('Select Scene...', '');
        sceneSelect.add(defaultOption);
        Object.values(this.scenes).forEach((s: Scene) => {
            const option = new Option(s.name, s.id);
            sceneSelect.add(option);
        });
        sceneSelect.value = this.data.nextSceneId;
        sceneSelect.id = 'transfer-scene-select';

        wrapper.appendChild(label);
        wrapper.appendChild(sceneSelect);
        return wrapper;
    }

    save(blockElement: HTMLDivElement) {
        const select = blockElement.querySelector('#transfer-scene-select') as HTMLSelectElement;
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
        this.ui.urlInput.tabIndex = -1;
        const urlButton = document.createElement('button');
        urlButton.type = 'button';
        urlButton.innerText = 'Set';
        urlButton.className = commonButtonClass;
        urlButton.onclick = () => this.setImageFromUrl();
        urlButton.tabIndex = -1;
        urlGroup.appendChild(this.ui.urlInput);
        urlGroup.appendChild(urlButton);

        // Upload input
        const uploadLabel = document.createElement('label');
        uploadLabel.className = `${commonButtonClass} cursor-pointer w-full text-center block`;
        uploadLabel.innerText = 'or Upload an Image (PNG, JPG, GIF)';
        uploadLabel.tabIndex = -1;
        this.ui.uploadInput = document.createElement('input');
        this.ui.uploadInput.type = 'file';
        this.ui.uploadInput.accept = 'image/png, image/jpeg, image/gif';
        this.ui.uploadInput.className = 'hidden';
        this.ui.uploadInput.onchange = (e) => this.handleFileUpload(e);
        this.ui.uploadInput.tabIndex = -1;
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
    private tempBlobUrl: string | null = null; // To store temporary preview URL
    private ui: {
        videoContainer: HTMLDivElement | null;
        urlInput: HTMLInputElement | null;
        uploadInput: HTMLInputElement | null;
    } = { videoContainer: null, urlInput: null, uploadInput: null };

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
        this.ui.urlInput.placeholder = 'Video URL or path...';
        this.ui.urlInput.className = `${commonInputClass} flex-grow`;
        this.ui.urlInput.value = this.data.url;
        this.ui.urlInput.tabIndex = -1;
        // Update data when typing directly
        this.ui.urlInput.oninput = () => {
            this.data.url = this.ui.urlInput?.value || '';
        };

        const urlButton = document.createElement('button');
        urlButton.type = 'button';
        urlButton.innerText = 'Preview URL';
        urlButton.className = commonButtonClass;
        urlButton.onclick = () => this.setVideoFromUrl();
        urlButton.tabIndex = -1;

        urlGroup.appendChild(this.ui.urlInput);
        urlGroup.appendChild(urlButton);

        // Upload input
        const uploadLabel = document.createElement('label');
        uploadLabel.className = `${commonButtonClass} cursor-pointer w-full text-center block`;
        uploadLabel.innerText = 'or Select Local Video File (MP4, WEBM)';
        uploadLabel.tabIndex = -1;
        this.ui.uploadInput = document.createElement('input');
        this.ui.uploadInput.type = 'file';
        this.ui.uploadInput.accept = 'video/mp4, video/webm, video/ogg';
        this.ui.uploadInput.className = 'hidden';
        this.ui.uploadInput.onchange = (e) => this.handleFileUpload(e);
        this.ui.uploadInput.tabIndex = -1;
        uploadLabel.appendChild(this.ui.uploadInput);

        this.wrapper.appendChild(this.ui.videoContainer);
        this.wrapper.appendChild(urlGroup);
        this.wrapper.appendChild(uploadLabel);

        return this.wrapper;
    }

    updateVideoPreview() {
        if (!this.ui.videoContainer) return;
        this.ui.videoContainer.innerHTML = '';
        
        // Prioritize tempBlobUrl for preview if it exists (active session), otherwise fallback to data.url
        const src = this.tempBlobUrl || this.data.url;

        if (src) {
            const video = document.createElement('video');
            video.src = src;
            video.className = 'max-w-full max-h-48 rounded';
            video.controls = true;
            video.tabIndex = -1;
            
            video.onerror = () => {
                if (!this.ui.videoContainer) return;
                this.ui.videoContainer.innerHTML = '';
                const msg = document.createElement('div');
                msg.className = "text-center p-2";
                msg.innerHTML = `<p class="font-semibold">Video Set: ${this.data.url}</p><p class="text-xs mt-1">(Preview unavailable for local export path)</p>`;
                this.ui.videoContainer.appendChild(msg);
            };

            this.ui.videoContainer.appendChild(video);
        } else {
            this.ui.videoContainer.innerText = 'No video set';
        }
    }
    
    setVideoFromUrl() {
        if (this.ui.urlInput && this.ui.urlInput.value) {
            this.data.url = this.ui.urlInput.value;
            this.tempBlobUrl = null; // Reset temp blob if manually setting URL
            this.updateVideoPreview();
        }
    }

    handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            // 1. Set the export path as requested by user
            this.data.url = `img/events/${file.name}`;
            if (this.ui.urlInput) {
                this.ui.urlInput.value = this.data.url;
            }

            // 2. Create a blob URL for immediate preview in the editor session
            this.tempBlobUrl = URL.createObjectURL(file);
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
    static get toolbox() { return { title: 'AI Prompt', icon: '✨' }; }

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
        
        // Manually mapping the slider index back to values
        const options = ['Short', 'Medium', 'Long'];
        const initialIndex = options.indexOf(this.data.config.dialogueLength);
        const displayLabels = ['3-5 lines', '6-8 lines', '9-12 lines'];

        this.wrapper.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-primary font-bold text-sm">✨ AI Prompt</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <div class="flex justify-between items-baseline mb-1">
                        <label class="block text-xs font-bold text-foreground/80">Dialogue</label>
                        <span id="len-label" class="text-[10px] text-primary font-medium">${displayLabels[initialIndex]}</span>
                    </div>
                    <input type="range" id="dialogueLengthSlider" min="0" max="2" step="1" value="${initialIndex}" class="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer" tabindex="-1">
                </div>
                <div>
                    <label class="block text-xs font-bold text-foreground/80 mb-1">Desired Outcome</label>
                    <select id="desiredOutcome" class="${commonSelectClass}" tabindex="-1">
                        <option value="auto">Let AI Decide</option>
                        <option value="transition">Continue (Transition)</option>
                        <option value="choice">Present a Choice</option>
                        <option value="end_story">End the Story</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-foreground/80 mb-1">Prompt (Optional)</label>
                <textarea id="aiPrompt" placeholder="e.g., The hero reveals a hidden secret." class="${commonInputClass} h-16 resize-y text-xs" tabindex="-1"></textarea>
            </div>
            <div class="flex items-center">
                <input type="checkbox" id="useContinuity-${this.data.id}" class="h-4 w-4 rounded border-border bg-card text-primary focus:ring-ring" tabindex="-1" />
                <label for="useContinuity-${this.data.id}" class="ml-2 block text-sm text-foreground/80">Use existing dialogue as context</label>
            </div>
            <button id="generateBtn" type="button" class="w-full mt-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-md shadow-sm hover:bg-primary/90" tabindex="-1">
                ✨ Generate
            </button>
        `;

        // Initialize Values
        const slider = this.wrapper.querySelector('#dialogueLengthSlider') as HTMLInputElement;
        const label = this.wrapper.querySelector('#len-label') as HTMLSpanElement;
        const desiredOutcomeSelect = this.wrapper.querySelector('#desiredOutcome') as HTMLSelectElement;
        const aiPromptTextarea = this.wrapper.querySelector('#aiPrompt') as HTMLTextAreaElement;
        const continuityCheckbox = this.wrapper.querySelector(`#useContinuity-${this.data.id}`) as HTMLInputElement;

        desiredOutcomeSelect.value = this.data.config.desiredOutcome;
        aiPromptTextarea.value = this.data.config.aiPrompt;
        continuityCheckbox.checked = this.data.config.useContinuity;

        // Slider interaction
        slider.oninput = () => {
            const idx = parseInt(slider.value);
            label.innerText = displayLabels[idx];
        };

        // Generate Button
        const generateBtn = this.wrapper.querySelector('#generateBtn') as HTMLButtonElement;
        generateBtn.onclick = () => {
            generateBtn.disabled = true;
            generateBtn.innerText = 'Generating...';
            this.config.onGenerate(this.save().config, this.block);
        };

        return this.wrapper;
    }

    save() {
        if (!this.wrapper) return this.data;
        
        const slider = this.wrapper.querySelector('#dialogueLengthSlider') as HTMLInputElement;
        const options: DialogueLength[] = ['Short', 'Medium', 'Long'];
        const dialogueLength = options[parseInt(slider.value)];

        const desiredOutcome = (this.wrapper.querySelector('#desiredOutcome') as HTMLSelectElement).value as AIPromptLine['config']['desiredOutcome'];
        const aiPrompt = (this.wrapper.querySelector('#aiPrompt') as HTMLTextAreaElement).value;
        const useContinuity = (this.wrapper.querySelector(`#useContinuity-${this.data.id}`) as HTMLInputElement).checked;

        return {
            id: this.data.id,
            config: { dialogueLength, desiredOutcome, aiPrompt, useContinuity }
        };
    }
}