// src/main.ts
import { Notice, Plugin } from "obsidian";

import { textTransformerSuggestionExtensions } from './suggestion-state';
import {
	textTransformerDocumentCM6,
	textTransformerTextCM6
} from "./textTransformer";
import {
	resolveSuggestionsInSelectionCM6,
	resolveNextSuggestionCM6,
	clearAllActiveSuggestionsCM6
} from "./suggestion-handler";

import { ContextControlPanel, CONTEXT_CONTROL_VIEW_TYPE } from "./context-control-panel";
import { PromptPaletteModal } from "./prompt-palette";
import {
	DEFAULT_SETTINGS,
	TextTransformerSettings,
	TextTransformerSettingsMenu,
} from "./settings";
import {
	MODEL_SPECS,
	TextTransformerPrompt,
	DEFAULT_TEXT_TRANSFORMER_PROMPTS
} from "./settings-data";


// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	settings: TextTransformerSettings;

	override async onload(): Promise<void> {
		console.log("TextTransformer Plugin: Loading...");

		await this.loadSettings();
		this.addSettingTab(new TextTransformerSettingsMenu(this));

		try {
			this.registerEditorExtension(textTransformerSuggestionExtensions());
			// console.log("TextTransformer Plugin: Successfully registered editor extensions for suggestions.");
		} catch (e) {
			console.error("TextTransformer Plugin: FAILED to register editor extensions!", e);
			new Notice("TextTransformer Error: Could not register editor extensions. Highlighting will not work.", 0);
		}

		this.registerView(CONTEXT_CONTROL_VIEW_TYPE, (leaf) => new ContextControlPanel(leaf, this));

		this.addCommand({
			id: "open-context-control-panel",
			name: "Open AI Context Control Panel",
			callback: () => {
				this.activateView();
			},
			icon: "settings-2",
		});

		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCallback: async (editor) => {
				const enabledPrompts = this.settings.prompts.filter((p) => p.enabled);
				if (enabledPrompts.length === 0) {
					new Notice("No enabled prompts. Please configure prompts in Text Transformer settings.");
					return;
				}
				if (enabledPrompts.length === 1 && !this.settings.alwaysShowPromptSelection) {
					await textTransformerTextCM6(this, editor, enabledPrompts[0]);
					return;
				}
				return new Promise<void>((resolve) => {
					const modal = new PromptPaletteModal(this.app, enabledPrompts, async (prompt) => {
						await textTransformerTextCM6(this, editor, prompt);
						resolve();
					}, () => resolve());
					modal.open();
				});
			},
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "textTransformer-full-document",
			name: "Transform full document",
			editorCallback: (editor) => {
				const defaultPrompt = this.settings.prompts.find(p => p.id === this.settings.defaultPromptId)
				|| this.settings.prompts.find(p => p.enabled)
				|| this.settings.prompts[0];
				if (!defaultPrompt) {
					new Notice("No default or enabled prompt found for document transformation.");
					return;
				}
				textTransformerDocumentCM6(this, editor, defaultPrompt);
			},
			icon: "bot-message-square",
		});

		this.addCommand({
			id: "accept-suggestions-in-text",
			name: "Accept suggestions in selection/paragraph",
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(editor, "accept"),
							 icon: "check-check",
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph",
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(editor, "reject"),
							 icon: "x",
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion",
			editorCallback: (editor): void => resolveNextSuggestionCM6(editor, "accept"),
							 icon: "check-check",
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion",
			editorCallback: (editor): void => resolveNextSuggestionCM6(editor, "reject"),
							 icon: "x",
		});
		this.addCommand({
			id: "clear-all-suggestions",
			name: "Clear all active suggestions (reject all)",
							 editorCallback: (editor): void => clearAllActiveSuggestionsCM6(editor),
							 icon: "trash-2",
		});

		console.info(this.manifest.name + " Plugin loaded successfully.");
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		await this.app.workspace.getRightLeaf(false)?.setViewState({
			type: CONTEXT_CONTROL_VIEW_TYPE,
			active: true,
		});
		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE)[0],
		);
	}

	override onunload(): void {
		this.app.workspace.detachLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
		console.info(this.manifest.name + " Plugin unloaded.");
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData() as Partial<TextTransformerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded); // Ensure all defaults are present

		// Migrate/ensure prompts array
		if (!loaded || !Array.isArray(loaded.prompts) || loaded.prompts.length === 0) {
			this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map(p => ({...p}));
		} else {
			const loadedPrompts = loaded.prompts as TextTransformerPrompt[];
			const existingIds = new Set(loadedPrompts.map(p => p.id));
			const newPromptsToAdd = DEFAULT_TEXT_TRANSFORMER_PROMPTS.filter(defP => !existingIds.has(defP.id));

			this.settings.prompts = [
				...loadedPrompts.map(p => ({ // Ensure defaults for existing loaded prompts
					...DEFAULT_TEXT_TRANSFORMER_PROMPTS.find(dp => dp.id === p.id) || {},
													...p
				})),
				...newPromptsToAdd.map(p => ({...p}))
			];
		}
		// Ensure 'enabled' exists on all prompts
		this.settings.prompts.forEach(p => {
			if (typeof p.enabled === 'undefined') {
				p.enabled = true; // Default to true if undefined
			}
		});


		if (!this.settings.model || !Object.keys(MODEL_SPECS).includes(this.settings.model)) {
			this.settings.model = DEFAULT_SETTINGS.model;
		}
		// Ensure other boolean/numeric settings have defaults if not loaded
		for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof TextTransformerSettings>) {
			if (typeof this.settings[key] === 'undefined') {
				(this.settings as any)[key] = DEFAULT_SETTINGS[key];
			}
		}
	}
}
