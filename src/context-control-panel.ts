// src/context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Notice,
	Setting,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
} from "obsidian"; 
import TextTransformer from "./main"; 
import { MODEL_SPECS, SupportedModels } from "./settings-data"; 

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer; 
	private useWholeNoteContext = false;
	private useCustomContext = false;
	private customContextText = "";
	private useDynamicContext = false;

	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
	private modelDropdown: DropdownComponent | null = null;
	private dynamicContextLinesSetting: Setting | null = null;

	private descriptionContainer: HTMLDivElement | null = null;
	private descriptionIndicator: HTMLSpanElement | null = null;
	private isDescriptionExpanded = false; // To track the state

	constructor(leaf: WorkspaceLeaf, plugin: TextTransformer) {
		super(leaf);
		this.plugin = plugin; 
		// Initialize state from plugin settings if needed, e.g. for dynamicContextLineCount
		// For toggles, they typically default to false unless persisted elsewhere.
		// For this panel, we assume these states (useWholeNoteContext, etc.) are session-based
		// or managed by the plugin's global settings if they were intended to be persistent
		// beyond the panel's lifecycle. For now, they are component-local.
	}

	override getViewType(): string {
		return CONTEXT_CONTROL_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return "Text Transformer: Context Control";
	}

	override getIcon(): string {
		return "book-type";
	}

	updateModelSelector(): void {
		if (this.modelDropdown) {
			this.modelDropdown.setValue(this.plugin.settings.model);
		}
	}

	override async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		const headerContainer = container.createDiv();
		headerContainer.style.display = "flex";
		headerContainer.style.alignItems = "center";
		headerContainer.style.justifyContent = "space-between"; 
		headerContainer.style.marginBottom = "2px";

		const titleEl = headerContainer.createEl("div", { text: "TT Model" });
		titleEl.style.marginTop = "0px";
		titleEl.style.marginBottom = "0px"; 
		titleEl.style.flexGrow = "1";
		titleEl.style.fontSize = "var(--font-ui-small)";
		titleEl.style.fontWeight = "bold";

		const modelSelectorContainer = headerContainer.createDiv();

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
			});
			dropdown.selectEl.style.maxWidth = "150px";
			// ADD THESE LINES for smaller appearance:
			dropdown.selectEl.style.fontSize = "var(--font-ui-smaller)"; // Make the font smaller
			dropdown.selectEl.style.padding = "0px 8px"; // Reduce padding (top/bottom and left/right)
			// You might also need to adjust height if the theme/Obsidian version sets a specific height
			dropdown.selectEl.style.height = "auto"; // Or a specific smaller pixel value like "24px"
		});

		// --- Expandable AI Context Options Subtitle ---
		const contextOptionsHeader = container.createDiv();
		contextOptionsHeader.style.cursor = "pointer";
		contextOptionsHeader.style.display = "flex";
		contextOptionsHeader.style.alignItems = "center";
		contextOptionsHeader.style.marginTop = "15px"; // Give some space above
		contextOptionsHeader.style.marginBottom = "5px"; // Space before description or first setting

		this.descriptionIndicator = contextOptionsHeader.createEl("span", { text: this.isDescriptionExpanded ? "🞃 " : "‣ " });
		this.descriptionIndicator.style.marginRight = "5px";
		this.descriptionIndicator.style.fontSize = "var(--font-ui-small)"; // Indicator size
        this.descriptionIndicator.style.color = "var(--text-muted)";

		const subTitleTextEl = contextOptionsHeader.createEl("div", { text: "Context Options:" }); // Renamed to avoid conflict if you still had subTitleEl
		subTitleTextEl.style.fontWeight = "bold";
		subTitleTextEl.style.fontSize = "var(--font-ui-smaller)";
		subTitleTextEl.style.color = "var(--text-muted)";

		// --- Description Text Container (hidden by default) ---
		this.descriptionContainer = container.createDiv();
		this.descriptionContainer.style.display = this.isDescriptionExpanded ? "block" : "none";
		this.descriptionContainer.style.paddingLeft = "20px"; // Indent the description
		this.descriptionContainer.style.marginBottom = "10px";
		this.descriptionContainer.style.fontSize = "var(--font-ui-smaller)";
		this.descriptionContainer.style.color = "var(--text-muted)";
		this.descriptionContainer.style.lineHeight = "1.4";

		const p1 = this.descriptionContainer.createEl("p", {
			text: "Configure how AI understands your note's context. This is crucial for relevant and accurate transformations or generations. Keep in mind this can get expensive, depending on the size of your context.",
		});
        p1.style.marginBottom = "3px"; // Optional: Adjust spacing between paragraphs
		this.descriptionContainer.createEl("p", {
			text: "⏺ Dynamic: Uses text immediately around your selection/cursor. Good for local edits.",
		});

		this.descriptionContainer.createEl("p", {
			text: "  ‣ Lines: represents how many lines before and after the selection are included with Dynamic Context. These can be blank lines or whole paragraphs.",
		});

		this.descriptionContainer.createEl("p", {
			text: "⏺ Full Note: Sends the whole note. Best for summaries or global changes, but costs more.",
		});
		this.descriptionContainer.createEl("p", {
			text: "⏺ Custom: Paste specific text (like rules or style guides) for the AI to consider. Including [[notes]] via wikilinks is currently work in progress. Try <RULE: Spell everything backwards.>",
		});

		contextOptionsHeader.addEventListener("click", () => {
			this.isDescriptionExpanded = !this.isDescriptionExpanded;
			if (this.descriptionContainer && this.descriptionIndicator) {
				if (this.isDescriptionExpanded) {
					this.descriptionContainer.style.display = "block";
					this.descriptionIndicator.setText("🞃 ");
				} else {
					this.descriptionContainer.style.display = "none";
					this.descriptionIndicator.setText("‣ ");
				}
			}
		});

		// 1. Dynamic Context Toggle
		new Setting(container)
			.setName("Dynamic")
			.addToggle((toggle) => {
				this.dynamicContextToggleComponent = toggle;
				toggle.setValue(this.useDynamicContext).onChange((value) => {
					this.useDynamicContext = value;
					if (value && this.wholeNoteContextToggleComponent) {
						this.useWholeNoteContext = false;
						this.wholeNoteContextToggleComponent.setValue(false);
					}
					if (this.dynamicContextLinesSetting) {
						if (value) {
							this.dynamicContextLinesSetting.settingEl.style.display = "";
						} else {
							this.dynamicContextLinesSetting.settingEl.style.display = "none";
						}
					}
				});
			});

		this.dynamicContextLinesSetting = new Setting(container)
			.setName("  ‣ Lines")
			.addText((text) => {
				text
					.setPlaceholder(
						this.plugin.settings.dynamicContextLineCount.toString(),
					)
					.setValue(this.plugin.settings.dynamicContextLineCount.toString())
					.onChange(async (value) => {
						const numValue = Number.parseInt(value);
						if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 21) {
							this.plugin.settings.dynamicContextLineCount = numValue;
							await this.plugin.saveSettings();
						} else {
							new Notice("Please enter a number between 1 and 21.");
							text.setValue(this.plugin.settings.dynamicContextLineCount.toString()); // Revert to original value
						}
					});
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.max = "21";
				text.inputEl.style.width = "40px"; // Make the input box smaller
			});
		
			if (this.dynamicContextLinesSetting) { // Check if it was successfully created
				this.dynamicContextLinesSetting.settingEl.style.borderTop = "none";
			}

		// Initial visibility based on useDynamicContext state
		if (this.dynamicContextLinesSetting) {
			this.dynamicContextLinesSetting.settingEl.style.display = this.useDynamicContext ? "" : "none";
		}


		// 2. Entire Note Context Toggle
		new Setting(container)
			.setName("Full note")
			.addToggle((toggle) => {
				this.wholeNoteContextToggleComponent = toggle; 
				toggle.setValue(this.useWholeNoteContext).onChange((value) => {
					this.useWholeNoteContext = value;
					if (value && this.dynamicContextToggleComponent) {
						this.useDynamicContext = false;
						this.dynamicContextToggleComponent.setValue(false);
						if (this.dynamicContextLinesSetting) { // Also hide lines setting if dynamic is turned off
							this.dynamicContextLinesSetting.settingEl.style.display = "none";
						}
					}
				});
			});

		// 3. Custom Context Toggle (Independent)
		new Setting(container)
			.setName("Custom")
			.addToggle((toggle) =>
				toggle.setValue(this.useCustomContext).onChange((value) => {
					this.useCustomContext = value;
				}),
			);

		// 4. Custom Context Input Area (Text Area)
		const textAreaContainer = container.createDiv("tt-custom-context-container");
		const customContextTextArea = new TextAreaComponent(textAreaContainer)
			.setPlaceholder(
				`Add custom context.
Can include [[notes]].`,
			)
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		customContextTextArea.inputEl.style.width = "100%";
		customContextTextArea.inputEl.style.minHeight = "50px";
		customContextTextArea.inputEl.style.resize = "vertical";
		textAreaContainer.style.marginTop = "5px";
	}

	override onClose(): Promise<void> {
		this.dynamicContextToggleComponent = null;
		this.wholeNoteContextToggleComponent = null;
		this.modelDropdown = null; 
		this.dynamicContextLinesSetting = null;
		return Promise.resolve(); 
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