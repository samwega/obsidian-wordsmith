import { PluginSettingTab, Setting } from "obsidian";
import TextTransformer from "./main";
import {
    MODEL_SPECS,
    SupportedModels,
    TextTransformerPrompt,
    TextTransformerSettings,
    DEFAULT_SETTINGS,
    // DEFAULT_TEXT_TRANSFORMER_PROMPTS // Not directly used in this file anymore after refactor
} from "./settings-data";

//──────────────────────────────────────────────────────────────────────────────

// DOCS https://docs.obsidian.md/Plugins/User+interface/Settings
export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;
	private addPromptForm: HTMLDivElement | null = null;

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "TextTransformer Settings" });

		this._renderApiModelSection(containerEl);
		this._renderDynamicContextSection(containerEl);
		this._renderPromptManagementSection(containerEl);
		this._renderCleanupOptionsSection(containerEl);
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		const apiModelSectionContents = containerEl.createDiv();
		apiModelSectionContents.style.display = "none"; // Hidden by default
		apiModelSectionContents.style.marginTop = "10px";

		const apiModelSetting = new Setting(containerEl)
			.setName("API Keys & Model")
			.setDesc("Click to expand/collapse API key and model settings.")
			.addButton((button) => {
				button.setButtonText("Show").onClick(() => {
					if (apiModelSectionContents.style.display === "none") {
						apiModelSectionContents.style.display = "block";
						button.setButtonText("Hide");
						apiModelSetting.setDesc("Click to expand/collapse API key and model settings.");
					} else {
						apiModelSectionContents.style.display = "none";
						button.setButtonText("Show");
						apiModelSetting.setDesc("Click to expand/collapse API key and model settings.");
					}
				});
			});

		new Setting(apiModelSetting.settingEl)
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
		apiModelSetting.nameEl.style.flexGrow = "0";
		apiModelSetting.controlEl.style.marginLeft = "auto";

		new Setting(apiModelSectionContents).setName("OpenAI API key").addText((input) => {
			input.inputEl.type = "password";
			input.inputEl.setCssProps({ width: "100%" });
			input.setValue(this.plugin.settings.openAiApiKey).onChange(async (value) => {
				this.plugin.settings.openAiApiKey = value.trim();
				await this.plugin.saveSettings();
			});
		});

		new Setting(apiModelSectionContents).setName("Gemini API key").addText((input) => {
			input.inputEl.type = "password";
			input.inputEl.setCssProps({ width: "100%" });
			input.setValue(this.plugin.settings.geminiApiKey || "").onChange(async (value) => {
				this.plugin.settings.geminiApiKey = value.trim();
				await this.plugin.saveSettings();
			});
		});

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
		const modelDescDiv = apiModelSectionContents.createEl("div");
		modelDescDiv.innerHTML = modelDesc;
		modelDescDiv.style.marginTop = "10px";
		modelDescDiv.style.paddingLeft = "10px";
		modelDescDiv.style.color = "var(--text-muted)";
		modelDescDiv.style.fontSize = "var(--font-ui-smaller)";
	}

	private _renderDynamicContextSection(containerEl: HTMLElement): void {
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
	}

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
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
			this.addPromptForm?.remove();
			this.addPromptForm = null;
			this.display();
		};
		cancelBtn.onclick = (): void => {
			this.addPromptForm?.remove();
			this.addPromptForm = null;
		};
		return form;
	}

	private _createAddPromptForm(): HTMLDivElement {
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
			this.addPromptForm?.remove();
			this.addPromptForm = null;
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
			this.addPromptForm?.remove();
			this.addPromptForm = null;
		};
		return form;
	}

	private _renderPromptManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Prompt Management" });

		const defaultPrompts = this.plugin.settings.prompts.filter((p) => p.isDefault);
		const customPrompts = this.plugin.settings.prompts.filter((p) => !p.isDefault);

		const defaultTitle = containerEl.createEl("div", { text: "Default Prompts" });
		defaultTitle.setAttr(
			"style",
			"color:#b6a84b;font-size:1.1em;font-weight:600;margin-bottom:2px;margin-top:8px;",
		);
		const defaultPromptsGrid = containerEl.createEl("div", { cls: "prompts-grid" });
		defaultPromptsGrid.style.display = "grid";
		defaultPromptsGrid.style.gridTemplateColumns = "1fr 1fr";
		defaultPromptsGrid.style.gap = "0px";

		defaultPrompts.forEach((prompt, index) => {
			const settingContainer = defaultPromptsGrid.createEl("div");
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
			customPromptsGrid.style.gap = "0px";

			customPrompts.forEach((prompt, index) => {
				const settingContainer = customPromptsGrid.createEl("div");
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
							if (this.addPromptForm) return;
							this.addPromptForm = settingContainer.parentElement?.insertBefore(
								this._createEditPromptForm(prompt),
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
					if (this.addPromptForm) return;
					this.addPromptForm = containerEl.insertBefore(
						this._createAddPromptForm(),
						addPromptFooter
					) as HTMLDivElement;
				});
			});
		addPromptSetting.settingEl.style.margin = "0";
		addPromptSetting.settingEl.style.borderTop = "none";
	}

	private _renderCleanupOptionsSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
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
		new Setting(containerEl)
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

export { DEFAULT_SETTINGS };
export type { TextTransformerSettings };
