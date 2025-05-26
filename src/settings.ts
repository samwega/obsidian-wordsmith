// src/settings.ts
import { PluginSettingTab, Setting } from "obsidian";
import TextTransformer from "./main";
import { DEFAULT_SETTINGS, MODEL_SPECS } from "./settings-data";
import type { SupportedModels, TextTransformerPrompt } from "./settings-data";

//──────────────────────────────────────────────────────────────────────────────

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

		containerEl.createEl("h2", { text: "WordSmith Settings" });

		this._renderApiModelSection(containerEl);
		this._renderPromptManagementSection(containerEl);
		// _renderDynamicContextSection has been removed
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		const apiModelSetting = new Setting(containerEl).setName("API Keys & Model");

		apiModelSetting.settingEl.style.borderTop = "none";
		apiModelSetting.settingEl.style.borderBottom = "none";

		const apiModelSectionContents = containerEl.createDiv();
		apiModelSectionContents.style.display = "none";
		apiModelSectionContents.style.marginTop = "0px";
		apiModelSectionContents.style.paddingLeft = "25px";

		apiModelSetting.addButton((button) => {
			button.setButtonText("Show").onClick(() => {
				if (apiModelSectionContents.style.display === "none") {
					apiModelSectionContents.style.display = "block";
					button.setButtonText("Hide");
				} else {
					apiModelSectionContents.style.display = "none";
					button.setButtonText("Show");
				}
			});
		});

		apiModelSetting.addDropdown((dropdown) => {
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

		apiModelSetting.nameEl.style.flex = "1";
		apiModelSetting.controlEl.style.flex = "0 0 auto";
		apiModelSetting.controlEl.style.marginLeft = "10px";
		apiModelSetting.settingEl.style.display = "flex";
		apiModelSetting.settingEl.style.alignItems = "center";

		const openaiSetting = new Setting(apiModelSectionContents)
			.setName("OpenAI API key")
			.addText((input) => {
				input.inputEl.type = "password";
				input.inputEl.setCssProps({ width: "100%" });
				input.setValue(this.plugin.settings.openAiApiKey).onChange(async (value) => {
					this.plugin.settings.openAiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			});
		openaiSetting.settingEl.style.borderTop = "none";

		const geminiSetting = new Setting(apiModelSectionContents)
			.setName("Gemini API key")
			.addText((input) => {
				input.inputEl.type = "password";
				input.inputEl.setCssProps({ width: "100%" });
				input.setValue(this.plugin.settings.geminiApiKey || "").onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			});
		geminiSetting.settingEl.style.borderTop = "none";

		const modelDesc = `
GPT 4.1 for the best literary results. Nano and Mini should be sufficient for basic text proofreading.<br>
Gemini 2.5 Flash is very fast and powerful. Gemini 2.5 Pro is a thinking model (slooow and powerful).<br><br>
<strong>Prices are estimates per 1000 tokens or 750 words:</strong><br>
<strong>GPT 4.1</strong> - intelligence = 4, speed = 3. Price = $0.01<br>
<strong>GPT 4.1 mini</strong> - intelligence = 3, speed = 4. Price = $0.002<br>
<strong>GPT 4.1 nano</strong> - intelligence = 2, speed = 5. Price = $0.0005<br>
<strong>Gemini 2.5 Flash</strong> - intelligence = 3, speed = 5. Price = $0.0005<br>
<strong>Gemini 2.5 Pro</strong> - intelligence = 4, speed = thinking. Price = $0.011<br>
`.trim();
		const modelDescDiv = apiModelSectionContents.createEl("div");
		modelDescDiv.innerHTML = modelDesc;
		modelDescDiv.style.marginTop = "15px";
		modelDescDiv.style.color = "var(--text-muted)";
		modelDescDiv.style.fontSize = "var(--font-ui-small)";
	}

	// _renderDynamicContextSection has been removed

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form";
		form.setAttribute(
			"style",
			"border:1px solid var(--background-modifier-border); background:var(--background-secondary-alt); padding:16px; margin-top:12px; border-radius:8px;" +
				"display:flex; flex-direction:column; gap:10px;" +
				"width:100%; grid-column: 1 / -1;",
		);

		const nameInput = form.appendChild(document.createElement("input"));
		nameInput.type = "text";
		nameInput.value = prompt.name;
		nameInput.placeholder = "Prompt name";
		nameInput.setAttribute(
			"style",
			"padding:6px; font-size:var(--font-ui-medium); border-radius:4px; border:1px solid var(--background-modifier-border); width:100%; flex-shrink: 0;",
		);

		const textInput = form.appendChild(document.createElement("textarea"));
		textInput.value = prompt.text;
		textInput.placeholder = "Prompt text";
		textInput.setAttribute(
			"style",
			"width: 100%;" +
				"box-sizing: border-box !important;" +
				"height: 240px !important;" +
				"resize: none !important;" +
				"overflow-y: auto !important;" +
				"padding: 6px;" +
				"border-radius: 4px;" +
				"border: 1px solid var(--background-modifier-border);" +
				"background-color: var(--input-background, var(--background-secondary));" +
				"color: var(--text-normal);",
		);

		const buttonRow = form.appendChild(document.createElement("div"));
		buttonRow.setAttribute(
			"style",
			"display:flex; gap:8px; justify-content:flex-end; flex-shrink: 0;",
		);

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
			"border:1px solid var(--background-modifier-border); background:var(--background-secondary-alt); padding:16px; margin-top:12px; border-radius:8px;" +
				"display:flex; flex-direction:column; gap:10px;" +
				"width:100%; grid-column: 1 / -1;",
		);

		const nameInput = form.appendChild(document.createElement("input"));
		nameInput.type = "text";
		nameInput.placeholder = "Prompt name";
		nameInput.setAttribute(
			"style",
			"padding:6px; font-size:var(--font-ui-medium); border-radius:4px; border:1px solid var(--background-modifier-border); width:100%; flex-shrink: 0;",
		);

		const textInput = form.appendChild(document.createElement("textarea"));
		textInput.placeholder = "Prompt text";
		textInput.value =
			"Act as a professional editor. [replace this with your prompt; replace the role too if you want]. Output only the revised text and nothing else. The text is:";
		textInput.setAttribute(
			"style",
			"width: 100%;" +
				"box-sizing: border-box !important;" +
				"height: 240px !important;" +
				"resize: none !important;" +
				"overflow-y: auto !important;" +
				"padding: 6px;" +
				"border-radius: 4px;" +
				"border: 1px solid var(--background-modifier-border);" +
				"background-color: var(--input-background, var(--background-secondary));" +
				"color: var(--text-normal);",
		);

		const buttonRow = form.appendChild(document.createElement("div"));
		buttonRow.setAttribute(
			"style",
			"display:flex; gap:8px; justify-content:flex-end; flex-shrink: 0;",
		);

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

		const defaultPrompts = this.plugin.settings.prompts.filter(
			(p: TextTransformerPrompt) => p.isDefault,
		);
		const customPrompts = this.plugin.settings.prompts.filter(
			(p: TextTransformerPrompt) => !p.isDefault,
		);

		const defaultTitle = containerEl.createEl("div", { text: "Default Prompts" });
		defaultTitle.setAttr(
			"style",
			"color:#b6a84b;font-size:1.1em;font-weight:600;margin-bottom:2px;margin-top:8px;",
		);
		const defaultPromptsGrid = containerEl.createEl("div", { cls: "prompts-grid" });
		defaultPromptsGrid.style.display = "grid";
		defaultPromptsGrid.style.gridTemplateColumns = "1fr 1fr";
		defaultPromptsGrid.style.gap = "0px";

		defaultPrompts.forEach((prompt: TextTransformerPrompt, index: number) => {
			const settingContainer = defaultPromptsGrid.createEl("div");
			if (index % 2 === 0) {
				settingContainer.style.borderRight = "1px solid var(--background-modifier-border)";
				settingContainer.style.paddingRight = "10px";
			} else {
				settingContainer.style.paddingLeft = "10px";
			}
			const setting = new Setting(settingContainer);

			if (prompt.id === "translate") {
				setting.setName("Translate to:");

				setting.addText((text) =>
					text
						.setPlaceholder("E.g., Spanish")
						.setValue(this.plugin.settings.translationLanguage)
						.onChange(async (value) => {
							const newLang = value.trim();
							this.plugin.settings.translationLanguage =
								newLang || DEFAULT_SETTINGS.translationLanguage;

							const translatePromptObj = this.plugin.settings.prompts.find(
								(p: TextTransformerPrompt) => p.id === "translate",
							);
							if (translatePromptObj) {
								if (newLang) {
									translatePromptObj.name = `Translate to ${newLang}—autodetects source language`;
								} else {
									translatePromptObj.name = `Translate to ${DEFAULT_SETTINGS.translationLanguage}—autodetects source language`;
								}
							}
							await this.plugin.saveSettings();
						}),
				);

				setting.addToggle((tg) => {
					tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
						const p = this.plugin.settings.prompts.find(
							(p: TextTransformerPrompt) => p.id === prompt.id,
						);
						if (p) p.enabled = value;
						await this.plugin.saveSettings();
					});
				});
			} else {
				setting.setName(prompt.name);
				setting.addToggle((tg) => {
					tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
						const p = this.plugin.settings.prompts.find(
							(p: TextTransformerPrompt) => p.id === prompt.id,
						);
						if (p) p.enabled = value;
						await this.plugin.saveSettings();
					});
				});
			}
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

			customPrompts.forEach((prompt: TextTransformerPrompt, index: number) => {
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
							const realIdx = this.plugin.settings.prompts.findIndex(
								(p: TextTransformerPrompt) => p.id === prompt.id,
							);
							if (realIdx > -1) {
								this.plugin.settings.prompts.splice(realIdx, 1);
								await this.plugin.saveSettings();
								this.display();
							}
						});
				});
				setting.addToggle((tg) => {
					tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
						const p = this.plugin.settings.prompts.find(
							(p: TextTransformerPrompt) => p.id === prompt.id,
						);
						if (p) p.enabled = value;
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

		const customPromptDesc = addPromptFooter.createEl("p", {
			text: "If you need to modify the default prompts for some reason, you can find them in your-vault/.obsidian/plugins/wordsmith/data.json - reload obsidian when you're done.",
		});
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
						addPromptFooter,
					) as HTMLDivElement;
				});
			});
		addPromptSetting.settingEl.style.margin = "0";
		addPromptSetting.settingEl.style.borderTop = "none";
	}
}
