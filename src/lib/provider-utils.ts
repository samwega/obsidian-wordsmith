// src/lib/provider-utils.ts
import { KNOWN_MODEL_HINTS, ModelTemperatureHint, UNKNOWN_MODEL_HINT } from "./settings-data";

export interface ProviderInfo {
	symbol: string;
	shortTag: string; // The short representation for the context panel button
}

// Keys are lowercase keywords to match against provider names
const PROVIDER_KEYWORD_MAP: Record<string, ProviderInfo> = {
	"ai studio": { symbol: "ⓖ", shortTag: "ⓖ" },
	google: { symbol: "ⓖ", shortTag: "ⓖ" },
	gemini: { symbol: "ⓖ", shortTag: "ⓖ" },
	openrouter: { symbol: "ⓡ", shortTag: "ⓡ" },
	openai: { symbol: "ⓞ", shortTag: "ⓞ" },
	anthropic: { symbol: "Ⓐ", shortTag: "Ⓐ" },
	ollama: { symbol: "🦙", shortTag: "🦙" },
	"lm studio": { symbol: "🅻🅼", shortTag: "🅻🅼" },
};

const DEFAULT_SYMBOL = "🤖";
const DEFAULT_PROVIDER_INFO: ProviderInfo = {
	symbol: DEFAULT_SYMBOL,
	shortTag: DEFAULT_SYMBOL,
};

/**
 * Gets display information for a given provider name by checking for keywords.
 * @param providerName The name of the provider.
 * @returns An object with the provider's symbol and short tag.
 */
export function getProviderInfo(providerName: string | null): ProviderInfo {
	if (!providerName) {
		return DEFAULT_PROVIDER_INFO;
	}

	const lowerProviderName = providerName.toLowerCase();

	// Find a key in the map that is a substring of the provider name
	for (const keyword in PROVIDER_KEYWORD_MAP) {
		if (lowerProviderName.includes(keyword)) {
			return PROVIDER_KEYWORD_MAP[keyword];
		}
	}

	// Fallback for custom names not matching any keyword
	return DEFAULT_PROVIDER_INFO;
}

/**
 * Finds the most specific temperature hint for a given model ID.
 * It searches for the longest key in KNOWN_MODEL_HINTS that is a substring of the model's apiId.
 * @param modelId The canonical model ID (e.g., 'ollama//llama3') or just the apiId ('llama3').
 * @returns The most specific ModelTemperatureHint, or the unknown hint if no match is found.
 */
export function getTemperatureHintForModel(modelId: string | null): ModelTemperatureHint {
	if (!modelId) {
		return UNKNOWN_MODEL_HINT;
	}

	// Extract the apiId, which is the part after '//' or the whole string if no '//' is present.
	const apiId = modelId.includes("//") ? modelId.split("//")[1] : modelId;

	const matchingKeys = Object.keys(KNOWN_MODEL_HINTS).filter((key) => apiId.includes(key));

	if (matchingKeys.length === 0) {
		return UNKNOWN_MODEL_HINT;
	}

	// Find the longest matching key to ensure specificity (e.g., 'gpt-4o' is chosen over 'gpt-4').
	const longestKey = matchingKeys.reduce((a, b) => (a.length > b.length ? a : b));

	return KNOWN_MODEL_HINTS[longestKey];
}
