// src/ui/modals/ModelSelectionModal.ts
import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { getProviderInfo } from "../../lib/provider-utils";
import type { Model } from "../../lib/settings-data";
import type TextTransformer from "../../main";

export class ModelSelectionModal extends Modal {
	private plugin: TextTransformer;
	private allModels: Model[] = [];
	private filteredModels: Model[] = [];
	private selectedProvider = "All";
	private searchQuery = "";

	private modelListContainer!: HTMLDivElement;
	private providerDropdown!: HTMLSelectElement;

	constructor(app: App, plugin: TextTransformer) {
		super(app);
		this.plugin = plugin;
	}

	override async onOpen(): Promise<void> {
		this.modalEl.addClass("tt-model-selection-modal"); // Apply class to the root modal element
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Browse Models" });

		this.renderFilters(contentEl);
		this.modelListContainer = contentEl.createDiv({ cls: "tt-model-list-container" });

		const loadingEl = this.modelListContainer.createEl("p", { text: "Fetching models..." });

		try {
			this.allModels = await this.plugin.modelService.getModels();
			this.allModels = this.plugin.favoritesService.enrichModelsWithFavorites(this.allModels);
			this.applyFiltersAndRender();
		} catch (error) {
			console.error("[WordSmith] Error fetching models for modal:", error);
			this.modelListContainer.setText("Failed to load models. Check your provider settings.");
		} finally {
			loadingEl.remove();
		}
	}

	private renderFilters(container: HTMLElement): void {
		const filterContainer = container.createDiv({ cls: "tt-model-filters" });
		const filterGrid = filterContainer.createDiv({ cls: "tt-model-filters-grid" });

		const providerFilterSetting = new Setting(filterGrid).setName("Filter by Provider");

		const searchSetting = new Setting(filterGrid).setName("Search").addText((text) => {
			text.setPlaceholder("e.g., Llama, GPT, OpenRouter...").onChange((value) => {
				this.searchQuery = value.toLowerCase();
				this.applyFiltersAndRender();
			});
			text.inputEl.addClass("tt-model-search-input");
		});
		searchSetting.settingEl.addClass("tt-model-filter-item");

		this.providerDropdown = providerFilterSetting.controlEl.createEl("select");
		this.providerDropdown.addClass("dropdown");
		this.providerDropdown.onchange = (e: Event): void => {
			this.selectedProvider = (e.target as HTMLSelectElement).value;
			this.applyFiltersAndRender();
		};
		providerFilterSetting.settingEl.addClass("tt-model-filter-item");

		const refreshButtonWrapper = filterContainer.createDiv({ cls: "tt-refresh-button-wrapper" });
		new ButtonComponent(refreshButtonWrapper)
			.setButtonText("Refresh Model List")
			.setTooltip("Bypass cache and fetch the latest models from all providers")
			.onClick(async () => {
				const notice = new Notice("Refreshing model list...", 0);
				try {
					this.allModels = await this.plugin.modelService.getModels(true);
					this.allModels = this.plugin.favoritesService.enrichModelsWithFavorites(
						this.allModels,
					);
					this.applyFiltersAndRender();
					notice.setMessage("✅ Models refreshed.");
					setTimeout(() => notice.hide(), 2000);
				} catch (error) {
					console.error("[WordSmith] Error refreshing models:", error);
					notice.setMessage("Failed to refresh models.");
					setTimeout(() => notice.hide(), 3000);
				}
			});
	}

	private populateProviderFilter(): void {
		const currentVal = this.providerDropdown.value;
		const providers = ["All", ...new Set(this.allModels.map((m) => m.provider))];
		this.providerDropdown.innerHTML = "";
		providers.forEach((provider) => {
			const option = this.providerDropdown.createEl("option", { text: provider });
			option.value = provider;
			this.providerDropdown.appendChild(option);
		});
		if (providers.includes(currentVal)) {
			this.providerDropdown.value = currentVal;
		}
	}

	private applyFiltersAndRender(): void {
		let models = [...this.allModels];

		if (this.selectedProvider !== "All") {
			models = models.filter((m) => m.provider === this.selectedProvider);
		}

		if (this.searchQuery) {
			models = models.filter(
				(m) =>
					m.name.toLowerCase().includes(this.searchQuery) ||
					m.provider.toLowerCase().includes(this.searchQuery),
			);
		}

		models.sort((a, b) => {
			if (a.isFavorite && !b.isFavorite) return -1;
			if (!a.isFavorite && b.isFavorite) return 1;

			const providerCompare = a.provider.localeCompare(b.provider);
			if (providerCompare !== 0) return providerCompare;

			return a.name.localeCompare(b.name);
		});

		this.filteredModels = models;
		this.populateProviderFilter();
		this.renderModelList();
	}

	private renderModelList(): void {
		this.modelListContainer.empty();
		if (this.filteredModels.length === 0) {
			this.modelListContainer.createEl("p", { text: "No models match your criteria." });
			return;
		}

		for (const model of this.filteredModels) {
			const modelEl = this.modelListContainer.createDiv({ cls: "tt-model-list-item" });
			if (model.isFavorite) modelEl.addClass("is-favorite");
			if (this.plugin.settings.selectedModelId === model.id) modelEl.addClass("is-selected");

			const infoEl = modelEl.createDiv({ cls: "tt-model-info" });
			infoEl.createEl("div", { text: model.name, cls: "tt-model-name" });

			if (model.description) {
				infoEl.createEl("div", {
					text: model.description,
					cls: "tt-model-description",
				});
				// Set hover tooltip on the entire list item for better UX
				modelEl.title = model.description;
			}

			infoEl.addEventListener("click", async () => {
				this.plugin.settings.selectedModelId = model.id;
				await this.plugin.updateTemperatureForModel(model.id);

				if (!this.plugin.favoritesService.isFavorite(model.id)) {
					await this.plugin.favoritesService.addFavorite(model);
				}
				this.close();
			});

			const actionsEl = modelEl.createDiv({ cls: "tt-model-actions" });
			const providerInfo = getProviderInfo(model.provider);
			actionsEl.createDiv({
				text: `${providerInfo.symbol} ${model.provider}`,
				cls: "tt-provider-tag",
			});

			const favButtonContainer = actionsEl.createDiv({
				cls: "tt-model-favorite-button-container",
			});
			new Setting(favButtonContainer)
				.addExtraButton((button) => {
					button
						.setIcon("star")
						.setTooltip(model.isFavorite ? "Remove from favorites" : "Add to favorites")
						.onClick(async () => {
							if (model.isFavorite) {
								await this.plugin.favoritesService.removeFavorite(model.id);
							} else {
								await this.plugin.favoritesService.addFavorite(model);
							}
							const modelInList = this.allModels.find((m) => m.id === model.id);
							if (modelInList) {
								modelInList.isFavorite = !modelInList.isFavorite;
							}
							this.applyFiltersAndRender();
						});
				})
				.settingEl.removeClass("setting-item"); // Remove default Setting styling
		}
	}
}
