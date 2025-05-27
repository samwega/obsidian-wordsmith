import { App, ButtonComponent, Modal, Notice, TextAreaComponent } from "obsidian";

export class CustomPromptModal extends Modal {
	private promptText = "";
	private onSubmit: (promptText: string) => void;

	constructor(app: App, onSubmit: (promptText: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", { text: "Context Aware Generator", cls: "custom-prompt-modal-title" });

		const textArea = new TextAreaComponent(contentEl)
			.setValue(this.promptText)
			.onChange((value) => {
				this.promptText = value;
			})
			.setPlaceholder(
				`Enter your prompt... You may reference your context if you like.

<enter> submits. <shift+enter> for new line.`,
			);

		textArea.inputEl.classList.add("custom-prompt-modal-textarea");

		setTimeout(() => {
			textArea.inputEl.focus();
		}, 50);

		textArea.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && !evt.shiftKey) {
				evt.preventDefault();
				this.submitForm();
			}
		});

		const buttonContainer = contentEl.createDiv({ cls: ["modal-button-container", "custom-prompt-modal-button-container-styles"] });

		new ButtonComponent(buttonContainer)
			.setButtonText("Generate at Cursor")
			.setCta()
			.onClick(() => {
				this.submitForm();
			});
	}

	private submitForm(): void {
		if (this.promptText.trim()) {
			this.onSubmit(this.promptText);
			this.close();
		} else {
			new Notice("Prompt cannot be empty.");
		}
	}

	override onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
