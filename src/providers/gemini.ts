import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import {
	GEMINI_MODEL_ID_MAP,
	MODEL_SPECS,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "src/settings";
import { logError } from "src/utils";

/**
 * Send a request to the Gemini API.
 * Returns: { newText, isOverlength, cost } or undefined on error.
 */
export async function geminiRequest(
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	let response: RequestUrlResponse;
	try {
		// DOCS: https://ai.google.dev/api/rest/v1beta/models/gemini-pro:generateContent
		const modelId = GEMINI_MODEL_ID_MAP[settings.model] || settings.model;
		// Build the request body according to modelId
		let requestBody: unknown;
		if (modelId === "gemini-2.5-flash-preview-04-17") {
			requestBody = {
				contents: [
					{
						parts: [{ text: prompt.text + "\n" + oldText }],
					},
				],
				generationConfig: {
					thinkingConfig: {
						thinkingBudget: 0,
					},
				},
			};
		} else {
			requestBody = {
				contents: [
					{
						parts: [{ text: prompt.text + "\n" + oldText }],
					},
				],
				// biome-ignore lint/style/useNamingConvention: required by Gemini API
				tool_config: { function_calling_config: { mode: "NONE" } },
			};
		}

		response = await requestUrl({
			url:
				"https://generativelanguage.googleapis.com/v1beta/models/" +
				modelId +
				":generateContent?key=" +
				settings.geminiApiKey,
			method: "POST",
			contentType: "application/json",
			body: JSON.stringify(requestBody),
		});
	} catch (err) {
		console.error("Gemini API error:", err);
		if (err && typeof err === "object" && "response" in err) {
			console.error("Gemini API error response:", (err as { response?: unknown }).response);
		}
		logError(err);
		new Notice("Gemini API request failed. Check your API key and model.");
		return;
	}

	// Handle Gemini API response
	const candidates = response.json?.candidates;
	const newText = candidates?.[0]?.content?.parts?.[0]?.text || "";
	// Gemini API does not provide token usage/cost in the same way as OpenAI, so estimate
	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed = newText.split(/\s+/).length; // crude estimate
	const isOverlength = outputTokensUsed >= modelSpec.maxOutputTokens;
	const cost = (outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6;
	return { newText, isOverlength, cost };
}
