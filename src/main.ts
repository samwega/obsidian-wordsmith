// src/main.ts
import { Plugin } from "obsidian";

// Imports based on the deduced file content mapping
import { textTransformerSuggestionExtensions } from './suggestion-state';
import {
    textTransformerDocumentCM6,
    textTransformerTextCM6
} from "./textTransformer"; // <= Core AI logic now expected here
import {
    resolveSuggestionsInSelectionCM6,
    resolveNextSuggestionCM6,
    clearAllActiveSuggestionsCM6
} from "./suggestion-handler"; // <= Resolver logic now expected here

// Existing imports
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
	settings: TextTransformerSettings = DEFAULT_SETTINGS;

	override async onload(): Promise<void> {
		// Settings
		await this.loadSettings();
		this.addSettingTab(new TextTransformerSettingsMenu(this));

        // Register CodeMirror 6 extensions for suggestions
        this.registerEditorExtension(textTransformerSuggestionExtensions());

		// Register the context control panel view
		this.registerView(CONTEXT_CONTROL_VIEW_TYPE, (leaf) => new ContextControlPanel(leaf)); // Corrected: Removed 'this'

		// Add a command to open the context control panel
		this.addCommand({
			id: "open-context-control-panel",
			name: "Open AI Context Control Panel",
			callback: () => {
				this.activateView();
			},
			icon: "settings-2",
		});

		// Commands
		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph (CM6)",
			editorCallback: async (editor) => {
				const enabledPrompts = this.settings.prompts.filter((p) => p.enabled);
				if (enabledPrompts.length === 1) {
					await textTransformerTextCM6(this, editor, enabledPrompts[0]);
					return;
				}
                return new Promise<void>((resolve) => {
					const modal = new PromptPaletteModal(this.app, enabledPrompts, async (prompt) => {
						await textTransformerTextCM6(this, editor, prompt);
						resolve();
					});
					modal.open();
				});
			},
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "textTransformer-full-document",
			name: "Text Transformer full document (CM6)",
			editorCallback: (editor) => textTransformerDocumentCM6(this, editor),
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "accept-suggestions-in-text",
			name: "Accept suggestions in selection/paragraph (CM6)",
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph (CM6)",
			editorCallback: (editor): void => resolveSuggestionsInSelectionCM6(editor, "reject"),
			icon: "x",
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion (CM6)",
			editorCallback: (editor): void => resolveNextSuggestionCM6(editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion (CM6)",
			editorCallback: (editor): void => resolveNextSuggestionCM6(editor, "reject"),
			icon: "x",
		});
        this.addCommand({
            id: "clear-all-suggestions",
            name: "Clear all active suggestions (reject all) (CM6)",
            editorCallback: (editor): void => clearAllActiveSuggestionsCM6(editor),
            icon: "trash-2",
        });


		console.info(this.manifest.name + " Plugin loaded.");
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
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		if (!Array.isArray(this.settings.prompts)) {
			this.settings.prompts = [];
		}
		const existingIds = new Set(this.settings.prompts.map((p: TextTransformerPrompt) => p.id));
		for (const defPrompt of DEFAULT_TEXT_TRANSFORMER_PROMPTS) {
			if (!existingIds.has(defPrompt.id)) {
                const newPrompt = { ...defPrompt };
                if (typeof newPrompt.enabled === 'undefined') {
                    newPrompt.enabled = true;
                }
				this.settings.prompts.push(newPrompt);
			}
		}
		const outdatedModel = !Object.keys(MODEL_SPECS).includes(this.settings.model);
		if (outdatedModel) {
			this.settings.model = DEFAULT_SETTINGS.model;
		}
	}
}