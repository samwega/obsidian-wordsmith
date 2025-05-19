import { ItemView, WorkspaceLeaf, Setting, TextAreaComponent } from "obsidian";

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	// To store the state of the toggles and input
	private useWholeNoteContext: boolean = false;
	private useCustomContext: boolean = false;
	private customContextText: string = "";
	private useDynamicContext: boolean = false; // Added for Dynamic Context

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return CONTEXT_CONTROL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "AI Context Control";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.createEl("h4", { text: "AI Context Options" });

		// Whole Note Context Toggle
		new Setting(container)
			.setName("Use whole note as context")
			.setDesc("Uses the entire current note as context.")
			.addToggle((toggle) =>
				toggle.setValue(this.useWholeNoteContext).onChange(async (value) => {
					this.useWholeNoteContext = value;
					console.log("Whole note context toggled:", this.useWholeNoteContext);
					// TODO: Add logic to manage interactions between context types
				}),
			);

		// Custom Context Toggle
		new Setting(container)
			.setName("Use custom context")
			.setDesc("Manually provide text as context below.")
			.addToggle((toggle) =>
				toggle.setValue(this.useCustomContext).onChange(async (value) => {
					this.useCustomContext = value;
					console.log("Custom context toggled:", this.useCustomContext);
					// TODO: Show/hide or enable/disable the text area based on this value
				}),
			);

		// Custom Context Input Area
		const customContextSetting = new Setting(container)
			.setName("Custom context content")
			.setDesc("Paste context here. Supports [[wikilinks]].");

		const textAreaContainer = customContextSetting.controlEl.createDiv();
		const customContextTextArea = new TextAreaComponent(textAreaContainer)
			.setPlaceholder(`Paste your custom context here...
Supports [[wikilinks]].`) // Corrected to template literal
			.setValue(this.customContextText)
			.onChange(async (value) => {
				this.customContextText = value;
			}); // Removed semicolon if it was here and problematic

		customContextTextArea.inputEl.style.width = "100%";
		customContextTextArea.inputEl.style.minHeight = "100px";
		customContextTextArea.inputEl.style.resize = "vertical";

		// Dynamic Context Toggle (Optional Feature)
		new Setting(container)
			.setName("Use dynamic context (Optional)")
			.setDesc(
				"Automatically include surrounding paragraphs as context (e.g., 3 paragraphs around selection). WIP.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.useDynamicContext).onChange(async (value) => {
					this.useDynamicContext = value;
					console.log("Dynamic context toggled:", this.useDynamicContext);
					// TODO: Add logic to manage interactions
				}),
			);
	}

	async onClose() {
		// Perform any cleanup needed when the view is closed
	}

	// Methods to get current context states
	public getWholeNoteContextState(): boolean {
		return this.useWholeNoteContext;
	}

	public getCustomContextState(): boolean {
		return this.useCustomContext;
	}

	public getCustomContextText(): string {
		return this.useCustomContext ? this.customContextText : "";
	}

	public getDynamicContextState(): boolean {
		return this.useDynamicContext;
	}
}
