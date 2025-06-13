// src/lib/provider-utils.ts

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
