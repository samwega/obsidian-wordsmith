/* eslint-disable no-unused-vars */
import { App, SuggestModal } from "obsidian";
import { TextTransformerPrompt } from "./settings";

export class PromptPaletteModal extends SuggestModal<TextTransformerPrompt> {
	private prompts: TextTransformerPrompt[];
	private onChoose: (prompt: TextTransformerPrompt) => void;

	constructor(
		app: App,
		prompts: TextTransformerPrompt[],
		_onChoose: (prompt: TextTransformerPrompt) => void,
	) {
		super(app);
		this.prompts = prompts;
		this.onChoose = _onChoose;
		this.setPlaceholder("Select a prompt...");
	}

	getSuggestions(query: string): TextTransformerPrompt[] {
		const lower = query.toLowerCase();
		return this.prompts.filter((p) => p.name.toLowerCase().includes(lower));
	}

	renderSuggestion(_prompt: TextTransformerPrompt, el: HTMLElement): void {
		el.createEl("div", { text: _prompt.name });
		el.createEl("small", { text: _prompt.isDefault ? "Default" : "Custom" });
	}

	onChooseSuggestion(prompt: TextTransformerPrompt): void {
		this.onChoose(prompt);
	}
}
