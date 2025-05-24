// context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Setting,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
	Notice, // Added Notice
} from "obsidian";
import TextTransformer from "./main";
import { MODEL_SPECS, SupportedModels } from "./settings-data";

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer;
	private useWholeNoteContext = false;
	private useCustomContext = false;
	private customContextText = "";
	private useDynamicContext = false; // Will default to false on new panel open

	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
	private modelDropdown: DropdownComponent | null = null;
	private dynamicContextLinesSetting: Setting | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TextTransformer) {
		super(leaf);
		this.plugin = plugin;
		// this.useDynamicContext = this.plugin.settings.dynamicContextActivePanel ?? false; // Removed this line
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

		const titleEl = headerContainer.createEl("h4", { text: "Text Transform" });
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

		const subTitleEl = container.createEl("h6", { text: "AI Context Options" });
		subTitleEl.style.marginTop = "0px";
		subTitleEl.style.marginBottom = "15px";
		subTitleEl.style.color = "var(--text-muted)";

		// 1. Dynamic Context Toggle
		new Setting(container)
			.setName("Dynamic context")
			.setDesc(
				"Automatically include surrounding paragraphs as context. Configure lines below. More expensive!",
			)
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
			.setName("Context lines")
			.setDesc("Paragraphs before/after to include (1-21).")
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
							text.setValue(this.plugin.settings.dynamicContextLineCount.toString());
						}
					});
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.max = "21";
			});

		if (this.useDynamicContext) {
			this.dynamicContextLinesSetting.settingEl.style.display = "";
		} else {
			this.dynamicContextLinesSetting.settingEl.style.display = "none";
		}
		this.dynamicContextLinesSetting.settingEl.style.paddingLeft = "25px";


		new Setting(container)
			.setName("Entire note as context")
			.setDesc("More expensive!")
			.addToggle((toggle) => {
				this.wholeNoteContextToggleComponent = toggle;
				toggle.setValue(this.useWholeNoteContext).onChange((value) => {
					this.useWholeNoteContext = value;
					if (value && this.dynamicContextToggleComponent) {
						this.useDynamicContext = false;
						this.dynamicContextToggleComponent.setValue(false);
						if (this.dynamicContextLinesSetting) {
							this.dynamicContextLinesSetting.settingEl.style.display = "none";
						}
					}
				});
			});

		new Setting(container)
			.setName("Custom context")
			.setDesc("Provide text as context in the input box below.")
			.addToggle((toggle) =>
				toggle.setValue(this.useCustomContext).onChange((value) => {
					this.useCustomContext = value;
				}),
			);

		const textAreaContainer = container.createDiv("tt-custom-context-container");
		const customContextTextArea = new TextAreaComponent(textAreaContainer)
			.setPlaceholder(
				`Paste your custom context here...
You can also add rules in here, try "Spell everything backwards.".
Coming soon: [[wikilinks]] support.`,
			)
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		customContextTextArea.inputEl.style.width = "100%";
		customContextTextArea.inputEl.style.minHeight = "100px";
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