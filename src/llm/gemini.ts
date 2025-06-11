// src/lib/llm/gemini.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import type { AssembledContextForLLM } from "../lib/core/textTransformer";
import { MODEL_SPECS, TextTransformerPrompt, TextTransformerSettings } from "../lib/settings-data";
import { logError } from "../lib/utils";
import { buildPromptComponents } from "./prompt-builder";

/**
 * Sends a request to the Google Gemini API.
 * @param settings The plugin settings.
 * @param oldText The original text to be transformed. Empty for generation tasks.
 * @param prompt The prompt detailing the transformation or generation task.
 * @param additionalContextForAI Optional additional context to provide to the AI.
 * @param isGenerationTask Flag indicating if this is a text generation task.
 * @returns A promise that resolves to an object containing the new text,
 *          whether the output might be overlength, and the estimated cost,
 *          or undefined if an error occurs.
 */
export async function geminiRequest(
	plugin: { runtimeDebugMode: boolean }, // Added plugin argument
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	assembledContext?: AssembledContextForLLM, // Changed parameter type and name
	isGenerationTask = false,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	const { systemInstructions, userContent, contextBlock } = buildPromptComponents(
		assembledContext,
		prompt,
		isGenerationTask,
		oldText,
	);

	// For Gemini, we assemble all components into a single string.
	const fullPrompt = [
		systemInstructions,
		contextBlock,
		userContent,
		// For transformation tasks, Gemini seems to work better when prompted for the final output.
		isGenerationTask ? "" : "\n\nTransformed text:",
	]
		.filter(Boolean)
		.join("\n\n");

	let response: RequestUrlResponse;
	try {
		const modelSpec = MODEL_SPECS[settings.model];
		const actualModelId = modelSpec.apiId;

		const requestBody: {
			contents: Array<{ parts: Array<{ text: string }> }>;
			generationConfig: {
				temperature: number;
				thinkingConfig?: { thinkingBudget: number };
				maxOutputTokens?: number;
			};
			// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
			tool_config: {
				// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
				function_calling_config: { mode: string };
			};
		} = {
			contents: [
				{
					parts: [{ text: fullPrompt }],
				},
			],
			generationConfig: {
				temperature: settings.temperature,
				maxOutputTokens: settings.max_tokens,
			},
			// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
			tool_config: {
				// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
				function_calling_config: { mode: "NONE" },
			},
		};

		if (actualModelId.includes("2.5-flash")) {
			requestBody.generationConfig.thinkingConfig = {
				thinkingBudget: isGenerationTask ? 1 : 0,
			};
		}
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Request Body:", requestBody);
		}

		response = await requestUrl({
			url:
				"https://generativelanguage.googleapis.com/v1beta/models/" +
				actualModelId +
				":generateContent?key=" +
				settings.geminiApiKey,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(requestBody),
		});
		if (plugin.runtimeDebugMode) {
			console.debug("[WordSmith plugin] Gemini Response:", response);
		}
	} catch (err) {
		console.error("Gemini API error:", err);
		if (err && typeof err === "object" && "response" in err) {
			console.error("Gemini API error response:", (err as { response?: unknown }).response);
		}
		logError(err);
		new Notice("Gemini API request failed. Check your API key and model.");
		return;
	}

	const candidates = response.json?.candidates;
	let newText = candidates?.[0]?.content?.parts?.[0]?.text || "";
	if (newText.startsWith("Generated text:")) {
		newText = newText.substring("Generated text:".length).trimStart();
	}
	if (newText.startsWith("Transformed text:")) {
		newText = newText.substring("Transformed text:".length).trimStart();
	}

	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed =
		response.json?.usageMetadata?.candidatesTokenCount ||
		(newText.split(/\s+/).length > 0 ? newText.split(/\s+/).length : 0);
	const inputTokensUsed =
		response.json?.usageMetadata?.promptTokenCount ||
		(fullPrompt.split(/\s+/).length > 0 ? fullPrompt.split(/\s+/).length : 0);

	const isOverlength = modelSpec.maxOutputTokens
		? outputTokensUsed >= modelSpec.maxOutputTokens
		: false;

	const cost = modelSpec.costPerMillionTokens
		? (inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
			(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6
		: 0;

	return { newText, isOverlength, cost };
}
