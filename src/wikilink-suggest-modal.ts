// src/wikilink-suggest-modal.ts
import { App, SuggestModal, TFile } from "obsidian";

export class WikilinkSuggestModal extends SuggestModal<TFile> {
	private onChoose: (file: TFile) => void;

	constructor(app: App, onChoose: (file: TFile) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Type to search for a note to link...");
	}

	getSuggestions(query: string): TFile[] {
		const lowerCaseQuery = query.toLowerCase();
		return this.app.vault.getMarkdownFiles().filter((file) => {
			return file.basename.toLowerCase().includes(lowerCaseQuery);
		});
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createEl("div", { text: file.basename });
		el.createEl("small", { text: file.path, cls: "text-muted" });
	}

	onChooseSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(file);
	}
}
