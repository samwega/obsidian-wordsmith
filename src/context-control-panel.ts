import {
	DropdownComponent,
	ItemView,
	Setting,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
} from "obsidian"; // Added ToggleComponent, DropdownComponent
import TextTransformer from "./main"; // Import TextTransformer
import { MODEL_SPECS, SupportedModels } from "./settings-data"; // Import MODEL_SPECS and SupportedModels

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer; // Store plugin instance
	private useWholeNoteContext = false;
	private useCustomContext = false;
	private customContextText = "";
	private useDynamicContext = false;

	// To store toggle components for mutual exclusion
	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
	private modelDropdown: DropdownComponent | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TextTransformer) {
		// Accept plugin instance
		super(leaf);
		this.plugin = plugin; // Store plugin instance
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

	// Method to update the dropdown if settings change elsewhere
	updateModelSelector(): void {
		if (this.modelDropdown) {
			this.modelDropdown.setValue(this.plugin.settings.model);
		}
	}

	override async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		// Header container for Title and Model Dropdown
		const headerContainer = container.createDiv();
		headerContainer.style.display = "flex";
		headerContainer.style.alignItems = "center";
		headerContainer.style.justifyContent = "space-between"; // Pushes dropdown to the right
		headerContainer.style.marginBottom = "2px";

		const titleEl = headerContainer.createEl("h4", { text: "Text Transform" });
		titleEl.style.marginTop = "0px";
		titleEl.style.marginBottom = "0px"; // Adjusted margin
		titleEl.style.flexGrow = "1"; // Allow title to take available space

		const modelSelectorContainer = headerContainer.createDiv();
		// No explicit styling needed here if dropdown handles its own width

		new DropdownComponent(modelSelectorContainer).then((dropdown) => {
			this.modelDropdown = dropdown;
			for (const key in MODEL_SPECS) {
				if (!Object.hasOwn(MODEL_SPECS, key)) continue;
				const display = MODEL_SPECS[key as SupportedModels].displayText;
				dropdown.addOption(key, display);
			}
			dropdown.setValue(this.plugin.settings.model).onChange(async (value) => {
				this.plugin.settings.model = value as SupportedModels;
				await this.plugin.saveSettings();
				// If settings tab is open, it should ideally reflect this change.
				// Obsidian's settings tabs usually re-render on display or if forced.
			});
			// Adjust dropdown style if necessary, e.g., width or margin
			dropdown.selectEl.style.maxWidth = "150px"; // Example: constrain width
		});

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
				toggle.setValue(this.useDynamicContext).onChange((value) => {
					this.useDynamicContext = value;
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
				toggle.setValue(this.useWholeNoteContext).onChange((value) => {
					this.useWholeNoteContext = value;
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
				toggle.setValue(this.useCustomContext).onChange((value) => {
					this.useCustomContext = value;
				}),
			);

		// 4. Custom Context Input Area (Text Area)
		const textAreaContainer = container.createDiv("tt-custom-context-container");
		const customContextTextArea = new TextAreaComponent(textAreaContainer)
			.setPlaceholder(`Paste your custom context here...
You can also add rules in here, try "Spell everything backwards."
Coming soon: [[wikilinks]] support.`)
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		customContextTextArea.inputEl.style.width = "100%";
		customContextTextArea.inputEl.style.minHeight = "100px";
		customContextTextArea.inputEl.style.resize = "vertical";
		textAreaContainer.style.marginTop = "5px";
	}

	override onClose(): void {
		// Perform any cleanup needed when the view is closed
		this.dynamicContextToggleComponent = null;
		this.wholeNoteContextToggleComponent = null;
		this.modelDropdown = null; // Clear reference to dropdown
	}

	getWholeNoteContextState(): boolean {
		return this.useWholeNoteContext;
	}

	getCustomContextState(): boolean {
		return this.useCustomContext;
	}

	getCustomContextText(): string {
		return this.useCustomContext ? this.customContextText : "";
	}

	getDynamicContextState(): boolean {
		return this.useDynamicContext;
	}
}
