import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { GEMINI_MODEL_ID_MAP, MODEL_SPECS } from "src/settings-data";
import { logError } from "src/utils";
import { TextTransformerPrompt, TextTransformerSettings } from "../settings-data";

/**
 * Send a request to the Gemini API.
 * Returns: { newText, isOverlength, cost } or undefined on error.
 */
export async function geminiRequest(
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	additionalContextForAI?: string,
	isGenerationTask = false, // Added to control thinkingConfig and prompt structure
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.geminiApiKey) {
		new Notice("Please set your Gemini API key in the plugin settings.");
		return;
	}

	let fullPrompt = "";

	if (isGenerationTask) {
		fullPrompt =
			"You are an AI assistant embedded in Obsidian, tasked with generating text based on a user prompt.";
		if (additionalContextForAI?.includes("<<<GENERATION_TARGET_CURSOR_POSITION>>>")) {
			fullPrompt +=
				" The provided context (marked as --- Context Start --- and --- Context End ---) contains a marker '<<<GENERATION_TARGET_CURSOR_POSITION>>>'. " +
				"This marker indicates the precise spot in the context where the user's cursor is, and thus where the new text should be generated or inserted. " +
				"Focus on fulfilling the user's ad-hoc prompt as the primary instruction, using the context for awareness. Output ONLY the generated text, without any preambles or explanatory sentences.";
		} else {
			fullPrompt +=
				" Focus on fulfilling the user's ad-hoc prompt as the primary instruction. Output ONLY the generated text, without any preambles or explanatory sentences.";
		}
		if (additionalContextForAI) {
			fullPrompt += `

--- Context Start ---
${additionalContextForAI}
--- Context End ---`;
		}
		fullPrompt += `

User's ad-hoc prompt: ${prompt.text}

Generated text:`; // Guide the AI to start generation
	} else {
		// Existing transformation logic
		if (additionalContextForAI) {
			fullPrompt = `You will be provided with context (marked as --- Context Start --- and --- Context End ---) and a text to transform (marked as --- Text to Transform Start --- and --- Text to Transform End ---).
Your task is to apply the specific instruction (e.g., summarize, improve, fix grammar) ONLY to the 'Text to Transform'. Do not comment on or alter the context itself. The context is for your awareness only.

--- Context Start ---
${additionalContextForAI}
--- Context End ---`;
		}
		fullPrompt += `

User's instruction: ${prompt.text}

--- Text to Transform Start ---
${oldText}
--- Text to Transform End ---`;
	}

	let response: RequestUrlResponse;
	try {
		const actualModelId = GEMINI_MODEL_ID_MAP[settings.model] || settings.model; // Use this variable
		const requestBody: {
			contents: Array<{ parts: Array<{ text: string }> }>;
			generationConfig: { temperature: number; thinkingConfig?: { thinkingBudget: number } };
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
				actualModelId + // Use actualModelId here
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
