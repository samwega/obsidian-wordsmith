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
import { getProviderInfo, getTemperatureHintForModel } from "../lib/provider-utils";
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
	private headerContextToggleComponent: ToggleComponent | null = null;
	private dynamicContextLinesSetting: Setting | null = null;
	private customContextTextAreaContainer: HTMLDivElement | null = null;
	private customContextTextArea: TextAreaComponent | null = null;
	private justInsertedLink = false;

	// Stop generation button - UI components for cancelling ongoing AI requests
	private stopGenerationButton: ButtonComponent | null = null;
	private stopGenerationContainer: HTMLDivElement | null = null;

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
		this.renderStopGenerationButton();
	}

	override async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("wordsmith-context-panel");

		this._renderHeader(contentEl);
		await this.updateView(); // Initial render of dynamic controls

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

		const effectiveHint = getTemperatureHintForModel(this.plugin.settings.selectedModelId);
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

	private renderStopGenerationButton(): void {
		// Remove existing stop button if it exists
		this.stopGenerationContainer?.remove();

		// Create container for the stop button
		this.stopGenerationContainer = this.contentEl.createDiv({
			cls: "ccp-stop-generation-container",
		});

		// Create the stop button
		this.stopGenerationButton = new ButtonComponent(this.stopGenerationContainer)
			.setClass("ccp-stop-generation-button")
			.setTooltip("Cancel current generation")
			.onClick(() => {
				this.plugin.cancelCurrentGeneration(true); // Show notice when user clicks
			});

		// Clear any default content and add our custom content
		const buttonEl = this.stopGenerationButton.buttonEl;
		buttonEl.empty();

		// Add the "Stop" text
		buttonEl.createSpan({ text: "Stop" });

		// Add spinner icon
		const spinnerEl = buttonEl.createDiv({
			cls: "ccp-generation-spinner",
		});
		setIcon(spinnerEl, "cog");

		// Position the container after the temperature slider
		const temperatureSlider = this.contentEl.querySelector(".ccp-temperature-slider-setting");
		if (temperatureSlider) {
			temperatureSlider.insertAdjacentElement("afterend", this.stopGenerationContainer);
		}

		// Initially hide the button
		this.stopGenerationContainer.addClass("is-hidden");
	}

	/**
	 * Updates the visibility of the stop generation button based on generation state.
	 * Called by the main plugin when generation starts/stops.
	 */
	updateGenerationState(isGenerating: boolean): void {
		if (this.stopGenerationContainer) {
			this.stopGenerationContainer.classList.toggle("is-hidden", !isGenerating);
		}
	}

	private _renderContextToggles(container: HTMLElement): void {
		const titleEl = container.createEl("h4", { text: "Include context:", cls: "ccp-subtitle" });
		titleEl.setAttribute(
			"aria-label",
			"Configure what contextual information is sent to the AI with your text.",
		);
		titleEl.addClass("ccp-context-options-header");

		// --- Dynamic Context ---
		new Setting(container).setName("Dynamic").addToggle((toggle) => {
			this.dynamicContextToggleComponent = toggle;
			toggle.toggleEl.setAttribute(
				"aria-label",
				"Sends text immediately around your cursor/selection. Good for local edits.",
			);
			toggle.setValue(this.plugin.settings.useDynamicContext).onChange(async (value) => {
				this.plugin.settings.useDynamicContext = value;
				if (value) {
					this.plugin.settings.useHeaderContext = false;
					this.plugin.settings.useWholeNoteContext = false;
					this.headerContextToggleComponent?.setValue(false);
					this.wholeNoteContextToggleComponent?.setValue(false);
				}
				this.dynamicContextLinesSetting?.settingEl.classList.toggle("is-visible", value);
				await this.plugin.saveSettings();
			});
		});

		this.dynamicContextLinesSetting = new Setting(container)
			.setName("‣  Lines")
			.addText((text) => {
				text.inputEl.setAttribute(
					"aria-label",
					"Number of lines before and after selection to include as context.",
				);
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
		this.dynamicContextLinesSetting.settingEl.addClass("ccp-dynamic-lines-setting");
		this.dynamicContextLinesSetting.nameEl.classList.add("ccp-dynamic-lines-setting-name");
		this.dynamicContextLinesSetting.settingEl.classList.toggle(
			"is-visible",
			this.plugin.settings.useDynamicContext,
		);

		// --- Section Context ---
		new Setting(container).setName("Section").addToggle((toggle) => {
			this.headerContextToggleComponent = toggle;
			toggle.toggleEl.setAttribute(
				"aria-label",
				"Sends text from the current header to the next. Ideal for topic-focused tasks.",
			);
			toggle.setValue(this.plugin.settings.useHeaderContext).onChange(async (value) => {
				this.plugin.settings.useHeaderContext = value;
				if (value) {
					this.plugin.settings.useDynamicContext = false;
					this.plugin.settings.useWholeNoteContext = false;
					this.dynamicContextToggleComponent?.setValue(false);
					this.wholeNoteContextToggleComponent?.setValue(false);
					this.dynamicContextLinesSetting?.settingEl.classList.remove("is-visible");
				}
				await this.plugin.saveSettings();
			});
		});

		// --- Full Note Context ---
		new Setting(container).setName("Full note").addToggle((toggle) => {
			this.wholeNoteContextToggleComponent = toggle;
			toggle.toggleEl.setAttribute(
				"aria-label",
				"Sends the entire note. Best for summaries or global changes, but can be expensive.",
			);
			toggle.setValue(this.plugin.settings.useWholeNoteContext).onChange(async (value) => {
				this.plugin.settings.useWholeNoteContext = value;
				if (value) {
					this.plugin.settings.useDynamicContext = false;
					this.plugin.settings.useHeaderContext = false;
					this.dynamicContextToggleComponent?.setValue(false);
					this.headerContextToggleComponent?.setValue(false);
					this.dynamicContextLinesSetting?.settingEl.classList.remove("is-visible");
				}
				await this.plugin.saveSettings();
			});
		});

		// --- Custom Context ---
		new Setting(container).setName("Custom").addToggle((toggle) => {
			toggle.toggleEl.setAttribute(
				"aria-label",
				"Sends only the text you provide below. Type '[[' to link and embed other notes.",
			);
			toggle.setValue(this.plugin.settings.useCustomContext).onChange(async (value) => {
				this.plugin.settings.useCustomContext = value;
				this.customContextTextAreaContainer?.classList.toggle("is-visible", value);
				if (value && this.customContextTextArea) {
					this.customContextTextArea.inputEl.focus();
				}
				await this.plugin.saveSettings();
			});
		});
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
		this.headerContextToggleComponent = null;
		this.dynamicContextLinesSetting = null;
		this.customContextTextAreaContainer = null;
		this.customContextTextArea = null;
		this.stopGenerationButton = null;
		this.stopGenerationContainer = null;
		return super.onClose();
	}

	private async _resolveWikilinkToNoteData(
		linkPath: string,
		originalWikilink: string,
		aliasText?: string,
	): Promise<ReferencedNoteData> {
		const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, "");
		const noteData: ReferencedNoteData = {
			originalWikilink,
			linkText: linkPath,
			sourcePath: file instanceof TFile ? file.path : "[NOT FOUND]",
			content: "", // Default empty content
			...(aliasText !== undefined && { aliasText }),
		};

		if (file instanceof TFile) {
			try {
				noteData.content = await this.plugin.app.vault.cachedRead(file);
			} catch (error) {
				noteData.content = `[Error reading note: ${error instanceof Error ? error.message : "Unknown error"}]`;
			}
		} else {
			noteData.content = "[This note could not be found.]";
		}

		return noteData;
	}

	async getStructuredCustomContext(): Promise<StructuredCustomContext> {
		const { settings } = this.plugin;
		if (!settings.useCustomContext || !settings.customContextText) {
			return { rawText: settings.customContextText || "", referencedNotes: [] };
		}

		const textToProcess = settings.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		const uniqueReferencedNotes = new Map<string, Promise<ReferencedNoteData>>();
		const promises: Promise<ReferencedNoteData>[] = [];

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
				const promise = this._resolveWikilinkToNoteData(
					linkPathOnly,
					originalWikilink,
					aliasText,
				);
				uniqueReferencedNotes.set(linkPathOnly, promise);
				promises.push(promise);
			}
		}

		const resolvedNotes = await Promise.all(promises);
		return { rawText: textToProcess, referencedNotes: resolvedNotes };
	}
}
