// src/services/CustomProviderService.ts
import { Notice, RequestUrlParam, requestUrl } from "obsidian";
import type { CustomProvider, Model } from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";

// --- FIX: Make both `id` and `name` optional to handle different API responses ---
interface ApiModel {
	id?: string;
	name?: string;
	object?: string;
	created?: number;
	ownedBy?: string;
	contextLength?: number;
	description?: string;
}

interface GeminiModelListResponse {
	models: ApiModel[];
}

interface OpenAIModelListResponse {
	object: "list";
	data: ApiModel[];
}

export class CustomProviderService {
	private plugin: TextTransformer;

	constructor(plugin: TextTransformer) {
		this.plugin = plugin;
	}

	async testConnection(provider: CustomProvider): Promise<boolean> {
		try {
			const models = await this.fetchModels(provider);
			return models.length > 0;
		} catch (error) {
			console.error(`[WordSmith] Connection test failed for ${provider.name}:`, error);
			return false;
		}
	}

	async getModels(provider: CustomProvider): Promise<Model[]> {
		const apiModels = await this.fetchModels(provider);

		return apiModels.map((apiModel) => {
			// --- FIX: Robustly get the model identifier from either `id` or `name` ---
			const modelIdentifier = (apiModel.id || apiModel.name || "").replace(/^models\//, "");

			const model: Model = {
				id: `${provider.name}//${modelIdentifier}`,
				name: modelIdentifier,
				provider: provider.name,
				providerId: provider.id,
				isFavorite: false, // isFavorite is handled by FavoritesService
			};

			if (apiModel.contextLength !== undefined) {
				// Corrected casing
				model.contextLength = apiModel.contextLength; // Corrected casing
			}
			if (apiModel.description !== undefined) {
				model.description = apiModel.description;
			}
			// owned_by is not currently part of the Model interface, so no mapping for it here.

			return model;
		});
	}

	private async fetchModels(provider: CustomProvider): Promise<ApiModel[]> {
		if (!provider.endpoint) {
			throw new Error("Provider endpoint is not configured.");
		}

		const lowerProviderName = provider.name.toLowerCase();
		const isGeminiProvider =
			lowerProviderName.includes("google") ||
			lowerProviderName.includes("gemini") ||
			lowerProviderName.includes("ai studio");

		let requestUrlString: string;
		if (isGeminiProvider) {
			if (!provider.apiKey) {
				throw new Error("AI Studio (Gemini) provider requires an API key.");
			}
			requestUrlString = `${provider.endpoint}?key=${provider.apiKey}`;
		} else {
			requestUrlString = `${provider.endpoint}/models`;
		}

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (provider.apiKey && !isGeminiProvider) {
			headers.Authorization = `Bearer ${provider.apiKey}`;
		}

		// Add custom headers from provider settings
		if (provider.name.toLowerCase().includes("openrouter")) {
			headers["HTTP-Referer"] = this.plugin.manifest.id;
			headers["X-Title"] = this.plugin.manifest.name;
		}

		const requestParams: RequestUrlParam = {
			url: requestUrlString,
			method: "GET",
			headers: headers,
		};

		try {
			const response = await requestUrl(requestParams);

			if (isGeminiProvider) {
				const data: GeminiModelListResponse = response.json;
				if (!data || !Array.isArray(data.models)) {
					throw new Error("Invalid response format from Gemini model provider.");
				}
				return data.models;
			}
			// Handle non-OpenRouter, OpenAI-compatible model lists
			const data: OpenAIModelListResponse = response.json;
			if (!data || !Array.isArray(data.data)) {
				console.error(
					`[WordSmith] Unexpected response structure for OpenAI-compatible provider ${provider.name}:`,
					response.json,
				);
				throw new Error(
					`Unexpected response structure from ${provider.name}. Expected an array of models.`,
				);
			}
			return data.data;
		} catch (error) {
			const err = error as Error & { status?: number; message: string };
			let userMessage = `Failed to fetch models from ${provider.name}.`;

			if (err.status === 401) {
				userMessage += " Check your API key.";
			} else if (err.message.includes("net::ERR_NAME_NOT_RESOLVED")) {
				userMessage +=
					" Could not resolve the endpoint address. Is it correct and is the local server running?";
			} else {
				userMessage += " Check the endpoint URL and your network connection.";
			}

			console.error(
				`[WordSmith] Error fetching models from ${provider.name}: ${err.message}`,
				error,
			);
			new Notice(userMessage, 8000);
			logError(error);
			throw error;
		}
	}
}
