// src/settings-data.ts
export const MODEL_SPECS = {
	"gpt-4.1": {
		displayText: "GPT 4.1",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 2.0, output: 8.0 },
		info: {
			intelligence: 4,
			speed: 3,
			url: "https://platform.openai.com/docs/models/gpt-4.1",
		},
	},
	"gpt-4.1-mini": {
		displayText: "GPT 4.1 mini",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.4, output: 1.6 },
		info: {
			intelligence: 3,
			speed: 4,
			url: "https://platform.openai.com/docs/models/gpt-4.1-mini",
		},
	},
	"gpt-4.1-nano": {
		displayText: "GPT 4.1 nano",
		maxOutputTokens: 32_768,
		costPerMillionTokens: { input: 0.1, output: 0.4 },
		info: {
			intelligence: 2,
			speed: 5,
			url: "https://platform.openai.com/docs/models/gpt-4.1-nano",
		},
	},
	// Gemini models
	"gemini-2.5-flash-preview-04-17": {
		displayText: "Gemini 2.5 Flash",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 0.5, output: 1.5 },
		info: {
			intelligence: 3,
			speed: 5,
			url: "https://ai.google.dev/models/gemini",
		},
	},
	"gemini-2.5-pro-preview-05-06": {
		displayText: "Gemini 2.5 Pro",
		maxOutputTokens: 8192,
		costPerMillionTokens: { input: 3.5, output: 10.5 },
		info: {
			intelligence: 4,
			speed: 4,
			url: "https://ai.google.dev/models/gemini",
		},
	},
};

export type OpenAiModels = "gpt-4.1" | "gpt-4.1-mini" | "gpt-4.1-nano";
export type GeminiModels = "gemini-2.5-pro-preview-05-06" | "gemini-2.5-flash-preview-04-17";

export type SupportedModels = OpenAiModels | GeminiModels;

export const GEMINI_MODEL_ID_MAP: Record<string, string> = {
	"gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
	"gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
	"gemini-2.5-pro-preview-05-06": "gemini-2.5-pro-preview-05-06",
	"gemini-2.5-flash-preview-04-17": "gemini-2.5-flash-preview-04-17",
};
//──────────────────────────────────────────────────────────────────────────────

