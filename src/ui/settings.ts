// src/ui/settings.ts
import { PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS, TextTransformerPrompt } from "../lib/settings-data";
import { log } from "../lib/utils";
import type TextTransformer from "../main";
import { CustomProviderModal } from "./modals/CustomProviderModal";

type SettingsTab = "prompts" | "providers" | "params";

export class TextTransformerSettingsMenu extends PluginSettingTab {
	plugin: TextTransformer;
	private addPromptForm: HTMLDivElement | null = null;
	private addTransformationPromptButton: Setting | null = null;
	private addGenerationPromptButton: Setting | null = null;
	private activeTab: SettingsTab = "prompts";

	constructor(plugin: TextTransformer) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addPromptForm = null;
		this.addTransformationPromptButton = null;
		this.addGenerationPromptButton = null;

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
				this.display();
			});
		};

		renderTabButton("Prompt management", "prompts", tabsContainer);
		renderTabButton("Model providers", "providers", tabsContainer);
		renderTabButton("LLM parameters", "params", tabsContainer);
	}

	private _renderProviderManagementSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Model providers").setHeading();
		const desc = containerEl.createEl("p", { cls: "setting-item-description" });
		desc.setText(
			"Connect to any API endpoint, including local servers like Ollama or LM Studio.",
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
						.setTooltip("Edit provider settings")
						.onClick(() => {
							new CustomProviderModal(this.app, {
								plugin: this.plugin,
								provider: provider,
								onSave: async (updatedProvider): Promise<void> => {
									const index = this.plugin.settings.customProviders.findIndex(
										(p) => p.id === updatedProvider.id,
									);
									if (index > -1) {
										this.plugin.settings.customProviders[index] = updatedProvider;
										await this.plugin.saveSettings();
										this.display();
									}
								},
							}).open();
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
			button.setButtonText("Add provider").onClick(() => {
				new CustomProviderModal(this.app, {
					plugin: this.plugin,
					provider: null,
					onSave: async (newProvider): Promise<void> => {
						this.plugin.settings.customProviders.push(newProvider);
						await this.plugin.saveSettings();
						this.display();
					},
				}).open();
			}),
		);
	}

	private _renderApiModelSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("LLM parameters").setHeading();

		new Setting(containerEl)
			.setName("Max output tokens")
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
			.setName("Knowledge graphs asset path")
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
			.setName("Debug mode (runtime only)")
			.setDesc(
				"Enable verbose logging to the developer console for troubleshooting. This state is NOT saved and resets on reload.",
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.runtimeDebugMode).onChange((value) => {
					if (value) {
						this.plugin.runtimeDebugMode = value;
						log(this.plugin, "Debug mode enabled (runtime only).");
					} else {
						// Log before changing the flag so the message is not suppressed
						log(this.plugin, "Debug mode disabled (runtime only).");
						this.plugin.runtimeDebugMode = value;
					}
				});
			});
	}

	private _createEditPromptForm(prompt: TextTransformerPrompt): HTMLDivElement {
		const form = createDiv({ cls: "add-prompt-form tt-edit-prompt-form" });

		const nameInput = form.createEl("input", {
			type: "text",
			placeholder: "Prompt name",
			cls: "tt-prompt-form-input",
		});
		nameInput.value = prompt.name;

		const textInput = form.createEl("textarea", {
			placeholder: "Prompt text",
			cls: "tt-prompt-form-textarea",
		});
		textInput.value = prompt.text;

		const buttonRow = form.createDiv({ cls: "tt-edit-prompt-button-row" });

		const saveBtn = buttonRow.createEl("button", {
			text: "Save",
			cls: "tt-edit-prompt-save-button",
		});
		saveBtn.onclick = async (): Promise<void> => {
			const newName = nameInput.value.trim();
			const newText = textInput.value.trim();
			if (!newName || !newText) return;

			let existingPrompt = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
			if (!existingPrompt) {
				existingPrompt = this.plugin.settings.generationPrompts.find((p) => p.id === prompt.id);
			}

			if (existingPrompt) {
				existingPrompt.name = newName;
				existingPrompt.text = newText;
				await this.plugin.saveSettings();
			}
			this._closePromptForm();
			this.display();
		};

		const cancelBtn = buttonRow.createEl("button", {
			text: "Cancel",
			cls: "tt-edit-prompt-cancel-button",
		});
		cancelBtn.onclick = (): void => {
			this._closePromptForm();
		};
		return form;
	}

	private _createAddPromptForm(targetArray: "prompts" | "generationPrompts"): HTMLDivElement {
		const form = createDiv({ cls: "add-prompt-form tt-add-prompt-form" });

		const nameInput = form.createEl("input", {
			type: "text",
			placeholder: "Prompt name",
			cls: "tt-prompt-form-input",
		});

		const textInput = form.createEl("textarea", {
			placeholder: "Prompt text",
			cls: "tt-prompt-form-textarea",
		});
		textInput.value =
			"[AI ROLE]: Professional editor.\n[TASK]: You will receive a text selection. [replace this with your prompt; replace the role too if you want].";

		const buttonRow = form.createDiv({ cls: "tt-add-prompt-button-row" });

		const saveBtn = buttonRow.createEl("button", {
			text: "Save",
			cls: "tt-add-prompt-save-button",
		});
		saveBtn.onclick = async (): Promise<void> => {
			const name = nameInput.value.trim();
			const text = textInput.value.trim();
			if (!name || !text) return;

			const newPrompt: TextTransformerPrompt = {
				id: `custom-${Date.now()}`,
				name,
				text,
				isDefault: false,
				enabled: true,
				showInPromptPalette: true,
			};

			if (targetArray === "generationPrompts") {
				this.plugin.settings.generationPrompts.push(newPrompt);
			} else {
				this.plugin.settings.prompts.push(newPrompt);
			}

			await this.plugin.saveSettings();
			this._closePromptForm();
			this.display();
		};

		const cancelBtn = buttonRow.createEl("button", {
			text: "Cancel",
			cls: "tt-add-prompt-cancel-button",
		});
		cancelBtn.onclick = (): void => {
			this._closePromptForm();
		};
		return form;
	}

	private _closePromptForm(): void {
		this.addPromptForm?.remove();
		this.addPromptForm = null;
		this.addTransformationPromptButton?.settingEl.show();
		this.addGenerationPromptButton?.settingEl.show();
	}

	private _renderPromptManagementSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Prompt management").setHeading();
		const promptManagementWrapper = containerEl.createDiv({
			cls: "prompt-management-section-container",
		});

		const defaultPrompts = this.plugin.settings.prompts.filter((p) => p.isDefault);
		const customPrompts = this.plugin.settings.prompts.filter((p) => !p.isDefault);

		if (defaultPrompts.length > 0) {
			promptManagementWrapper.createEl("div", {
				text: "Preset transformation prompts",
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
				text: "User transformation prompts",
				cls: "tt-prompt-section-title",
			});
			const customPromptsGrid = promptManagementWrapper.createEl("div", {
				cls: "tt-prompts-grid",
			});
			customPrompts.forEach((prompt, index) =>
				this._renderPromptItem(prompt, customPromptsGrid, index),
			);
		}

		this.addTransformationPromptButton = new Setting(promptManagementWrapper)
			.setName("Add new transformation prompt")
			.setDesc("Create a new custom prompt for transforming selected text.")
			.addButton((button) => {
				button.setButtonText("Add new prompt").onClick(() => {
					if (this.addPromptForm) this._closePromptForm();
					this.addPromptForm = this._createAddPromptForm("prompts");
					this.addTransformationPromptButton?.settingEl.insertAdjacentElement(
						"beforebegin",
						this.addPromptForm,
					);
					this.addTransformationPromptButton?.settingEl.hide();
				});
			});
		this.addTransformationPromptButton.settingEl.classList.add("tt-add-prompt-button-container");

		promptManagementWrapper.createEl("div", { cls: "tt-prompt-divider" });

		promptManagementWrapper.createEl("div", {
			text: "User generation prompts",
			cls: "tt-prompt-section-title",
		});
		const generationPromptsGrid = promptManagementWrapper.createEl("div", {
			cls: "tt-prompts-grid",
		});
		this.plugin.settings.generationPrompts.forEach((prompt, index) =>
			this._renderPromptItem(prompt, generationPromptsGrid, index),
		);

		this.addGenerationPromptButton = new Setting(promptManagementWrapper)
			.setName("Add new generation prompt")
			.setDesc("Create a new reusable prompt for ad-hoc text generation.")
			.addButton((button) => {
				button.setButtonText("Add new prompt").onClick(() => {
					if (this.addPromptForm) this._closePromptForm();
					this.addPromptForm = this._createAddPromptForm("generationPrompts");
					this.addGenerationPromptButton?.settingEl.insertAdjacentElement(
						"beforebegin",
						this.addPromptForm,
					);
					this.addGenerationPromptButton?.settingEl.hide();
				});
			});
		this.addGenerationPromptButton.settingEl.classList.add("tt-add-prompt-button-container");
	}

	private _renderPromptItem(
		prompt: TextTransformerPrompt,
		gridContainer: HTMLElement,
		index: number,
	): void {
		const setting = new Setting(gridContainer);
		setting.settingEl.addClass("tt-prompt-item");
		if (index % 2 === 0) setting.settingEl.addClass("tt-grid-item-left");
		else setting.settingEl.addClass("tt-grid-item-right");

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
						const container = gridContainer.closest(".prompt-management-section-container");
						if (container) {
							container.appendChild(this.addPromptForm);
							this.addTransformationPromptButton?.settingEl.hide();
							this.addGenerationPromptButton?.settingEl.hide();
						}
					});
			});
			setting.addExtraButton((btn) => {
				btn.setIcon("trash")
					.setTooltip("Delete")
					.onClick(async (): Promise<void> => {
						let wasDeleted = false;
						let realIdx = this.plugin.settings.prompts.findIndex((p) => p.id === prompt.id);
						if (realIdx > -1) {
							this.plugin.settings.prompts.splice(realIdx, 1);
							wasDeleted = true;
						} else {
							realIdx = this.plugin.settings.generationPrompts.findIndex(
								(p) => p.id === prompt.id,
							);
							if (realIdx > -1) {
								this.plugin.settings.generationPrompts.splice(realIdx, 1);
								wasDeleted = true;
							}
						}

						if (wasDeleted) {
							await this.plugin.saveSettings();
							this.display();
						}
					});
			});
		}

		setting.addToggle((tg) => {
			tg.setValue(prompt.enabled).onChange(async (value): Promise<void> => {
				let p = this.plugin.settings.prompts.find((p) => p.id === prompt.id);
				if (!p) {
					p = this.plugin.settings.generationPrompts.find((p) => p.id === prompt.id);
				}
				if (p) {
					p.enabled = value;
					await this.plugin.saveSettings();
				}
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
