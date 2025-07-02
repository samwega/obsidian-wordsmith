// src/ui/modals/ModelSelectionModal.ts
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent } from "obsidian";
import { getProviderInfo } from "../../lib/provider-utils";
import type { Model } from "../../lib/settings-data";
import type TextTransformer from "../../main";

const ITEM_HEIGHT = 56; // The fixed height of a single model item in pixels
const VISIBLE_ITEMS_BUFFER = 5; // Render a few extra items above/below the viewport

export class ModelSelectionModal extends Modal {
	private plugin: TextTransformer;
	private allModels: Model[] = [];
	private filteredModels: Model[] = [];
	private selectedProvider = "All";
	private searchQuery = "";

	// --- UI Elements ---
	private providerDropdown!: HTMLSelectElement;
	private searchInput!: TextComponent;
	private searchDebounceTimer: number | null = null;
	private isPopulatingFilter = false;

	// --- Virtualization Elements ---
	private listContainerEl!: HTMLDivElement;
	private listSizerEl!: HTMLDivElement;
	private listItemsEl!: HTMLDivElement;
	private isScrolling = false;

	constructor(app: App, plugin: TextTransformer) {
		super(app);
		this.plugin = plugin;
	}

	override onOpen(): void {
		this.modalEl.addClass("tt-model-selection-modal");
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Browse models" });

		this.renderFilters(contentEl);
		this.setupVirtualList(contentEl);

		window.setTimeout(() => {
			this.searchInput?.inputEl.focus();
		}, 0);

		this.listItemsEl.createEl("p", { text: "Fetching models..." });

		this.loadAndRenderModels();
	}

	private setupVirtualList(container: HTMLElement): void {
		this.listContainerEl = container.createDiv({ cls: "tt-virtual-list-container" });
		this.listSizerEl = this.listContainerEl.createDiv({ cls: "tt-virtual-list-sizer" });
		this.listItemsEl = this.listContainerEl.createDiv({ cls: "tt-virtual-list-items" });

		this.listContainerEl.addEventListener("scroll", () => {
			if (!this.isScrolling) {
				window.requestAnimationFrame(() => {
					this.renderVisibleItems();
					this.isScrolling = false;
				});
				this.isScrolling = true;
			}
		});
	}

	private async loadAndRenderModels(): Promise<void> {
		try {
			this.allModels = await this.plugin.modelService.getModels();
			this.allModels = this.plugin.favoritesService.enrichModelsWithFavorites(this.allModels);
			this.populateProviderFilter();
			this.applyFiltersAndRender();
		} catch (error) {
			console.error("[WordSmith] Error fetching models for modal:", error);
			this.listItemsEl.empty();
			this.listItemsEl.setText("Failed to load models. Check your provider settings.");
		}
	}

	private renderFilters(container: HTMLElement): void {
		const filterContainer = container.createDiv({ cls: "tt-model-filters" });
		const filterGrid = filterContainer.createDiv({ cls: "tt-model-filters-grid" });

		const providerFilterSetting = new Setting(filterGrid).setName("Filter by provider");

		const searchSetting = new Setting(filterGrid).setName("Search").addText((text) => {
			this.searchInput = text;
			text.setPlaceholder("e.g., Llama, GPT, OpenRouter...").onChange((value) => {
				if (this.searchDebounceTimer) {
					window.clearTimeout(this.searchDebounceTimer);
				}
				this.searchDebounceTimer = window.setTimeout(() => {
					this.searchQuery = value.toLowerCase();
					this.applyFiltersAndRender();
				}, 200);
			});
			text.inputEl.addClass("tt-model-search-input");
		});
		searchSetting.settingEl.addClass("tt-model-filter-item");

		this.providerDropdown = providerFilterSetting.controlEl.createEl("select");
		this.providerDropdown.addClass("dropdown");
		this.providerDropdown.onchange = (e: Event): void => {
			if (this.isPopulatingFilter) return;
			this.selectedProvider = (e.target as HTMLSelectElement).value;
			this.applyFiltersAndRender();
		};
		providerFilterSetting.settingEl.addClass("tt-model-filter-item");

		const refreshButtonWrapper = filterContainer.createDiv({ cls: "tt-refresh-button-wrapper" });
		new ButtonComponent(refreshButtonWrapper)
			.setButtonText("Refresh model list")
			.setTooltip("Bypass cache and fetch the latest models from all providers")
			.onClick(async () => {
				const notice = new Notice("Refreshing model list...", 0);
				// Show loading state *inside* the virtual list structure
				this.listItemsEl.empty();
				this.listSizerEl.style.height = "0px";
				this.listItemsEl.createEl("p", { text: "Refreshing..." });
				try {
					this.allModels = await this.plugin.modelService.getModels(true);
					this.allModels = this.plugin.favoritesService.enrichModelsWithFavorites(
						this.allModels,
					);
					this.populateProviderFilter();
					this.applyFiltersAndRender();
					notice.setMessage("✅ Models refreshed.");
					window.setTimeout(() => notice.hide(), 2000);
				} catch (error) {
					console.error("[WordSmith] Error refreshing models:", error);
					this.listItemsEl.empty();
					this.listItemsEl.setText("Failed to refresh models.");
					notice.setMessage("Failed to refresh models.");
					window.setTimeout(() => notice.hide(), 3000);
				}
			});
	}