export interface TextTransformerPrompt {
	id: string;
	name: string;
	text: string;
	isDefault: boolean;
	enabled: boolean;
	model?: SupportedModels;
	temperature?: number;
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

export const DEFAULT_SETTINGS: Omit<TextTransformerSettings, "defaultPromptId"> & {
	defaultPromptId?: string | null | undefined;
} = {
	openAiApiKey: "",
	geminiApiKey: "",
	model: "gpt-4.1-nano",
	prompts: [],
	alwaysShowPromptSelection: false,
	dynamicContextLineCount: 3,
	translationLanguage: "English",
	longInputThreshold: 1500,
	veryLongInputThreshold: 15000,
	temperature: 0.7,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	frequency_penalty: 0,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	presence_penalty: 0,
	// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
	max_tokens: 2048,
	saveToClipboard: false,
};
// Note: defaultPromptId was removed from DEFAULT_SETTINGS structure as it's no longer part of TextTransformerSettings

export const DEFAULT_TEXT_TRANSFORMER_PROMPTS: TextTransformerPrompt[] = [
	{
		id: "improve",
		name: "Improve",
		text: "[AI ROLE]: Professional editor.\n[TASK]: Masterfully refine the provided text, enhancing its style, clarity, readability, and language. Crucially, preserve the original meaning, technical jargon, and the author's unique voice and personal style. Implement structural changes only if they markedly improve flow or comprehension. Avoid unnecessary expansion or significant reformatting (e.g., no unwarranted lists). Strive for minimal alterations; if the text is already clear and concise, refrain from changes.\nIf additional context is supplied, use it to inform your revisions. Output only the revised text. The text to improve is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "shorten",
		name: "Shorten",
		text: "[AI ROLE]: Professional editor. \n[TASK]: Shorten the following text while preserving its meaning and clarity.\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "fix-grammar",
		name: "Fix grammar",
		text: "[AI ROLE]: Professional proofreader. \n[TASK]: Correct any grammatical, spelling, or punctuation errors in the following text.\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "lengthen",
		name: "Lengthen",
		text: "[AI ROLE]: Professional editor. \n[TASK]: Expand and elaborate the following text for greater detail and depth, but do not add unrelated information.\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "structure",
		name: "Refine Structure",
		text: "[AI ROLE]: Expert editor.\n[TASK]: Refine the structure of the following text, in ways compatible with Obsidian Markdown (#headers, - bullet and 1. numbered lists, **bold**, *italics*, etc.) \n[RULE]: Make the minimal changes which  enhance comprehension; \n[RULE]: IMPORTANT: don't overdo it! Minimal is preferable.\nIf more context is provided, it should inform the response. Only output the revised text. This is the text:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "simplify-language",
		name: "Simplify language",
		text: "[AI ROLE]: Professional editor. \n[TASK]: Rewrite the following text in simpler language, making it easier to understand while preserving the original meaning.\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "mind-the-context",
		name: "Mind the Context!",
		text: "[AI ROLE]:  Professional editor.\n [TASK]: You will receive a text selection, and a context which may contain instructions or indications. Do to the text whatever the context says. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "enhance-readability",
		name: "Enhance readability",
		text: "[AI ROLE]: Professional editor. \n[TASK]: Improve the readability and flow of the following text.\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "flesh-out",
		name: "Flesh out",
		text: "[AI ROLE]: Masterful writer. \n[TASK]: You will receive a text. Expand and flesh out this sketch of an article, note, scene, or chapter. Don't be cheesy!\nIf more context is provided, it should inform the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "cleanup",
		name: "Cleanup Text/Chat",
		text: "[AI ROLE]: Professional proofreader.\n[TASK]: Turn the following text or conversation into something that would flow well if read by text-to-speech, but without changing the content and meaning. Clean up the text received, which MAY contain chat conversations. Remove timestamps. Multiple consecutive messages from one speaker can be concatenated it they makes sense as a single paragraph or sentence. Don't change what the speakers say, but you can clean up the syntax and punctuation, expanding an `ic`, an `idk`, etc. Preserve emojis and numerals. Don't add empty lines between messages.\n[CASE]: If it's a chat between at least two different names (& if date is present): write [### YYYY-MM-DD Conversation] as a title. Below the title, goes the cleaned up conversation.\n[CASE]: If there's only one speaker: do not add title/date, only write the [Name: ] once at the beginning of the first line.\nIf context is provided, it should be considered for the response. Output only the revised text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "define",
		name: "Define",
		text: "[AI ROLE]: Master linguist. \n[TASK]: Add the definition(s) of the word (or expression) right next to it in the format 'word/expression [def: definition]'. If input text is not a single definable word or expression, say just <Error—SelectOneWordOrExpression>.\nIf more context is provided, it should inform the response. Your output should be a single line of text. The word/expression is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
	{
		id: "translate",
		name: `Translate to ${DEFAULT_SETTINGS.translationLanguage}—autodetects source language`, // Name will be dynamically updated in loadSettings
		text: "[AI ROLE]: Professional translator. \n [TASK]: Automatically detect language and translate the following text to {language}, preserving meaning, tone, format and style.\nIf more context is provided, it should inform the response. Output only the translated text and nothing else. The text is:",
		isDefault: true,
		enabled: true,
		showInPromptPalette: true,
	},
];

// Assign DEFAULT_TEXT_TRANSFORMER_PROMPTS to DEFAULT_SETTINGS.prompts after definition
DEFAULT_SETTINGS.prompts = DEFAULT_TEXT_TRANSFORMER_PROMPTS.map((p) => ({ ...p }));
