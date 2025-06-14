// src/ui/settings.ts
import { PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS, TextTransformerPrompt } from "../lib/settings-data";
import type TextTransformer from "../main";
import { CustomProviderModal } from "./modals/CustomProviderModal";

type SettingsTab = "prompts" | "providers" | "params";

export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;
	private addPromptForm: HTMLDivElement | null = null;
	private addPromptButtonSettingInstance: Setting | null = null;
	private activeTab: SettingsTab = "prompts"; // Default to prompts as requested

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Reset these on each display call to ensure clean state
		this.addPromptForm = null;
		this.addPromptButtonSettingInstance = null;

		containerEl.createEl("h2", { text: "WordSmith Settings" });

		this._renderTabs(containerEl);

		const tabContentEl = containerEl.createDiv({ cls: "tt-settings-tab-content" });

		switch (this.activeTab) {
			case "prompts":
				this._renderPromptManagementSection(tabContentEl);
				break;
			case "providers":
				this._renderProviderManagementSection(tabContentEl);
				break;
			case "params":
				this._renderApiModelSection(tabContentEl);
				break;
			default:
				// Fallback to prompts tab if activeTab is somehow invalid
				this._renderPromptManagementSection(tabContentEl);
				break;
		}
	}

	private _renderTabs(containerEl: HTMLElement): void {
		const tabsContainer = containerEl.createDiv({ cls: "tt-settings-tabs-container" });

		const renderTabButton = (name: string, tabId: SettingsTab, container: HTMLElement): void => {
			const button = container.createEl("button", {
				text: name,
				cls: "tt-settings-tab-button",
			});

			if (this.activeTab === tabId) {
				button.addClass("is-active");
			}

			button.addEventListener("click", () => {
				this.activeTab = tabId;
				this.display(); // Re-render the whole settings tab
			});
		};

		// Render buttons in the requested order
		renderTabButton("Prompt Management", "prompts", tabsContainer);
		renderTabButton("Model Providers", "providers", tabsContainer);
		renderTabButton("LLM Parameters", "params", tabsContainer);
	}

	private _renderProviderManagementSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "Model Providers" });
		const desc = containerEl.createEl("p", { cls: "setting-item-description" });
		desc.setText(
			"Connect to any OpenAI-compatible API endpoint, including local servers like Ollama or LM Studio. Use the 'Quick Setup' buttons in the 'Add Provider' modal for common services.",
		);

		this.plugin.settings.customProviders.forEach((provider) => {
			new Setting(containerEl)
				.setName(provider.name)
				.addToggle((toggle) => {
					toggle.setValue(provider.isEnabled).onChange(async (value) => {
						provider.isEnabled = value;
						await this.plugin.saveSettings();
						this.display();
					});
				})
				.addButton((button) => {
					button
						.setButtonText("Edit")
						.setTooltip("Edit Provider Settings")
						.onClick(() => {
							new CustomProviderModal(
								this.app,
								this.plugin,
								provider,
								async (updatedProvider) => {
									const index = this.plugin.settings.customProviders.findIndex(
										(p) => p.id === updatedProvider.id,
									);
									if (index > -1) {
										this.plugin.settings.customProviders[index] = updatedProvider;
										await this.plugin.saveSettings();
										this.display();
									}
								},
							).open();
						});
				})
				.addButton((button) => {
					button
						.setButtonText("Delete")
						.setTooltip("Delete this Provider")
						.setClass("mod-warning")
						.onClick(async () => {
							this.plugin.settings.customProviders =
								this.plugin.settings.customProviders.filter((p) => p.id !== provider.id);
							await this.plugin.saveSettings();
							this.display();
						});
				});
		});

		new Setting(containerEl).addButton((button) =>
			button.setButtonText("Add Provider").onClick(() => {
				new CustomProviderModal(this.app, this.plugin, null, async (newProvider) => {
					this.plugin.settings.customProviders.push(newProvider);
					await this.plugin.saveSettings();
					this.display();
				}).open();
			}),
		);
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		containerEl.createEl("h3", { text: "LLM Parameters" });

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc(
				"Controls the creativity of the AI. Lower values make the output more deterministic and focused. Higher values increase randomness and exploration. High values may be prone to errors. Most models use a range of 0 to 2,, others 0 to 1 or something different. Defaults vary by model, most default to 1, others 0.7, 0.6, 0.3, even 0. Unfortunately, the API call to update models does not include any temperature information - I have included the ranges for 3 dozen popular models, so the range and default value will automatically change based on the model you select. However, for most other models, the temperature resets to a sane 0.8 and a range of 0 to 2 which should be ok for most models, but you might need to check the documentation for the model you are using to determine the range and default value.",
			)
			.addSlider((slider) => {
				slider
					.setLimits(0.0, 2.0, 0.1)
					.setValue(this.plugin.settings.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.temperature = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Max Output Tokens")
			.setDesc(
				"Set the maximum number of tokens the AI can generate in a single response. Higher values allow for longer, more complex outputs (like knowledge graphs) but may increase cost and latency.",
			)
			.addText((text) => {
				text.inputEl.type = "number";
				text.setValue(this.plugin.settings.max_tokens.toString()).onChange(async (value) => {
					const numValue = Number.parseInt(value);
					if (!Number.isNaN(numValue) && numValue > 0) {
						this.plugin.settings.max_tokens = numValue;
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(containerEl)
			.setName("Knowledge Graphs Asset Path")
			.setDesc("The vault subfolder where generated .canvas files will be stored.")
			.addText((text) => {
				text
					.setPlaceholder("WordSmith/graphs")
					.setValue(this.plugin.settings.graphAssetPath)
					.onChange(async (value) => {
						const sanitizedPath = value.trim().replace(/^\/+|\/+$/g, "");
						this.plugin.settings.graphAssetPath =
							sanitizedPath || DEFAULT_SETTINGS.graphAssetPath;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Debug Mode (Runtime Only)")
			.setDesc(
				"Enable verbose logging to the developer console for troubleshooting. This state is NOT saved and resets on reload.",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.runtimeDebugMode).onChange((value) => {
					this.plugin.runtimeDebugMode = value;
					if (value) {
						console.log("WordSmith: Debug mode enabled (runtime only).");
					} else {
						console.log("WordSmith: Debug mode disabled (runtime only).");
					}
				});
			});
	}

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
		const form = document.createElement("div");
		form.className = "add-prompt-form tt-edit-prompt-form";

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
			if (!newName || !newText) return;

			const existingPrompt = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
			if (existingPrompt) {
				existingPrompt.name = newName;
				existingPrompt.text = newText;
				await this.plugin.saveSettings();
			}
			this._closePromptForm();
			this.display();
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
		form.className = "add-prompt-form tt-add-prompt-form";

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
			if (!name || !text) return;

			this.plugin.settings.prompts.push({
				id: `custom-${Date.now()}`,
				name,
				text,
				isDefault: false,
				enabled: true,
				showInPromptPalette: true,
			});
			await this.plugin.saveSettings();
			this._closePromptForm();
			this.display();
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
					if (this.addPromptForm) this._closePromptForm();

					this.addPromptForm = this._createAddPromptForm();
					const addBtnContainer = this.addPromptButtonSettingInstance?.settingEl;
					if (addBtnContainer) {
						addBtnContainer.insertAdjacentElement("beforebegin", this.addPromptForm);
						addBtnContainer.hide();
					} else {
						promptManagementWrapper.appendChild(this.addPromptForm);
					}
				});
			});
		this.addPromptButtonSettingInstance.settingEl.classList.add("tt-add-prompt-button-container");

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
							const langToDisplay = newLang || DEFAULT_SETTINGS.translationLanguage;
							const capitalizedLang =
								langToDisplay.charAt(0).toUpperCase() + langToDisplay.slice(1);
							translatePromptObj.name = `Translate to ${capitalizedLang}—autodetects source language`;
						}
						await this.plugin.saveSettings();
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
						if (this.addPromptForm) this._closePromptForm();

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
							this.display();
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
		if (this.addPromptForm) {
			this._closePromptForm();
		}
		super.hide();
	}
}
