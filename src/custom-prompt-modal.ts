import { App, ButtonComponent, Modal, Notice, TextAreaComponent, ToggleComponent } from "obsidian";
import TextTransformer from "./main";

export class CustomPromptModal extends Modal {
	private promptText = "";
	private onSubmit: (promptText: string) => void;
	private plugin: TextTransformer;

	constructor(app: App, plugin: TextTransformer, onSubmit: (promptText: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", {
			text: "Context Aware Generator",
			cls: "custom-prompt-modal-title",
		});

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

		const buttonContainer = contentEl.createDiv({
			cls: ["modal-button-container", "custom-prompt-modal-button-container-styles"],
		});

		const toggleContainer = buttonContainer.createDiv("toggle-container");

		toggleContainer.createEl("span", {
			text: "Save prompt to clipboard",
			cls: "toggle-label",
		});

		new ToggleComponent(toggleContainer)
			.setValue(this.plugin.settings.saveToClipboard)
			.onChange(async (value) => {
				this.plugin.settings.saveToClipboard = value;
				await this.plugin.saveSettings();
			});

		new ButtonComponent(buttonContainer)
			.setButtonText("Generate at Cursor")
			.setCta()
			.onClick(() => {
				this.submitForm();
			});
	}

	private submitForm(): void {
		if (this.promptText.trim()) {
			if (this.plugin.settings.saveToClipboard) {
				navigator.clipboard.writeText(this.promptText);
			}
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
