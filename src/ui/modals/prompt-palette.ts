// src/ui/modals/prompt-palette.ts
import { App, SuggestModal } from "obsidian";
import type { TextTransformerPrompt } from "../../lib/settings-data";

export interface PromptPaletteModalOptions {
	prompts: TextTransformerPrompt[];
	onChoose: (prompt: TextTransformerPrompt) => void;
	onCancel?: () => void;
}

export class PromptPaletteModal extends SuggestModal<TextTransformerPrompt> {
	private prompts: TextTransformerPrompt[];
	private onChoose: (prompt: TextTransformerPrompt) => void;
	private onCancel: (() => void) | undefined;
	private chosen = false;

	constructor(app: App, options: PromptPaletteModalOptions) {
		super(app);
		this.prompts = options.prompts.filter((p) => p.showInPromptPalette !== false);
		this.onChoose = options.onChoose;
		this.onCancel = options.onCancel;
		this.setPlaceholder("Select a prompt...");
	}

	getSuggestions(query: string): TextTransformerPrompt[] {
		const lower = query.toLowerCase();
		return this.prompts.filter((p) => p.name.toLowerCase().includes(lower));
	}

	renderSuggestion(prompt: TextTransformerPrompt, el: HTMLElement): void {
		el.createEl("div", { text: prompt.name });
		let smallText = "";
		if (prompt.isDefault) {
			smallText = "Default";
		} else if (prompt.id.startsWith("custom-")) {
			smallText = "Custom";
		}
		if (smallText) {
			el.createEl("small", { text: smallText, cls: "text-muted" });
		}
	}

	onChooseSuggestion(prompt: TextTransformerPrompt, _evt: MouseEvent | KeyboardEvent): void {
		this.chosen = true;
		this.onChoose(prompt);
	}

	override onClose(): void {
		super.onClose();
		if (!this.chosen && this.onCancel) {
			this.onCancel();
		}
	}
}
