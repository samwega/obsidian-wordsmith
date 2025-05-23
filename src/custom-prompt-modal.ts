import { App, Modal, TextAreaComponent, ButtonComponent } from 'obsidian';

export class CustomPromptModal extends Modal {
    private promptText: string = "Type your prompt here...";
    private onSubmit: (promptText: string) => void;

    constructor(app: App, onSubmit: (promptText: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: 'Enter your Ad-hoc AI Prompt' });

        const textArea = new TextAreaComponent(contentEl)
            .setValue(this.promptText)
            .onChange((value) => {
                this.promptText = value;
            })
            .setPlaceholder('Enter your prompt...');
        
        textArea.inputEl.style.width = '100%';
        textArea.inputEl.style.minHeight = '300px';
        
        // Automatically focus the textarea
        // Needs to be deferred slightly for focus to work reliably
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

        new ButtonComponent(buttonContainer)
            .setButtonText('Generate')
            .setCta()
            .onClick(() => {
                this.submitForm();
            });
        
        new ButtonComponent(buttonContainer)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close();
            });
    }

    private submitForm() {
        if (this.promptText.trim()) {
            this.onSubmit(this.promptText);
            this.close();
        }
    }

    override onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
