// src/lib/settings-data.ts

// --- Internal Model Object Structure (in memory) ---
export interface Model {
	id: string;
	name: string;
	provider: string; // The provider's display name
	providerId: string; // The provider's unique ID (from CustomProvider.id)
	description?: string;
	contextLength?: number;
	maxOutputTokens?: number; // Maximum output tokens for this model
	isFavorite?: boolean; // Enriched by FavoritesService
}

// --- Custom Provider Structure ---
export interface CustomProvider {
	id: string; // A unique identifier, e.g., "custom-provider-162..."
	name: string; // User-defined name, e.g., "OpenRouter"
	endpoint: string; // API base URL, e.g., "https://openrouter.ai/api/v1"
	apiKey: string; // The user's API key (can be empty for some local providers)
	isEnabled: boolean; // Whether this provider is active
}

// --- Favorite Model Structure (in settings) ---
export interface FavoriteModel {
	providerId: string; // The ID of the provider, e.g., "custom-provider-162..."
	modelId: string; // The canonical model ID, e.g., "openrouter//cohere/command-a"
	addedAt: number; // Timestamp of when it was favorited
}

export interface TextTransformerPrompt {
	id: string;
	name: string;
	text: string;
	isDefault: boolean;
	enabled: boolean;
	showInPromptPalette?: boolean;
}

// --- Temperature Hint Structure ---
export interface ModelTemperatureHint {
	min: number;
	max: number;
	default: number;
}

/**
 * Default temperature settings for models without a specific hint.
 */
export const UNKNOWN_MODEL_HINT: ModelTemperatureHint = {
	min: 0.0,
	max: 2.0,
	default: 0.7,
};

export const KNOWN_MODEL_HINTS: Record<string, ModelTemperatureHint> = {
	// --- NOTE: Keys are substrings. The system finds the LONGEST matching key for a given model ID. ---
	// --- This allows for broad matching (e.g., 'claude-3.5' matches 'anthropic/claude-3.5-sonnet'). ---

	// Anthropic
	claude: { min: 0.0, max: 1.0, default: 1.0 },
	"claude-sonnet-4": { min: 0.0, max: 1.0, default: 0.8 },
	"claude-opus": { min: 0.0, max: 1.0, default: 0.8 },

	// Google
	gemini: { min: 0.0, max: 2.0, default: 0.7 },
	gemma: { min: 0.0, max: 2.0, default: 1.0 },

	// OpenAI
	"gpt-4": { min: 0.0, max: 2.0, default: 0.7 },
	"gpt-4o": { min: 0.0, max: 2.0, default: 0.8 },
	"o4-mini": { min: 0.0, max: 2.0, default: 0.7 },
	o3: { min: 0.0, max: 2.0, default: 0.7 },

	// Meta
	"llama-4-maverick": { min: 0.0, max: 2.0, default: 0.65 },
	"llama-4-scout": { min: 0.0, max: 2.0, default: 0.7 },
	"llama-3.3-70b-instruct": { min: 0.0, max: 5.0, default: 0.7 },
	"llama-3.1-405b-instruct": { min: 0.0, max: 2.0, default: 0.9 },

	// Mistral
	"mistral-large-2411": { min: 0.0, max: 2.0, default: 0.85 },
	"mistral-large-2407": { min: 0.0, max: 2.0, default: 0.35 },
	magistral: { min: 0.0, max: 2.0, default: 0.7 },

	// Cohere
	"command-a": { min: 0.0, max: 2.0, default: 0.7 },
	"command-r": { min: 0.0, max: 2.0, default: 0.85 },

	// Other popular models by keyword
	grok: { min: 0.0, max: 2.0, default: 1.0 },
	"deepseek-chat-v3": { min: 0.0, max: 2.0, default: 0.3 },
	"deepseek-r1": { min: 0.0, max: 2.0, default: 0.6 },
	qwen: { min: 0.0, max: 2.0, default: 0.7 },
	"eva-qwen-2.5-72b": { min: 0.0, max: 2.0, default: 0.8 },
	"eva-llama-3.33-70b": { min: 0.0, max: 2.0, default: 1.0 },
	"3.1-nemotron-70b": { min: 0.0, max: 2.0, default: 0.8 }, // `nemotron-ultra` will match this
	"3.1-nemotron-ultra": { min: 0.0, max: 2.0, default: 0.6 },
	"3.3-nemotron-super": { min: 0.0, max: 2.0, default: 0.6 },
	"hermes-3-llama-3.1-70b": { min: 0.0, max: 2.0, default: 0.9 },
	"hermes-3-llama-3.1-405b": { min: 0.0, max: 2.0, default: 0.8 },
	"magnum-v4-72b": { min: 0.0, max: 2.0, default: 0.9 },
	skyfall: { min: 0.0, max: 2.0, default: 0.8 },
	valkyrie: { min: 0.0, max: 2.0, default: 0.7 },
	anubis: { min: 0.0, max: 2.0, default: 0.75 },
	"llama-3.1-lumimaid": { min: 0.0, max: 2.0, default: 0.85 },
	"llama-3-lumimaid-70b": { min: 0.0, max: 2.0, default: 1.05 },
	goliath: { min: 0.0, max: 2.0, default: 0.85 },
	"sorcererlm-8x22b": { min: 0.0, max: 2.0, default: 1.0 },
	"wizardlm-2-8x22b": { min: 0.0, max: 2.0, default: 1.0 },
	"mercury-coder-small-beta": { min: 0.0, max: 2.0, default: 0.7 },
	euryale: { min: 0.0, max: 2.0, default: 1.1 },
	"deephermes-3-mistral-24b": { min: 0.0, max: 2.0, default: 0.25 },
};

