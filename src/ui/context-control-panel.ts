// src/ui/context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Notice,
	Setting,
	SliderComponent,
	TFile,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
} from "obsidian";
import { MODEL_SPECS, SupportedModels } from "../lib/settings-data";
import type TextTransformer from "../main";
import { WikilinkSuggestModal } from "./modals/wikilink-suggest-modal";

// Add these new interface definitions
export interface ReferencedNoteData {
	originalWikilink: string; // The exact string matched, e.g., "[[NoteA]]" or "[[NoteA|Alias]]"
	linkText: string; // The text used for resolution, e.g., "NoteA"
	aliasText?: string; // The alias text, e.g., "Alias" from "[[NoteA|Alias]]"
	sourcePath: string; // Full path to the note, e.g., "folder/NoteA.md" or "[NOT FOUND]"
	content: string; // Content of the note or "[This note could not be found.]"
}

export interface StructuredCustomContext {
	rawText: string; // The original custom context text with [[wikilinks]] intact.
	referencedNotes: ReferencedNoteData[];
}

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
	private temperatureSliderComponent: SliderComponent | null = null;
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

	updateTemperatureSliderDisplay(): void {
		if (this.temperatureSliderComponent) {
			this.temperatureSliderComponent.setValue(this.plugin.settings.temperature);
		}
	}

	override onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		this._renderHeader(contentEl);
		this._renderTemperatureSlider(contentEl); // Slider rendered on a new line
		this._renderDescriptionSection(contentEl);
		this._renderContextToggles(contentEl);
		this._renderCustomContextArea(contentEl);
		this.updateTemperatureSliderDisplay(); // Call to initialize slider value
		return Promise.resolve();
	}

	private _renderHeader(container: HTMLElement): void {
		const headerContainer = container.createDiv({ cls: "ccp-header-container" });
		headerContainer.createEl("div", { text: "WS Model", cls: "ccp-title" });

		const modelSelectorContainer = headerContainer.createDiv();
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
	}

	private _renderTemperatureSlider(container: HTMLElement): void {
		// Temperature Slider
		new Setting(container)
			.setName("Temperature") // Name changed
			.addSlider((slider) => {
				this.temperatureSliderComponent = slider;
				slider
					.setLimits(0.0, 2.0, 0.1) // Step is 0.1
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
					});
			})
			.settingEl.classList.add("ccp-temperature-slider-setting");
	}

	private _renderDescriptionSection(container: HTMLElement): void {
		const contextOptionsHeader = container.createDiv({ cls: "ccp-context-options-header" });
		this.descriptionIndicator = contextOptionsHeader.createEl("span", {
			text: this.isDescriptionExpanded ? "🞃 " : "‣ ",
			cls: "ccp-description-indicator",
		});
		contextOptionsHeader.createEl("div", { text: "Context Options:", cls: "ccp-subtitle" });

		this.descriptionContainer = container.createDiv({ cls: "ccp-description-container" });
		if (this.isDescriptionExpanded) this.descriptionContainer.classList.add("is-visible");

		this.descriptionContainer.createEl("p", {
			text: "Configure how AI understands your note's context. This is crucial for relevant and accurate transformations or generations. Keep in mind this can get expensive, depending on the size of your context.",
			cls: "ccp-description-p1",
		});

		this.descriptionContainer.createEl("p", {
			text: "⏺ Dynamic: Uses text immediately around your selection/cursor. Good for local edits.",
			cls: "ccp-description-paragraph",
		});
		this.descriptionContainer.createEl("p", {
			text: "  ‣ Lines: represents how many lines before and after the selection are included with Dynamic Context. These can be blank lines or whole paragraphs.",
			cls: "ccp-description-paragraph",
		});
		this.descriptionContainer.createEl("p", {
			text: "⏺ Full Note: Sends the whole note. Best for summaries or global changes, but costs more.",
			cls: "ccp-description-paragraph",
		});
		this.descriptionContainer.createEl("p", {
			text: "⏺ Custom: Paste specific text (like rules or style guides) for the AI to consider. Type '[[' to link notes (their content will be embedded). Try <RULE: Spell everything backwards.>",
			cls: "ccp-description-paragraph",
		});

		contextOptionsHeader.addEventListener("click", () => {
			this.isDescriptionExpanded = !this.isDescriptionExpanded;
			if (this.descriptionContainer && this.descriptionIndicator) {
				this.descriptionContainer.classList.toggle("is-visible", this.isDescriptionExpanded);
				this.descriptionIndicator.setText(this.isDescriptionExpanded ? "🞃 " : "‣ ");
			}
		});
	}

	private _renderContextToggles(container: HTMLElement): void {
		new Setting(container).setName("Dynamic").addToggle((toggle) => {
			this.dynamicContextToggleComponent = toggle;
			toggle.setValue(this.useDynamicContext).onChange((value) => {
				this.useDynamicContext = value;
				if (value && this.wholeNoteContextToggleComponent) {
					this.useWholeNoteContext = false;
					this.wholeNoteContextToggleComponent.setValue(false);
				}
				this.dynamicContextLinesSetting?.settingEl.classList.toggle("is-visible", value);
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

		this.dynamicContextLinesSetting.settingEl.classList.add("ccp-dynamic-lines-setting");
		this.dynamicContextLinesSetting.nameEl.classList.add("ccp-dynamic-lines-setting-name");
		this.dynamicContextLinesSetting.settingEl.classList.toggle(
			"is-visible",
			this.useDynamicContext,
		);

		new Setting(container).setName("Full note").addToggle((toggle) => {
			this.wholeNoteContextToggleComponent = toggle;
			toggle.setValue(this.useWholeNoteContext).onChange((value) => {
				this.useWholeNoteContext = value;
				if (value && this.dynamicContextToggleComponent) {
					this.useDynamicContext = false;
					this.dynamicContextToggleComponent.setValue(false);
					this.dynamicContextLinesSetting?.settingEl.classList.remove("is-visible");
				}
			});
		});

		new Setting(container).setName("Custom").addToggle((toggle) =>
			toggle.setValue(this.useCustomContext).onChange((value) => {
				this.useCustomContext = value;
				this.customContextTextAreaContainer?.classList.toggle("is-visible", value);
				if (value && this.customContextTextArea) {
					this.customContextTextArea.inputEl.focus();
				}
			}),
		);
	}

	private _renderCustomContextArea(container: HTMLElement): void {
		this.customContextTextAreaContainer = container.createDiv({
			cls: "ccp-custom-context-container",
		});
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
				new WikilinkSuggestModal(this.plugin.app, (chosenFile: TFile) => {
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
		this.temperatureSliderComponent = null;
		this.dynamicContextLinesSetting = null;
		this.descriptionContainer = null;
		this.descriptionIndicator = null;
		this.customContextTextAreaContainer = null;
		this.customContextTextArea = null;
		return super.onClose();
	}

	getWholeNoteContextState(): boolean {
		return this.useWholeNoteContext;
	}

	getCustomContextState(): boolean {
		return this.useCustomContext;
	}

	getDynamicContextState(): boolean {
		return this.useDynamicContext;
	}

	async getStructuredCustomContext(): Promise<StructuredCustomContext> {
		if (!this.useCustomContext || !this.customContextText) {
			return { rawText: this.customContextText || "", referencedNotes: [] };
		}

		const textToProcess = this.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		const uniqueReferencedNotes = new Map<string, Promise<ReferencedNoteData>>();

		if (!this.plugin || !this.plugin.app) {
			console.error(
				"WordSmith: Plugin or App instance not available for getStructuredCustomContext.",
			);
			return { rawText: textToProcess, referencedNotes: [] };
		}

		let match: RegExpExecArray | null;
		wikilinkRegex.lastIndex = 0;

		match = wikilinkRegex.exec(textToProcess);
		while (match !== null) {
			const originalWikilink = match[0];
			const linkFullText = match[1];

			const parts = linkFullText.split("|");
			const linkPathOnly = parts[0].trim();
			const aliasText = parts.length > 1 ? parts[1].trim() : undefined;

			if (!uniqueReferencedNotes.has(linkPathOnly)) {
				const promise = (async (): Promise<ReferencedNoteData> => {
					const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPathOnly, "");
					if (file instanceof TFile) {
						try {
							const content = await this.plugin.app.vault.cachedRead(file);
							const noteData: ReferencedNoteData = {
								originalWikilink,
								linkText: linkPathOnly,
								sourcePath: file.path,
								content,
							};
							if (aliasText !== undefined) {
								noteData.aliasText = aliasText;
							}
							return noteData;
						} catch (error) {
							console.error(
								`WordSmith: Error reading file ${file.path} for wikilink ${originalWikilink}:`,
								error,
							);
							const noteData: ReferencedNoteData = {
								originalWikilink,
								linkText: linkPathOnly,
								sourcePath: file.path,
								content: `[Error reading note: ${error instanceof Error ? error.message : "Unknown error"}]`,
							};
							if (aliasText !== undefined) {
								noteData.aliasText = aliasText;
							}
							return noteData;
						}
					} else {
						const noteData: ReferencedNoteData = {
							originalWikilink,
							linkText: linkPathOnly,
							sourcePath: "[NOT FOUND]",
							content: "[This note could not be found.]",
						};
						if (aliasText !== undefined) {
							noteData.aliasText = aliasText;
						}
						return noteData;
					}
				})();
				uniqueReferencedNotes.set(linkPathOnly, promise);
			}
		}

		const resolvedNotes = await Promise.all(Array.from(uniqueReferencedNotes.values()));

		return {
			rawText: textToProcess,
			referencedNotes: resolvedNotes,
		};
	}
}
