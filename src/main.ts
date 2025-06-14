// src/main.ts
import { Editor, Notice, Plugin, WorkspaceLeaf } from "obsidian";

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

import {
	DEFAULT_SETTINGS,
	DEFAULT_TEXT_TRANSFORMER_PROMPTS,
	KNOWN_MODEL_HINTS,
	TextTransformerPrompt,
	TextTransformerSettings,
	UNKNOWN_MODEL_HINT,
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

		this.addCommand({
			id: "open-context-control-panel",
			name: "Open AI Context Control Panel",
			callback: (): void => {
				this.activateView();
			},
			icon: "settings-2",
		});

		this.addCommand({
			id: "generate-text-with-ad-hoc-prompt-suggestion",
			name: "Prompt Based Context Aware Generation at Cursor",
			icon: "wand-2",
			editorCallback: (editor: Editor): void => {
				new CustomPromptModal(this.app, this, async (promptText) => {
					await generateTextAndApplyAsSuggestionCM6(this, editor, promptText);
				}).open();
			},
		});

		this.addCommand({
			id: "generate-knowledge-graph",
			name: "Generate knowledge graph",
			icon: "brain-circuit",
			editorCallback: async (editor: Editor): Promise<void> => {
				await generateGraphAndCreateCanvas(this, editor);
			},
		});

		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCallback: async (editor: Editor): Promise<void> => {
				const enabledPrompts = this.settings.prompts.filter(
					(p) => p.enabled && p.showInPromptPalette !== false,
				);
				if (enabledPrompts.length === 0) {
					new Notice(
						"No enabled prompts (for palette). Please configure prompts in WordSmith settings.",
					);
					return;
				}
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice("No active file to transform text in.");
					return;
				}

				if (enabledPrompts.length === 1 && !this.settings.alwaysShowPromptSelection) {
					await textTransformerTextCM6(this, editor, enabledPrompts[0], activeFile);
					return;
				}

				return new Promise<void>((resolve, reject) => {
					const modal = new PromptPaletteModal(
						this.app,
						enabledPrompts,
						async (prompt: TextTransformerPrompt) => {
							try {
								await textTransformerTextCM6(this, editor, prompt, activeFile);
								resolve();
							} catch (error) {
								console.error("Error transforming text:", error);
								new Notice("Error during text transformation.");
								reject(error);
							}
						},
						() => {
							resolve();
						},
					);
					modal.open();
				});
			},
			icon: "crown",
		});

		this.addCommand({
			id: "accept-suggestions-in-text",
			name: "Accept suggestions in selection/paragraph",
			editorCallback: (editor): void => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					resolveSuggestionsInSelectionCM6(this, editor, activeFile, "accept");
				} else {
					new Notice("No active file.");
				}
			},
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph",
			editorCallback: (editor): void => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					resolveSuggestionsInSelectionCM6(this, editor, activeFile, "reject");
				} else {
					new Notice("No active file.");
				}
			},
			icon: "x",
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion",
			editorCallback: (editor): void => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					resolveNextSuggestionCM6(this, editor, activeFile, "accept");
				} else {
					new Notice("No active file.");
				}
			},
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion",
			editorCallback: (editor): void => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					resolveNextSuggestionCM6(this, editor, activeFile, "reject");
				} else {
					new Notice("No active file.");
				}
			},
			icon: "x",
		});
		this.addCommand({
			id: "clear-all-suggestions",
			name: "Clear all active suggestions (reject all)",
			editorCallback: (editor): void => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					clearAllActiveSuggestionsCM6(this, editor, activeFile);
				} else {
					new Notice("No active file.");
				}
			},
			icon: "trash-2",
		});

		this.addCommand({
			id: "focus-next-suggestion",
			name: "Focus next suggestion",
			editorCallback: (editor: Editor): void => {
				focusNextSuggestionCM6(this, editor);
			},
			icon: "arrow-down-circle",
		});

		this.addCommand({
			id: "focus-previous-suggestion",
			name: "Focus previous suggestion",
			editorCallback: (editor: Editor): void => {
				focusPreviousSuggestionCM6(this, editor);
			},
			icon: "arrow-up-circle",
		});

		console.info(this.manifest.name + " Plugin loaded successfully.");
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
		this.app.workspace.detachLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		console.info(this.manifest.name + " Plugin unloaded.");
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

		// Parse the API ID from the full canonical ID (e.g., "OpenRouter//anthropic/claude-3.5-sonnet")
		const apiId = modelId.split("//")[1];

		// Also check for local models that might not have a provider prefix in their ID
		const hint = KNOWN_MODEL_HINTS[apiId] || KNOWN_MODEL_HINTS[modelId];

		if (hint) {
			// If a known hint is found, update the global temperature to its default.
			this.settings.temperature = hint.default;
		} else {
			// If no hint is found, set to the sane default temperature.
			this.settings.temperature = UNKNOWN_MODEL_HINT.default;
		}

		// Save settings to persist the potential change and trigger a UI update.
		await this.saveSettings();
	}

	getContextPanel(): ContextControlPanel | null {
		const leaf = this.app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE)[0];
		if (leaf?.view instanceof ContextControlPanel) {
			return leaf.view;
		}
		return null;
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
		if (typeof combined.frequency_penalty !== "undefined")
			newPrompt.frequency_penalty = combined.frequency_penalty;
		if (typeof combined.presence_penalty !== "undefined")
			newPrompt.presence_penalty = combined.presence_penalty;

		return newPrompt;
	}

	async loadSettings(): Promise<void> {
		const defaultSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		const loadedData = (await this.loadData()) as Partial<TextTransformerSettings> | null;

		this.settings = Object.assign({}, defaultSettings, loadedData);

		// --- MIGRATION LOGIC ---
		// Migration: Rename "Google/Gemini" provider to "AI Studio" for consistency
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
		// --- END MIGRATION LOGIC ---

		if (loadedData && Array.isArray(loadedData.prompts) && loadedData.prompts.length > 0) {
			const processedDefaultPromptsMap = new Map<string, TextTransformerPrompt>();
			const keptCustomPrompts: TextTransformerPrompt[] = [];

			loadedData.prompts.forEach((loadedPrompt) => {
				if (loadedPrompt.isDefault) {
					const defaultDefinition = DEFAULT_TEXT_TRANSFORMER_PROMPTS.find(
						(dp) => dp.id === loadedPrompt.id,
					);
					if (defaultDefinition) {
						// Create an update object and only add properties that are defined.
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
