// src/main.ts
import { Notice, Plugin, WorkspaceLeaf, Editor } from "obsidian"; // Added Editor

import {
	clearAllActiveSuggestionsCM6,
	resolveNextSuggestionCM6,
	resolveSuggestionsInSelectionCM6,
} from "./suggestion-handler";
import { textTransformerSuggestionExtensions } from "./suggestion-state";
import { textTransformerDocumentCM6, textTransformerTextCM6 } from "./textTransformer";

import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./context-control-panel";
import { PromptPaletteModal } from "./prompt-palette";
import {
	DEFAULT_SETTINGS,
	TextTransformerPrompt, // Keep if used by PromptPaletteModal signature directly, or if other commands use it.
	TextTransformerSettings,
	TextTransformerSettingsMenu,
} from "./settings";
import {
	// TextTransformerPrompt, // This was the duplicate causing the unused warning, settings.ts re-exports it.
	DEFAULT_TEXT_TRANSFORMER_PROMPTS,
	MODEL_SPECS,
} from "./settings-data";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	settings!: TextTransformerSettings; // Definite assignment assertion

	override async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new TextTransformerSettingsMenu(this));

		try {
			this.registerEditorExtension(textTransformerSuggestionExtensions());
		} catch (e) {
			console.error("TextTransformer Plugin: FAILED to register editor extensions!", e);
			new Notice(
				"TextTransformer Error: Could not register editor extensions. Highlighting will not work.",
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
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCallback: async (editor: Editor): Promise<void> => {
				const enabledPrompts = this.settings.prompts.filter((p) => p.enabled);
				if (enabledPrompts.length === 0) {
					new Notice(
						"No enabled prompts. Please configure prompts in Text Transformer settings.",
					);
					return;
				}
				if (enabledPrompts.length === 1 && !this.settings.alwaysShowPromptSelection) {
					await textTransformerTextCM6(this, editor, enabledPrompts[0]);
					return;
				}
				return new Promise<void>((resolve) => {
					const modal = new PromptPaletteModal(
						this.app,
						enabledPrompts,
						async (prompt: TextTransformerPrompt) => {
							// Explicitly type prompt here
							await textTransformerTextCM6(this, editor, prompt);
							resolve();
						},
						() => {
							// onCancel
							resolve();
						},
					);
					modal.open();
				});
			},
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "textTransformer-full-document",
			name: "Transform full document",
			editorCallback: (editor: Editor): void => {
				const defaultPrompt =
					this.settings.prompts.find((p) => p.id === this.settings.defaultPromptId) ||
					this.settings.prompts.find((p) => p.enabled) ||
					this.settings.prompts[0];
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
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(this, editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph",
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(this, editor, "reject"),
			icon: "x",
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion",
			editorCallback: (editor): void => resolveNextSuggestionCM6(this, editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion",
			editorCallback: (editor): void => resolveNextSuggestionCM6(this, editor, "reject"),
			icon: "x",
		});
		this.addCommand({
			id: "clear-all-suggestions",
			name: "Clear all active suggestions (reject all)",
			editorCallback: (editor): void => clearAllActiveSuggestionsCM6(this, editor),
			icon: "trash-2",
		});

		console.info(this.manifest.name + " Plugin loaded successfully.");
	}

	async activateView(): Promise<void> {
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
		this.app.workspace
			.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE)
			.forEach((leaf: WorkspaceLeaf) => {
				if (leaf.view instanceof ContextControlPanel) {
					leaf.view.updateModelSelector();
				}
			});
	}

	async loadSettings(): Promise<void> {
		this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		const loaded = (await this.loadData()) as Partial<TextTransformerSettings> | null;

		if (loaded) {
			const { prompts: loadedPrompts, ...otherLoadedSettings } = loaded;
			Object.assign(this.settings, otherLoadedSettings);

			if (!Array.isArray(loadedPrompts) || loadedPrompts.length === 0) {
				this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => ({ ...p }));
			} else {
				const existingIds = new Set(loadedPrompts.map((p) => p.id));
				const newPromptsToAdd = DEFAULT_TEXT_TRANSFORMER_PROMPTS.filter(
					(defP) => !existingIds.has(defP.id),
				);

				this.settings.prompts = [
					...loadedPrompts.map((p) => ({
						...(DEFAULT_TEXT_TRANSFORMER_PROMPTS.find((dp) => dp.id === p.id) || {}),
						...p,
					})),
					...newPromptsToAdd.map((p) => ({ ...p })),
				];
			}
		} else {
			this.settings.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => ({ ...p }));
		}

		this.settings.prompts.forEach((p) => {
			if (typeof p.enabled === "undefined") {
				p.enabled = true;
			}
		});

		if (!this.settings.model || !Object.keys(MODEL_SPECS).includes(this.settings.model)) {
			this.settings.model = DEFAULT_SETTINGS.model;
		}

		for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof TextTransformerSettings>) {
			if (typeof this.settings[key] === "undefined") {
				(this.settings as any)[key] = DEFAULT_SETTINGS[key];
			}
		}
	}
}
