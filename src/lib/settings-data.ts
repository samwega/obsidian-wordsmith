// src/lib/settings-data.ts

/**
 * Represents the specification for a supported AI model.
 */
export interface ModelSpec {
	displayText: string;
	/** The unique ID required by the API provider. For OpenAI/Gemini, this matches the object key. For OpenRouter, it's their specific string. */
	apiId: string;
	maxOutputTokens: number;
	costPerMillionTokens: { input: number; output: number };
	info: {
		intelligence: number;
		speed: number;
		url: string;
	};
	minTemperature: number;
	maxTemperature: number;
	defaultModelTemperature: number;
}

export const MODEL_SPECS: Record<string, ModelSpec> = {
	// OpenAI models
	"gpt-4.1": {
		displayText: "GPT 4.1",
		apiId: "gpt-4.1",
		maxOutputTokens: 32_768, // Please verify this value
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 2,
			url: "https://platform.openai.com/docs/models/gpt-4.1",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4o": {
		displayText: "GPT-4o",
		apiId: "gpt-4o",
		maxOutputTokens: 16_384,
		costPerMillionTokens: { input: 5.0, output: 15.0 },
		info: {
			intelligence: 5,
			speed: 4,
			url: "https://platform.openai.com/docs/models/gpt-4o",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-mini": {
		displayText: "GPT 4.1 mini",
		apiId: "gpt-4.1-mini",
		maxOutputTokens: 32_768, // Please verify this value
		costPerMillionTokens: { input: 0.4, output: 1.6 },
		info: {
			intelligence: 3,
			speed: 3,
			url: "https://platform.openai.com/docs/models/gpt-4.1-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-nano": {
		displayText: "GPT 4.1 nano",
		apiId: "gpt-4.1-nano",
		maxOutputTokens: 32_768, // Please verify this value
		costPerMillionTokens: { input: 0.1, output: 0.4 },
		info: {
			intelligence: 2,
			speed: 4,
			url: "https://platform.openai.com/docs/models/gpt-4.1-nano",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"o4-mini": {
		displayText: "OpenAI o4-mini",
		apiId: "o4-mini-2025-04-16",
		maxOutputTokens: 100_000,
		costPerMillionTokens: { input: 1.1, output: 4.4 },
		info: {
			intelligence: 4,
			speed: 5,
			url: "https://platform.openai.com/docs/models/o4-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"o3-2025-04-16": {
		displayText: "OpenAI o3",
		apiId: "o3-2025-04-16",
		maxOutputTokens: 100_000, // Please verify this value
		costPerMillionTokens: { input: 10.0, output: 40.0 },
		info: {
			intelligence: 5,
			speed: 3,
			url: "https://platform.openai.com/docs/models/o3",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, // Verified
	},
	"gpt-4.5-preview-2025-02-27": {
		displayText: "GPT 4.5 Preview",
		apiId: "gpt-4.5-preview-2025-02-27",
		maxOutputTokens: 16_000, // Please verify this value
		costPerMillionTokens: { input: 75.0, output: 150.0 },
		info: {
			intelligence: 5,
			speed: 2,
			url: "https://platform.openai.com/docs/models/gpt-4.5-preview",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, // Verified
	},
	// Gemini models
	"gemini-2.5-flash-preview-05-20": {
		displayText: "Gemini 2.5 Flash",
		apiId: "gemini-2.5-flash-preview-05-20",
		maxOutputTokens: 67584,
		costPerMillionTokens: { input: 0.15, output: 0.6 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://ai.google.dev/models/gemini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.5-pro-preview-06-05": {
		displayText: "Gemini 2.5 Pro",
		apiId: "gemini-2.5-pro-preview-06-05",
		maxOutputTokens: 8192, // Please verify this value
		costPerMillionTokens: { input: 1.25, output: 10.0 },
		info: {
			intelligence: 5,
			speed: 3,
			url: "https://ai.google.dev/models/gemini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.0-flash-lite": {
		displayText: "Gemini 2.0 Flash-Lite",
		apiId: "gemini-2.0-flash-lite-001",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.075, output: 0.3 },
		info: {
			intelligence: 2,
			speed: 5,
			url: "https://ai.google.dev/models/gemini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemma-3-27b": {
		displayText: "Gemma 3 27B Free",
		apiId: "gemma-3-27b-it",
		maxOutputTokens: 8192, // Please verify this value
		costPerMillionTokens: { input: 0.15, output: 0.6 },
		info: {
			intelligence: 1,
			speed: 1,
			url: "https://ai.google.dev/models/gemini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	// OpenRouter Models
	"gpt-4.1-openrouter": {
		displayText: "ⓡGPT-4.1",
		apiId: "openai/gpt-4.1",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://openrouter.ai/models/openai/gpt-4.1",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4o-openrouter": {
		displayText: "ⓡGPT-4o",
		apiId: "openai/gpt-4o-2024-11-20",
		maxOutputTokens: 16384,
		costPerMillionTokens: { input: 2.5, output: 10.0 },
		info: {
			intelligence: 5,
			speed: 4,
			url: "https://openrouter.ai/openai/gpt-4o-2024-11-20",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-mini-openrouter": {
		displayText: "ⓡGPT-4.1 Mini",
		apiId: "openai/gpt-4.1-mini",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.4, output: 1.6 },
		info: {
			intelligence: 3,
			speed: 3,
			url: "https://openrouter.ai/models/openai/gpt-4.1-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-nano-openrouter": {
		displayText: "ⓡGPT-4.1 nano",
		apiId: "openai/gpt-4.1-nano",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.1, output: 0.4 },
		info: {
			intelligence: 2,
			speed: 4,
			url: "https://openrouter.ai/models/openai/gpt-4.1-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"o4-mini-openrouter": {
		displayText: "ⓡGPT o4-mini",
		apiId: "openai/o4-mini",
		maxOutputTokens: 100_000,
		costPerMillionTokens: { input: 1.1, output: 4.4 },
		info: {
			intelligence: 4,
			speed: 5,
			url: "https://openrouter.ai/models/openai/o4-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.5-flash-openrouter": {
		displayText: "ⓡGemini 2.5 Flash",
		apiId: "google/gemini-2.5-flash-preview-05-20",
		maxOutputTokens: 67584,
		costPerMillionTokens: { input: 0.15, output: 0.6 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://openrouter.ai/models/google/gemini-2.5-flash-preview-05-20",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.5-pro-openrouter": {
		displayText: "ⓡGemini 2.5 Pro",
		apiId: "google/gemini-2.5-pro-preview-06-05",
		maxOutputTokens: 67584,
		costPerMillionTokens: { input: 1.25, output: 10.0 },
		info: {
			intelligence: 5,
			speed: 3,
			url: "https://openrouter.ai/models/google/gemini-2.5-pro-preview-06-05",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.0-flash-lite-openrouter": {
		displayText: "ⓡGemini 2.0 Flash-Lite",
		apiId: "google/gemini-2.0-flash-lite-001",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.075, output: 0.3 },
		info: {
			intelligence: 2,
			speed: 5,
			url: "https://openrouter.ai/google/gemini-2.0-flash-lite-001",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemma-3-27b-openrouter": {
		displayText: "ⓡGemma 3 27B Free",
		apiId: "google/gemma-3-27b-it:free",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.0, output: 0.0 },
		info: {
			intelligence: 3,
			speed: 3,
			url: "https://openrouter.ai/google/gemma-3-27b-it:free",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"claude-3.5-sonnet-openrouter": {
		// A unique key for use within the plugin
		displayText: "ⓡClaude 3.5 Sonnet",
		apiId: "anthropic/claude-3.5-sonnet", // The EXACT ID from OpenRouter
		maxOutputTokens: 8192, // Please verify this value
		costPerMillionTokens: { input: 3.0, output: 15.0 },
		info: {
			intelligence: 4, // Your rating
			speed: 2, // Your rating
			url: "https://openrouter.ai/models/anthropic/claude-3.5-sonnet",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0, // Some models have different ranges
		defaultModelTemperature: 0.7,
	},
	// With this one:
	"claude-3.7-sonnet-openrouter": {
		displayText: "ⓡClaude 3.7 Sonnet",
		apiId: "anthropic/claude-3.7-sonnet",
		maxOutputTokens: 65_536,
		costPerMillionTokens: { input: 3.0, output: 15.0 },
		info: {
			intelligence: 5,
			speed: 2,
			url: "https://openrouter.ai/models/anthropic/claude-3.7-sonnet",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 0.7,
	},
	"grok-3-beta-openrouter": {
		displayText: "ⓡGrok 3",
		apiId: "x-ai/grok-3-beta",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 3.0, output: 15.0 },
		info: {
			intelligence: 4,
			speed: 2,
			url: "https://openrouter.ai/models/x-ai/grok-3-beta",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, // Checked
	},
	"deepseek-chat-v3-openrouter": {
		displayText: "ⓡDeepSeek v3",
		apiId: "deepseek/deepseek-chat-v3-0324",
		maxOutputTokens: 163_840,
		costPerMillionTokens: { input: 0.3, output: 0.88 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/deepseek/deepseek-chat-v3-0324",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0, // Checked
	},
	"deepseek-r1-openrouter": {
		displayText: "ⓡDeepSeek R1",
		apiId: "deepseek/deepseek-r1-0528",
		maxOutputTokens: 163_840, // 164K
		costPerMillionTokens: { input: 0.5, output: 2.15 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://openrouter.ai/models/deepseek/deepseek-r1-0528",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0, // Checked
	},
	"qwen3-235b-a22b-openrouter": {
		displayText: "ⓡQwen 3 235B",
		apiId: "qwen/qwen3-235b-a22b",
		maxOutputTokens: 41_072,
		costPerMillionTokens: { input: 0.14, output: 1.0 },
		info: {
			intelligence: 3,
			speed: 2,
			url: "https://openrouter.ai/models/x-ai/grok-3-beta",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, // Checked
	},
	"qwen3-32b-openrouter": {
		displayText: "ⓡQwen 3 32B",
		apiId: "qwen/qwen3-32b",
		maxOutputTokens: 41_072,
		costPerMillionTokens: { input: 0.1, output: 0.3 },
		info: {
			intelligence: 2,
			speed: 2,
			url: "https://openrouter.ai/models/x-ai/grok-3-beta",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, // Checked
	},
	"llama-3.3-70b-instruct-openrouter": {
		displayText: "ⓡLlama 3.3 70B",
		apiId: "meta-llama/llama-3.3-70b-instruct",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.1, output: 0.3 },
		info: {
			intelligence: 3,
			speed: 2,
			url: "https://openrouter.ai/meta-llama/llama-3.3-70b-instruct",
		},
		minTemperature: 0.0,
		maxTemperature: 5.0,
		defaultModelTemperature: 0.7, // Checked
	},
	"llama-3.1-405b-instruct-openrouter": {
		displayText: "ⓡLlama 3.1 405B",
		apiId: "meta-llama/llama-3.1-405b-instruct",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.8, output: 0.8 },
		info: {
			intelligence: 4,
			speed: 1,
			url: "https://openrouter.ai/meta-llama/llama-3.1-405b-instruct",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 0.7, // Checked
	},
	"llama-3.1-nemotron-ultra-253b-v1": {
		displayText: "ⓡLlama 3.1 NU 253B",
		apiId: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.6, output: 1.8 },
		info: {
			intelligence: 4,
			speed: 2,
			url: "https://openrouter.ai/meta-llama/llama-3.1-405b-instruct",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 0.0, // Checked
	},
	"hermes-3-70b-openrouter": {
		displayText: "ⓡHermes 3 70B",
		apiId: "nousresearch/hermes-3-llama-3.1-70b",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.12, output: 0.3 },
		info: {
			intelligence: 2,
			speed: 2,
			url: "https://openrouter.ai/models/nousresearch/hermes-3-llama-3.1-70b",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 0.7, //verified
	},
	"hermes-3-405b-openrouter": {
		displayText: "ⓡHermes 3 405B",
		apiId: "nousresearch/hermes-3-llama-3.1-405b",
		maxOutputTokens: 16384,
		costPerMillionTokens: { input: 0.7, output: 0.8 },
		info: {
			intelligence: 3,
			speed: 1,
			url: "https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 0.7, //verified
	},
	"goliath-120b-openrouter": {
		displayText: "ⓡGoliath 120B",
		apiId: "alpindale/goliath-120b",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 10.0, output: 12.5 },
		info: {
			intelligence: 2,
			speed: 1,
			url: "https://openrouter.ai/models/alpindale/goliath-120b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"magnum-72b-openrouter": {
		displayText: "ⓡMagnum 72B",
		apiId: "anthracite-org/magnum-v4-72b",
		maxOutputTokens: 16_384,
		costPerMillionTokens: { input: 2.5, output: 3.0 },
		info: {
			intelligence: 2,
			speed: 1,
			url: "https://openrouter.ai/anthracite-org/magnum-v4-72b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"skyfall-36b-v2-openrouter": {
		displayText: "ⓡSkyfall 36B V2",
		apiId: "thedrummer/skyfall-36b-v2",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.5, output: 0.8 },
		info: {
			intelligence: 1,
			speed: 2,
			url: "https://openrouter.ai/thedrummer/skyfall-36b-v2",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"valkyrie-49b-v1-openrouter": {
		displayText: "ⓡValkyrie 49B",
		apiId: "thedrummer/valkyrie-49b-v1",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.5, output: 0.8 },
		info: {
			intelligence: 3,
			speed: 2,
			url: "https://openrouter.ai/thedrummer/skyfall-36b-v2",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"anubis-pro-105b-v1-openrouter": {
		displayText: "ⓡAnubis 105B",
		apiId: "thedrummer/anubis-pro-105b-v1",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.8, output: 1.0 },
		info: {
			intelligence: 3,
			speed: 1,
			url: "https://openrouter.ai/thedrummer/anubis-pro-105b-v1",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"lumimaid-v0.2-70b-openrouter": {
		displayText: "ⓡLumimaid 70B",
		apiId: "neversleep/llama-3.1-lumimaid-70b",
		maxOutputTokens: 2048,
		costPerMillionTokens: { input: 2.5, output: 3.0 },
		info: {
			intelligence: 2,
			speed: 1,
			url: "https://openrouter.ai/models/neversleep/llama-3.1-lumimaid-70b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 0.7, //verified
	},
	"command-a-openrouter": {
		displayText: "ⓡCommand A",
		apiId: "cohere/command-a",
		maxOutputTokens: 8048,
		costPerMillionTokens: { input: 2.5, output: 10.0 },
		info: {
			intelligence: 3,
			speed: 3,
			url: "https://openrouter.ai/cohere/command-a",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0, // Verified
		defaultModelTemperature: 0.3,
	},
	"mistral-large-2411-openrouter": {
		displayText: "ⓡMistral Large 2411",
		apiId: "mistralai/mistral-large-2411",
		maxOutputTokens: 131_000,
		costPerMillionTokens: { input: 2.0, output: 6.0 },
		info: {
			intelligence: 3,
			speed: 2,
			url: "https://openrouter.ai/mistralai/mistral-large-2411",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Verified
		defaultModelTemperature: 0.7,
	},
};

export const OPENAI_MODELS = [
	"gpt-4.1",
	"gpt-4.1-mini",
	"gpt-4.1-nano",
	"gpt-4o",
	"o4-mini",
	"o3-2025-04-16",
	"gpt-4.5-preview-2025-02-27",
] as const;
export type OpenAiModels = (typeof OPENAI_MODELS)[number];

export const GEMINI_MODELS = [
	"gemini-2.5-flash-preview-05-20",
	"gemini-2.5-pro-preview-06-05",
	"gemini-2.0-flash-lite",
	"gemma-3-27b",
] as const;
export type GeminiModels = (typeof GEMINI_MODELS)[number];

export const OPENROUTER_MODELS = [
	"gpt-4.1-openrouter",
	"gpt-4.1-mini-openrouter",
	"gpt-4.1-nano-openrouter",
	"gpt-4o-openrouter",
	"o4-mini-openrouter",
	"gemini-2.5-flash-openrouter",
	"gemini-2.5-pro-openrouter",
	"gemini-2.0-flash-lite",
	"gemini-2.0-flash-lite-openrouter",
	"gemma-3-27b-openrouter",
	"claude-3.5-sonnet-openrouter",
	"claude-3.7-sonnet-openrouter",
	"grok-3-beta-openrouter",
	"deepseek-chat-v3-openrouter",
	"deepseek-r1-openrouter",
	"qwen3-235b-a22b",
	"qwen3-32b-openrouter",
	"llama-3.3-70b-instruct-openrouter",
	"llama-3.1-405b-instruct-openrouter",
	"llama-3.1-nemotron-ultra-253b-v1",
	"hermes-3-70b-openrouter",
	"hermes-3-405b-openrouter",
	"goliath-120b-openrouter",
	"magnum-72b-openrouter",
	"skyfall-36b-v2-openrouter",
	"anubis-pro-105b-v1-openrouter",
	"valkyrie-49b-v1-openrouter",
	"lumimaid-v0.2-70b-openrouter",
	"command-a-openrouter",
	"mistral-large-2411-openrouter",
] as const;
export type OpenRouterModels = (typeof OPENROUTER_MODELS)[number];

export type SupportedModels = OpenAiModels | GeminiModels | OpenRouterModels;
//──────────────────────────────────────────────────────────────────────────────

export interface TextTransformerPrompt {
	id: string;
	name: string;
	text: string;
	isDefault: boolean;
	enabled: boolean;
	model?: SupportedModels;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	frequency_penalty?: number;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	presence_penalty?: number;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	max_tokens?: number;
	showInPromptPalette?: boolean; // Made optional
}

export interface TextTransformerSettings {
	openAiApiKey: string;
	geminiApiKey: string;
	openRouterApiKey: string; // New API key
	model: SupportedModels;
	prompts: TextTransformerPrompt[];
	alwaysShowPromptSelection: boolean;
	dynamicContextLineCount: number;
	translationLanguage: string;
	longInputThreshold: number;
	veryLongInputThreshold: number;
	temperature: number;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	frequency_penalty: number;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	presence_penalty: number;
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	max_tokens: number;
	saveToClipboard: boolean;
}

export const DEFAULT_SETTINGS: Omit<TextTransformerSettings, "defaultPromptId" | "debugMode"> = {
	openAiApiKey: "",
	geminiApiKey: "",
	openRouterApiKey: "", // New default
	model: "gpt-4.1-nano",
	prompts: [],
	alwaysShowPromptSelection: false,
	dynamicContextLineCount: 3,
	translationLanguage: "English",
	longInputThreshold: 1500,
	veryLongInputThreshold: 15000,
	temperature: 1.0,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	frequency_penalty: 0,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	presence_penalty: 0,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	max_tokens: 2048,
	saveToClipboard: false,
};

// Note: defaultPromptId and debugMode were removed from DEFAULT_SETTINGS structure

export const DEFAULT_TEXT_TRANSFORMER_PROMPTS: TextTransformerPrompt[] = [
	{
		id: "improve",
		name: "Improve",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Masterfully refine the provided text, enhancing its style, clarity, readability, and language. Crucially, preserve the original meaning, technical jargon, and the author's unique voice and personal style. Implement structural changes only if they markedly improve flow or comprehension. Avoid unnecessary expansion or significant reformatting (e.g., no unwarranted lists). Strive for minimal alterations; if the text is already clear and concise, refrain from changes.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "shorten",
		name: "Shorten",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Shorten the following text while preserving its meaning and clarity.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "fix-grammar",
		name: "Fix grammar",
		text: "[AI ROLE]: Professional proofreader. \n[TASK]: Correct any grammatical, spelling, or punctuation errors in the following text.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "lengthen",
		name: "Lengthen",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Expand and elaborate the following text for greater detail and depth, but do not add unrelated information.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "structure",
		name: "Refine Structure",
		text: "[AI ROLE]: Expert editor.\n[TASK]: Refine the structure of the following text, in ways compatible with Obsidian Markdown (#headers, - bullet and 1. numbered lists, **bold**, *italics*, etc.)\n[RULE]: Make the minimal changes which  enhance comprehension;\n[RULE]: IMPORTANT: don't overdo it! Minimal is preferable.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "simplify-language",
		name: "Simplify language",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Rewrite the following text in simpler language, making it easier to understand while preserving the original meaning.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "mind-the-context",
		name: "Mind the Context!",
		text: "[AI ROLE]:  Professional editor.\n[TASK]: You will receive a text selection, and a context which may contain instructions or indications. Do to the text whatever the context says.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "enhance-readability",
		name: "Enhance readability",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Improve the readability and flow of the following text.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "flesh-out",
		name: "Flesh out",
		text: "[AI ROLE]: Masterful writer.\n[TASK]: You will receive a text. Expand and flesh out this sketch of an article, note, scene, or chapter. Don't be cheesy!",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "cleanup",
		name: "Cleanup Text/Chat",
		text: "[AI ROLE]: Professional proofreader.\n[TASK]: Turn the following text or conversation into something that would flow well if read by text-to-speech, but without changing the content and meaning. Clean up the text received, which MAY contain chat conversations. Remove timestamps. Multiple consecutive messages from one speaker can be concatenated it they makes sense as a single paragraph or sentence. Don't change what the speakers say, but you can clean up the syntax and punctuation, expanding an `ic`, an `idk`, etc. Preserve emojis and numerals. Don't add empty lines between messages.\n[CASE]: If it's a chat between at least two different names (& if date is present): write [### YYYY-MM-DD Conversation] as a title. Below the title, goes the cleaned up conversation.\n[CASE]: If there's only one speaker: do not add title/date, only write the [Name: ] once at the beginning of the first line.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "define",
		name: "Define",
		text: "[AI ROLE]: Master linguist.\n[TASK]: Add the definition(s) of the word (or expression) right next to it in the format 'word/expression [def: definition]'. If input text is not a single definable word or expression, say just <Error—SelectOneWordOrExpression>. Your output should be a single line of text.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "translate",
		name: `Translate to ${DEFAULT_SETTINGS.translationLanguage}—autodetects source language`, // Name will be dynamically updated in loadSettings
		text: "[AI ROLE]: Professional translator.\n [TASK]: Automatically detect language and translate the following text to {language}, preserving meaning, tone, format and style.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
];

// Assign DEFAULT_TEXT_TRANSFORMER_PROMPTS to DEFAULT_SETTINGS.prompts after definition
DEFAULT_SETTINGS.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => ({ ...p }));
