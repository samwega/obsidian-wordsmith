// src/context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Notice,
	Setting,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
	TFile,
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
		titleEl.style.fontSize = "var(--font-ui-medium)";
		titleEl.style.color = "var(--text-accent)";
		titleEl.style.fontWeight = "bold";

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
		this.modelDropdown.selectEl.style.maxWidth = "150px";
		this.modelDropdown.selectEl.style.fontSize = "var(--font-ui-smaller)";
		this.modelDropdown.selectEl.style.padding = "0px 18px 0px 2px";
		this.modelDropdown.selectEl.style.height = "auto";


		const contextOptionsHeader = container.createDiv();
		contextOptionsHeader.style.cursor = "pointer";
		contextOptionsHeader.style.display = "flex";
		contextOptionsHeader.style.alignItems = "center";
		contextOptionsHeader.style.marginTop = "15px";
		contextOptionsHeader.style.marginBottom = "5px";

		this.descriptionIndicator = contextOptionsHeader.createEl("span", {
			text: this.isDescriptionExpanded ? "🞃 " : "‣ ",
		});
		this.descriptionIndicator.style.marginRight = "5px";
		this.descriptionIndicator.style.fontSize = "var(--font-ui-small)";
		this.descriptionIndicator.style.color = "var(--text-muted)";

		const subTitleTextEl = contextOptionsHeader.createEl("div", { text: "Context Options:" });
		subTitleTextEl.style.fontWeight = "bold";
		subTitleTextEl.style.fontSize = "var(--font-ui-small)";
		subTitleTextEl.style.color = "var(--text-muted)";

		this.descriptionContainer = container.createDiv();
		this.descriptionContainer.style.display = this.isDescriptionExpanded ? "block" : "none";
		this.descriptionContainer.style.paddingLeft = "20px";
		this.descriptionContainer.style.marginBottom = "10px";
		this.descriptionContainer.style.fontSize = "var(--font-ui-smaller)";
		this.descriptionContainer.style.color = "var(--text-muted)";
		this.descriptionContainer.style.lineHeight = "1.4";

		const p1 = this.descriptionContainer.createEl("p", {
			text: "Configure how AI understands your note's context. This is crucial for relevant and accurate transformations or generations. Keep in mind this can get expensive, depending on the size of your context.",
		});
		p1.style.marginBottom = "3px";
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
			text: "⏺ Custom: Paste specific text (like rules or style guides) for the AI to consider. Type '[[' to link notes (their content will be embedded). Try <RULE: Spell everything backwards.>",
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

		new Setting(container).setName("Dynamic").addToggle((toggle) => {
			this.dynamicContextToggleComponent = toggle;
			toggle.setValue(this.useDynamicContext).onChange((value) => {
				this.useDynamicContext = value;
				if (value && this.wholeNoteContextToggleComponent) {
					this.useWholeNoteContext = false;
					this.wholeNoteContextToggleComponent.setValue(false);
				}
				if (this.dynamicContextLinesSetting) {
					this.dynamicContextLinesSetting.settingEl.style.display = value ? "" : "none";
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
				text.inputEl.style.width = "40px";
			});
		if (this.dynamicContextLinesSetting) {
			this.dynamicContextLinesSetting.settingEl.style.borderTop = "none";
			this.dynamicContextLinesSetting.nameEl.style.color = "var(--text-accent)";
			this.dynamicContextLinesSetting.settingEl.style.display = this.useDynamicContext ? "" : "none";
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
					this.customContextTextAreaContainer.style.display = value ? "" : "none";
				}
				if (value && this.customContextTextArea) {
					this.customContextTextArea.inputEl.focus();
				}
			}),
		);

		this.customContextTextAreaContainer = container.createDiv("tt-custom-context-container");
		this.customContextTextAreaContainer.style.display = this.useCustomContext ? "" : "none";
		this.customContextTextAreaContainer.style.marginTop = "5px";

		this.customContextTextArea = new TextAreaComponent(this.customContextTextAreaContainer)
			.setPlaceholder("Add custom context. Type '[[' to link notes...")
			.setValue(this.customContextText)
			.onChange((value) => {
				this.customContextText = value;
			});

		this.customContextTextArea.inputEl.style.width = "100%";
		this.customContextTextArea.inputEl.style.minHeight = "80px";
		this.customContextTextArea.inputEl.style.resize = "vertical";

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
					
					if(this.customContextTextArea){
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

	override async onClose(): Promise<void> {
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

		let textToProcess = this.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		let match;
		
		const partsToResolve: (string | Promise<string>)[] = [];
		let lastIndex = 0;

		if (!this.plugin || !this.plugin.app) {
			console.error("WordSmith: Plugin or App instance not available for getCustomContextText.");
			return textToProcess; 
		}

		while ((match = wikilinkRegex.exec(textToProcess)) !== null) {
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