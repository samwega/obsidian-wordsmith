// src/services/ModelService.ts
import type { Model } from "../lib/settings-data";
import type TextTransformer from "../main";
import { CustomProviderService } from "./CustomProviderService";

const MODEL_CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

export class ModelService {
	private plugin: TextTransformer;
	private customProviderService: CustomProviderService;
	private modelCache: Map<string, { timestamp: number; models: Model[] }>;

	constructor(plugin: TextTransformer) {
		this.plugin = plugin;
		this.customProviderService = new CustomProviderService(plugin);
		this.modelCache = new Map();
	}

	/**
	 * Retrieves all models from all enabled providers, using a cache.
	 * @param forceRefresh If true, bypasses the cache and fetches fresh data.
	 * @returns A promise that resolves to a unified array of all available models.
	 */
	async getModels(forceRefresh = false): Promise<Model[]> {
		const allModels: Model[] = [];
		const enabledProviders = this.plugin.settings.customProviders.filter((p) => p.isEnabled);

		const fetchPromises = enabledProviders.map(async (provider) => {
			const cacheEntry = this.modelCache.get(provider.id);
			const now = Date.now();

			if (!forceRefresh && cacheEntry && now - cacheEntry.timestamp < MODEL_CACHE_DURATION_MS) {
				return cacheEntry.models;
			}

			try {
				const models = await this.customProviderService.getModels(provider);
				this.modelCache.set(provider.id, { timestamp: now, models });
				return models;
			} catch (_error) {
				console.error(`[WordSmith] Failed to get models for provider ${provider.name}.`);
				// Return models from cache if available, even if stale, on error
				return cacheEntry?.models || [];
			}
		});

		const results = await Promise.all(fetchPromises);
		for (const modelList of results) {
			allModels.push(...modelList);
		}

		return allModels;
	}

	/**
	 * Clears the entire model cache.
	 */
	clearCache(): void {
		this.modelCache.clear();
	}
}
