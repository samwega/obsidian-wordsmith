import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { MODEL_SPECS } from "src/settings-data";
import { logError } from "src/utils";
import { TextTransformerPrompt, TextTransformerSettings } from "../settings-data";

export async function openAiRequest(
	settings: TextTransformerSettings,
	oldText: string, // This will be an empty string for generation tasks
	prompt: TextTransformerPrompt,
	additionalContextForAI?: string,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openAiApiKey) {
		new Notice("Please set your OpenAI API key in the plugin settings.");
		return;
	}

	let systemMessageContent = "You are an AI assistant embedded in Obsidian helping with text tasks.";

	if (
		oldText === "" &&
		additionalContextForAI?.includes("<<<GENERATION_TARGET_CURSOR_POSITION>>>")
	) {
		systemMessageContent +=
			" The user wants to generate new text. " +
			"The provided context (marked as --- Context Start --- and --- Context End ---) may contain a marker '<<<GENERATION_TARGET_CURSOR_POSITION>>>'. " +
			"This marker indicates the precise spot in the context where the user's cursor is, and thus where the new text should be generated or inserted. " +
			"Focus on fulfilling the user's ad-hoc prompt as the primary instruction, using the context for awareness. Output ONLY the generated text, without any preambles or explanatory sentences.";
	} else if (oldText === "") {
		systemMessageContent +=
			" The user wants to generate new text. " +
			"Focus on fulfilling the user's ad-hoc prompt as the primary instruction. Output ONLY the generated text, without any preambles or explanatory sentences.";
	} else {
		systemMessageContent +=
			" You will be provided with context (marked as --- Context Start --- and --- Context End ---). " +
			"This context is for your awareness only. Do not comment on or alter the context itself. " +
			"User's transformation instruction: " +
			prompt.text +
			". Apply this instruction ONLY to the user-provided text that follows.";
	}

	if (additionalContextForAI) {
		systemMessageContent += `

--- Context Start ---
${additionalContextForAI}
--- Context End ---`;
	}

	// For non-generation tasks, reiterate the prompt after context if context exists.
	if (oldText !== "" && additionalContextForAI) {
		systemMessageContent += `

User's transformation instruction: ${prompt.text}

Apply this instruction ONLY to the user-provided text that follows.`;
	} else if (oldText !== "" && !additionalContextForAI) {
		systemMessageContent += `

User's transformation instruction: ${prompt.text}

Apply this instruction ONLY to the user-provided text that follows.`;
	} else if (oldText === "" && !additionalContextForAI) {
		// For generation without context, the primary instruction is already in the system message.
		systemMessageContent += `

User's ad-hoc prompt: ${prompt.text}

Generate text to fulfill this prompt. Output ONLY the generated text.`;
	} else if (oldText === "" && additionalContextForAI) {
		// For generation with context, the primary instruction is already in the system message.
		systemMessageContent += `

User's ad-hoc prompt: ${prompt.text}

Generate text to fulfill this prompt, considering the provided context and the <<<GENERATION_TARGET_CURSOR_POSITION>>> marker if present. Output ONLY the generated text.`;
	}

	const messages = [
		{ role: "system", content: systemMessageContent },
		{ role: "user", content: oldText === "" ? prompt.text : oldText }, // If oldText is empty, user message is the ad-hoc prompt itself for clarity to AI, though system prompt is primary driver.
	];

	let response: RequestUrlResponse;
	try {
		response = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			contentType: "application/json",
			headers: { authorization: "Bearer " + settings.openAiApiKey },
			body: JSON.stringify({
				model: settings.model,
				messages: messages,
				// Pass through relevant parameters from the prompt object if they exist
				temperature: prompt.temperature ?? settings.temperature,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				frequency_penalty: prompt.frequency_penalty ?? settings.frequency_penalty,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				presence_penalty: prompt.presence_penalty ?? settings.presence_penalty,
				// biome-ignore lint/style/useNamingConvention: OpenAI API requires snake_case
				max_tokens: prompt.max_tokens ?? settings.max_tokens,
			}),
		});
		console.debug("[WordSmith plugin] OpenAI response", response);
	} catch (error) {
		if ((error as { status: number }).status === 401) {
			const msg = "OpenAI API key is not valid. Please verify the key in the plugin settings.";
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

	const modelSpec = MODEL_SPECS[settings.model];
	const outputTokensUsed = response.json?.usage?.completion_tokens || 0;
	const isOverlength = modelSpec.maxOutputTokens
		? outputTokensUsed >= modelSpec.maxOutputTokens
		: false;
	const inputTokensUsed = response.json?.usage?.prompt_tokens || 0;
	const cost = modelSpec.costPerMillionTokens
		? (inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
			(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6
		: 0;

	return { newText: newText, isOverlength: isOverlength, cost: cost };
}
