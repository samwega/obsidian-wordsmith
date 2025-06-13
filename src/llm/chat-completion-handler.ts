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

	const messages = [];

	// The 'system' role is not consistently supported across all OpenAI-compatible APIs.
	// Models from major providers (OpenAI, Anthropic, Google, Meta, Mistral, Cohere) are
	// specifically tuned for it. Many other models (especially local ones) respond more
	// reliably when system instructions are part of the first user message. This heuristic
	// checks the model's origin to decide the format for maximum performance and compatibility.
	const isOfficialOpenAIEndpoint = options.apiUrl.includes("api.openai.com");
	const isKnownOpenAIModel =
		options.modelId.startsWith("openai/") || options.modelId.startsWith("gpt-");
	const isKnownAnthropicModel = options.modelId.startsWith("anthropic/");
	const isKnownGeminiModel =
		options.modelId.startsWith("google/") || options.modelId.startsWith("gemini");
	const isKnownLlamaModel = options.modelId.startsWith("meta-llama/");
	const isKnownMistralModel = options.modelId.startsWith("mistralai/");
	const isKnownCohereModel = options.modelId.startsWith("cohere/");

	const shouldUseSeparateSystemPrompt =
		isOfficialOpenAIEndpoint ||
		isKnownOpenAIModel ||
		isKnownAnthropicModel ||
		isKnownGeminiModel ||
		isKnownLlamaModel ||
		isKnownMistralModel ||
		isKnownCohereModel;

	if (systemMessageContent && shouldUseSeparateSystemPrompt) {
		messages.push({ role: "system", content: systemMessageContent });
		messages.push({ role: "user", content: userContent });
	} else {
		// For other providers/models, combine into a single user message for max compatibility.
		const combinedContent = [systemMessageContent, userContent].filter(Boolean).join("\n\n");
		messages.push({ role: "user", content: combinedContent });
	}

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
