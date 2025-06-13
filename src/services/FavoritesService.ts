// src/services/FavoritesService.ts
import type { Model, TextTransformerSettings } from "../lib/settings-data";
import type TextTransformer from "../main";

export class FavoritesService {
	private plugin: TextTransformer;

	constructor(plugin: TextTransformer) {
		this.plugin = plugin;
	}

	private get settings(): TextTransformerSettings {
		return this.plugin.settings;
	}

	/**
	 * Adds a model to the user's favorites list.
	 * @param model The model to add.
	 */
	async addFavorite(model: Model): Promise<void> {
		if (this.isFavorite(model.id)) {
			return; // Already a favorite
		}
		this.settings.favoriteModels.push({
			providerId: model.providerId,
			modelId: model.id,
			addedAt: Date.now(),
		});
		await this.plugin.saveSettings();
	}

	/**
	 * Removes a model from the user's favorites list.
	 * @param modelId The canonical ID of the model to remove.
	 */
	async removeFavorite(modelId: string): Promise<void> {
		this.settings.favoriteModels = this.settings.favoriteModels.filter(
			(fav) => fav.modelId !== modelId,
		);
		await this.plugin.saveSettings();
	}

	/**
	 * Checks if a model is in the user's favorites.
	 * @param modelId The canonical ID of the model to check.
	 * @returns True if the model is a favorite, false otherwise.
	 */
	isFavorite(modelId: string): boolean {
		return this.settings.favoriteModels.some((fav) => fav.modelId === modelId);
	}

	/**
	 * Takes an array of models and returns a new array with the `isFavorite` flag correctly set on each.
	 * @param models The array of models to process.
	 * @returns A new array of models enriched with favorite status.
	 */
	enrichModelsWithFavorites(models: Model[]): Model[] {
		const favoriteIds = new Set(this.settings.favoriteModels.map((fav) => fav.modelId));
		return models.map((model) => ({
			...model,
			isFavorite: favoriteIds.has(model.id),
		}));
	}

	/**
	 * Filters a list of models to return only the favorites.
	 * @param allModels The complete list of models.
	 * @returns An array containing only the favorite models.
	 */
	getFavorites(allModels: Model[]): Model[] {
		const favoriteIds = new Set(this.settings.favoriteModels.map((fav) => fav.modelId));
		return allModels.filter((model) => favoriteIds.has(model.id));
	}
}
