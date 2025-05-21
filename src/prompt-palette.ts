/* eslint-disable no-unused-vars */
import { App, SuggestModal } from "obsidian";
import { TextTransformerPrompt } from "./settings"; // Assuming settings.ts re-exports TextTransformerPrompt

export class PromptPaletteModal extends SuggestModal<TextTransformerPrompt> {
	private prompts: TextTransformerPrompt[];
	private onChoose: (prompt: TextTransformerPrompt) => void;
	private onCancel: (() => void) | undefined; // Correctly typed for exactOptionalPropertyTypes
	private chosen: boolean = false;

	constructor(
		app: App,
		prompts: TextTransformerPrompt[],
		_onChoose: (prompt: TextTransformerPrompt) => void,
		_onCancel?: () => void // onCancel is optional
	) {
		super(app);
		this.prompts = prompts;
		this.onChoose = _onChoose;
		this.onCancel = _onCancel;
		this.setPlaceholder("Select a prompt...");
	}

	getSuggestions(query: string): TextTransformerPrompt[] {
		const lower = query.toLowerCase();
		return this.prompts.filter((p) => p.name.toLowerCase().includes(lower));
	}

	renderSuggestion(_prompt: TextTransformerPrompt, el: HTMLElement): void {
		el.createEl("div", { text: _prompt.name });
		el.createEl("small", { text: _prompt.isDefault ? "Default" : (_prompt.id.startsWith("custom-") ? "Custom" : "") });
	}

	onChooseSuggestion(prompt: TextTransformerPrompt, _evt: MouseEvent | KeyboardEvent): void { // _evt marked as unused
		this.chosen = true;
		this.onChoose(prompt);
	}

	override onClose() { // Added override
		super.onClose(); 
		if (!this.chosen && this.onCancel) {
			this.onCancel();
		}
	}
}