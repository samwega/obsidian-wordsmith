import { App, SuggestModal } from "obsidian";
import { ProofreaderPrompt } from "./settings";

export class PromptPaletteModal extends SuggestModal<ProofreaderPrompt> {
	private prompts: ProofreaderPrompt[];
	private onChoose: (prompt: ProofreaderPrompt) => void;

	constructor(
		app: App,
		prompts: ProofreaderPrompt[],
		onChoose: (prompt: ProofreaderPrompt) => void,
	) {
		super(app);
		this.prompts = prompts;
		this.onChoose = onChoose;
		this.setPlaceholder("Select a prompt...");
	}

	getSuggestions(query: string): ProofreaderPrompt[] {
		const lower = query.toLowerCase();
		return this.prompts.filter((p) => p.name.toLowerCase().includes(lower));
	}

	renderSuggestion(prompt: ProofreaderPrompt, el: HTMLElement): void {
		el.createEl("div", { text: prompt.name });
		el.createEl("small", { text: prompt.isDefault ? "Default" : "Custom" });
	}

	onChooseSuggestion(prompt: ProofreaderPrompt): void {
		this.onChoose(prompt);
	}
}
