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
		return "Text Transformer Context Control";
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

		const titleEl = headerContainer.createEl("h5", { text: "Transformer" });
		titleEl.style.marginTop = "0px";
		titleEl.style.marginBottom = "0px"; 
		titleEl.style.flexGrow = "1"; 

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
		});

		const subTitleEl = container.createEl("h6", { text: "Context Menu" });
		subTitleEl.style.marginTop = "0px";
		subTitleEl.style.marginBottom = "15px";
		subTitleEl.style.color = "var(--text-muted)";

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
			.setName("‣ Lines")
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
				`Add custom context...
Try "RULE: Spell everything backwards."
Or include [[notes]] (wip).`,
			)
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		customContextTextArea.inputEl.style.width = "100%";
		customContextTextArea.inputEl.style.minHeight = "80px";
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