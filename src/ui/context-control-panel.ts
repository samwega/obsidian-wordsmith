// src/ui/context-control-panel.ts
import {
	ButtonComponent,
	ItemView,
	Notice,
	Setting,
	TFile,
	TextAreaComponent,
	ToggleComponent,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";
import { getProviderInfo } from "../lib/provider-utils";
import { KNOWN_MODEL_HINTS, ModelTemperatureHint, UNKNOWN_MODEL_HINT } from "../lib/settings-data";
import type TextTransformer from "../main";
import { ModelSelectionModal } from "./modals/ModelSelectionModal";
import { WikilinkSuggestModal } from "./modals/wikilink-suggest-modal";

export interface ReferencedNoteData {
	originalWikilink: string;
	linkText: string;
	aliasText?: string;
	sourcePath: string;
	content: string;
}

export interface StructuredCustomContext {
	rawText: string;
	referencedNotes: ReferencedNoteData[];
}

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer;
	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
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
		return "WordSmith: Context";
	}

	override getIcon(): string {
		return "crown";
	}

	async updateView(): Promise<void> {
		await this.renderModelControls();
		this.updateTemperatureSlider();
	}

	override async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("wordsmith-context-panel");

		this._renderHeader(contentEl);
		await this.updateView(); // Initial render of dynamic controls

		this._renderDescriptionSection(contentEl);
		this._renderContextToggles(contentEl);
		this._renderCustomContextArea(contentEl);
	}

	private _renderHeader(container: HTMLElement): void {
		container.createDiv({ cls: "ccp-header-container" });
	}

	private async renderModelControls(): Promise<void> {
		const container = this.contentEl.querySelector(".ccp-header-container");
		if (!container) return;

		container.querySelector(".ccp-model-controls")?.remove();
		const controlsContainer = container.createDiv({ cls: "ccp-model-controls" });

		let modelNameText = "Select a Model";
		let providerNameText: string | null = null;

		const { selectedModelId } = this.plugin.settings;
		if (selectedModelId) {
			const allModels = await this.plugin.modelService.getModels();
			const selectedModel = allModels.find((m) => m.id === selectedModelId);

			if (selectedModel) {
				modelNameText = selectedModel.name;
				providerNameText = selectedModel.provider;

				// For OpenRouter models, shorten the display name by removing the original provider prefix.
				if (
					providerNameText?.toLowerCase().includes("openrouter") &&
					modelNameText.includes("/")
				) {
					modelNameText = modelNameText.substring(modelNameText.indexOf("/") + 1);
				}
			} else {
				const [provider, name] = selectedModelId.split("//");
				modelNameText = name || selectedModelId;
				if (provider) providerNameText = provider;
			}
		}

		const setting = new Setting(controlsContainer).addButton((button: ButtonComponent) => {
			button.buttonEl.empty();
			button.buttonEl.addClass("wordsmith-model-selector");

			button.buttonEl.createSpan({
				cls: "wordsmith-model-selector-icon",
				text: "w͜s",
			});

			const textWrapper = button.buttonEl.createSpan({
				cls: "wordsmith-model-selector-text",
			});
			const providerInfo = getProviderInfo(providerNameText);

			textWrapper.createSpan({
				text: `${providerInfo.shortTag} `,
				cls: "wordsmith-model-selector-short-tag",
			});

			textWrapper.createSpan({ text: modelNameText });

			const chevronEl = button.buttonEl.createSpan();
			setIcon(chevronEl, "chevron-down");

			button
				.setTooltip("Select model")
				.onClick(() => new ModelSelectionModal(this.app, this.plugin).open());
		});

		setting.settingEl.addClass("wordsmith-model-selector-setting");
	}

	private updateTemperatureSlider(): void {
		const sliderSettingEl = this.contentEl.querySelector(".ccp-temperature-slider-setting");
		sliderSettingEl?.remove();

		let hint: ModelTemperatureHint | undefined;
		const currentModelId = this.plugin.settings.selectedModelId;
		if (currentModelId) {
			// --- FIX: Simplify lookup logic ---
			// The `apiId` is the part of the canonical ID after "//".
			const apiId = currentModelId.split("//")[1];
			// Check for a hint using only the apiId.
			hint = KNOWN_MODEL_HINTS[apiId];
		}

		// Use the explicit default hint if no specific hint is found.
		const effectiveHint = hint || UNKNOWN_MODEL_HINT;

		const minTemp = effectiveHint.min;
		const maxTemp = effectiveHint.max;

		const temperatureSetting = new Setting(this.contentEl)
			.setName("Temperature")
			.addSlider((slider) => {
				slider
					.setLimits(minTemp, maxTemp, 0.05)
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
					});
			});
		temperatureSetting.settingEl.addClass("ccp-temperature-slider-setting");

		const header = this.contentEl.querySelector(".ccp-header-container");
		header?.insertAdjacentElement("afterend", temperatureSetting.settingEl);
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
			toggle.setValue(this.plugin.settings.useDynamicContext).onChange(async (value) => {
				this.plugin.settings.useDynamicContext = value;
				if (value) {
					this.plugin.settings.useWholeNoteContext = false;
					if (this.wholeNoteContextToggleComponent) {
						this.wholeNoteContextToggleComponent.setValue(false);
					}
				}
				this.dynamicContextLinesSetting?.settingEl.classList.toggle("is-visible", value);
				await this.plugin.saveSettings();
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
			this.plugin.settings.useDynamicContext,
		);
		new Setting(container).setName("Full note").addToggle((toggle) => {
			this.wholeNoteContextToggleComponent = toggle;
			toggle.setValue(this.plugin.settings.useWholeNoteContext).onChange(async (value) => {
				this.plugin.settings.useWholeNoteContext = value;
				if (value) {
					this.plugin.settings.useDynamicContext = false;
					if (this.dynamicContextToggleComponent) {
						this.dynamicContextToggleComponent.setValue(false);
					}
					this.dynamicContextLinesSetting?.settingEl.classList.remove("is-visible");
				}
				await this.plugin.saveSettings();
			});
		});
		new Setting(container).setName("Custom").addToggle((toggle) =>
			toggle.setValue(this.plugin.settings.useCustomContext).onChange(async (value) => {
				this.plugin.settings.useCustomContext = value;
				this.customContextTextAreaContainer?.classList.toggle("is-visible", value);
				if (value && this.customContextTextArea) {
					this.customContextTextArea.inputEl.focus();
				}
				await this.plugin.saveSettings();
			}),
		);
	}

	private _renderCustomContextArea(container: HTMLElement): void {
		this.customContextTextAreaContainer = container.createDiv({
			cls: "ccp-custom-context-container",
		});
		if (this.plugin.settings.useCustomContext)
			this.customContextTextAreaContainer.classList.add("is-visible");
		this.customContextTextArea = new TextAreaComponent(this.customContextTextAreaContainer)
			.setPlaceholder("Add custom context. Type '[[' to link notes...")
			.setValue(this.plugin.settings.customContextText)
			.onChange(async (value) => {
				this.plugin.settings.customContextText = value;
				await this.plugin.saveSettings();
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
				new WikilinkSuggestModal(this.app, async (chosenFile: TFile) => {
					const linkText = `[[${chosenFile.basename}]]`;
					const textBeforeLinkOpen = textBeforeCursor.substring(0, match.index);
					const textAfterCursor = text.substring(cursorPos);
					const newText = textBeforeLinkOpen + linkText + textAfterCursor;
					this.plugin.settings.customContextText = newText;
					await this.plugin.saveSettings();
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
		this.dynamicContextLinesSetting = null;
		this.descriptionContainer = null;
		this.descriptionIndicator = null;
		this.customContextTextAreaContainer = null;
		this.customContextTextArea = null;
		return super.onClose();
	}

	async getStructuredCustomContext(): Promise<StructuredCustomContext> {
		const { settings } = this.plugin;
		if (!settings.useCustomContext || !settings.customContextText) {
			return { rawText: settings.customContextText || "", referencedNotes: [] };
		}
		const textToProcess = settings.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		const uniqueReferencedNotes = new Map<string, Promise<ReferencedNoteData>>();

		if (!this.plugin || !this.plugin.app) {
			console.error(
				"WordSmith: Plugin or App instance not available for getStructuredCustomContext.",
			);
			return { rawText: textToProcess, referencedNotes: [] };
		}
		let match: RegExpExecArray | null = null;
		// biome-ignore lint/suspicious/noAssignInExpressions: Intentional assignment in while loop condition for brevity
		while ((match = wikilinkRegex.exec(textToProcess)) !== null) {
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
		return { rawText: textToProcess, referencedNotes: resolvedNotes };
	}
}
