// src/main.ts
import { Editor, Notice, Plugin, WorkspaceLeaf } from "obsidian";

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
	MODEL_SPECS,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "./lib/settings-data";
import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./ui/context-control-panel";
import { CustomPromptModal } from "./ui/modals/custom-prompt-modal";
import { PromptPaletteModal } from "./ui/modals/prompt-palette";
import { TextTransformerSettingsMenu } from "./ui/settings";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	defaultSettings = DEFAULT_SETTINGS;
	settings!: TextTransformerSettings;
	runtimeDebugMode = false;

	override async onload(): Promise<void> {
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
			icon: "anvil",
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
					leaf.view.updateModelSelector();
					leaf.view.updateTemperatureSliderDisplay(); // Added this line
				}
			});
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
			// model, temperature, etc. can be undefined
		};
		// Conditionally add properties if they are not undefined to satisfy exactOptionalPropertyTypes
		if (typeof combined.model !== "undefined") newPrompt.model = combined.model;
		// if (typeof combined.temperature !== "undefined") newPrompt.temperature = combined.temperature; // Removed as temperature is now global
		if (typeof combined.frequency_penalty !== "undefined")
			newPrompt.frequency_penalty = combined.frequency_penalty;
		if (typeof combined.presence_penalty !== "undefined")
			newPrompt.presence_penalty = combined.presence_penalty;
		if (typeof combined.max_tokens !== "undefined") newPrompt.max_tokens = combined.max_tokens;

		return newPrompt;
	}

	async loadSettings(): Promise<void> {
		this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as TextTransformerSettings;

		const loadedData = (await this.loadData()) as Partial<TextTransformerSettings> | null;

		if (loadedData) {
			const {
				prompts: loadedPrompts,
				debugMode,
				...otherLoadedSettings
			} = loadedData as Partial<TextTransformerSettings> & { debugMode?: boolean }; // Explicitly type to handle potential old debugMode
			Object.assign(this.settings, otherLoadedSettings);

			// runtimeDebugMode is initialized to false and not loaded from settings.
			// If an old debugMode setting exists in data, it's now ignored for persistent settings.

			if (typeof this.settings.translationLanguage === "undefined") {
				this.settings.translationLanguage = DEFAULT_SETTINGS.translationLanguage;
			}
			// Ensure temperature is loaded or defaulted
			if (
				typeof this.settings.temperature === "undefined" ||
				this.settings.temperature === null
			) {
				this.settings.temperature = DEFAULT_SETTINGS.temperature;
			}

			if (Array.isArray(loadedPrompts) && loadedPrompts.length > 0) {
				const processedDefaultPromptsMap = new Map<string, TextTransformerPrompt>();
				const keptCustomPrompts: TextTransformerPrompt[] = [];

				loadedPrompts.forEach((loadedPrompt) => {
					if (loadedPrompt.isDefault) {
						const defaultDefinition = DEFAULT_TEXT_TRANSFORMER_PROMPTS.find(
							(dp) => dp.id === loadedPrompt.id,
						);
						if (defaultDefinition) {
							let currentDefaultName = defaultDefinition.name;
							if (defaultDefinition.id === "translate") {
								const langSetting =
									this.settings.translationLanguage ||
									DEFAULT_SETTINGS.translationLanguage;
								const capitalizedLang =
									langSetting.charAt(0).toUpperCase() + langSetting.slice(1);
								currentDefaultName = `Translate to ${capitalizedLang}—autodetects source language`;
							}
							let showInPromptPalette = true;
							if (typeof loadedPrompt.showInPromptPalette === "boolean") {
								showInPromptPalette = loadedPrompt.showInPromptPalette;
							} else if (typeof defaultDefinition.showInPromptPalette === "boolean") {
								showInPromptPalette = defaultDefinition.showInPromptPalette;
							}
							processedDefaultPromptsMap.set(
								loadedPrompt.id,
								this._createPromptObject(defaultDefinition, {
									name: currentDefaultName,
									enabled:
										typeof loadedPrompt.enabled === "boolean"
											? loadedPrompt.enabled
											: defaultDefinition.enabled,
									showInPromptPalette,
									isDefault: true,
								}),
							);
						}
					} else {
						keptCustomPrompts.push(
							this._createPromptObject(loadedPrompt, {
								// Base is loadedPrompt
								isDefault: false, // Ensure this is false
								enabled:
									typeof loadedPrompt.enabled === "boolean" ? loadedPrompt.enabled : true,
								showInPromptPalette:
									typeof loadedPrompt.showInPromptPalette === "boolean"
										? loadedPrompt.showInPromptPalette
										: true,
							}),
						);
					}
				});

				const finalPrompts: TextTransformerPrompt[] = [];
				DEFAULT_TEXT_TRANSFORMER_PROMPTS.forEach((defaultDefFromCode) => {
					if (processedDefaultPromptsMap.has(defaultDefFromCode.id)) {
						const prompt = processedDefaultPromptsMap.get(defaultDefFromCode.id);
						if (prompt) finalPrompts.push(prompt);
					} else {
						let name = defaultDefFromCode.name;
						if (defaultDefFromCode.id === "translate") {
							const langSetting =
								this.settings.translationLanguage || DEFAULT_SETTINGS.translationLanguage;
							const capitalizedLang =
								langSetting.charAt(0).toUpperCase() + langSetting.slice(1);
							name = `Translate to ${capitalizedLang}—autodetects source language`;
						}
						finalPrompts.push(this._createPromptObject(defaultDefFromCode, { name }));
					}
				});

				finalPrompts.push(...keptCustomPrompts);
				this.settings.prompts = finalPrompts;
			} else {
				this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => {
					let name = p.name;
					if (p.id === "translate") {
						const langSetting =
							this.settings.translationLanguage || DEFAULT_SETTINGS.translationLanguage;
						const capitalizedLang =
							langSetting.charAt(0).toUpperCase() + langSetting.slice(1);
						name = `Translate to ${capitalizedLang}—autodetects source language`;
					}
					return this._createPromptObject(p, { name });
				});
			}
		} else {
			this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => {
				let name = p.name;
				if (p.id === "translate") {
					const langSetting =
						this.settings.translationLanguage || DEFAULT_SETTINGS.translationLanguage;
					const capitalizedLang = langSetting.charAt(0).toUpperCase() + langSetting.slice(1);
					name = `Translate to ${capitalizedLang}—autodetects source language`;
				}
				return this._createPromptObject(p, { name });
			});
		}

		const { prompts, ...defaultKeysForLoop } = DEFAULT_SETTINGS;
		for (const key of Object.keys(defaultKeysForLoop) as Array<keyof typeof defaultKeysForLoop>) {
			const typedKey = key as keyof Omit<TextTransformerSettings, "prompts" | "defaultPromptId">;
			if (
				typeof this.settings[typedKey] === "undefined" &&
				typeof DEFAULT_SETTINGS[typedKey] !== "undefined"
			) {
				(this.settings as unknown as Record<string, unknown>)[typedKey] =
					DEFAULT_SETTINGS[typedKey];
			}
		}

		if (!this.settings.model || !Object.keys(MODEL_SPECS).includes(this.settings.model)) {
			this.settings.model = DEFAULT_SETTINGS.model;
		}

		await this.saveData(this.settings);
	}
}
