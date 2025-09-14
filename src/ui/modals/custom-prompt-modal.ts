// src/ui/modals/custom-prompt-modal.ts
import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	ToggleComponent,
} from "obsidian";
import type TextTransformer from "../../main";

export interface CustomPromptModalOptions {
	plugin: TextTransformer;
	onSubmit: (promptText: string) => void;
	initialPromptText?: string;
}

export class CustomPromptModal extends Modal {
	private promptText: string;
	private onSubmit: (promptText: string) => void;
	private plugin: TextTransformer;

	constructor(app: App, options: CustomPromptModalOptions) {
		super(app);
		this.plugin = options.plugin;
		this.onSubmit = options.onSubmit;
		this.promptText = options.initialPromptText || "";
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.titleEl.setText("Context aware generator");
		this.titleEl.addClass("custom-prompt-modal-title");

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

		// Delay focus to ensure modal is fully rendered
		window.setTimeout(() => {
			textArea.inputEl.focus();
		}, 50);

		textArea.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter" && !evt.shiftKey) {
				evt.preventDefault();
				this.submitForm();
			}
		});

		// --- NEW "Insert Prompt" Dropdown ---
		const insertPromptSetting = new Setting(contentEl)
			.setName("Modular generation user prompt constructor")
			.setDesc(
				"You can compose your prompt out of multiple saved generation prompts, like LEGO blocks.",
			);

		insertPromptSetting.addDropdown((dropdown) => {
			dropdown.addOption("", "--- Select prompt to insert ---"); // Placeholder
			const savedPrompts = this.plugin.settings.generationPrompts.filter((p) => p.enabled);

			savedPrompts.forEach((prompt) => {
				dropdown.addOption(prompt.id, prompt.name);
			});

			dropdown.onChange(async (value) => {
				if (!value) return; // Ignore selection of the placeholder

				const selectedPrompt = this.plugin.settings.generationPrompts.find(
					(p) => p.id === value,
				);
				if (selectedPrompt) {
					const currentText = textArea.getValue();
					const separator = currentText.trim() === "" ? "" : "\n\n";
					const newText = currentText + separator + selectedPrompt.text;

					textArea.setValue(newText);
					this.promptText = newText; // Update internal state

					// Move cursor to the end and focus
					window.setTimeout(() => {
						textArea.inputEl.focus();
						textArea.inputEl.selectionStart = newText.length;
						textArea.inputEl.selectionEnd = newText.length;
					}, 50);
				}

				dropdown.setValue(""); // Reset dropdown to placeholder after insertion
			});
		});

		const buttonContainer = contentEl.createDiv({
			cls: ["modal-button-container", "custom-prompt-modal-button-container-styles"],
		});

		const toggleContainer = buttonContainer.createDiv("toggle-container");
		toggleContainer.createEl("span", { text: "Save prompt to clipboard", cls: "toggle-label" });
		new ToggleComponent(toggleContainer)
			.setValue(this.plugin.settings.saveToClipboard)
			.onChange(async (value) => {
				this.plugin.settings.saveToClipboard = value;
				await this.plugin.saveSettings();
			});

		new ButtonComponent(buttonContainer)
			.setButtonText("Generate at cursor")
			.setCta()
			.onClick(() => {
				this.submitForm();
			});
	}

	private async submitForm(): Promise<void> {
		if (this.promptText.trim()) {
			if (this.plugin.settings.saveToClipboard) {
				try {
					await navigator.clipboard.writeText(this.promptText);
				} catch (err) {
					console.error("Failed to copy prompt to clipboard:", err);
					new Notice("Failed to copy prompt to clipboard.");
				}
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