// --- Core Settings Structure ---
export interface TextTransformerSettings {
	// API Keys and provider settings
	customProviders: CustomProvider[];

	// Model selection and management
	selectedModelId: string; // Canonical ID, e.g., "ollama//llama3"
	favoriteModels: FavoriteModel[];

	// LLM parameters
	temperature: number;
	// OpenAI API requires snake_case
	max_tokens: number;

	// Prompt management
	prompts: TextTransformerPrompt[];
	generationPrompts: TextTransformerPrompt[];
	alwaysShowPromptSelection: boolean;
	translationLanguage: string;
	saveToClipboard: boolean;

	// Context Panel State
	useWholeNoteContext: boolean;
	useCustomContext: boolean;
	useDynamicContext: boolean;
	useHeaderContext: boolean;
	dynamicContextLineCount: number;
	customContextText: string;

	// Knowledge Graph
	graphAssetPath: string;

	// Legacy - to be removed/ignored on load
	openAiApiKey?: string;
	geminiApiKey?: string;
	openRouterApiKey?: string;
	model?: string;
}

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
		name: "Refine structure",
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
		name: "Do context tasks",
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
		name: "Cleanup text/chat",
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
		name: "Translate to English—autodetects source language", // Will be dynamically updated
		text: "[AI ROLE]: Professional translator.\n [TASK]: Automatically detect language and translate the following text to {language}, preserving meaning, tone, format and style.",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
];

export const DEFAULT_SETTINGS: TextTransformerSettings = {
	customProviders: [],
	selectedModelId: "",
	favoriteModels: [],
	temperature: 1.0,
	// OpenAI API requires snake_case
	max_tokens: 8192,

	prompts: JSON.parse(JSON.stringify(DEFAULT_TEXT_TRANSFORMER_PROMPTS)),
	generationPrompts: [],
	alwaysShowPromptSelection: false,
	translationLanguage: "English",
	saveToClipboard: false,

	useWholeNoteContext: false,
	useCustomContext: false,
	useDynamicContext: false,
	useHeaderContext: false,
	dynamicContextLineCount: 3,
	customContextText: "",

	graphAssetPath: "WordSmith/graphs",
};
