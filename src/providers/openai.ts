import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { TextTransformerPrompt, TextTransformerSettings } from "src/settings";
import { MODEL_SPECS } from "src/settings-data";
import { logError } from "src/utils";

export async function openAiRequest(
	settings: TextTransformerSettings,
	oldText: string,
	prompt: TextTransformerPrompt,
	additionalContextForAI?: string,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openAiApiKey) {
		new Notice("Please set your OpenAI API key in the plugin settings.");
		return;
	}

	let systemMessageContent = "You are an AI assistant helping with text transformation.";

	if (additionalContextForAI) {
		systemMessageContent += `

You will be provided with context (marked as --- Context Start --- and --- Context End ---).
This context is for your awareness only. Do not comment on or alter the context itself.

--- Context Start ---
${additionalContextForAI}
--- Context End ---`;
	}

	systemMessageContent += `

User's transformation instruction: ${prompt.text}

Apply this instruction ONLY to the user-provided text that follows.`;

	const messages = [
		{ role: "system", content: systemMessageContent },
		{ role: "user", content: oldText },
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
			}),
		});
		console.debug("[TextTransformer plugin] OpenAI response", response);
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
	const isOverlength = outputTokensUsed >= modelSpec.maxOutputTokens;
	const inputTokensUsed = response.json?.usage?.prompt_tokens || 0;
	const cost =
		(inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
		(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6;

	return { newText: newText, isOverlength: isOverlength, cost: cost };
}
