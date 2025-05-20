import { PluginSettingTab, Setting } from "obsidian";
import TextTransformer from "./main";

// The `nano` and `mini` models are sufficiently good sufficiently good output
// for the very focussed task of just fixing language
export const MODEL_SPECS = {
	"gpt-4.1": {
		displayText: "GPT 4.1",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://platform.openai.com/docs/models/gpt-4.1",
		},
	},
	"gpt-4.1-mini": {
		displayText: "GPT 4.1 mini",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.4, output: 1.6 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://platform.openai.com/docs/models/gpt-4.1-mini",
		},
	},
	"gpt-4.1-nano": {
		displayText: "GPT 4.1 nano",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.1, output: 0.4 },
		info: {
			intelligence: 2,
			speed: 5,
			url: "https://platform.openai.com/docs/models/gpt-4.1-nano",
		},
	},
	// Gemini models
	"gemini-2.5-flash-preview-04-17": {
		displayText: "Gemini 2.5 Flash",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.5, output: 1.5 },
		info: {
			intelligence: 3,
			speed: 5,
			url: "https://ai.google.dev/models/gemini",
		},
	},
	"gemini-2.5-pro-preview-05-06": {
		displayText: "Gemini 2.5 Pro",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 3.5, output: 10.5 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://ai.google.dev/models/gemini",
		},
	},
};

type OpenAiModels = "gpt-4.1" | "gpt-4.1-mini" | "gpt-4.1-nano";
type GeminiModels = "gemini-2.5-pro-preview-05-06" | "gemini-2.5-flash-preview-04-17";

type SupportedModels = OpenAiModels | GeminiModels;

// Maps friendly Gemini model names to API model IDs
export const GEMINI_MODEL_ID_MAP: Record<string, string> = {
	"gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
	"gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
	"gemini-2.5-pro-preview-05-06": "gemini-2.5-pro-preview-05-06",
	"gemini-2.5-flash-preview-04-17": "gemini-2.5-flash-preview-04-17",
};
//──────────────────────────────────────────────────────────────────────────────

export interface TextTransformerPrompt {
	id: string; // unique identifier
	name: string; // display name
	text: string; // the prompt text
	isDefault: boolean; // true for default prompts
	enabled: boolean; // if this prompt is active
}

