import { ItemView, WorkspaceLeaf, Setting, TextAreaComponent } from "obsidian";

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
    private useWholeNoteContext: boolean = false;
    private useCustomContext: boolean = false;
    private customContextText: string = "";
    private useDynamicContext: boolean = false;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return CONTEXT_CONTROL_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "AI Context Control"; // This is the text shown on hover, can be different from panel title
    }

    getIcon(): string {
        return "book-type"; // Changed icon to book-type
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        
        // Main Title for the Panel
        const titleEl = container.createEl("h4", { text: "Text Transform" });
        titleEl.style.marginTop = "0px";
        titleEl.style.marginBottom = "2px";

        // Subtitle
        const subTitleEl = container.createEl("h6", { text: "AI Context Options" });
        subTitleEl.style.marginTop = "0px";
        subTitleEl.style.marginBottom = "15px";
        subTitleEl.style.color = "var(--text-muted)";

        // 1. Dynamic Context Toggle
        new Setting(container)
            .setName("Dynamic context")
            .setDesc(
                "Automatically include surrounding paragraphs as context (e.g., 3 paragraphs around selection). WIP.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.useDynamicContext).onChange(async (value) => {
                    this.useDynamicContext = value;
                    console.log("Dynamic context toggled:", this.useDynamicContext);
                }),
            );

        // 2. Entire Note Context Toggle
        new Setting(container)
            .setName("Entire note as context")
            .setDesc("Uses the whole current note as context.")
            .addToggle((toggle) =>
                toggle.setValue(this.useWholeNoteContext).onChange(async (value) => {
                    this.useWholeNoteContext = value;
                    console.log("Whole note context toggled:", this.useWholeNoteContext);
                }),
            );

        // 3. Custom Context Toggle
        new Setting(container)
            .setName("Custom context")
            .setDesc("Manually provide text as context in the input box below.")
            .addToggle((toggle) =>
                toggle.setValue(this.useCustomContext).onChange(async (value) => {
                    this.useCustomContext = value;
                    console.log("Custom context toggled:", this.useCustomContext);
                }),
            );

        // 4. Custom Context Input Area (Text Area)
        const textAreaContainer = container.createDiv("tt-custom-context-container");
        const customContextTextArea = new TextAreaComponent(textAreaContainer)
            .setPlaceholder(`Paste your custom context here...
Supports [[wikilinks]] to include other notes.`)
            .setValue(this.customContextText)
            .onChange(async (value) => {
                this.customContextText = value;
            });

        customContextTextArea.inputEl.style.width = "100%";
        customContextTextArea.inputEl.style.minHeight = "100px";
        customContextTextArea.inputEl.style.resize = "vertical";
        textAreaContainer.style.marginTop = "5px"; 
        // No specific marginBottom here, as it's the last element in this group
        // Spacing before next major section (if any) or end of panel would be handled by panel padding or next element's marginTop

    }

    async onClose() {
        // Perform any cleanup needed when the view is closed
    }

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
