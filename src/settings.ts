// src/settings.ts
import { PluginSettingTab, Setting } from "obsidian";
import TextTransformer from "./main";
import { MODEL_SPECS } from "./settings-data";
import type { SupportedModels, TextTransformerPrompt } from "./settings-data";

//──────────────────────────────────────────────────────────────────────────────

export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;
	private addPromptForm: HTMLDivElement | null = null;
	private addPromptButtonSettingInstance: Setting | null = null; // Instance for the button

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Reset the form and button instance references when the display is re-rendered
		this.addPromptForm = null;
		this.addPromptButtonSettingInstance = null;

		containerEl.createEl("h2", { text: "WordSmith Settings" });

		this._renderApiModelSection(containerEl);
		this._renderPromptManagementSection(containerEl);
		// _renderDynamicContextSection has been removed
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		const apiModelSetting = new Setting(containerEl).setName("API Keys & Model");

		apiModelSetting.settingEl.classList.add("api-model-setting-el");

		const apiModelSectionContents = containerEl.createDiv();
		apiModelSectionContents.classList.add("tt-api-model-section-contents");

		apiModelSetting.addButton((button) => {
			button.setButtonText("Show").onClick(() => {
				if (apiModelSectionContents.classList.contains("is-visible")) {
					apiModelSectionContents.classList.remove("is-visible");
					button.setButtonText("Show");
				} else {
					apiModelSectionContents.classList.add("is-visible");
					button.setButtonText("Hide");
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

		apiModelSetting.nameEl.classList.add("tt-setting-name-el");
		apiModelSetting.controlEl.classList.add("tt-setting-control-el");

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
		openaiSetting.settingEl.classList.add("api-key-setting-el");

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
		geminiSetting.settingEl.classList.add("api-key-setting-el");

		// Define the structure of the description
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
			{ type: "br" },
			{ type: "strong", text: "Prices are estimates per 1000 tokens or 750 words:" },
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
			{ type: "strong", text: "Gemini 2.5 Flash" },
			{ type: "text", text: " - intelligence = 3, speed = 5. Price = $0.0005" },
			{ type: "br" },
			{ type: "strong", text: "Gemini 2.5 Pro" },
			{ type: "text", text: " - intelligence = 4, speed = thinking. Price = $0.011" },
			{ type: "br" },
		];

		const modelDescDiv = apiModelSectionContents.createEl("div");

		// Populate the div using DOM manipulation
		contentStructure.forEach((item) => {
			if (item.type === "text" && typeof item.text === "string") {
				modelDescDiv.appendText(item.text);
			} else if (item.type === "strong" && typeof item.text === "string") {
				modelDescDiv.createEl("strong", { text: item.text });
			} else if (item.type === "br") {
				modelDescDiv.createEl("br");
			}
		});

		modelDescDiv.classList.add("tt-model-description");
	}

	// _renderDynamicContextSection has been removed

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form";
		form.classList.add("tt-edit-prompt-form");

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

		const cancelBtn = buttonRow.appendChild(document.createElement("button"));
		cancelBtn.textContent = "Cancel";
		cancelBtn.classList.add("tt-edit-prompt-cancel-button");

		saveBtn.onclick = async (): Promise<void> => {
			const newName = (nameInput as HTMLInputElement).value.trim();
			const newText = (textInput as HTMLTextAreaElement).value.trim();
			if (!newName || !newText) return;
			const existingPrompt = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
			if (existingPrompt) {
				existingPrompt.name = newName;
				existingPrompt.text = newText;
				await this.plugin.saveSettings();
			}
			form.remove();
			this.addPromptForm = null;
			this.addPromptButtonSettingInstance?.settingEl.show();
			this.display();
		};
		cancelBtn.onclick = (): void => {
			this.addPromptForm?.remove();
			this.addPromptForm = null;
			this.addPromptButtonSettingInstance?.settingEl.show();
		};
		return form;
	}

	private _createAddPromptForm(): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form";
		form.classList.add("tt-add-prompt-form");

		const nameInput = form.appendChild(document.createElement("input"));
		nameInput.type = "text";
		nameInput.placeholder = "Prompt name";
		nameInput.classList.add("tt-prompt-form-input");

		const textInput = form.appendChild(document.createElement("textarea"));
		textInput.placeholder = "Prompt text";
		textInput.value =
			"[AIROLE]: Professional editor.\n[TASK]: You will receive a text selection. [replace this with your prompt; replace the role too if you want].\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:";
		textInput.classList.add("tt-prompt-form-textarea");

		const buttonRow = form.appendChild(document.createElement("div"));
		buttonRow.classList.add("tt-add-prompt-button-row");

		const saveBtn = buttonRow.appendChild(document.createElement("button"));
		saveBtn.textContent = "Save";
		saveBtn.classList.add("tt-add-prompt-save-button");

		const cancelBtn = buttonRow.appendChild(document.createElement("button"));
		cancelBtn.textContent = "Cancel";
		cancelBtn.classList.add("tt-add-prompt-cancel-button");

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
			this.addPromptButtonSettingInstance?.settingEl.show();
			this.display();
		};
		cancelBtn.onclick = (): void => {
			this.addPromptForm?.remove();
			this.addPromptForm = null;
			this.addPromptButtonSettingInstance?.settingEl.show();
		};
		return form;
	}

	private _renderPromptManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Prompt Management" });
		// Add a wrapper div with a class for easier targeting of the whole section
		const promptManagementWrapper = containerEl.createDiv({
			cls: "prompt-management-section-container",
		});

		const defaultPrompts = this.plugin.settings.prompts.filter(
			(p: TextTransformerPrompt) => p.isDefault,
		);
		const customPrompts = this.plugin.settings.prompts.filter(
			(p: TextTransformerPrompt) => !p.isDefault,
		);

		promptManagementWrapper.createEl("div", {
			text: "Default Prompts",
			cls: "tt-prompt-section-title",
		});

		const defaultPromptsGrid = promptManagementWrapper.createEl("div", {
			cls: "tt-prompts-grid",
		});
		defaultPrompts.forEach((prompt, index) =>
			this._renderPromptItem(prompt, defaultPromptsGrid, index),
		);

		if (customPrompts.length > 0) {
			promptManagementWrapper.createEl("div", { cls: "tt-prompt-divider" });
			promptManagementWrapper.createEl("div", {
				text: "Custom Prompts",
				cls: "tt-prompt-section-title",
			});

			const customPromptsGrid = promptManagementWrapper.createEl("div", {
				cls: "tt-prompts-grid",
			});
			customPrompts.forEach((prompt, index) =>
				this._renderPromptItem(prompt, customPromptsGrid, index),
			);
		}

		// If an edit form exists from a previous render (e.g. after saving an edit), re-insert it.
		// This logic might need refinement if it causes issues with new edit form creation.
		if (this.addPromptForm?.classList.contains("tt-edit-prompt-form")) {
			const addPromptButtonSettingEl = promptManagementWrapper.querySelector(
				".tt-add-prompt-button-container",
			);
			if (addPromptButtonSettingEl) {
				promptManagementWrapper.insertBefore(this.addPromptForm, addPromptButtonSettingEl);
			} else {
				promptManagementWrapper.appendChild(this.addPromptForm);
			}
		}

		// Always create the Setting instance for the button in each render pass
		this.addPromptButtonSettingInstance = new Setting(promptManagementWrapper)
			.setName("Add New Prompt") // Keep name for consistency if styles target it
			.setDesc("Create a new custom prompt for your text transformations.") // Keep desc
			.addButton((button) => {
				button.setButtonText("Add New Prompt");
				button.onClick(() => {
					if (this.addPromptForm) {
						// If a form (e.g., edit form) was already open
						this.addPromptForm.remove();
						this.addPromptForm = null; // Clear ref to old form
					}
					this.addPromptForm = this._createAddPromptForm(); // Create and assign the new add form
					// Insert Add form before the button itself
					this.addPromptButtonSettingInstance?.settingEl.insertAdjacentElement(
						"beforebegin",
						this.addPromptForm,
					);
					this.addPromptButtonSettingInstance?.settingEl.hide(); // Hide button when form is shown
				});
			});
		this.addPromptButtonSettingInstance.settingEl.classList.add("tt-add-prompt-button-container");

		// Visibility logic based on .show() / .hide()
		if (this.addPromptForm) {
			// Check if a form (add or edit) is active
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

		if (prompt.id === "translate") {
			setting.setName("Translate to:"); // Static name

			setting.addText((text) =>
				text
					.setPlaceholder("E.g., Spanish")
					.setValue(this.plugin.settings.translationLanguage)
					.onChange(async (value) => {
						const newLang = value.trim();
						this.plugin.settings.translationLanguage = newLang;

						// Update the prompt name in the plugin settings for the Command Palette
						const translatePromptObj = this.plugin.settings.prompts.find(
							(p: TextTransformerPrompt) => p.id === "translate",
						);
						if (translatePromptObj) {
							const langToDisplay =
								newLang || this.plugin.defaultSettings.translationLanguage;
							const capitalizedLang =
								langToDisplay.charAt(0).toUpperCase() + langToDisplay.slice(1);
							translatePromptObj.name = `Translate to ${capitalizedLang}—autodetects source language`;
						}

						await this.plugin.saveSettings();
						// DO NOT call setting.setName() or this.display() here to prevent focus loss
					}),
			);
		} else {
			setting.setName(prompt.name); // For all other prompts
			// If other prompts might have descriptions, add them here:
			// if (prompt.description) setting.setDesc(prompt.description);
		}

		setting.settingEl.classList.add("tt-prompt-item");

		if (index % 2 === 0) {
			setting.settingEl.classList.add("tt-grid-item-left");
		} else {
			setting.settingEl.classList.add("tt-grid-item-right");
		}

		if (!prompt.isDefault) {
			setting.addExtraButton((btn) => {
				btn.setIcon("pencil")
					.setTooltip("Edit")
					.onClick((): void => {
						if (this.addPromptForm) {
							this.addPromptForm.remove();
							this.addPromptForm = null; // Clear the reference
						}
						this.addPromptForm = this._createEditPromptForm(prompt);

						// Find the main container for the prompt management section
						const promptManagementSection = gridContainer.closest(
							".prompt-management-section-container",
						); // Need to add this class to the main container
						const addPromptButtonContainer = promptManagementSection?.querySelector(
							".tt-add-prompt-button-container",
						);

						if (promptManagementSection && addPromptButtonContainer) {
							promptManagementSection.insertBefore(
								this.addPromptForm,
								addPromptButtonContainer,
							);
						} else if (promptManagementSection) {
							// Fallback if button container not found, append to section
							promptManagementSection.appendChild(this.addPromptForm);
						} else {
							// Fallback: if absolutely nothing else, append to grid's parent (less ideal)
							gridContainer.parentElement?.appendChild(this.addPromptForm);
						}
						this.addPromptButtonSettingInstance?.settingEl.hide();
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
		}

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

	override hide(): void {
		// If a form is open when the settings tab is hidden, remove it and clear the reference.
		if (this.addPromptForm) {
			this.addPromptForm.remove(); // Remove from DOM
			this.addPromptForm = null; // Clear the instance variable
		}
		// No need to call super.hide() or empty containerEl here,
		// as display() handles re-rendering and Component lifecycle manages the tab's main element.
	}
}