export const DEFAULT_TEXT_TRANSFORMER_PROMPTS: TextTransformerPrompt[] = [
	{
		id: "improve",
		name: "Improve",
		text: "Act as a professional editor. Please make suggestions how to improve clarity, readability, grammar, and language of the following text. Preserve the original meaning and any technical jargon. Suggest structural changes only if they significantly improve flow or understanding. Avoid unnecessary expansion or major reformatting (e.g., no unwarranted lists). Try to make as little changes as possible, refrain from doing any changes when the writing is already sufficiently clear and concise. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "shorten",
		name: "Shorten",
		text: "Act as a professional editor. Shorten the following text while preserving its meaning and clarity. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "lengthen",
		name: "Lengthen",
		text: "Act as a professional editor. Expand and elaborate the following text for greater detail and depth, but do not add unrelated information. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "fix-grammar",
		name: "Fix grammar",
		text: "Act as a professional proofreader. Correct any grammatical, spelling, or punctuation errors in the following text. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "simplify-language",
		name: "Simplify language",
		text: "Act as a professional editor. Rewrite the following text in simpler language, making it easier to understand while preserving the original meaning. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "enhance-readability",
		name: "Enhance readability",
		text: "Act as a professional editor. Improve the readability and flow of the following text. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
	{
		id: "translate-english",
		name: "Translate to English (autodetects language)",
		text: "Act as a professional translator. Automatically detect language and translate the following text to English, preserving meaning, tone, format and style. Output only the translated text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
	},
];

export interface TextTransformerSettings {
	openAiApiKey: string;
	geminiApiKey: string;
	model: SupportedModels;
	prompts: TextTransformerPrompt[]; // All prompts (default + custom)
	preserveTextInsideQuotes: boolean;
	preserveBlockquotes: boolean;
	dynamicContextLineCount: number; // New setting
}

export const DEFAULT_SETTINGS: TextTransformerSettings = {
	openAiApiKey: "",
	geminiApiKey: "",
	model: "gpt-4.1-nano",
	prompts: DEFAULT_TEXT_TRANSFORMER_PROMPTS,
	preserveTextInsideQuotes: false,
	preserveBlockquotes: false,
	dynamicContextLineCount: 3, // New setting default
};

//──────────────────────────────────────────────────────────────────────────────

// DOCS https://docs.obsidian.md/Plugins/User+interface/Settings
export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "TextTransformer Settings" });

		// API Key Section Toggle
		const apiKeySection = containerEl.createDiv();
		apiKeySection.style.display = "none"; // Hidden by default

		new Setting(containerEl)
			.setName("API Key Settings")
			.setDesc("Click to expand/collapse API key settings")
			.addButton((button) => {
				button.setButtonText("Show").onClick(() => {
					if (apiKeySection.style.display === "none") {
						apiKeySection.style.display = "block";
						button.setButtonText("Hide");
					} else {
						apiKeySection.style.display = "none";
						button.setButtonText("Show");
					}
				});
			});
		

		// OpenAI API Key Setting
		new Setting(apiKeySection).setName("OpenAI API key").addText((input) => {
			input.inputEl.type = "password";
			input.inputEl.setCssProps({ width: "100%" });
			input.setValue(this.plugin.settings.openAiApiKey).onChange(async (value) => {
				this.plugin.settings.openAiApiKey = value.trim();
				await this.plugin.saveSettings();
			});
		});

		// Gemini API Key Setting
		new Setting(apiKeySection).setName("Gemini API key").addText((input) => {
			input.inputEl.type = "password";
			input.inputEl.setCssProps({ width: "100%" });
			input.setValue(this.plugin.settings.geminiApiKey || "").onChange(async (value) => {
				this.plugin.settings.geminiApiKey = value.trim();
				await this.plugin.saveSettings();
			});
		});
		
		// Model Setting
		const modelDesc = `
GPT 4.1 for the best literary results. Nano and Mini should be sufficient for basic text proofreading.<br>
Gemini 2.5 Flash is very fast and powerful. Gemini 2.5 Pro is a thinking model (slooow and powerful).<br>
Prices are estimates per 1000 tokens or 750 words.<br><br>
GPT 4.1 - intelligence = 4, speed = 3. Price = $0.01<br>
GPT 4.1 mini - intelligence = 3, speed = 4. Price = $0.002<br>
GPT 4.1 nano - intelligence = 2, speed = 5. Price = $0.0005<br>
Gemini 2.5 Flash - intelligence = 3, speed = 5. Price = $0.0005<br>
Gemini 2.5 Pro - intelligence = 4, speed = thinking. Price = $0.011<br>
`.trim();
		const modelDescDiv = document.createElement("div");
		modelDescDiv.innerHTML = modelDesc;
		modelDescDiv.style.display = "none"; // Hidden by default
		modelDescDiv.style.marginTop = "10px";


		const modelSetting = new Setting(containerEl)
			.setName("Model")
			.setDesc("Select the model to use. Click the name to see details.")
			.addDropdown((dropdown) => {
				for (const key in MODEL_SPECS) {
					if (!Object.hasOwn(MODEL_SPECS, key)) continue;
					const display = MODEL_SPECS[key as SupportedModels].displayText;
					dropdown.addOption(key, display);
				}
				dropdown.setValue(this.plugin.settings.model).onChange(async (value) => {
					this.plugin.settings.model = value as SupportedModels;
					await this.plugin.saveSettings();
				});
			});
		
		// Make the setting name clickable to toggle description
		const modelNameEl = modelSetting.nameEl;
		modelNameEl.style.cursor = "pointer";
		modelNameEl.onClickEvent(() => {
			if (modelDescDiv.style.display === "none") {
				modelDescDiv.style.display = "block";
				modelSetting.setDesc("Select the model to use. Click the name to hide details.");
			} else {
				modelDescDiv.style.display = "none";
				modelSetting.setDesc("Select the model to use. Click the name to see details.");
			}
		});
		
		// Insert the model description div after the setting
		modelSetting.settingEl.insertAdjacentElement('afterend', modelDescDiv);


		// Dynamic Context Line Count Setting
		new Setting(containerEl)
			.setName("Dynamic context lines")
			.setDesc("Number of lines to include before and after the selection/paragraph for dynamic context (between 1 and 21). Keep in mind a whole paragraph is a line in Obsidian, so you may be sending a lot of context. Default is 1.")
			.addText(text => text
				.setPlaceholder("1")
				.setValue(this.plugin.settings.dynamicContextLineCount.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 1 && numValue <= 21) { 
						this.plugin.settings.dynamicContextLineCount = numValue;
						await this.plugin.saveSettings();
					}
				}));

		// Prompt Management Section
		containerEl.createEl("h3", { text: "Prompt Management" });

		// Helper for editing a custom prompt inline
		let addPromptForm: HTMLDivElement | null = null; // Moved declaration up
		const createEditPromptForm = (prompt: TextTransformerPrompt): HTMLDivElement => {
			const form = document.createElement("div");
			form.className = "add-prompt-form";
			form.setAttribute(
				"style",
				"border:1px solid var(--background-modifier-border);background:var(--background-secondary-alt);padding:16px;margin-top:12px;border-radius:8px;display:flex;flex-direction:column;gap:10px;max-width:100%;width:100%;",
			);
			const nameInput = form.appendChild(document.createElement("input"));
			nameInput.type = "text";
			nameInput.value = prompt.name;
			nameInput.placeholder = "Prompt name";
			nameInput.setAttribute(
				"style",
				"margin-bottom:8px;padding:6px;font-size:var(--font-ui-medium);border-radius:4px;border:1px solid var(--background-modifier-border);width:100%;",
			);
			const textInput = form.appendChild(document.createElement("textarea"));
			textInput.value = prompt.text;
			textInput.placeholder = "Prompt text";
			textInput.setAttribute(
				"style",
				"margin-bottom:8px;padding:6px;font-size:var(--font-ui-medium);border-radius:4px;border:1px solid var(--background-modifier-border);min-height:29px;max-height:180px;width:100%;resize:vertical;",
			);
			const buttonRow = form.appendChild(document.createElement("div"));
			buttonRow.setAttribute("style", "display:flex;gap:8px;justify-content:flex-end;");
			const saveBtn = buttonRow.appendChild(document.createElement("button"));
			saveBtn.textContent = "Save";
			saveBtn.setAttribute(
				"style",
				"padding:6px 16px;font-size:var(--font-ui-medium);border-radius:4px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);",
			);
			const cancelBtn = buttonRow.appendChild(document.createElement("button"));
			cancelBtn.textContent = "Cancel";
			cancelBtn.setAttribute(
				"style",
				"padding:6px 16px;font-size:var(--font-ui-medium);border-radius:4px;border:none;background:var(--background-modifier-border);color:var(--text-normal);",
			);
			saveBtn.onclick = async (): Promise<void> => {
				const newName = (nameInput as HTMLInputElement).value.trim();
				const newText = (textInput as HTMLTextAreaElement).value.trim();
				if (!newName || !newText) return;
				prompt.name = newName;
				prompt.text = newText;
				await this.plugin.saveSettings();
				addPromptForm?.remove();
				addPromptForm = null;
				this.display();
			};
			cancelBtn.onclick = (): void => {
				addPromptForm?.remove();
				addPromptForm = null;
			};
			return form;
		};

		// Separate default and custom prompts
		const defaultPrompts = this.plugin.settings.prompts.filter((p) => p.isDefault);
		const customPrompts = this.plugin.settings.prompts.filter((p) => !p.isDefault);

		// Section: Default Prompts
		const defaultTitle = containerEl.createEl("div", { text: "Default Prompts" });
		defaultTitle.setAttr(
			"style",
			"color:#b6a84b;font-size:1.1em;font-weight:600;margin-bottom:2px;margin-top:8px;",
		);
		const defaultPromptsGrid = containerEl.createEl("div", { cls: "prompts-grid" });
		defaultPromptsGrid.style.display = "grid";
		defaultPromptsGrid.style.gridTemplateColumns = "1fr 1fr";
		defaultPromptsGrid.style.gap = "0px"; // Adjusted gap for borders
		
		defaultPrompts.forEach((prompt, index) => {
			const settingContainer = defaultPromptsGrid.createEl("div");
			// Apply border to the right of the first column elements and padding
			if (index % 2 === 0) {
				settingContainer.style.borderRight = "1px solid var(--background-modifier-border)";
				settingContainer.style.paddingRight = "10px";
			} else {
				settingContainer.style.paddingLeft = "10px";
			}
			new Setting(settingContainer).setName(prompt.name).addToggle((tg) => {
				tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
					prompt.enabled = value;
					await this.plugin.saveSettings();
				});
			});
		});

		// Section: Custom Prompts
		if (customPrompts.length > 0) {
			const divider = containerEl.createEl("div");
			divider.setAttr(
				"style",
				"border-bottom:1px solid var(--background-modifier-border);margin:10px 0 10px 0;",
			);
			const customTitle = containerEl.createEl("div", { text: "Custom Prompts" });
			customTitle.setAttr(
				"style",
				"color:#b6a84b;font-size:1.1em;font-weight:600;margin-top:8px;margin-bottom:2px;",
			);
			const customPromptsGrid = containerEl.createEl("div", { cls: "prompts-grid" });
			customPromptsGrid.style.display = "grid";
			customPromptsGrid.style.gridTemplateColumns = "1fr 1fr";
			customPromptsGrid.style.gap = "0px"; // Adjusted gap for borders

			customPrompts.forEach((prompt, index) => {
				const settingContainer = customPromptsGrid.createEl("div");
				// Apply border to the right of the first column elements and padding
				if (index % 2 === 0) {
					settingContainer.style.borderRight = "1px solid var(--background-modifier-border)";
					settingContainer.style.paddingRight = "10px";
				} else {
					settingContainer.style.paddingLeft = "10px";
				}
				const setting = new Setting(settingContainer).setName(prompt.name);
				
				setting.addExtraButton((btn) => {
					btn.setIcon("pencil")
						.setTooltip("Edit")
						.onClick((): void => {
							if (addPromptForm) return;
							addPromptForm = settingContainer.parentElement?.insertBefore(
								createEditPromptForm(prompt),
								settingContainer.nextSibling,
							) as HTMLDivElement;
						});
				});
				setting.addExtraButton((btn) => {
					btn.setIcon("trash")
						.setTooltip("Delete")
						.onClick(async (): Promise<void> => {
							const realIdx = this.plugin.settings.prompts.findIndex(p => p.id === prompt.id);
							if (realIdx > -1) {
								this.plugin.settings.prompts.splice(realIdx, 1);
								await this.plugin.saveSettings();
								this.display();
							}
						});
				});
				setting.addToggle((tg) => {
					tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
						prompt.enabled = value;
						await this.plugin.saveSettings();
					});
				});
			});
		}
		
		// Wrapper for description and button
		const addPromptFooter = containerEl.createEl("div");
		addPromptFooter.style.display = "flex";
		addPromptFooter.style.alignItems = "center";
		addPromptFooter.style.justifyContent = "space-between";
		addPromptFooter.style.marginTop = "10px";


		const customPromptDesc = addPromptFooter.createEl("p", { text: "If you need to modify the default prompts for some reason, you can find them in [your-vault]/.obsidian/plugins/text-transformer/data.json - reload obsidian when you're done." });
		customPromptDesc.style.fontSize = "var(--font-ui-smaller)";
		customPromptDesc.style.color = "var(--text-muted)";
		customPromptDesc.style.marginBottom = "0px";
		customPromptDesc.style.marginRight = "10px";
		customPromptDesc.style.flexGrow = "1";


		const addPromptSetting = new Setting(addPromptFooter)
			.setClass("add-prompt-setting-footer") 
			.addButton((btn) => {
				btn.setButtonText("Add Custom Prompt").setCta();
				btn.onClick((): void => {
					if (addPromptForm) return; 
					addPromptForm = containerEl.insertBefore(
						createAddPromptForm(),
						addPromptFooter 
					) as HTMLDivElement;
				});
			});
		addPromptSetting.settingEl.style.margin = "0";
		addPromptSetting.settingEl.style.borderTop = "none";
		
		const createAddPromptForm = (): HTMLDivElement => {
			const form = document.createElement("div");
			form.className = "add-prompt-form";
			form.setAttribute(
				"style",
				"border:1px solid var(--background-modifier-border);background:var(--background-secondary-alt);padding:16px;margin-top:12px;border-radius:8px;display:flex;flex-direction:column;gap:10px;max-width:100%;width:100%;",
			);
			const nameInput = form.appendChild(document.createElement("input"));
			nameInput.type = "text";
			nameInput.placeholder = "Prompt name";
			nameInput.setAttribute(
				"style",
				"margin-bottom:8px;padding:6px;font-size:var(--font-ui-medium);border-radius:4px;border:1px solid var(--background-modifier-border);width:100%;",
			);
			const textInput = form.appendChild(document.createElement("textarea"));
			textInput.placeholder = "Prompt text";
			textInput.value = 'Act as a professional editor. [replace this with your prompt, including the square brackets; change the rest too if you know what you are doing; replace "professional editor" with your desired role, for example "italian translator" if you want AI to translate to Italian - then of course replace "revised" with "translated" or whatever may be the case]. Output only the revised text and nothing else. The text is:';
			textInput.setAttribute(
				"style",
				"margin-bottom:8px;padding:6px;font-size:var(--font-ui-medium);border-radius:4px;border:1px solid var(--background-modifier-border);min-height:12px;max-height:80px;width:100%;resize:vertical;",
			);
			const buttonRow = form.appendChild(document.createElement("div"));
			buttonRow.setAttribute("style", "display:flex;gap:8px;justify-content:flex-end;");
			const saveBtn = buttonRow.appendChild(document.createElement("button"));
			saveBtn.textContent = "Save";
			saveBtn.setAttribute(
				"style",
				"padding:6px 16px;font-size:var(--font-ui-medium);border-radius:4px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);",
			);
			const cancelBtn = buttonRow.appendChild(document.createElement("button"));
			cancelBtn.textContent = "Cancel";
			cancelBtn.setAttribute(
				"style",
				"padding:6px 16px;font-size:var(--font-ui-medium);border-radius:4px;border:none;background:var(--background-modifier-border);color:var(--text-normal);",
			);
			saveBtn.onclick = async (): Promise<void> => {
				const name = (nameInput as HTMLInputElement).value.trim();
				const text = (textInput as HTMLTextAreaElement).value.trim();
				if (!name || !text) return;
				addPromptForm?.remove();
				addPromptForm = null;
				// Add the prompt
				this.plugin.settings.prompts.push({
					id: `custom-${Date.now()}`,
					name,
					text,
					isDefault: false,
					enabled: true,
				});
				await this.plugin.saveSettings();
				this.display();
			};
			cancelBtn.onclick = (): void => {
				addPromptForm?.remove();
				addPromptForm = null;
			};
			return form;
		};

		//────────────────────────────────────────────────────────────────────────
		// CLEANUP OPTIONS
		// const cleanupOptionsContainer = containerEl.createEl("div"); // No longer spanning grid items
		// cleanupOptionsContainer.style.gridColumn = "span 2"; 


		new Setting(containerEl) // Add directly to containerEl
			.setName("Preserve text inside quotes")
			.setDesc(
				'No changes will be made to text inside quotation marks ("").<br> Note that this prevention is not perfect, as the AI will sometimes suggest changes across quotes.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.preserveTextInsideQuotes)
					.onChange(async (value) => {
						this.plugin.settings.preserveTextInsideQuotes = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl) // Add directly to containerEl
			.setName("Preserve text in blockquotes and callouts")
			.setDesc(
				'No changes will be made to lines beginning with `>`. <br> Note that this prevention is not perfect, as the AI will sometimes suggest changes across quotes.',
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.preserveBlockquotes).onChange(async (value) => {
					this.plugin.settings.preserveBlockquotes = value;
					await this.plugin.saveSettings();
				}),
			);
	}
}
