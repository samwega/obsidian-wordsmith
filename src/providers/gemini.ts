import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import {
	TextTransformerPrompt,
	TextTransformerSettings,
} from "src/settings";
import {
    GEMINI_MODEL_ID_MAP,
    MODEL_SPECS
} from "src/settings-data";
import { logError } from "src/utils";

/**
 * Send a request to the Gemini API.
 * Returns: { newText, isOverlength, cost } or undefined on error.
 */
export async function geminiRequest(
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	additionalContextForAI?: string,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	let fullPrompt = "";
	if (additionalContextForAI) {
		fullPrompt = `You will be provided with context (marked as --- Context Start --- and --- Context End ---) and a text to transform (marked as --- Text to Transform Start --- and --- Text to Transform End ---).
Your task is to apply the specific instruction (e.g., summarize, improve, fix grammar) ONLY to the 'Text to Transform'. Do not comment on or alter the context itself. The context is for your awareness only.

--- Context Start ---
${additionalContextForAI}
--- Context End ---

`;
	}

	fullPrompt += `User's instruction: ${prompt.text}

--- Text to Transform Start ---
${oldText}
--- Text to Transform End ---`;

	let response: RequestUrlResponse;
	try {
		const modelId = GEMINI_MODEL_ID_MAP[settings.model] || settings.model;
		let requestBody: unknown;
		if (modelId === "gemini-2.5-flash-preview-04-17") {
			requestBody = {
				contents: [
					{
						parts: [{ text: fullPrompt }],
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
						parts: [{ text: fullPrompt }],
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

	const candidates = response.json?.candidates;
	const newText = candidates?.[0]?.content?.parts?.[0]?.text || "";
	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed = newText.split(/\s+/).length;
	const isOverlength = outputTokensUsed >= modelSpec.maxOutputTokens;
	const cost = (outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6;
	return { newText, isOverlength, cost };
}
