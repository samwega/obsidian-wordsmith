// src/ui/settings.ts
import { PluginSettingTab, Setting } from "obsidian";
import { MODEL_SPECS, SupportedModels, TextTransformerPrompt } from "../lib/settings-data";
import type TextTransformer from "../main";

export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;
	private addPromptForm: HTMLDivElement | null = null;
	private addPromptButtonSettingInstance: Setting | null = null;

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addPromptForm = null;
		this.addPromptButtonSettingInstance = null;

		containerEl.createEl("h2", { text: "WordSmith Settings" });

		this._renderApiModelSection(containerEl);
		this._renderPromptManagementSection(containerEl);
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		const apiModelSetting = new Setting(containerEl).setName("API Keys & Model");
		apiModelSetting.settingEl.classList.add("api-model-setting-el"); // Keep class if used by CSS

		const apiModelSectionContents = containerEl.createDiv({
			cls: "tt-api-model-section-contents",
		});

		apiModelSetting.addButton((button) => {
			button
				.setButtonText(
					apiModelSectionContents.classList.contains("is-visible") ? "Hide" : "Show",
				)
				.onClick(() => {
					const isVisible = apiModelSectionContents.classList.toggle("is-visible");
					button.setButtonText(isVisible ? "Hide" : "Show");
					apiModelSectionContents.style.display = isVisible ? "block" : "none";
				});
		});
		// Initial state from class
		apiModelSectionContents.style.display = apiModelSectionContents.classList.contains(
			"is-visible",
		)
			? "block"
			: "none";

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

		apiModelSetting.nameEl.classList.add("tt-setting-name-el");
		apiModelSetting.controlEl.classList.add("tt-setting-control-el");

		new Setting(apiModelSectionContents)
			.setName("OpenAI API key")
			.setDesc("API key for OpenAI models.")
			.addText((input) => {
				input.inputEl.type = "password";
				input.inputEl.setCssProps({ width: "100%" });
				input.setValue(this.plugin.settings.openAiApiKey).onChange(async (value) => {
					this.plugin.settings.openAiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.settingEl.classList.add("api-key-setting-el");

		new Setting(apiModelSectionContents)
			.setName("Gemini API key")
			.setDesc("API key for Google Gemini models.")
			.addText((input) => {
				input.inputEl.type = "password";
				input.inputEl.setCssProps({ width: "100%" });
				input.setValue(this.plugin.settings.geminiApiKey || "").onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.settingEl.classList.add("api-key-setting-el");

		new Setting(apiModelSectionContents)
			.setName("OpenRouter API key")
			.setDesc("API key for OpenRouter models. See openrouter.ai for details.")
			.addText((input) => {
				input.inputEl.type = "password";
				input.inputEl.setCssProps({ width: "100%" });
				input.setValue(this.plugin.settings.openRouterApiKey || "").onChange(async (value) => {
					this.plugin.settings.openRouterApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.settingEl.classList.add("api-key-setting-el");

		// Temperature Setting
		new Setting(apiModelSectionContents)
			.setName("Temperature")
			.setDesc(
				`0.0 - 0.6: More focused, deterministic, and predictable output. Ideal for factual recall or consistent styling.
0.7 - 1.2: A balance between coherence and creativity. Good for general writing and drafting. (Default: 1.0)
1.3 - 1.8: Increased creativity, novelty, and exploration of diverse ideas. Useful for brainstorming or unique content generation, but may be more prone to errors.
Above 1.8: Highly experimental. Incoherence and hallucination become the norm.`,
			)
			.addSlider((slider) => {
				slider
					.setLimits(0.0, 2.0, 0.1) // Changed step to 0.1
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
					});
			});

		// Debug Mode Setting
		new Setting(apiModelSectionContents)
			.setName("Debug Mode (Runtime Only)")
			.setDesc(
				"Enable verbose logging to the developer console for troubleshooting. This state is NOT saved and resets on reload.",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.runtimeDebugMode).onChange((value) => {
					this.plugin.runtimeDebugMode = value;
					// Do not save this setting.
					if (value) {
						console.log("WordSmith: Debug mode enabled (runtime only).");
					} else {
						console.log("WordSmith: Debug mode disabled (runtime only).");
					}
				});
			});

		const contentStructure: Array<{ type: "text" | "strong" | "br"; text?: string }> = [
			{
				type: "text",
				text: "GPT 4.1 for the best literary results. Nano and Mini should be sufficient for basic text proofreading.",
			},
			{ type: "br" },
			{
				type: "text",
				text: "Gemini 2.5 Flash is very fast and powerful. Gemini 2.5 Pro is a thinking model (slooow and powerful).",
			},
			{ type: "br" },
			{
				type: "text",
				text: "OpenRouter offers access to many models via a single API key, including some exotic ones which specialize in literary writing. Some of the ones I've included are also able to generate NSFW and other uncensored content. Some of them are also significantly slower.",
			},
			{ type: "br" },
			{ type: "br" },
			{ type: "strong", text: "PRICES ARE ESTIMATES PER 1000 TOKENS OR 750 WORDS." },
			{ type: "br" },
			{ type: "strong", text: " ⮞ OpenAI API Models" },
			{ type: "br" },
			{ type: "strong", text: "GPT 4.1" },
			{ type: "text", text: " - intelligence = 4, speed = 3. Price = $0.01" },
			{ type: "br" },
			{ type: "strong", text: "GPT 4.1 mini" },
			{ type: "text", text: " - intelligence = 3, speed = 4. Price = $0.002" },
			{ type: "br" },
			{ type: "strong", text: "GPT 4.1 nano" },
			{ type: "text", text: " - intelligence = 2, speed = 5. Price = $0.0005" },
			{ type: "br" },
			{ type: "strong", text: "GPT o4" },
			{ type: "text", text: " - intelligence = 4, speed = 3. Price = $0.01" },
			{ type: "br" },
			{ type: "strong", text: " ⮞ Google Gemini API Models" },
			{ type: "br" },
			{ type: "strong", text: "Gemini 2.5 Flash (05-20)" },
			{
				type: "text",
				text: " - intelligence = 3, speed = 5. Price = $0.0005 (500 free requests per day!)",
			},
			{ type: "br" },
			{ type: "strong", text: "Gemini 2.5 Pro (06-05)" },
			{ type: "text", text: " - intelligence = 5, speed = thinking. Price = $0.01" },
			{ type: "br" },
			{ type: "strong", text: " ⮞ OpenRouter API Models marked (OR)" },
			{ type: "br" },
			{ type: "strong", text: "GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano & GPT-4o (OR)" },
			{ type: "br" },
			{ type: "strong", text: "Gemini 2.5 Flash & Pro (OR)" },
			{ type: "br" },
			{ type: "strong", text: "Claude 3.5 Sonnet (OR)" },
			{ type: "text", text: " - intelligence = 5, speed = 4. Price = $0.018" }, // Please verify this value
			{ type: "br" },
			{ type: "strong", text: "Claude 3.7 Sonnet (OR)" },
			{ type: "text", text: " - intelligence = 5, speed = 5, Price = ???" }, // Please verify this value
			{ type: "br" },
			{ type: "strong", text: "DeepSeek Chat v3 (OR)" },
			{ type: "text", text: " - intelligence = 4, speed = 4. Price = ???" }, // Please verify this value
			{ type: "br" },
			{ type: "strong", text: "DeepSeek Chat R1 (OR)" },
			{ type: "text", text: " - intelligence = 4, speed = 4. Price = ???" }, // Please verify this value
			{ type: "br" },
			{ type: "strong", text: "Hermes 3 70B (OR)" },
			{ type: "text", text: " - seems very high quality; NSFW: yes" },
			{ type: "strong", text: "Hermes 3 405B (OR)" },
			{ type: "text", text: " - Philosophically complex narratives. Great context window; NSFW: yes", },
			{ type: "br" },
			{ type: "br" },
			{ type: "strong", text: "Magnum 72B (OR)" },
			{ type: "text",	text: " - Polished and nuanced literary prose, dialogue, pacing. Might refuse NSFW generation from scratch but will transform if given one",},
			{ type: "br" },
			{ type: "strong", text: "Goliath 120B (OR)" },
			{type: "text", text: " - Novel writing, complex roleplay, immersive world-building. Best for epic fantasy/saga. Small context, expensive; NSFW: yes", },
			{ type: "br" },
			{ type: "strong", text: "Lumimaid v0.2 70B (OR)" },
			{type: "text", text: " - Modern, blended genres, technical, research integration. Best for speculative fiction; NSFW: yes",},
			{ type: "br" },
			{ type: "strong", text: "Skyfall 36B V2 (OR)" },
			{type: "text", text: " - Detailed description, lively RP, humor. Large context; NSFW: yes",},
			{ type: "br" },
			{ type: "strong", text: "Gemma 3 27B (OR)" },
			{ type: "text", text: " - small fast model from Google" },
			{ type: "br" },
		];
		const modelDescDiv = apiModelSectionContents.createEl("div", { cls: "tt-model-description" });
		contentStructure.forEach((item) => {
			if (item.type === "text" && typeof item.text === "string")
				modelDescDiv.appendText(item.text);
			else if (item.type === "strong" && typeof item.text === "string")
				modelDescDiv.createEl("strong", { text: item.text });
			else if (item.type === "br") modelDescDiv.createEl("br");
		});
	}

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form tt-edit-prompt-form"; // Combined classes

		const nameInput = form.appendChild(document.createElement("input"));
		nameInput.type = "text";
		nameInput.value = prompt.name;
		nameInput.placeholder = "Prompt name";
		nameInput.classList.add("tt-prompt-form-input");

		const textInput = form.appendChild(document.createElement("textarea"));
		textInput.value = prompt.text;
		textInput.placeholder = "Prompt text";
		textInput.classList.add("tt-prompt-form-textarea");

		const buttonRow = form.appendChild(document.createElement("div"));
		buttonRow.classList.add("tt-edit-prompt-button-row");

		const saveBtn = buttonRow.appendChild(document.createElement("button"));
		saveBtn.textContent = "Save";
		saveBtn.classList.add("tt-edit-prompt-save-button");
		saveBtn.onclick = async (): Promise<void> => {
			const newName = nameInput.value.trim();
			const newText = textInput.value.trim();
			if (!newName || !newText) return; // Basic validation

			const existingPrompt = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
			if (existingPrompt) {
				existingPrompt.name = newName;
				existingPrompt.text = newText;
				await this.plugin.saveSettings();
			}
			this._closePromptForm();
			this.display(); // Re-render to show updated list
		};

		const cancelBtn = buttonRow.appendChild(document.createElement("button"));
		cancelBtn.textContent = "Cancel";
		cancelBtn.classList.add("tt-edit-prompt-cancel-button");
		cancelBtn.onclick = (): void => {
			this._closePromptForm();
		};
		return form;
	}

	private _createAddPromptForm(): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form tt-add-prompt-form"; // Combined classes

		const nameInput = form.appendChild(document.createElement("input"));
		nameInput.type = "text";
		nameInput.placeholder = "Prompt name";
		nameInput.classList.add("tt-prompt-form-input");

		const textInput = form.appendChild(document.createElement("textarea"));
		textInput.placeholder = "Prompt text";
		textInput.value =
			"[AI ROLE]: Professional editor.\n[TASK]: You will receive a text selection. [replace this with your prompt; replace the role too if you want].";
		textInput.classList.add("tt-prompt-form-textarea");

		const buttonRow = form.appendChild(document.createElement("div"));
		buttonRow.classList.add("tt-add-prompt-button-row");

		const saveBtn = buttonRow.appendChild(document.createElement("button"));
		saveBtn.textContent = "Save";
		saveBtn.classList.add("tt-add-prompt-save-button");
		saveBtn.onclick = async (): Promise<void> => {
			const name = nameInput.value.trim();
			const text = textInput.value.trim();
			if (!name || !text) return; // Basic validation

			this.plugin.settings.prompts.push({
				id: `custom-${Date.now()}`,
				name,
				text,
				isDefault: false,
				enabled: true,
				showInPromptPalette: true, // Default for new custom prompts
			});
			await this.plugin.saveSettings();
			this._closePromptForm();
			this.display(); // Re-render to show new prompt
		};

		const cancelBtn = buttonRow.appendChild(document.createElement("button"));
		cancelBtn.textContent = "Cancel";
		cancelBtn.classList.add("tt-add-prompt-cancel-button");
		cancelBtn.onclick = (): void => {
			this._closePromptForm();
		};
		return form;
	}

	private _closePromptForm(): void {
		this.addPromptForm?.remove();
		this.addPromptForm = null;
		this.addPromptButtonSettingInstance?.settingEl.show();
	}

	private _renderPromptManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Prompt Management" });
		const promptManagementWrapper = containerEl.createDiv({
			cls: "prompt-management-section-container",
		});

		const defaultPrompts = this.plugin.settings.prompts.filter((p) => p.isDefault);
		const customPrompts = this.plugin.settings.prompts.filter((p) => !p.isDefault);

		if (defaultPrompts.length > 0) {
			promptManagementWrapper.createEl("div", {
				text: "Preset Prompts",
				cls: "tt-prompt-section-title",
			});
			const defaultPromptsGrid = promptManagementWrapper.createEl("div", {
				cls: "tt-prompts-grid",
			});
			defaultPrompts.forEach((prompt, index) =>
				this._renderPromptItem(prompt, defaultPromptsGrid, index),
			);
		}

		if (customPrompts.length > 0) {
			promptManagementWrapper.createEl("div", { cls: "tt-prompt-divider" });
			promptManagementWrapper.createEl("div", {
				text: "User Prompts",
				cls: "tt-prompt-section-title",
			});
			const customPromptsGrid = promptManagementWrapper.createEl("div", {
				cls: "tt-prompts-grid",
			});
			customPrompts.forEach((prompt, index) =>
				this._renderPromptItem(prompt, customPromptsGrid, index),
			);
		}

		// If a form (edit or add) was active and needs to be re-inserted (e.g. after validation fail, though current logic closes on success/cancel)
		if (this.addPromptForm) {
			const addBtnContainer = this.addPromptButtonSettingInstance?.settingEl;
			if (addBtnContainer) {
				promptManagementWrapper.insertBefore(this.addPromptForm, addBtnContainer);
			} else {
				promptManagementWrapper.appendChild(this.addPromptForm);
			}
		}

		this.addPromptButtonSettingInstance = new Setting(promptManagementWrapper)
			.setName("Add New Prompt")
			.setDesc("Create a new custom prompt for your text transformations.")
			.addButton((button) => {
				button.setButtonText("Add New Prompt").onClick(() => {
					if (this.addPromptForm) this._closePromptForm(); // Close any existing form

					this.addPromptForm = this._createAddPromptForm();
					const addBtnContainer = this.addPromptButtonSettingInstance?.settingEl;
					if (addBtnContainer) {
						addBtnContainer.insertAdjacentElement("beforebegin", this.addPromptForm);
						addBtnContainer.hide();
					} else {
						// Fallback, though should not happen if button instance exists
						promptManagementWrapper.appendChild(this.addPromptForm);
					}
				});
			});
		this.addPromptButtonSettingInstance.settingEl.classList.add("tt-add-prompt-button-container");

		// Initial visibility of add button
		if (this.addPromptForm) {
			this.addPromptButtonSettingInstance?.settingEl.hide();
		} else {
			this.addPromptButtonSettingInstance?.settingEl.show();
		}
	}

	private _renderPromptItem(
		prompt: TextTransformerPrompt,
		gridContainer: HTMLElement,
		index: number,
	): void {
		const setting = new Setting(gridContainer);
		setting.settingEl.classList.add("tt-prompt-item");
		if (index % 2 === 0) setting.settingEl.classList.add("tt-grid-item-left");
		else setting.settingEl.classList.add("tt-grid-item-right");

		if (prompt.id === "translate") {
			setting.setName("Translate to:");
			setting.addText((text) =>
				text
					.setPlaceholder("E.g., Spanish")
					.setValue(this.plugin.settings.translationLanguage)
					.onChange(async (value) => {
						const newLang = value.trim();
						this.plugin.settings.translationLanguage = newLang;
						const translatePromptObj = this.plugin.settings.prompts.find(
							(p) => p.id === "translate",
						);
						if (translatePromptObj) {
							const langToDisplay =
								newLang || this.plugin.defaultSettings.translationLanguage;
							const capitalizedLang =
								langToDisplay.charAt(0).toUpperCase() + langToDisplay.slice(1);
							translatePromptObj.name = `Translate to ${capitalizedLang}—autodetects source language`;
						}
						await this.plugin.saveSettings();
						// No re-display to keep focus
					}),
			);
		} else {
			setting.setName(prompt.name);
		}

		if (!prompt.isDefault) {
			setting.addExtraButton((btn) => {
				btn.setIcon("pencil")
					.setTooltip("Edit")
					.onClick((): void => {
						if (this.addPromptForm) this._closePromptForm(); // Close any existing form

						this.addPromptForm = this._createEditPromptForm(prompt);
						const addBtnContainer = this.addPromptButtonSettingInstance?.settingEl;

						if (addBtnContainer) {
							gridContainer
								.closest(".prompt-management-section-container")
								?.insertBefore(this.addPromptForm, addBtnContainer);
							addBtnContainer.hide();
						} else {
							gridContainer
								.closest(".prompt-management-section-container")
								?.appendChild(this.addPromptForm);
						}
					});
			});
			setting.addExtraButton((btn) => {
				btn.setIcon("trash")
					.setTooltip("Delete")
					.onClick(async (): Promise<void> => {
						const realIdx = this.plugin.settings.prompts.findIndex((p) => p.id === prompt.id);
						if (realIdx > -1) {
							this.plugin.settings.prompts.splice(realIdx, 1);
							await this.plugin.saveSettings();
							this.display(); // Re-render after deletion
						}
					});
			});
		}

		setting.addToggle((tg) => {
			tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
				const p = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
				if (p) p.enabled = value;
				await this.plugin.saveSettings();
			});
		});
	}

	override hide(): void {
		// Ensure form is removed if settings tab is closed while form is open
		if (this.addPromptForm) {
			this._closePromptForm();
		}
		super.hide(); // Call base class hide
	}
}
