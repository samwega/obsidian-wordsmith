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
	"gpt-4.1": {
		displayText: "GPT 4.1",
		apiId: "gpt-4.1",
		maxOutputTokens: 32_768, // Please verify this value
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://platform.openai.com/docs/models/gpt-4.1",
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
			speed: 4,
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
			speed: 5,
			url: "https://platform.openai.com/docs/models/gpt-4.1-nano",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4o": {
		displayText: "GPT-4o",
		apiId: "openai/gpt-4o-2024-11-20",
		maxOutputTokens: 4096,
		costPerMillionTokens: { input: 5.0, output: 15.0 },
		info: {
			intelligence: 5,
			speed: 5,
			url: "https://platform.openai.com/docs/models/gpt-4o",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	// Gemini models
	"gemini-2.5-flash-preview-05-20": {
		displayText: "Gemini 2.5 Flash",
		apiId: "gemini-2.5-flash-preview-05-20",
		maxOutputTokens: 8192, // Please verify this value
		costPerMillionTokens: { input: 0.15, output: 0.6 },
		info: {
			intelligence: 3,
			speed: 5,
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
			intelligence: 4,
			speed: 4,
			url: "https://ai.google.dev/models/gemini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	// OpenRouter Models
	"gpt-4.1-openrouter": {
		displayText: "GPT-4.1 (OR)",
		apiId: "openai/gpt-4.1",
		maxOutputTokens: 33792,
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/openai/gpt-4.1",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-mini-openrouter": {
		displayText: "GPT-4.1 Mini (OR)",
		apiId: "openai/gpt-4.1-mini",
		maxOutputTokens: 33792,
		costPerMillionTokens: { input: 0.4, output: 1.6 },
		info: {
			intelligence: 3,
			speed: 5,
			url: "https://openrouter.ai/models/openai/gpt-4.1-mini",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4.1-nano-openrouter": {
		displayText: "GPT-4.1 Nano (OR)",
		apiId: "openai/gpt-4.1-nano",
		maxOutputTokens: 33792,
		costPerMillionTokens: { input: 0.1, output: 0.4 },
		info: {
			intelligence: 2,
			speed: 5,
			url: "https://openrouter.ai/models/openai/gpt-4.1-nano",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gpt-4o-openrouter": {
		displayText: "GPT-4o (OR)",
		apiId: "openai/gpt-4o-2024-11-20",
		maxOutputTokens: 16384,
		costPerMillionTokens: { input: 2.5, output: 10.0 },
		info: {
			intelligence: 5,
			speed: 5,
			url: "https://openrouter.ai/openai/gpt-4o-2024-11-20",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.5-flash-openrouter": {
		displayText: "Gemini 2.5 Flash (OR)",
		apiId: "google/gemini-2.5-flash-preview-05-20",
		maxOutputTokens: 67584,
		costPerMillionTokens: { input: 0.15, output: 0.6 },
		info: {
			intelligence: 3,
			speed: 5,
			url: "https://openrouter.ai/models/google/gemini-2.5-flash-preview-05-20",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"gemini-2.5-pro-openrouter": {
		displayText: "Gemini 2.5 Pro (OR)",
		apiId: "google/gemini-2.5-pro-preview-06-05",
		maxOutputTokens: 67584,
		costPerMillionTokens: { input: 1.25, output: 10.0 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/google/gemini-2.5-pro-preview-06-05",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"anthropic-claude-3.5-sonnet": {
		// A unique key for use within the plugin
		displayText: "3.5 Sonnet (OR)",
		apiId: "anthropic/claude-3.5-sonnet", // The EXACT ID from OpenRouter
		maxOutputTokens: 8192, // Please verify this value
		costPerMillionTokens: { input: 3.0, output: 15.0 },
		info: {
			intelligence: 4, // Your rating
			speed: 4, // Your rating
			url: "https://openrouter.ai/models/anthropic/claude-3.5-sonnet",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0, // Some models have different ranges
		defaultModelTemperature: 1.0,
	},
	// With this one:
	"claude-3.7-sonnet": {
		displayText: "3.7 Sonnet (OR)",
		apiId: "anthropic/claude-3.7-sonnet",
		maxOutputTokens: 65_536,
		costPerMillionTokens: { input: 3.0, output: 15.0 },
		info: {
			intelligence: 5,
			speed: 5,
			url: "https://openrouter.ai/models/anthropic/claude-3.7-sonnet",
		},
		minTemperature: 0.0,
		maxTemperature: 1.0,
		defaultModelTemperature: 1.0,
	},
	"deepseek-chat-v3": {
		displayText: "DeepSeek v3",
		apiId: "deepseek/deepseek-chat-v3-0324",
		maxOutputTokens: 32_768, // Please verify this value
		costPerMillionTokens: { input: 0.3, output: 0.88 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/deepseek/deepseek-chat-v3-0324",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"deepseek-r1": {
		displayText: "DeepSeek R1 (OR)",
		apiId: "deepseek/deepseek-r1-0528",
		maxOutputTokens: 163_840, // 164K
		costPerMillionTokens: { input: 0.5, output: 2.15 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/deepseek/deepseek-r1-0528",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"hermes-3-70b": {
		displayText: "Hermes 3 70B (OR)",
		apiId: "nousresearch/hermes-3-llama-3.1-70b",
		maxOutputTokens: 131_072,
		costPerMillionTokens: { input: 0.12, output: 0.3 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://openrouter.ai/models/nousresearch/hermes-3-llama-3.1-70b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"hermes-3-405b": {
		displayText: "Hermes 3 405B (OR)",
		apiId: "nousresearch/hermes-3-llama-3.1-405b",
		maxOutputTokens: 16384,
		costPerMillionTokens: { input: 0.7, output: 0.8 },
		info: {
			intelligence: 5,
			speed: 2,
			url: "https://openrouter.ai/nousresearch/hermes-3-llama-3.1-405b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0,
		defaultModelTemperature: 1.0,
	},
	"goliath-120b": {
		displayText: "Goliath 120B (OR)",
		apiId: "alpindale/goliath-120b",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 1.8, output: 1.8 },
		info: {
			intelligence: 4,
			speed: 2,
			url: "https://openrouter.ai/models/alpindale/goliath-120b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"magnum-72b": {
		displayText: "Magnum 72B (OR)",
		apiId: "anthracite-org/magnum-v4-72b",
		maxOutputTokens: 16_384,
		costPerMillionTokens: { input: 1.2, output: 1.2 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://openrouter.ai/anthracite-org/magnum-v4-72b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"skyfall-36b-v2": {
		displayText: "Skyfall 36B V2 (OR)",
		apiId: "thedrummer/skyfall-36b-v2",
		maxOutputTokens: 16_384,
		costPerMillionTokens: { input: 0.9, output: 0.9 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://openrouter.ai/thedrummer/skyfall-36b-v2",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"lumimaid-v0.2-70b": {
		displayText: "Lumimaid v0.2 70B (OR)",
		apiId: "neversleep/llama-3.1-lumimaid-70b",
		maxOutputTokens: 2048,
		costPerMillionTokens: { input: 2.5, output: 3.0 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://openrouter.ai/models/neversleep/llama-3.1-lumimaid-70b",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
	"gemma-3-27b": {
		displayText: "Gemma 3 27B Free (OR)",
		apiId: "google/gemma-3-27b-it:free",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.0, output: 0.0 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://openrouter.ai/google/gemma-3-27b-it:free",
		},
		minTemperature: 0.0,
		maxTemperature: 2.0, // Please verify this value
		defaultModelTemperature: 1.0,
	},
};

export type OpenAiModels = "gpt-4o" | "gpt-4.1" | "gpt-4.1-mini" | "gpt-4.1-nano";

export type GeminiModels = "gemini-2.5-pro-preview-06-05" | "gemini-2.5-flash-preview-05-20";

export type OpenRouterModels =
	| "gpt-4o-openrouter"
	| "gpt-4.1-openrouter"
	| "gpt-4.1-mini-openrouter"
	| "gpt-4.1-nano-openrouter"
	| "gemini-2.5-flash-openrouter"
	| "gemini-2.5-pro-openrouter"
	| "claude-3.5-sonnet"
	| "claude-3.7-sonnet"
	| "deepseek-chat-v3"
	| "deepseek-r1"
	| "hermes-3-70b"
	| "hermes-3-405b"
	| "goliath-120b"
	| "magnum-72b"
	| "lumimaid-v0.2-70b"
	| "skyfall-36b-v2"
	| "gemma-3-27b";

export type SupportedModels = OpenAiModels | GeminiModels | OpenRouterModels;

export const GEMINI_MODEL_ID_MAP: Record<string, string> = {
	"gemini-2.5-pro": "gemini-2.5-pro-preview-06-05",
	"gemini-2.5-flash": "gemini-2.5-flash-preview-05-20",
	"gemini-2.5-pro-preview-06-05": "gemini-2.5-pro-preview-06-05",
	"gemini-2.5-flash-preview-05-20": "gemini-2.5-flash-preview-05-20",
};
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
