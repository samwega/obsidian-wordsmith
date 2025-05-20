import { ItemView, WorkspaceLeaf, Setting, TextAreaComponent, ToggleComponent } from "obsidian"; // Added ToggleComponent

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
    private useWholeNoteContext: boolean = false;
    private useCustomContext: boolean = false;
    private customContextText: string = "";
    private useDynamicContext: boolean = false;

    // To store toggle components for mutual exclusion
    private dynamicContextToggleComponent: ToggleComponent | null = null;
    private wholeNoteContextToggleComponent: ToggleComponent | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    override getViewType(): string {
        return CONTEXT_CONTROL_VIEW_TYPE;
    }

    override getDisplayText(): string {
        return "AI Context Control";
    }

    override getIcon(): string {
        return "book-type";
    }

    override async onOpen() {
        const container = this.contentEl;
        container.empty();
        
        const titleEl = container.createEl("h4", { text: "Text Transform" });
        titleEl.style.marginTop = "0px";
        titleEl.style.marginBottom = "2px";

        const subTitleEl = container.createEl("h6", { text: "AI Context Options" });
        subTitleEl.style.marginTop = "0px";
        subTitleEl.style.marginBottom = "15px";
        subTitleEl.style.color = "var(--text-muted)";

        // 1. Dynamic Context Toggle
        new Setting(container)
            .setName("Dynamic context")
            .setDesc(
                "Automatically include surrounding paragraphs as context. More expensive!", // Updated desc slightly
            )
            .addToggle((toggle) => {
                this.dynamicContextToggleComponent = toggle; // Store component
                toggle.setValue(this.useDynamicContext).onChange(async (value) => {
                    this.useDynamicContext = value;
                    console.log("Dynamic context toggled:", this.useDynamicContext);
                    if (value && this.wholeNoteContextToggleComponent) {
                        this.useWholeNoteContext = false;
                        this.wholeNoteContextToggleComponent.setValue(false);
                    }
                });
            });

        // 2. Entire Note Context Toggle
        new Setting(container)
            .setName("Entire note as context")
            .setDesc("More expensive!")
            .addToggle((toggle) => {
                this.wholeNoteContextToggleComponent = toggle; // Store component
                toggle.setValue(this.useWholeNoteContext).onChange(async (value) => {
                    this.useWholeNoteContext = value;
                    console.log("Whole note context toggled:", this.useWholeNoteContext);
                    if (value && this.dynamicContextToggleComponent) {
                        this.useDynamicContext = false;
                        this.dynamicContextToggleComponent.setValue(false);
                    }
                });
            });

        // 3. Custom Context Toggle (Independent)
        new Setting(container)
            .setName("Custom context")
            .setDesc("Provide text as context in the input box below.")
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
Adding [[wikilinks]] support to include other notes soon.`)
            .setValue(this.customContextText)
            .onChange(async (value) => {
                this.customContextText = value;
            });

        customContextTextArea.inputEl.style.width = "100%";
        customContextTextArea.inputEl.style.minHeight = "100px";
        customContextTextArea.inputEl.style.resize = "vertical";
        textAreaContainer.style.marginTop = "5px"; 

    }

    override async onClose() {
        // Perform any cleanup needed when the view is closed
        this.dynamicContextToggleComponent = null;
        this.wholeNoteContextToggleComponent = null;
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
