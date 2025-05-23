import { App, Modal, Notice, TextAreaComponent, ButtonComponent } from 'obsidian';

export class CustomPromptModal extends Modal {
    private promptText: string = ""; 
    private onSubmit: (promptText: string) => void;

    constructor(app: App, onSubmit: (promptText: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const titleEl = contentEl.createEl('h3', { text: 'Context Aware Generator' });
        titleEl.style.textAlign = 'center';

        const textArea = new TextAreaComponent(contentEl)
            .setValue(this.promptText) 
            .onChange((value) => {
                this.promptText = value;
            })
            .setPlaceholder(
                `Enter your prompt...

You may reference your context if you like.

<Enter> submits. <Shift+Enter> for new line.`,
                ) 
        
        textArea.inputEl.style.width = '100%';
        textArea.inputEl.style.minHeight = '300px';
        textArea.inputEl.style.minWidth = '100%'; // Prevent shrinking below container width
        
        setTimeout(() => {
            textArea.inputEl.focus();
        }, 50);

        textArea.inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
            if (evt.key === 'Enter' && !evt.shiftKey) {
                evt.preventDefault();
                this.submitForm();
            }
        });
        
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.textAlign = 'center'; 
        buttonContainer.style.marginTop = '1em';

        new ButtonComponent(buttonContainer)
            .setButtonText('Generate at Cursor')
            .setCta()
            .onClick(() => {
                this.submitForm();
            });
    }

    private submitForm() {
        if (this.promptText.trim()) {
            this.onSubmit(this.promptText);
            this.close();
        } else {
            new Notice("Prompt cannot be empty.");
        }
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}