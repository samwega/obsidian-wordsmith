// src/llm/chat-completion-handler.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { AssembledContextForLLM } from "../lib/core/textTransformer";
import { TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";
import { buildPromptComponents } from "./prompt-builder";

interface ChatCompletionOptions {
	apiUrl: string;
	apiKey: string;
	modelId: string;
	additionalHeaders?: Record<string, string>;
	additionalRequestBodyParams?: Record<string, unknown>;
}

export async function chatCompletionRequest(
	plugin: TextTransformer,
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	assembledContext: AssembledContextForLLM | undefined,
	isGenerationTask: boolean,
	options: ChatCompletionOptions,
): Promise<{ newText: string } | undefined> {
	const { systemInstructions, userContent, contextBlock } = buildPromptComponents(
		assembledContext,
		prompt,
		isGenerationTask,
		oldText,
	);

	const systemMessageContent = [systemInstructions, contextBlock].filter(Boolean).join("\n\n");

	const messages = [
		{ role: "system", content: systemMessageContent },
		{ role: "user", content: userContent },
	];

	const requestBody = {
		model: options.modelId,
		messages: messages,
		temperature: settings.temperature,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		frequency_penalty: prompt.frequency_penalty ?? settings.frequency_penalty,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		presence_penalty: prompt.presence_penalty ?? settings.presence_penalty,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		max_tokens: settings.max_tokens,
		...(options.additionalRequestBodyParams || {}),
	};

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Chat Completion Request Body:", requestBody);
	}

	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url: options.apiUrl,
			method: "POST",
			contentType: "application/json",
			headers: {
				authorization: `Bearer ${options.apiKey}`,
				...options.additionalHeaders,
			},
			body: JSON.stringify(requestBody),
		});
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Chat Completion Response:", response);
		}
	} catch (error) {
		if ((error as { status: number }).status === 401) {
			const msg = "API key is not valid. Please verify the key in the plugin settings.";
			new Notice(msg, 6_000);
			return;
		}
		logError(error);
		return;
	}

	const newText = response.json?.choices?.[0].message.content;
	if (!newText) {
		logError(response);
		return;
	}

	return { newText };
}