	private populateProviderFilter(): void {
		this.isPopulatingFilter = true;
		try {
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
		} finally {
			this.isPopulatingFilter = false;
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

		// Reset scroll and render the initial visible items
		this.listContainerEl.scrollTop = 0;
		this.renderVisibleItems();
	}

	private renderVisibleItems(): void {
		const totalItems = this.filteredModels.length;
		this.listSizerEl.style.height = `${totalItems * ITEM_HEIGHT}px`;

		// Always clear the currently rendered items before adding new ones
		this.listItemsEl.empty();

		if (totalItems === 0) {
			this.listItemsEl.createEl("p", { text: "No models match your criteria." });
			return;
		}

		const containerHeight = this.listContainerEl.clientHeight;
		const scrollTop = this.listContainerEl.scrollTop;

		const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - VISIBLE_ITEMS_BUFFER);
		const endIndex = Math.min(
			totalItems,
			Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + VISIBLE_ITEMS_BUFFER,
		);

		this.listItemsEl.style.transform = `translateY(${startIndex * ITEM_HEIGHT}px)`;

		for (let i = startIndex; i < endIndex; i++) {
			const model = this.filteredModels[i];
			const modelEl = this._renderItem(model);
			this.listItemsEl.appendChild(modelEl);
		}
	}

	private _renderItem(model: Model): HTMLElement {
		const modelEl = document.createElement("div");
		modelEl.className = "tt-model-list-item";
		if (model.isFavorite) modelEl.addClass("is-favorite");
		if (this.plugin.settings.selectedModelId === model.id) modelEl.addClass("is-selected");

		const infoEl = modelEl.createDiv({ cls: "tt-model-info" });
		infoEl.createEl("div", { text: model.name, cls: "tt-model-name" });

		if (model.description) {
			infoEl.createEl("div", {
				text: model.description,
				cls: "tt-model-description",
			});
			modelEl.title = model.description;
		}

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
			.addButton((button) => {
				button
					.setIcon("star")
					.setTooltip(model.isFavorite ? "Remove from favorites" : "Add to favorites")
					.onClick(async (evt: MouseEvent) => {
						evt.stopPropagation();
						if (model.isFavorite) {
							await this.plugin.favoritesService.removeFavorite(model.id);
						} else {
							await this.plugin.favoritesService.addFavorite(model);
						}
						const modelInAllModels = this.allModels.find((m) => m.id === model.id);
						if (modelInAllModels) {
							modelInAllModels.isFavorite = !modelInAllModels.isFavorite;
						}
						this.applyFiltersAndRender();
					});
			})
			.settingEl.removeClass("setting-item");

		modelEl.addEventListener("click", async () => {
			this.plugin.settings.selectedModelId = model.id;
			await this.plugin.updateTemperatureForModel(model.id);
			if (!this.plugin.favoritesService.isFavorite(model.id)) {
				await this.plugin.favoritesService.addFavorite(model);
			}
			this.close();
		});

		return modelEl;
	}

	override onClose(): void {
		super.onClose();
		if (this.searchDebounceTimer) {
			window.clearTimeout(this.searchDebounceTimer);
		}
	}
}
