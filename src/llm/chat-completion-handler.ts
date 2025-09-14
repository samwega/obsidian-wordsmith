// src/llm/chat-completion-handler.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { AssembledContextForLLM } from "../lib/core/textTransformer";
import { getMaxOutputTokensForModel } from "../lib/provider-utils";
import { TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logDebug, logError, logWarn } from "../lib/utils";
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

	// Cap max_tokens at the model's actual limit to prevent API errors
	const modelMaxTokens = getMaxOutputTokensForModel(plugin, modelId);
	const effectiveMaxTokens = modelMaxTokens
		? Math.min(settings.max_tokens, modelMaxTokens)
		: settings.max_tokens;

	const requestBody: { [key: string]: unknown } = {
		model: modelId,
		messages: messages,
		temperature: settings.temperature,
		// API requires snake_case
		max_tokens: effectiveMaxTokens,
		...(additionalRequestBodyParams || {}),
	};

	if (isDirectAnthropicApi && systemMessageContent) {
		requestBody.system = systemMessageContent;
	}

	logDebug(plugin, "Chat Completion Request Body:", requestBody);
	if (modelMaxTokens && settings.max_tokens > modelMaxTokens) {
		logDebug(
			plugin,
			`Max tokens capped: user setting ${settings.max_tokens} → model limit ${modelMaxTokens} for ${modelId}`,
		);
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

		logDebug(plugin, "Chat Completion Response:", response);
	} catch (error) {
		// Handle user cancellation
		if (abortSignal?.aborted || (error as Error).message === "Request was cancelled") {
			new Notice("Generation cancelled by user.", 3000);
			logDebug(plugin, "Response finish reason: CANCELLED (user clicked stop button)");
			logDebug(plugin, "This is NOT a natural completion - user manually cancelled");
			return;
		}

		// Handle other errors
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

	// Check for truncation indicators
	const finishReason = isDirectAnthropicApi
		? response.json?.stop_reason
		: response.json?.choices?.[0]?.finish_reason;

	if (newText === undefined) {
		logError(response.json || "API response was empty or malformed.");
		return;
	}

	// Check for truncation indicators

	if (finishReason === "length" || finishReason === "max_tokens") {
		new Notice(
			`⚠️ Response was truncated due to token limit. Current limit: ${settings.max_tokens} tokens. Consider increasing the Max Output Tokens setting.`,
			8000,
		);
		logWarn(plugin, "Response truncated due to token limit:", {
			finishReason,
			maxTokens: settings.max_tokens,
			responseLength: newText.length,
			modelId,
		});
	}

	let finishReasonDescription: string;
	if (finishReason === "stop") {
		finishReasonDescription = "(NATURAL COMPLETION)";
	} else if (finishReason === "length" || finishReason === "max_tokens") {
		finishReasonDescription = "(TRUNCATED BY TOKEN LIMIT)";
	} else {
		finishReasonDescription = `(${finishReason?.toUpperCase()})`;
	}

	logDebug(plugin, "Response finish reason:", finishReason, finishReasonDescription);
	logDebug(plugin, "Response length:", newText.length, "characters");

	return { newText };
}
