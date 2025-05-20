import { Plugin } from "obsidian";
import { acceptOrRejectInText, acceptOrRejectNextSuggestion } from "./accept-reject-suggestions";
import { ContextControlPanel, CONTEXT_CONTROL_VIEW_TYPE } from "./context-control-panel"; // Added import
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
import { textTransformerDocument, textTransformerText } from "./textTransformer";

// biome-ignore lint/style/noDefaultExport: required for Obsidian plugins to work
export default class TextTransformer extends Plugin {
	settings: TextTransformerSettings = DEFAULT_SETTINGS;

	override async onload(): Promise<void> {
		// settings
		await this.loadSettings();
		this.addSettingTab(new TextTransformerSettingsMenu(this));

		// Register the context control panel view
		this.registerView(CONTEXT_CONTROL_VIEW_TYPE, (leaf) => new ContextControlPanel(leaf));

		// Add a command to open the context control panel
		this.addCommand({
			id: "open-context-control-panel",
			name: "Open AI Context Control Panel",
			callback: () => {
				this.activateView();
			},
			icon: "settings-2", // You might want to choose a more appropriate icon
		});

		// commands
		this.addCommand({
			id: "textTransformer-selection-paragraph",
			name: "Transform selection/paragraph",
			editorCallback: (editor): Promise<void> => {
				const enabledPrompts = this.settings.prompts.filter((p) => p.enabled);
				if (enabledPrompts.length === 1) {
					return textTransformerText(this, editor, enabledPrompts[0]);
				}
				// Show prompt selection modal
				return new Promise((resolve) => {
					const modal = new PromptPaletteModal(this.app, enabledPrompts, (prompt) => {
						textTransformerText(this, editor, prompt).then(resolve);
					});
					modal.open();
				});
			},
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "textTransformer-full-document",
			name: "Text Transformer full document",
			editorCallback: (editor): Promise<void> => textTransformerDocument(this, editor),
			icon: "bot-message-square",
		});
		this.addCommand({
			id: "accept-suggestions-in-text",
			name: "Accept suggestions in selection/paragraph",
			editorCallback: (editor): void => acceptOrRejectInText(editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-suggestions-in-text",
			name: "Reject suggestions in selection/paragraph",
			editorCallback: (editor): void => acceptOrRejectInText(editor, "reject"),
			icon: "x",
		});
		this.addCommand({
			id: "accept-next-suggestion",
			name: "Accept next suggestion (or go to suggestion if outside viewport)",
			editorCallback: (editor): void => acceptOrRejectNextSuggestion(editor, "accept"),
			icon: "check-check",
		});
		this.addCommand({
			id: "reject-next-suggestion",
			name: "Reject next suggestion (or go to suggestion if outside viewport)",
			editorCallback: (editor): void => acceptOrRejectNextSuggestion(editor, "reject"),
			icon: "x",
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
		console.info(this.manifest.name + " Plugin unloaded.");
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

		// Merge in any new default prompts that do not already exist
		if (!Array.isArray(this.settings.prompts)) {
			this.settings.prompts = [];
		}
		const existingIds = new Set(this.settings.prompts.map((p: TextTransformerPrompt) => p.id));
		for (const defPrompt of DEFAULT_TEXT_TRANSFORMER_PROMPTS) {
			if (!existingIds.has(defPrompt.id)) {
				this.settings.prompts.push({ ...defPrompt });
			}
		}

		// In case the plugin updates to newer models, ensure the user will not be
		// left with an outdated model from the settings.
		const outdatedModel = !Object.keys(MODEL_SPECS).includes(this.settings.model);
		if (outdatedModel) {
			this.settings.model = DEFAULT_SETTINGS.model;
			await this.saveSettings();
		}
	}
}
