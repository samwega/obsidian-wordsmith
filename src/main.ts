// src/main.ts
import { Editor, Notice, Plugin, WorkspaceLeaf } from "obsidian";

import {
	clearAllActiveSuggestionsCM6,
	focusNextSuggestionCM6,
	focusPreviousSuggestionCM6,
	resolveNextSuggestionCM6,
	resolveSuggestionsInSelectionCM6,
} from "./suggestion-handler";
import { textTransformerSuggestionExtensions } from "./suggestion-state";
import { generateTextAndApplyAsSuggestionCM6, textTransformerTextCM6 } from "./textTransformer";

import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./context-control-panel";
import { CustomPromptModal } from "./custom-prompt-modal";
import { PromptPaletteModal } from "./prompt-palette";
import { TextTransformerSettingsMenu } from "./settings";
import { DEFAULT_SETTINGS, TextTransformerPrompt, TextTransformerSettings } from "./settings-data";
import { DEFAULT_TEXT_TRANSFORMER_PROMPTS, MODEL_SPECS } from "./settings-data";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	defaultSettings = DEFAULT_SETTINGS; // Expose DEFAULT_SETTINGS in camelCase
	settings!: TextTransformerSettings;

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
					// generateTextAndApplyAsSuggestionCM6 will handle updating file suggestions
					await generateTextAndApplyAsSuggestionCM6(this, editor, promptText);
				}).open();
			},
		});

		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCallback: async (editor: Editor): Promise<void> => {
				const enabledPrompts = this.settings.prompts.filter((p) => p.enabled);
				if (enabledPrompts.length === 0) {
					new Notice("No enabled prompts. Please configure prompts in WordSmith settings.");
					return;
				}
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice("No active file to transform text in.");
					return;
				}

				if (enabledPrompts.length === 1 && !this.settings.alwaysShowPromptSelection) {
					// textTransformerTextCM6 will handle updating file suggestions
					await textTransformerTextCM6(this, editor, enabledPrompts[0], activeFile);
					return;
				}
				return new Promise<void>((resolve) => {
					const modal = new PromptPaletteModal(
						this.app,
						enabledPrompts,
						async (prompt: TextTransformerPrompt) => {
							// textTransformerTextCM6 will handle updating file suggestions
							await textTransformerTextCM6(this, editor, prompt, activeFile);
							resolve();
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
				focusNextSuggestionCM6(this, editor); // No file needed, doesn't modify persisted state
			},
			icon: "arrow-down-circle",
		});

		this.addCommand({
			id: "focus-previous-suggestion",
			name: "Focus previous suggestion",
			editorCallback: (editor: Editor): void => {
				focusPreviousSuggestionCM6(this, editor); // No file needed, doesn't modify persisted state
			},
			icon: "arrow-up-circle",
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
			const tempDefaultSettings = { ...DEFAULT_SETTINGS };
			tempDefaultSettings.defaultPromptId = undefined;
			const { prompts: loadedPrompts, ...otherLoadedSettings } =
				loaded as Partial<TextTransformerSettings>;
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

		const tempDefaultSettings = { ...DEFAULT_SETTINGS };
		tempDefaultSettings.defaultPromptId = undefined;

		for (const key of Object.keys(tempDefaultSettings) as Array<
			keyof Omit<TextTransformerSettings, "defaultPromptId">
		>) {
			if (typeof this.settings[key] === "undefined") {
				(this.settings as unknown as Record<string, unknown>)[key] =
					DEFAULT_SETTINGS[key as keyof TextTransformerSettings];
			}
		}
	}
}
