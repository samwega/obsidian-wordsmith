// src/llm/chat-completion-handler.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { AssembledContextForLLM } from "../lib/core/textTransformer";
import { TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";
import { buildPromptComponents } from "./prompt-builder";

/**
 * Defines the consolidated parameters for a chat completion request.
 * This pattern improves readability and makes the function signature stable.
 */
export interface ChatCompletionRequestParams {
	settings: TextTransformerSettings;
	prompt: TextTransformerPrompt;
	isGenerationTask: boolean;

	// API details
	apiUrl: string;
	apiKey: string;
	modelId: string;
	additionalHeaders?: Record<string, string>;
	additionalRequestBodyParams?: Record<string, unknown>;

	// Optional parameters that depend on the task
	oldText?: string;
	assembledContext?: AssembledContextForLLM;

	// Cancellation support
	abortSignal?: AbortSignal;
}

export async function chatCompletionRequest(
	plugin: TextTransformer,
	params: ChatCompletionRequestParams,
): Promise<{ newText: string } | undefined> {
	// Destructure all parameters from the params object for use in the function.
	const {
		settings,
		prompt,
		isGenerationTask,
		apiUrl,
		apiKey,
		modelId,
		additionalHeaders,
		additionalRequestBodyParams,
		oldText = "", // Provide a safe default for generation tasks
		assembledContext,
		abortSignal,
	} = params;

	const { systemInstructions, userContent, contextBlock } = buildPromptComponents({
		prompt,
		isGenerationTask,
		oldText,
		...(assembledContext && { assembledContext }),
	});

	const systemMessageContent = [systemInstructions, contextBlock].filter(Boolean).join("\n\n");
	const messages: Array<{ role: string; content: string }> = [];

	const isDirectAnthropicApi = apiUrl.includes("api.anthropic.com");
	const isKnownCompatibleProvider =
		apiUrl.includes("api.openai.com") || apiUrl.includes("openrouter.ai");

	if (isDirectAnthropicApi) {
		messages.push({ role: "user", content: userContent });
	} else if (isKnownCompatibleProvider) {
		if (systemMessageContent) {
			messages.push({ role: "system", content: systemMessageContent });
		}
		messages.push({ role: "user", content: userContent });
	} else {
		const combinedContent = [systemMessageContent, userContent].filter(Boolean).join("\n\n");
		messages.push({ role: "user", content: combinedContent });
	}

	const requestBody: { [key: string]: unknown } = {
		model: modelId,
		messages: messages,
		temperature: settings.temperature,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		max_tokens: settings.max_tokens,
		...(additionalRequestBodyParams || {}),
	};

	if (isDirectAnthropicApi && systemMessageContent) {
		requestBody.system = systemMessageContent;
	}

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Chat Completion Request Body:", requestBody);
	}

	let response: RequestUrlResponse;
	try {
		const requestHeaders: Record<string, string> = {
			"content-type": "application/json",
			...additionalHeaders,
		};

		if (isDirectAnthropicApi) {
			requestHeaders["anthropic-version"] = "2023-06-01";
			requestHeaders["x-api-key"] = apiKey;
		} else {
			requestHeaders.authorization = `Bearer ${apiKey}`;
		}

		const requestOptions: Parameters<typeof requestUrl>[0] = {
			url: apiUrl,
			method: "POST",
			headers: requestHeaders,
			body: JSON.stringify(requestBody),
		};

		// Add abort signal if provided
		if (abortSignal?.aborted) {
			throw new Error("Request was cancelled");
		}

		response = await requestUrl(requestOptions);

		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Chat Completion Response:", response);
		}
	} catch (error) {
		// Handle cancellation
		if (abortSignal?.aborted || (error as Error).message === "Request was cancelled") {
			new Notice("Generation cancelled by user.", 3000);
			return;
		}

		if ((error as { status: number }).status === 401) {
			const msg = "API key is not valid. Please verify the key in the plugin settings.";
			new Notice(msg, 6_000);
			return;
		}
		logError(error);
		return;
	}

	const newText = isDirectAnthropicApi
		? response.json?.content?.[0]?.text
		: response.json?.choices?.[0].message.content;

	if (newText === undefined) {
		logError(response.json || "API response was empty or malformed.");
		return;
	}

	return { newText };
}
