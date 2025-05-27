import { StateEffect } from "@codemirror/state";
// src/main.ts
import {
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TAbstractFile,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import {
	clearAllActiveSuggestionsCM6,
	focusNextSuggestionCM6,
	focusPreviousSuggestionCM6,
	resolveNextSuggestionCM6,
	resolveSuggestionsInSelectionCM6,
} from "./suggestion-handler";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	setSuggestionsEffect,
	textTransformerSuggestionExtensions,
} from "./suggestion-state";
import { generateTextAndApplyAsSuggestionCM6, textTransformerTextCM6 } from "./textTransformer";

import { CONTEXT_CONTROL_VIEW_TYPE, ContextControlPanel } from "./context-control-panel";
import { CustomPromptModal } from "./custom-prompt-modal";
import { PromptPaletteModal } from "./prompt-palette";
import { TextTransformerSettingsMenu } from "./settings";
import { DEFAULT_SETTINGS, TextTransformerPrompt, TextTransformerSettings } from "./settings-data";
import { DEFAULT_TEXT_TRANSFORMER_PROMPTS, MODEL_SPECS } from "./settings-data";
import { getCmEditorView } from "./utils";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	DEFAULT_SETTINGS = DEFAULT_SETTINGS; // Expose DEFAULT_SETTINGS
	settings!: TextTransformerSettings;
	private activeSuggestionsByFile: Record<string, SuggestionMark[]> = {};
	private suggestionsFilePath!: string;

	override async onload(): Promise<void> {
		this.suggestionsFilePath = `${this.manifest.dir}/suggestions.json`;

		await this.loadSettings();
		await this.loadSuggestionsData(); // Load persisted suggestions

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
				new CustomPromptModal(this.app, async (promptText) => {
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

		// Event listeners for persistence
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange.bind(this)),
		);
		this.registerEvent(this.app.vault.on("delete", this.handleFileDelete.bind(this)));

		this.app.workspace.onLayoutReady(async () => {
			await this.cleanupStaleSuggestions();
			await this.applyPersistedSuggestionsToAllOpenFiles();
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
		// Event listeners registered with `this.registerEvent` are automatically cleaned up by Obsidian
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

	// --- Suggestion Persistence Logic ---

	async loadSuggestionsData(): Promise<void> {
		try {
			if (await this.app.vault.adapter.exists(this.suggestionsFilePath)) {
				const data = await this.app.vault.adapter.read(this.suggestionsFilePath);
				if (data) {
					this.activeSuggestionsByFile = JSON.parse(data);
				} else {
					this.activeSuggestionsByFile = {};
				}
			} else {
				this.activeSuggestionsByFile = {};
			}
		} catch (error) {
			console.error("WordSmith: Error loading suggestions data from suggestions.json:", error);
			this.activeSuggestionsByFile = {}; // Reset on error
		}
	}

	async saveSuggestionsData(): Promise<void> {
		try {
			await this.app.vault.adapter.write(
				this.suggestionsFilePath,
				JSON.stringify(this.activeSuggestionsByFile, null, 2),
			);
		} catch (error) {
			console.error("WordSmith: Error saving suggestions data to suggestions.json:", error);
			new Notice("WordSmith: Could not save suggestions to disk.");
		}
	}

	async updateFileSuggestions(filePath: string, marks: SuggestionMark[]): Promise<void> {
		if (marks && marks.length > 0) {
			// Store a deep copy of marks to prevent external modifications to the stored array
			this.activeSuggestionsByFile[filePath] = marks.map((mark) => ({ ...mark }));
		} else {
			delete this.activeSuggestionsByFile[filePath];
		}
		await this.saveSuggestionsData();
	}

	private async cleanupStaleSuggestions(): Promise<void> {
		let changed = false;
		for (const filePath in this.activeSuggestionsByFile) {
			if (Object.hasOwn(this.activeSuggestionsByFile, filePath)) {
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile && file.extension === "md")) {
					delete this.activeSuggestionsByFile[filePath];
					changed = true;
				}
			}
		}
		if (changed) {
			await this.saveSuggestionsData();
		}
	}

	private async applyPersistedSuggestionsToAllOpenFiles(): Promise<void> {
		const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
		for (const leaf of markdownLeaves) {
			if (
				leaf.view instanceof MarkdownView &&
				leaf.view.file &&
				leaf.view.editor &&
				leaf.view.file.extension === "md"
			) {
				await this.applyPersistedSuggestionsToEditor(leaf.view.editor, leaf.view);
			}
		}
	}

	private handleActiveLeafChange = async (leaf: WorkspaceLeaf | null): Promise<void> => {
		if (
			leaf &&
			leaf.view instanceof MarkdownView &&
			leaf.view.file &&
			leaf.view.editor &&
			leaf.view.file.extension === "md"
		) {
			await this.applyPersistedSuggestionsToEditor(leaf.view.editor, leaf.view);
		}
	};

	private async applyPersistedSuggestionsToEditor(
		editor: Editor,
		view: MarkdownView,
	): Promise<void> {
		if (!view.file) {
			console.warn(
				"WordSmith: applyPersistedSuggestionsToEditor called without a file in view.",
			);
			return;
		}

		const cm = getCmEditorView(editor);
		if (!cm || !cm.state) {
			// console.warn(`WordSmith: Could not get CodeMirror 6 EditorView instance for ${view.file.path}, or state is not ready. Suggestions not applied.`);
			return;
		}

		const persistedMarks = this.activeSuggestionsByFile[view.file.path];
		// biome-ignore lint/suspicious/noExplicitAny: StateEffect type
		const effectsToDispatch: StateEffect<any>[] = [clearAllSuggestionsEffect.of(null)];

		if (persistedMarks && Array.isArray(persistedMarks) && persistedMarks.length > 0) {
			const docLength = cm.state.doc.length;
			const validMarks = persistedMarks.filter(
				(mark) =>
					typeof mark.from === "number" &&
					typeof mark.to === "number" &&
					mark.from <= mark.to &&
					mark.from >= 0 &&
					mark.to <= docLength,
			);

			if (validMarks.length !== persistedMarks.length) {
				console.warn(
					`WordSmith: Filtered out ${persistedMarks.length - validMarks.length} invalid/out-of-bounds marks for file ${view.file.path}. This might happen if the file was modified externally.`,
				);
			}

			if (validMarks.length > 0) {
				effectsToDispatch.push(setSuggestionsEffect.of(validMarks.map((m) => ({ ...m })))); // Apply copy
			} else if (persistedMarks.length > 0 && validMarks.length === 0) {
				console.warn(
					`WordSmith: All persisted suggestions for ${view.file.path} were invalid (e.g. file changed drastically). Clearing them from persistence.`,
				);
				delete this.activeSuggestionsByFile[view.file.path];
				// No await here, but save will be triggered if multiple files are processed or by next updateFileSuggestions
				this.saveSuggestionsData(); // Save this change immediately
			}
		}

		// Only dispatch if there's something to do or clear
		if (cm.state) {
			// Double check cm.state
			try {
				cm.dispatch({ effects: effectsToDispatch });
			} catch (e) {
				console.error(
					`WordSmith: Error dispatching effects to apply persisted suggestions for ${view.file.path}:`,
					e,
					"Marks attempted:",
					persistedMarks,
				);
				// If dispatching fails, it's safer to clear persisted marks for this file to prevent loops.
				delete this.activeSuggestionsByFile[view.file.path];
				await this.saveSuggestionsData();
				new Notice(
					`WordSmith: Error applying suggestions to ${view.file.path}. Cleared for this file. See console.`,
				);
			}
		}
	}

	private handleFileDelete = async (file: TAbstractFile): Promise<void> => {
		if (
			file instanceof TFile &&
			file.extension === "md" &&
			Object.hasOwn(this.activeSuggestionsByFile, file.path)
		) {
			delete this.activeSuggestionsByFile[file.path];
			await this.saveSuggestionsData();
		}
	};
}
