// src/llm/openrouter.ts
import { Notice } from "obsidian";
import type { AssembledContextForLLM } from "../lib/core/textTransformer";
import { MODEL_SPECS, TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import type TextTransformer from "../main";
import { chatCompletionRequest } from "./chat-completion-handler";

/**
 * Sends a request to the OpenRouter API.
 * @param plugin The main plugin instance.
 * @param settings The plugin settings.
 * @param oldText The original text to be transformed. Empty for generation tasks.
 * @param prompt The prompt detailing the transformation or generation task.
 * @param assembledContext Optional assembled context to provide to the AI.
 * @param isGenerationTask Flag indicating if this is a text generation task.
 * @returns A promise that resolves to an object containing the new text,
 *          whether the output might be overlength, and the estimated cost,
 *          or undefined if an error occurs.
 */
export function openRouterRequest(
	plugin: TextTransformer,
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	assembledContext: AssembledContextForLLM | undefined,
	isGenerationTask: boolean,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openRouterApiKey) {
		new Notice("Please set your OpenRouter API key in the plugin settings.");
		return Promise.resolve(undefined);
	}

	const modelSpec = MODEL_SPECS[settings.model];

	return chatCompletionRequest(
		plugin,
		settings,
		oldText,
		prompt,
		assembledContext,
		isGenerationTask,
		{
			apiUrl: "https://openrouter.ai/api/v1/chat/completions",
			apiKey: settings.openRouterApiKey,
			modelId: modelSpec.apiId, // OpenRouter uses a specific apiId from the spec
			additionalHeaders: {
				"HTTP-Referer": plugin.manifest.id,
				"X-Title": plugin.manifest.name,
			},
		},
	);
}
