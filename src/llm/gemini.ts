// src/llm/gemini.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { AssembledContextForLLM } from "../lib/core/textTransformer";
import type {
	CustomProvider,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "../lib/settings-data";
import { logError } from "../lib/utils";
import type TextTransformer from "../main";
import { buildPromptComponents } from "./prompt-builder";

/**
 * Defines the consolidated parameters for a Gemini API request.
 */
export interface GeminiRequestParams {
	settings: TextTransformerSettings;
	prompt: TextTransformerPrompt;
	isGenerationTask: boolean;
	provider: CustomProvider;
	modelApiId: string;
	oldText?: string;
	assembledContext?: AssembledContextForLLM;
	abortSignal?: AbortSignal;
}

export async function geminiRequest(
	plugin: TextTransformer,
	params: GeminiRequestParams,
): Promise<{ newText: string } | undefined> {
	// Destructure all parameters from the params object.
	const {
		settings,
		prompt,
		isGenerationTask,
		provider,
		modelApiId,
		oldText = "", // Provide a safe default for generation tasks
		assembledContext,
		abortSignal,
	} = params;

	if (!provider.apiKey) {
		new Notice("Gemini API key is missing for the selected provider.", 6000);
		return;
	}

	const isGeminiModel = modelApiId.includes("gemini");

	const { systemInstructions, userContent, contextBlock } = buildPromptComponents({
		prompt,
		isGenerationTask,
		oldText,
		...(assembledContext && { assembledContext }),
	});

	let finalUserContent = userContent;
	let systemMessageContent = [systemInstructions, contextBlock].filter(Boolean).join("\n\n");

	// For non-Gemini models, combine system instructions into the user content block
	// as they do not support the top-level `systemInstruction` parameter.
	if (!isGeminiModel && systemMessageContent) {
		finalUserContent = `${systemMessageContent}\n\n${userContent}`;
		systemMessageContent = ""; // Clear it so it's not used later
	}

	// Strip "google/" prefix from model ID if present, as Gemini API expects just the model name
	const cleanModelId = modelApiId.startsWith("google/") ? modelApiId.slice(7) : modelApiId;
	const requestUrlString = `${provider.endpoint}/${cleanModelId}:generateContent?key=${provider.apiKey}`;

	const requestBody: {
		contents: { role: string; parts: { text: string }[] }[];
		systemInstruction?: { parts: { text: string }[] };
		generationConfig: Record<string, unknown>;
		safetySettings: Record<string, string>[];
	} = {
		contents: [{ role: "user", parts: [{ text: finalUserContent }] }],
		generationConfig: {
			temperature: settings.temperature,
			maxOutputTokens: settings.max_tokens,
		},
		safetySettings: [
			{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
			{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
		],
	};

	// Only add the 'systemInstruction' block if it's a Gemini model and there's content for it.
	if (isGeminiModel && systemMessageContent) {
		requestBody.systemInstruction = {
			parts: [{ text: systemMessageContent }],
		};
	}

	if (plugin.runtimeDebugMode) {
		console.debug("[WordSmith plugin] Gemini Request Body:", requestBody);
		console.debug("[WordSmith plugin] Gemini Request URL:", requestUrlString);
	}

	let response: RequestUrlResponse;

	try {
		// Check if request was cancelled before making the call
		if (abortSignal?.aborted) {
			throw new Error("Request was cancelled");
		}

		response = await requestUrl({
			url: requestUrlString,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(requestBody),
		});

		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Response:", response);
		}
	} catch (error) {
		// Handle user cancellation
		if (abortSignal?.aborted || (error as Error).message === "Request was cancelled") {
			new Notice("Generation cancelled by user.", 3000);
			if (plugin.runtimeDebugMode) {
				console.debug(
					"[WordSmith plugin] Gemini finish reason: CANCELLED (user clicked stop button)",
				);
				console.debug(
					"[WordSmith plugin] This is NOT a natural completion - user manually cancelled",
				);
			}
			return;
		}

		// Handle other errors
		logError(error);
		return;
	}

	const candidate = response.json?.candidates?.[0];
	const newText = candidate?.content?.parts?.[0]?.text;
	const finishReason = candidate?.finishReason;

	if (newText === undefined || newText === null || newText === "") {
		// Add debug info to understand what's in the response
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Failed to extract text from Gemini response");
			console.debug("[WordSmith plugin] newText value:", newText);
			console.debug("[WordSmith plugin] Candidate:", candidate);
			console.debug("[WordSmith plugin] Content:", candidate?.content);
			console.debug("[WordSmith plugin] Parts:", candidate?.content?.parts);
			console.debug("[WordSmith plugin] finishReason:", finishReason);
		}

		// If it's a MAX_TOKENS case, don't treat it as an error
		if (finishReason === "MAX_TOKENS" || finishReason === "RECITATION") {
			return; // Return undefined, not an error
		}

		logError(response.json || "Gemini response was empty or malformed.");
		return;
	}

	// Check for truncation indicators in Gemini response

	if (finishReason === "MAX_TOKENS" || finishReason === "RECITATION") {
		const reasonText =
			finishReason === "MAX_TOKENS" ? "token limit" : "content policy (recitation)";
		new Notice(
			`⚠️ Response was truncated due to ${reasonText}. Current limit: ${settings.max_tokens} tokens. Consider increasing the Max Output Tokens setting.`,
			8000,
		);
		if (plugin.runtimeDebugMode) {
			console.warn("[WordSmith] Gemini response truncated:", {
				finishReason,
				maxTokens: settings.max_tokens,
				responseLength: newText.length,
				modelApiId,
			});
		}
	}

	if (plugin.runtimeDebugMode) {
		console.debug(
			"[WordSmith plugin] Gemini finish reason:",
			finishReason,
			finishReason === "STOP"
				? "(NATURAL COMPLETION)"
				: finishReason === "MAX_TOKENS"
					? "(TRUNCATED BY TOKEN LIMIT)"
					: finishReason === "RECITATION"
						? "(TRUNCATED BY CONTENT POLICY)"
						: `(${finishReason})`,
		);
		console.debug("[WordSmith plugin] Gemini response length:", newText.length, "characters");
	}

	return { newText };
}
