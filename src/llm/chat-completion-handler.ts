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
}

export async function chatCompletionRequest(
	plugin: TextTransformer,
	params: ChatCompletionRequestParams,
): Promise<{ newText: string } | undefined> {
	// Destructure all parameters from the params object for use in the function.
	// This keeps the rest of the function's logic identical to the previous version.
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
	} = params;

	const { systemInstructions, userContent, contextBlock } = buildPromptComponents(
		assembledContext,
		prompt,
		isGenerationTask,
		oldText,
	);

	const systemMessageContent = [systemInstructions, contextBlock].filter(Boolean).join("\n\n");
	const messages: Array<{ role: string; content: string }> = [];

	// --- NEW SIMPLIFIED LOGIC ---
	const isDirectAnthropicApi = apiUrl.includes("api.anthropic.com");

	// An endpoint is considered "known compatible" if it's OpenAI or OpenRouter.
	// These services are expected to correctly handle the standard 'system' role.
	const isKnownCompatibleProvider =
		apiUrl.includes("api.openai.com") || apiUrl.includes("openrouter.ai");

	// 1. Determine the message structure based on the API target
	if (isDirectAnthropicApi) {
		// Direct Anthropic calls: System prompt is a top-level parameter, not in messages.
		messages.push({ role: "user", content: userContent });
	} else if (isKnownCompatibleProvider) {
		// OpenAI & OpenRouter: Use the standard format with a separate system message if content exists.
		if (systemMessageContent) {
			messages.push({ role: "system", content: systemMessageContent });
		}
		messages.push({ role: "user", content: userContent });
	} else {
		// All others (local models, unknown providers): Combine for safety.
		const combinedContent = [systemMessageContent, userContent].filter(Boolean).join("\n\n");
		messages.push({ role: "user", content: combinedContent });
	}

	// 2. Construct the request body
	const requestBody: { [key: string]: unknown } = {
		model: modelId,
		messages: messages,
		temperature: settings.temperature,
		// biome-ignore lint/style/useNamingConvention: API requires snake_case
		max_tokens: settings.max_tokens,
		...(additionalRequestBodyParams || {}),
	};

	// 3. Add API-specific parameters
	if (isDirectAnthropicApi) {
		// Add top-level 'system' parameter for direct Anthropic calls.
		if (systemMessageContent) {
			requestBody.system = systemMessageContent;
		}
	} else {
		// Add frequency/presence penalty for OpenAI-compatible APIs.
		// These are not supported by Anthropic's Messages API.
		requestBody.frequency_penalty = prompt.frequency_penalty ?? settings.frequency_penalty;
		requestBody.presence_penalty = prompt.presence_penalty ?? settings.presence_penalty;
	}

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Chat Completion Request Body:", requestBody);
	}

	// 4. Perform the request with API-specific headers
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

		response = await requestUrl({
			url: apiUrl,
			method: "POST",
			headers: requestHeaders,
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

	// 5. Parse the response based on the API target
	const newText = isDirectAnthropicApi
		? response.json?.content?.[0]?.text
		: response.json?.choices?.[0].message.content;

	if (newText === undefined) {
		// Check for undefined specifically, as "" is a valid response
		logError(response.json || "API response was empty or malformed.");
		return;
	}

	return { newText };
}
