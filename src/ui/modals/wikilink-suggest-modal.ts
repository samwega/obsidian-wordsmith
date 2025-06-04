// src/ui/modals/wikilink-suggest-modal.ts
import { App, SuggestModal, TFile } from "obsidian";

export class WikilinkSuggestModal extends SuggestModal<TFile> {
	private onChooseFile: (file: TFile) => void; // Renamed for clarity

	constructor(app: App, onChooseFile: (file: TFile) => void) {
		super(app);
		this.onChooseFile = onChooseFile;
		this.setPlaceholder("Type to search for a note to link...");
	}

	getSuggestions(query: string): TFile[] {
		const lowerCaseQuery = query.toLowerCase();
		return this.app.vault.getMarkdownFiles().filter((file) => {
			// Search in basename and path for better matching
			return (
				file.basename.toLowerCase().includes(lowerCaseQuery) ||
				file.path.toLowerCase().includes(lowerCaseQuery)
			);
		});
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createEl("div", { text: file.basename });
		el.createEl("small", { text: file.path, cls: "text-muted" });
	}

	onChooseSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
		this.onChooseFile(file);
	}
}
