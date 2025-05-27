// src/context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Notice,
	Setting,
	TFile,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
	// App, // App is available via this.plugin.app
} from "obsidian";
import TextTransformer from "./main";
import { MODEL_SPECS, SupportedModels } from "./settings-data";
import { WikilinkSuggestModal } from "./wikilink-suggest-modal";

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer;
	private useWholeNoteContext = false;
	private useCustomContext = false;
	private customContextText = "";
	private useDynamicContext = false;

	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
	private modelDropdown: DropdownComponent | null = null; // Correctly typed
	private dynamicContextLinesSetting: Setting | null = null;

	private descriptionContainer: HTMLDivElement | null = null;
	private descriptionIndicator: HTMLSpanElement | null = null;
	private isDescriptionExpanded = false;
	private customContextTextAreaContainer: HTMLDivElement | null = null;
	private customContextTextArea: TextAreaComponent | null = null;

	private justInsertedLink = false;

	constructor(leaf: WorkspaceLeaf, plugin: TextTransformer) {
		super(leaf);
		this.plugin = plugin;
	}

	override getViewType(): string {
		return CONTEXT_CONTROL_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return "WordSmith: Context Control";
	}

	override getIcon(): string {
		return "anvil";
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
		headerContainer.classList.add("ccp-header-container");

		const titleEl = headerContainer.createEl("div", { text: "WS Model" });
		titleEl.classList.add("ccp-title");

		const modelSelectorContainer = headerContainer.createDiv();

		// Corrected DropdownComponent instantiation and assignment
		this.modelDropdown = new DropdownComponent(modelSelectorContainer);
		for (const key in MODEL_SPECS) {
			if (!Object.hasOwn(MODEL_SPECS, key)) continue;
			const display = MODEL_SPECS[key as SupportedModels].displayText;
			this.modelDropdown.addOption(key, display);
		}
		this.modelDropdown.setValue(this.plugin.settings.model).onChange(async (value) => {
			this.plugin.settings.model = value as SupportedModels;
			await this.plugin.saveSettings();
		});
		this.modelDropdown.selectEl.classList.add("ccp-model-dropdown-select");

		const contextOptionsHeader = container.createDiv();
		contextOptionsHeader.classList.add("ccp-context-options-header");

		this.descriptionIndicator = contextOptionsHeader.createEl("span", {
			text: this.isDescriptionExpanded ? "🞃 " : "‣ ",
		});
		this.descriptionIndicator.classList.add("ccp-description-indicator");

		const subTitleTextEl = contextOptionsHeader.createEl("div", { text: "Context Options:" });
		subTitleTextEl.classList.add("ccp-subtitle");

		this.descriptionContainer = container.createDiv();
		this.descriptionContainer.classList.add("ccp-description-container");
		if (this.isDescriptionExpanded) this.descriptionContainer.classList.add("is-visible");

		const p1 = this.descriptionContainer.createEl("p", {
			text: "Configure how AI understands your note's context. This is crucial for relevant and accurate transformations or generations. Keep in mind this can get expensive, depending on the size of your context.",
		});
		p1.classList.add("ccp-description-p1");

		this.descriptionContainer.createEl("p", {
			text: "⏺ Dynamic: Uses text immediately around your selection/cursor. Good for local edits.",
		}).classList.add("ccp-description-paragraph");

		this.descriptionContainer.createEl("p", {
			text: "  ‣ Lines: represents how many lines before and after the selection are included with Dynamic Context. These can be blank lines or whole paragraphs.",
		}).classList.add("ccp-description-paragraph");

		this.descriptionContainer.createEl("p", {
			text: "⏺ Full Note: Sends the whole note. Best for summaries or global changes, but costs more.",
		}).classList.add("ccp-description-paragraph");

		this.descriptionContainer.createEl("p", {
			text: "⏺ Custom: Paste specific text (like rules or style guides) for the AI to consider. Type '[[' to link notes (their content will be embedded). Try <RULE: Spell everything backwards.>",
		}).classList.add("ccp-description-paragraph");

		contextOptionsHeader.addEventListener("click", () => {
			this.isDescriptionExpanded = !this.isDescriptionExpanded;
			if (this.descriptionContainer && this.descriptionIndicator) {
				this.descriptionContainer.classList.toggle("is-visible", this.isDescriptionExpanded);
				this.descriptionIndicator.setText(this.isDescriptionExpanded ? "🞃 " : "‣ ");
			}
		});

		new Setting(container).setName("Dynamic").addToggle((toggle) => {
			this.dynamicContextToggleComponent = toggle;
			toggle.setValue(this.useDynamicContext).onChange((value) => {
				this.useDynamicContext = value;
				if (value && this.wholeNoteContextToggleComponent) {
					this.useWholeNoteContext = false;
					this.wholeNoteContextToggleComponent.setValue(false);
				}
				if (this.dynamicContextLinesSetting) {
					this.dynamicContextLinesSetting.settingEl.style.display = value ? "flex" : "none";
				}
			});
		});

		this.dynamicContextLinesSetting = new Setting(container)
			.setName("‣  Lines")
			.addText((text) => {
				text
					.setPlaceholder(this.plugin.settings.dynamicContextLineCount.toString())
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
				text.inputEl.classList.add("ccp-dynamic-lines-input");
			});
		if (this.dynamicContextLinesSetting) {
			this.dynamicContextLinesSetting.settingEl.classList.add("ccp-dynamic-lines-setting");
			this.dynamicContextLinesSetting.nameEl.classList.add("ccp-dynamic-lines-setting-name");
			this.dynamicContextLinesSetting.settingEl.style.display = this.useDynamicContext ? "flex" : "none";
		}

		new Setting(container).setName("Full note").addToggle((toggle) => {
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

		new Setting(container).setName("Custom").addToggle((toggle) =>
			toggle.setValue(this.useCustomContext).onChange((value) => {
				this.useCustomContext = value;
				if (this.customContextTextAreaContainer) {
					this.customContextTextAreaContainer.classList.toggle("is-visible", value);
				}
				if (value && this.customContextTextArea) {
					this.customContextTextArea.inputEl.focus();
				}
			}),
		);

		this.customContextTextAreaContainer = container.createDiv();
		this.customContextTextAreaContainer.classList.add("ccp-custom-context-container");
		if (this.useCustomContext) this.customContextTextAreaContainer.classList.add("is-visible");

		this.customContextTextArea = new TextAreaComponent(this.customContextTextAreaContainer)
			.setPlaceholder("Add custom context. Type '[[' to link notes...")
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		this.customContextTextArea.inputEl.classList.add("ccp-custom-context-textarea");

		this.customContextTextArea.inputEl.addEventListener("input", (event) => {
			if (this.justInsertedLink) {
				this.justInsertedLink = false;
				return;
			}

			const inputEl = event.target as HTMLTextAreaElement;
			const text = inputEl.value;
			const cursorPos = inputEl.selectionStart;
			const textBeforeCursor = text.substring(0, cursorPos);

			const match = /\[\[([^\]]*)$/.exec(textBeforeCursor);

			if (match) {
				new WikilinkSuggestModal(this.plugin.app, (chosenFile) => {
					const linkText = `[[${chosenFile.basename}]]`;
					const textBeforeLinkOpen = textBeforeCursor.substring(0, match.index);
					const textAfterCursor = text.substring(cursorPos);

					const newText = textBeforeLinkOpen + linkText + textAfterCursor;
					this.customContextText = newText;

					if (this.customContextTextArea) {
						this.customContextTextArea.setValue(newText);

						const newCursorPos = textBeforeLinkOpen.length + linkText.length;
						this.customContextTextArea.inputEl.selectionStart = newCursorPos;
						this.customContextTextArea.inputEl.selectionEnd = newCursorPos;
						this.justInsertedLink = true;
						this.customContextTextArea.inputEl.focus();
					}
				}).open();
			}
		});
	}

	override onClose(): Promise<void> {
		this.dynamicContextToggleComponent = null;
		this.wholeNoteContextToggleComponent = null;
		this.modelDropdown = null;
		this.dynamicContextLinesSetting = null;
		this.customContextTextArea = null;
		this.descriptionContainer = null;
		this.descriptionIndicator = null;
		this.customContextTextAreaContainer = null;
		return super.onClose();
	}

	getWholeNoteContextState(): boolean {
		return this.useWholeNoteContext;
	}

	getCustomContextState(): boolean {
		return this.useCustomContext;
	}

	async getCustomContextText(): Promise<string> {
		if (!this.useCustomContext || !this.customContextText) {
			return "";
		}

		const textToProcess = this.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		let match: RegExpExecArray | null;
		let lastIndex = 0;

		const partsToResolve: (string | Promise<string>)[] = [];

		if (!this.plugin || !this.plugin.app) {
			console.error("WordSmith: Plugin or App instance not available for getCustomContextText.");
			return textToProcess;
		}

		while (true) {
			match = wikilinkRegex.exec(textToProcess);
			if (match === null) break;
			partsToResolve.push(textToProcess.substring(lastIndex, match.index));

			const linkFullText = match[1];
			const linkPathOnly = linkFullText.split("|")[0].trim();
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPathOnly, "");

			if (file instanceof TFile) {
				partsToResolve.push(this.plugin.app.vault.cachedRead(file));
			} else {
				partsToResolve.push(match[0]);
			}
			lastIndex = wikilinkRegex.lastIndex;
		}
		partsToResolve.push(textToProcess.substring(lastIndex));

		const resolvedParts = await Promise.all(partsToResolve);

		return resolvedParts.join("");
	}

	getDynamicContextState(): boolean {
		return this.useDynamicContext;
	}
}
