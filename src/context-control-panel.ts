// src/context-control-panel.ts
import {
	DropdownComponent,
	ItemView,
	Notice,
	Setting,
	ToggleComponent,
	WorkspaceLeaf,
	TFile,
} from "obsidian";

import TextTransformer from "./main";
import { MODEL_SPECS, SupportedModels } from "./settings-data";

// CodeMirror 6 imports
import { EditorState, Extension } from "@codemirror/state";
import {
	EditorView,
	keymap,
	placeholder as cmPlaceholder,
} from "@codemirror/view";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
	autocompletion,
	completionKeymap,
	CompletionContext,
	CompletionResult,
} from "@codemirror/autocomplete";

export const CONTEXT_CONTROL_VIEW_TYPE = "context-control-panel";

const customEditorTheme = EditorView.theme({
  "&.cm-editor": {
    backgroundColor: "var(--input-background)", // Make editor background distinct
    // This ensures the editor itself has the input-like background
  },
  ".cm-scroller": {
     overflowY: "auto",
     fontFamily: "var(--font-interface, var(--font-default))", // Use interface font
     padding: "0px", // Scroller itself has no padding
  },
  ".cm-content": {
    padding: "var(--size-2-2, 4px) var(--size-2-3, 8px)", // Content padding
    lineHeight: "var(--line-height-normal, 1.5)",
    caretColor: "var(--text-cursor)", // Primary cursor color
  },
  ".cm-placeholder": {
    color: "var(--text-placeholder)",
    fontStyle: "italic",
    padding: "var(--size-2-2, 4px) var(--size-2-3, 8px)", // Match .cm-content padding
  },
  // Styling for the autocompletion tooltip
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--background-secondary)",
    border: "1px solid var(--background-modifier-border)",
    borderRadius: "var(--radius-m, 4px)",
    boxShadow: "var(--shadow-l, 0 2px 8px rgba(0,0,0,0.1))",
    color: "var(--text-normal)",
    marginTop: "var(--size-2-1, 2px)", // Small gap from text
  },
  ".cm-tooltip-autocomplete ul": {
    listStyle: "none",
    margin: "0",
    padding: "var(--size-2-1, 2px)", // Inner padding for the list
    fontFamily: "var(--font-interface, var(--font-default))",
    maxHeight: "10em", // Limit height of suggestion list
    overflowY: "auto",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "var(--size-2-2, 4px) var(--size-2-3, 8px)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--background-modifier-hover)",
    color: "var(--text-interactive-active, var(--text-accent))", // Selected item text color
  },
  ".cm-tooltip-autocomplete ul li .cm-completionDetail": {
    marginLeft: "1em",
    float: "right",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
}, {dark: document.body.hasClass("theme-dark")});


export class ContextControlPanel extends ItemView {
	private plugin: TextTransformer;
	private useWholeNoteContext = false;
	private useCustomContext = false;
	private customContextText = "";
	private useDynamicContext = false;

	private dynamicContextToggleComponent: ToggleComponent | null = null;
	private wholeNoteContextToggleComponent: ToggleComponent | null = null;
	private modelDropdown: DropdownComponent | null = null;
	private dynamicContextLinesSetting: Setting | null = null;

