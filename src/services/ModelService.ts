// src/services/ModelService.ts
import type { CustomProvider, Model } from "../lib/settings-data";
import type TextTransformer from "../main";
import { CustomProviderService } from "./CustomProviderService";

const MODEL_CACHE_DURATION_MS = 1000 * 60 * 60 * 12; // 12 hours

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
	 * Retrieves all models from all enabled providers.
	 * For normal calls, it uses a "stale-while-revalidate" caching strategy:
	 * - Returns cached data instantly (even if stale).
	 * - If data is stale (>12 hours), triggers a non-blocking background refresh.
	 * For forced refreshes, it performs a blocking fetch to get the latest data.
	 * @param forceRefresh If true, bypasses the cache and fetches fresh data, blocking until complete.
	 * @returns A promise that resolves to a unified array of available models.
	 */
	async getModels(forceRefresh = false): Promise<Model[]> {
		// --- Blocking fetch for explicit "Refresh" button action ---
		if (forceRefresh) {
			const allModels: Model[] = [];
			const enabledProviders = this.plugin.settings.customProviders.filter((p) => p.isEnabled);

			const fetchPromises = enabledProviders.map(async (provider) => {
				try {
					const models = await this.customProviderService.getModels(provider);
					this.modelCache.set(provider.id, { timestamp: Date.now(), models });
					return models;
				} catch (_error) {
					// Error is logged within the service.
					return [];
				}
			});

			const results = await Promise.all(fetchPromises);
			for (const modelList of results) {
				allModels.push(...modelList);
			}
			return allModels;
		}

		// --- "Stale-while-revalidate" for normal modal opening ---
		const cachedModels: Model[] = [];
		const providersToRefresh: CustomProvider[] = [];
		const now = Date.now();
		const enabledProviders = this.plugin.settings.customProviders.filter((p) => p.isEnabled);

		for (const provider of enabledProviders) {
			const cacheEntry = this.modelCache.get(provider.id);
			if (cacheEntry) {
				cachedModels.push(...cacheEntry.models);
			}

			// If cache is missing or stale, queue for a background refresh.
			if (!cacheEntry || now - cacheEntry.timestamp > MODEL_CACHE_DURATION_MS) {
				providersToRefresh.push(provider);
			}
		}

		if (providersToRefresh.length > 0) {
			// This is a "fire-and-forget" promise. We don't await it.
			(async () => {
				if (this.plugin.runtimeDebugMode) {
					const providerNames = providersToRefresh.map((p) => p.name).join(", ");
					console.log(`[WordSmith] Background refreshing models for: ${providerNames}`);
				}

				const refreshPromises = providersToRefresh.map(async (provider) => {
					try {
						const models = await this.customProviderService.getModels(provider);
						this.modelCache.set(provider.id, { timestamp: Date.now(), models });
					} catch (error) {
						// Errors are logged in the service. This just prevents the background task from crashing.
						console.error(
							`[WordSmith] Background refresh for ${provider.name} failed.`,
							error,
						);
					}
				});

				await Promise.allSettled(refreshPromises);

				if (this.plugin.runtimeDebugMode) {
					console.log("[WordSmith] Background model refresh process finished.");
				}
			})();
		}

		// Return the instantly available cached models.
		return Promise.resolve(cachedModels);
	}

	/**
	 * Gets all cached models without triggering any network requests.
	 * @returns Array of cached models from all providers
	 */
	getCachedModels(): Model[] {
		const allModels: Model[] = [];
		for (const cacheEntry of this.modelCache.values()) {
			allModels.push(...cacheEntry.models);
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
