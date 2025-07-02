// src/main.ts
import { Editor, MarkdownFileInfo, MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";

import { SuggestionAction } from "./lib/constants";
import { generateGraphAndCreateCanvas } from "./lib/core/graphGenerator";
import {
	generateTextAndApplyAsSuggestionCM6,
	textTransformerTextCM6,
} from "./lib/core/textTransformer";
import {
	clearAllActiveSuggestionsCM6,
	focusNextSuggestionCM6,
	focusPreviousSuggestionCM6,
	resolveNextSuggestionCM6,
	resolveSuggestionsInSelectionCM6,
} from "./lib/editor/suggestion-handler";
import { textTransformerSuggestionExtensions } from "./lib/editor/suggestion-state";

import { getTemperatureHintForModel } from "./lib/provider-utils";
import {
	DEFAULT_SETTINGS,
	DEFAULT_TEXT_TRANSFORMER_PROMPTS,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "./lib/settings-data";

// --- Service Imports ---
import { CustomProviderService } from "./services/CustomProviderService";
import { FavoritesService } from "./services/FavoritesService";
import { ModelService } from "./services/ModelService";

// --- UI Imports ---
import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./ui/context-control-panel";
import { CustomPromptModal } from "./ui/modals/custom-prompt-modal";
import { PromptPaletteModal } from "./ui/modals/prompt-palette";
import { TextTransformerSettingsMenu } from "./ui/settings";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	settings!: TextTransformerSettings;
	runtimeDebugMode = false;

	// --- Service Instances ---
	customProviderService!: CustomProviderService;
	modelService!: ModelService;
	favoritesService!: FavoritesService;

	// --- Generation State Management ---
	// These properties manage the cancellation system for AI generation requests
	private currentGenerationController: AbortController | null = null; // Controls request cancellation
	private isGenerating = false; // Tracks if generation is in progress
	private currentGenerationNotice: Notice | null = null; // Reference to current "Generating..." notice

	override async onload(): Promise<void> {
		// --- Initialize Services ---
		this.customProviderService = new CustomProviderService(this);
		this.modelService = new ModelService(this);
		this.favoritesService = new FavoritesService(this);

		await this.loadSettings();

		this.addSettingTab(new TextTransformerSettingsMenu(this));

		try {
			this.registerEditorExtension(textTransformerSuggestionExtensions());
		} catch (e) {
			console.error("WordSmith Plugin: FAILED to register editor extensions!", e);
			new Notice(
				"WordSmith Error: Could not register editor extensions. Highlighting will not work.",
				0,
			);
		}

		this.registerView(CONTEXT_CONTROL_VIEW_TYPE, (leaf) => new ContextControlPanel(leaf, this));

		this._registerCommands();

		console.info(this.manifest.name + " Plugin loaded successfully.");
	}

	private _registerCommands(): void {
		this.addCommand({
			id: "open-context-control-panel",
			name: "Open AI context control panel",
			callback: (): void => {
				this.activateView();
			},
		});

		this.addCommand({
			id: "generate-text-with-ad-hoc-prompt-suggestion",
			name: "Prompt based context aware generation at cursor",
			editorCallback: (editor: Editor): void => {
				const savedPrompts = this.settings.generationPrompts.filter((p) => p.enabled);

				const emptyPrompt: TextTransformerPrompt = {
					id: "empty-prompt-sentinel",
					name: "Start with an empty prompt",
					text: "",
					isDefault: true,
					enabled: true,
					showInPromptPalette: true,
				};

				const promptsForPalette = [emptyPrompt, ...savedPrompts];

				new PromptPaletteModal(this.app, {
					prompts: promptsForPalette,
					onChoose: (chosenPrompt: TextTransformerPrompt): void => {
						new CustomPromptModal(this.app, {
							plugin: this,
							initialPromptText: chosenPrompt.text,
							onSubmit: async (finalPromptText): Promise<void> => {
								await generateTextAndApplyAsSuggestionCM6(this, editor, finalPromptText);
							},
						}).open();
					},
				}).open();
			},
		});

		this.addCommand({
			id: "generate-knowledge-graph",
			name: "Generate knowledge graph",
			editorCallback: async (editor: Editor): Promise<void> => {
				await generateGraphAndCreateCanvas(this, editor);
			},
		});

		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					const activeFile = ctx.file; // Capture the narrowed type
					const enabledPrompts = this.settings.prompts.filter(
						(p) => p.enabled && p.showInPromptPalette !== false,
					);
					if (enabledPrompts.length === 0) {
						new Notice(
							"No enabled prompts (for palette). Please configure prompts in WordSmith settings.",
						);
						return;
					}

					if (enabledPrompts.length === 1 && !this.settings.alwaysShowPromptSelection) {
						textTransformerTextCM6(this, editor, enabledPrompts[0], activeFile);
						return;
					}

					new PromptPaletteModal(this.app, {
						prompts: enabledPrompts,
						onChoose: async (prompt: TextTransformerPrompt): Promise<void> => {
							await textTransformerTextCM6(this, editor, prompt, activeFile);
						},
					}).open();
				}
				return;
			},
		});

		this.addCommand({
			id: "accept-suggestions-in-text",
			name: "Accept suggestions in selection/paragraph",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					resolveSuggestionsInSelectionCM6(this, editor, ctx.file, SuggestionAction.accept);
				}
				return;
			},
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					resolveSuggestionsInSelectionCM6(this, editor, ctx.file, SuggestionAction.reject);
				}
				return;
			},
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					resolveNextSuggestionCM6(this, editor, ctx.file, SuggestionAction.accept);
				}
				return;
			},
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					resolveNextSuggestionCM6(this, editor, ctx.file, SuggestionAction.reject);
				}
				return;
			},
		});
		this.addCommand({
			id: "clear-all-suggestions",
			name: "Clear all active suggestions (reject all)",
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				ctx: MarkdownView | MarkdownFileInfo,
			): boolean | undefined => {
				if (checking) {
					return ctx instanceof MarkdownView && !!ctx.file;
				}
				if (ctx instanceof MarkdownView && ctx.file) {
					clearAllActiveSuggestionsCM6(this, editor, ctx.file);
				}
				return;
			},
		});

		this.addCommand({
			id: "focus-next-suggestion",
			name: "Focus next suggestion",
			editorCallback: (editor: Editor): void => {
				focusNextSuggestionCM6(this, editor);
			},
		});

		this.addCommand({
			id: "focus-previous-suggestion",
			name: "Focus previous suggestion",
			editorCallback: (editor: Editor): void => {
				focusPreviousSuggestionCM6(this, editor);
			},
		});
	}

	async activateView(): Promise<void> {
		this.app.workspace.detachLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: CONTEXT_CONTROL_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		} else {
			new Notice("Could not get a right leaf to activate the context control panel.");
		}
	}

	override onunload(): void {
		// Cancel any ongoing generation before unloading (no notice needed)
		this.cancelCurrentGeneration(false);
		// Obsidian handles detaching leaves for registered views automatically on unload.
		// Manually detaching here is redundant and can interfere with the app's cleanup process.
		console.info(this.manifest.name + " Plugin unloaded.");
	}

	// --- Generation State Management Methods ---

	/**
	 * Starts a new generation operation and returns the AbortController for it.
	 * Cancels any existing generation first.
	 */
	startGeneration(): AbortController {
		// Cancel any existing generation (no notice needed for automatic cancellation)
		this.cancelCurrentGeneration(false);

		// Create new controller and update state
		this.currentGenerationController = new AbortController();
		this.isGenerating = true;

		// Notify context panel to show stop button
		this.updateContextPanelGenerationState(true);

		return this.currentGenerationController;
	}

	/**
	 * Cancels the current generation operation if one is running.
	 * @param showNotice Whether to show the cancellation notice (true when user clicks stop button)
	 */
	cancelCurrentGeneration(showNotice = true): void {
		if (this.currentGenerationController) {
			this.currentGenerationController.abort();
			this.currentGenerationController = null;
		}
		this.isGenerating = false;

		// Hide the current generation notice
		if (this.currentGenerationNotice) {
			this.currentGenerationNotice.hide();
			this.currentGenerationNotice = null;
		}

		// Show cancellation message only when explicitly requested (user clicks stop)
		if (showNotice) {
			new Notice("🛑 Generation cancelled by user.", 3000);
		}

		// Notify context panel to hide stop button
		this.updateContextPanelGenerationState(false);
	}

	/**
	 * Marks the current generation as completed and cleans up state.
	 */
	completeGeneration(): void {
		this.currentGenerationController = null;
		this.isGenerating = false;

		// Clear the current generation notice
		if (this.currentGenerationNotice) {
			this.currentGenerationNotice.hide();
			this.currentGenerationNotice = null;
		}

		// Notify context panel to hide stop button
		this.updateContextPanelGenerationState(false);
	}

	/**
	 * Sets the current generation notice so it can be managed during cancellation.
	 */
	setCurrentGenerationNotice(notice: Notice): void {
		this.currentGenerationNotice = notice;
	}

	/**
	 * Returns whether a generation is currently in progress.
	 */
	getIsGenerating(): boolean {
		return this.isGenerating;
	}

	/**
	 * Gets the current generation AbortController if one exists.
	 */
	getCurrentGenerationController(): AbortController | null {
		return this.currentGenerationController;
	}

	/**
	 * Updates the context panel's generation state UI.
	 */
	private updateContextPanelGenerationState(isGenerating: boolean): void {
		const contextPanel = this.getContextPanel();
		if (contextPanel) {
			contextPanel.updateGenerationState(isGenerating);
		}
	}

	/**
	 * Gets the current context panel instance if it exists.
	 */
	getContextPanel(): ContextControlPanel | null {
		const leaves = this.app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		if (leaves.length > 0) {
			return leaves[0].view as ContextControlPanel;
		}
		return null;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.app.workspace
			.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE)
			.forEach((leaf: WorkspaceLeaf) => {
				if (leaf.view instanceof ContextControlPanel) {
					leaf.view.updateView();
				}
			});
	}

	async updateTemperatureForModel(modelId: string): Promise<void> {
		if (!modelId) return;

		const hint = getTemperatureHintForModel(modelId);
		this.settings.temperature = hint.default;

		await this.saveSettings();
	}

	private _createPromptObject(
		base: Omit<TextTransformerPrompt, "id" | "isDefault" | "enabled" | "showInPromptPalette"> &
			Partial<
				Pick<TextTransformerPrompt, "id" | "isDefault" | "enabled" | "showInPromptPalette">
			>,
		updates: Partial<TextTransformerPrompt>,
	): TextTransformerPrompt {
		const combined = { ...base, ...updates };

		const newPrompt: TextTransformerPrompt = {
			id: combined.id || `custom-${Date.now()}`,
			name: combined.name,
			text: combined.text,
			isDefault: typeof combined.isDefault === "boolean" ? combined.isDefault : false,
			enabled: typeof combined.enabled === "boolean" ? combined.enabled : true,
			showInPromptPalette:
				typeof combined.showInPromptPalette === "boolean" ? combined.showInPromptPalette : true,
		};

		return newPrompt;
	}

	async loadSettings(): Promise<void> {
		const defaultSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		const loadedData = (await this.loadData()) as Partial<TextTransformerSettings> | null;

		this.settings = Object.assign({}, defaultSettings, loadedData);

		if (this.settings.customProviders) {
			let wasMigrated = false;
			this.settings.customProviders.forEach((provider) => {
				if (provider.name === "Google/Gemini") {
					provider.name = "AI Studio";
					wasMigrated = true;
				}
			});
			if (wasMigrated && this.runtimeDebugMode) {
				console.log("WordSmith: Migrated legacy 'Google/Gemini' provider name to 'AI Studio'.");
			}
		}

		if (loadedData && Array.isArray(loadedData.prompts) && loadedData.prompts.length > 0) {
			const processedDefaultPromptsMap = new Map<string, TextTransformerPrompt>();
			const keptCustomPrompts: TextTransformerPrompt[] = [];

			loadedData.prompts.forEach((loadedPrompt) => {
				if (loadedPrompt.isDefault) {
					const defaultDefinition = DEFAULT_TEXT_TRANSFORMER_PROMPTS.find(
						(dp) => dp.id === loadedPrompt.id,
					);
					if (defaultDefinition) {
						const updates: Partial<TextTransformerPrompt> = {};
						if (typeof loadedPrompt.enabled === "boolean") {
							updates.enabled = loadedPrompt.enabled;
						}
						if (typeof loadedPrompt.showInPromptPalette === "boolean") {
							updates.showInPromptPalette = loadedPrompt.showInPromptPalette;
						}
						processedDefaultPromptsMap.set(
							loadedPrompt.id,
							this._createPromptObject(defaultDefinition, updates),
						);
					}
				} else {
					keptCustomPrompts.push(this._createPromptObject(loadedPrompt, {}));
				}
			});

			const finalPrompts: TextTransformerPrompt[] = [];
			DEFAULT_TEXT_TRANSFORMER_PROMPTS.forEach((defaultDefFromCode) => {
				if (processedDefaultPromptsMap.has(defaultDefFromCode.id)) {
					const prompt = processedDefaultPromptsMap.get(defaultDefFromCode.id);
					if (prompt) finalPrompts.push(prompt);
				} else {
					finalPrompts.push(this._createPromptObject(defaultDefFromCode, {}));
				}
			});

			finalPrompts.push(...keptCustomPrompts);
			this.settings.prompts = finalPrompts;
		} else {
			this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) =>
				this._createPromptObject(p, {}),
			);
		}

		const translatePrompt = this.settings.prompts.find((p) => p.id === "translate");
		if (translatePrompt) {
			const lang = this.settings.translationLanguage || "English";
			const capitalizedLang = lang.charAt(0).toUpperCase() + lang.slice(1);
			translatePrompt.name = `Translate to ${capitalizedLang}—autodetects source language`;
		}

		await this.saveSettings();
	}
}