	private descriptionContainer: HTMLDivElement | null = null;
	private descriptionIndicator: HTMLSpanElement | null = null;
	private isDescriptionExpanded = false;
	private customContextTextAreaContainer: HTMLDivElement | null = null;
	private customContextEditorView: EditorView | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TextTransformer) {
		super(leaf);
		this.plugin = plugin;
	}

	override getViewType(): string {
		return CONTEXT_CONTROL_VIEW_TYPE;
	}

	override getDisplayText(): string {
		return "Text Transformer: Context Control";
	}

	override getIcon(): string {
		return "book-type";
	}

	updateModelSelector(): void {
		if (this.modelDropdown) {
			this.modelDropdown.setValue(this.plugin.settings.model);
		}
	}

	private obsidianLinkCompleter(context: CompletionContext): CompletionResult | null {
		const matchResult = context.matchBefore(/\[\[([^\]\[]*)$/);

		if (!matchResult && !(context.explicit && context.matchBefore(/\[\[$/)) ) {
			// If no direct match for "[[text" and not an explicit request right after "[[", then no suggestions.
			// The "explicit && matchBefore [[ " handles ctrl+space after typing just [[
			return null;
		}
		
		let query = "";
		let fromPos = context.pos;

		if (matchResult) { // This means we have "[[text" or "[[ "
			query = matchResult.text.toLowerCase();
			fromPos = matchResult.from + 2; // Start replacing *after* the "[["
		} else if (context.explicit && context.matchBefore(/\[\[$/)) {
			// This case is for when user types "[[" and then explicitly requests completion (e.g. Ctrl+Space)
			// query remains ""
			fromPos = context.pos; // Start replacing from cursor, assuming it's right after "[["
		} else {
			return null; // Should not be reached if first condition is exhaustive
		}

		if (!this.plugin || !this.plugin.app) return null;
		
		const files = this.plugin.app.vault.getMarkdownFiles();
		const options = files
			.filter(file => file.basename.toLowerCase().includes(query))
			.map(file => ({
				label: file.basename,
				apply: `${file.basename}]]`,
				type: "link",
				detail: file.path,
			}));
		
		return {
			from: fromPos,
			options: options,
			filter: false, 
		};
	}

	override async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		// ... (header, model dropdown, description - unchanged) ...
		const headerContainer = container.createDiv();
		headerContainer.style.display = "flex";
		headerContainer.style.alignItems = "center";
		headerContainer.style.justifyContent = "space-between";
		headerContainer.style.marginBottom = "2px";

		const titleEl = headerContainer.createEl("div", { text: "TT Model" });
		titleEl.style.marginTop = "0px";
		titleEl.style.marginBottom = "0px";
		titleEl.style.flexGrow = "1";
		titleEl.style.fontSize = "var(--font-ui-medium)";
		titleEl.style.color = "var(--text-accent)";
		titleEl.style.fontWeight = "bold";

		const modelSelectorContainer = headerContainer.createDiv();

		new DropdownComponent(modelSelectorContainer).then((dropdown) => {
			this.modelDropdown = dropdown;
			for (const key in MODEL_SPECS) {
				if (!Object.hasOwn(MODEL_SPECS, key)) continue;
				const display = MODEL_SPECS[key as SupportedModels].displayText;
				dropdown.addOption(key, display);
			}
			dropdown.setValue(this.plugin.settings.model).onChange(async (value) => {
				this.plugin.settings.model = value as SupportedModels;
				await this.plugin.saveSettings();
			});
			dropdown.selectEl.style.maxWidth = "150px";
			dropdown.selectEl.style.fontSize = "var(--font-ui-smaller)";
			dropdown.selectEl.style.padding = "0px 18px 0px 2px";
			dropdown.selectEl.style.height = "auto";
		});

		const contextOptionsHeader = container.createDiv();
		contextOptionsHeader.style.cursor = "pointer";
		contextOptionsHeader.style.display = "flex";
		contextOptionsHeader.style.alignItems = "center";
		contextOptionsHeader.style.marginTop = "15px";
		contextOptionsHeader.style.marginBottom = "5px";

		this.descriptionIndicator = contextOptionsHeader.createEl("span", {
			text: this.isDescriptionExpanded ? "🞃 " : "‣ ",
		});
		this.descriptionIndicator.style.marginRight = "5px";
		this.descriptionIndicator.style.fontSize = "var(--font-ui-small)";
		this.descriptionIndicator.style.color = "var(--text-muted)";

		const subTitleTextEl = contextOptionsHeader.createEl("div", {
			text: "Context Options:",
		});
		subTitleTextEl.style.fontWeight = "bold";
		subTitleTextEl.style.fontSize = "var(--font-ui-small)";
		subTitleTextEl.style.color = "var(--text-muted)";

		this.descriptionContainer = container.createDiv();
		this.descriptionContainer.style.display = this.isDescriptionExpanded
			? "block"
			: "none";
		this.descriptionContainer.style.paddingLeft = "20px";
		this.descriptionContainer.style.marginBottom = "10px";
		this.descriptionContainer.style.fontSize = "var(--font-ui-smaller)";
		this.descriptionContainer.style.color = "var(--text-muted)";
		this.descriptionContainer.style.lineHeight = "1.4";

		const p1 = this.descriptionContainer.createEl("p", {
			text: "Configure how AI understands your note's context. This is crucial for relevant and accurate transformations or generations. Keep in mind this can get expensive, depending on the size of your context.",
		});
		p1.style.marginBottom = "3px";
		this.descriptionContainer.createEl("p", {
			text: "⏺ Dynamic: Uses text immediately around your selection/cursor. Good for local edits.",
		});
		this.descriptionContainer.createEl("p", {
			text: "  ‣ Lines: represents how many lines before and after the selection are included with Dynamic Context. These can be blank lines or whole paragraphs.",
		});
		this.descriptionContainer.createEl("p", {
			text: "⏺ Full Note: Sends the whole note. Best for summaries or global changes, but costs more.",
		});
		this.descriptionContainer.createEl("p", {
			text: "⏺ Custom: Paste specific text (like rules or style guides) for the AI to consider. Including [[notes]] via wikilinks will embed their content. Try <RULE: Spell everything backwards.>",
		});

		contextOptionsHeader.addEventListener("click", () => {
			this.isDescriptionExpanded = !this.isDescriptionExpanded;
			if (this.descriptionContainer && this.descriptionIndicator) {
				if (this.isDescriptionExpanded) {
					this.descriptionContainer.style.display = "block";
					this.descriptionIndicator.setText("🞃 ");
				} else {
					this.descriptionContainer.style.display = "none";
					this.descriptionIndicator.setText("‣ ");
				}
			}
		});


		new Setting(container).setName("Dynamic").addToggle((toggle) => {
			this.dynamicContextToggleComponent = toggle;
			toggle.setValue(this.useDynamicContext).onChange((value) => {
				this.useDynamicContext = value;
				if (value && this.wholeNoteContextToggleComponent) {
					this.useWholeNoteContext = false;
					this.wholeNoteContextToggleComponent.setValue(false);
				}
				if (this.dynamicContextLinesSetting) {
					this.dynamicContextLinesSetting.settingEl.style.display = value
						? ""
						: "none";
				}
			});
		});

		this.dynamicContextLinesSetting = new Setting(container)
			.setName("‣  Lines")
			.addText((text) => {
				text
					.setPlaceholder(
						this.plugin.settings.dynamicContextLineCount.toString(),
					)
					.setValue(this.plugin.settings.dynamicContextLineCount.toString())
					.onChange(async (value) => {
						const numValue = Number.parseInt(value);
						if (!Number.isNaN(numValue) && numValue >= 1 && numValue <= 21) {
							this.plugin.settings.dynamicContextLineCount = numValue;
							await this.plugin.saveSettings();
						} else {
							new Notice("Please enter a number between 1 and 21.");
							text.setValue(
								this.plugin.settings.dynamicContextLineCount.toString(),
							);
						}
					});
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.inputEl.max = "21";
				text.inputEl.style.width = "40px";
			});

		if (this.dynamicContextLinesSetting) {
			this.dynamicContextLinesSetting.settingEl.style.borderTop = "none";
			this.dynamicContextLinesSetting.nameEl.style.color =
				"var(--text-accent)";
			this.dynamicContextLinesSetting.settingEl.style.display = this
				.useDynamicContext
				? ""
				: "none";
		}

		new Setting(container).setName("Full note").addToggle((toggle) => {
			this.wholeNoteContextToggleComponent = toggle;
			toggle.setValue(this.useWholeNoteContext).onChange((value) => {
				this.useWholeNoteContext = value;
				if (value && this.dynamicContextToggleComponent) {
					this.useDynamicContext = false;
					this.dynamicContextToggleComponent.setValue(false);
					if (this.dynamicContextLinesSetting) {
						this.dynamicContextLinesSetting.settingEl.style.display =
							"none";
					}
				}
			});
		});

		new Setting(container).setName("Custom").addToggle((toggle) =>
			toggle.setValue(this.useCustomContext).onChange((value) => {
				this.useCustomContext = value;
				if (this.customContextTextAreaContainer) {
					this.customContextTextAreaContainer.style.display = value
						? ""
						: "none";
				}
				if (value && this.customContextEditorView) {
					this.customContextEditorView.focus();
				}
			}),
		);

		this.customContextTextAreaContainer = container.createDiv(
			"tt-custom-context-container",
		);
		this.customContextTextAreaContainer.style.display = this.useCustomContext
			? ""
			: "none";
		this.customContextTextAreaContainer.style.marginTop = "5px";
		this.customContextTextAreaContainer.style.border = "1px solid var(--input-border, var(--background-modifier-border))";
		this.customContextTextAreaContainer.style.borderRadius = "var(--input-radius, 4px)";
		// The container holds the border; CM editor inside will have its own background.
		// No padding on container, so CM editor theme controls inner padding.

		const editorExtensions: Extension[] = [
			EditorView.lineWrapping,
			history(),
			keymap.of([
				...defaultKeymap,
				...historyKeymap,
				...completionKeymap,
				indentWithTab,
			]),
			markdown(),
			cmPlaceholder(
				"Add custom context here...\nType [[ to link notes (their content will be embedded).",
			),
			autocompletion({
				override: [this.obsidianLinkCompleter.bind(this)],
				closeOnBlur: true,
				activateOnTyping: true, 
			}),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					this.customContextText = update.state.doc.toString();
				}
			}),
			customEditorTheme,
		];

		this.customContextEditorView = new EditorView({
			state: EditorState.create({
				doc: this.customContextText,
				extensions: editorExtensions,
			}),
			parent: this.customContextTextAreaContainer,
		});

		const cmDOM = this.customContextEditorView.dom;
		cmDOM.style.minHeight = "60px";
		cmDOM.style.maxHeight = "200px";
		cmDOM.addClasses(["cm-s-obsidian"]); // Essential for base Obsidian CM styling
	}

	override async onClose(): Promise<void> {
		this.customContextEditorView?.destroy();
		this.customContextEditorView = null;
		this.dynamicContextToggleComponent = null;
		this.wholeNoteContextToggleComponent = null;
		this.modelDropdown = null;
		this.dynamicContextLinesSetting = null;
		return super.onClose();
	}

	getWholeNoteContextState(): boolean {
		return this.useWholeNoteContext;
	}

	getCustomContextState(): boolean {
		return this.useCustomContext;
	}

	async getCustomContextText(): Promise<string> {
		if (!this.useCustomContext || !this.customContextText) {
			return "";
		}
		let textToProcess = this.customContextText;
		const wikilinkRegex = /\[\[([^\]]+?)\]\]/g;
		let match;
		const contentParts: (string | Promise<string>)[] = [];
		let lastIndex = 0;

		if (!this.plugin || !this.plugin.app) {
			console.error("TextTransformer: Plugin or App instance not available for getCustomContextText.");
			return textToProcess;
		}

		while ((match = wikilinkRegex.exec(textToProcess)) !== null) {
			contentParts.push(textToProcess.substring(lastIndex, match.index));
			const linkFullText = match[1];
			const linkPathOnly = linkFullText.split("|")[0];
			const file = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPathOnly, "");
			if (file instanceof TFile) {
				contentParts.push(this.plugin.app.vault.cachedRead(file));
			} else {
				contentParts.push(match[0]);
			}
			lastIndex = wikilinkRegex.lastIndex;
		}
		contentParts.push(textToProcess.substring(lastIndex));
		const resolvedContents = await Promise.all(contentParts);
		return resolvedContents.join("");
	}

	getDynamicContextState(): boolean {
		return this.useDynamicContext;
	}
}