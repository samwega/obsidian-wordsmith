// src/lib/llm/gemini.ts
import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GENERATION_TARGET_CURSOR_MARKER } from "../lib/constants";
import {
	GEMINI_MODEL_ID_MAP,
	MODEL_SPECS,
	TextTransformerPrompt,
	TextTransformerSettings,
} from "../lib/settings-data";
import { logError } from "../lib/utils";

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
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	additionalContextForAI?: string,
	isGenerationTask = false,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	let fullPrompt = "";
	const customContextLabelStart = "--- Custom User-Provided Context Start ---";
	const customContextLabelEnd = "--- Custom User-Provided Context End ---";

	if (isGenerationTask) {
		fullPrompt =
			"You are an AI assistant embedded in Obsidian, tasked with generating text based on a user prompt. Your primary instruction is to fulfill the user's ad-hoc prompt. ";

		// Instruction regarding custom context (if it exists)
		if (additionalContextForAI) {
			fullPrompt += `You will also be given 'Custom User-Provided Context' (marked as ${customContextLabelStart} and ${customContextLabelEnd}). Any instructions, rules, or requests found within this Custom User-Provided Context MUST be strictly obeyed and are considered as important as the user\'s ad-hoc prompt. `;
			if (additionalContextForAI.includes(GENERATION_TARGET_CURSOR_MARKER)) {
				fullPrompt += `The Custom User-Provided Context also contains a marker '${GENERATION_TARGET_CURSOR_MARKER}'. This marker indicates the precise spot where the new text should be generated or inserted. `;
			}
		}

		fullPrompt +=
			"Output ONLY the generated text, without any preambles or explanatory sentences. "; // General output rule

		// Append the actual custom context if it exists
		if (additionalContextForAI) {
			fullPrompt += `\n\n${customContextLabelStart}\n${additionalContextForAI}\n${customContextLabelEnd}`;
		}

		// Append the user's ad-hoc prompt
		fullPrompt += `\n\nUser\'s ad-hoc prompt: ${prompt.text}\n\nGenerated text:`;
	} else {
		// Transformation logic
		fullPrompt = "You are an AI assistant. "; // Base role

		if (additionalContextForAI) {
			fullPrompt += `You will be provided with 'Custom User-Provided Context' (marked as ${customContextLabelStart} and ${customContextLabelEnd}) and a 'Text to Transform'. Any instructions contained in the Custom User-Provided Context MUST be strictly obeyed and are as important as the main 'User's instruction'. Both sets of instructions should be applied ONLY to the 'Text to Transform'. Do not comment on or alter the Custom User-Provided Context itself; it is for your awareness and to provide supplementary directives.\n\n${customContextLabelStart}\n${additionalContextForAI}\n${customContextLabelEnd}`;
		} else {
			fullPrompt +=
				"You will be provided with a 'Text to Transform'. Your task is to apply the 'User's instruction' ONLY to the 'Text to Transform'.";
		}

		fullPrompt += `\n\nUser\'s instruction: ${prompt.text}`;
		fullPrompt += `\n\n--- Text to Transform Start ---\n${oldText}\n--- Text to Transform End ---`;
		fullPrompt += "\n\nTransformed text:";
	}

	let response: RequestUrlResponse;
	try {
		const actualModelId = GEMINI_MODEL_ID_MAP[settings.model] || settings.model;
		const requestBody: {
			contents: Array<{ parts: Array<{ text: string }> }>;
			generationConfig: {
				temperature: number;
				thinkingConfig?: { thinkingBudget: number };
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
				temperature: prompt.temperature ?? settings.temperature,
			},
			// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
			tool_config: {
				// biome-ignore lint/style/useNamingConvention: Gemini API requires snake_case
				function_calling_config: { mode: "NONE" },
			},
		};

		if (actualModelId.includes("flash")) {
			requestBody.generationConfig.thinkingConfig = {
				thinkingBudget: isGenerationTask ? 1 : 0,
			};
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
