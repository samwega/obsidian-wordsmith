import { Notice, RequestUrlResponse, requestUrl } from "obsidian";
import { MODEL_SPECS, ProofreaderSettings } from "src/settings";
import { logError } from "src/utils";

import { ProofreaderPrompt } from "src/settings";

export async function openAiRequest(
	settings: ProofreaderSettings,
	oldText: string,
	prompt: ProofreaderPrompt,
): Promise<{ newText: string; isOverlength: boolean; cost: number } | undefined> {
	if (!settings.openAiApiKey) {
		new Notice("Please set your OpenAI API key in the plugin settings.");
		return;
	}

	// SEND REQUEST
	let response: RequestUrlResponse;
	try {
		// DOCS https://platform.openai.com/docs/api-reference/chat
		response = await requestUrl({
			url: "https://api.openai.com/v1/chat/completions",
			method: "POST",
			contentType: "application/json",
			// biome-ignore lint/style/useNamingConvention: not by me
			headers: { Authorization: "Bearer " + settings.openAiApiKey },
			body: JSON.stringify({
				model: settings.model,
				messages: [
					{ role: "developer", content: prompt.text },
					{ role: "user", content: oldText },
				],
			}),
		});
		console.debug("[Proofreader plugin] OpenAI response", response);
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

	// DETERMINE OVERLENGTH & COST
	// https://platform.openai.com/docs/guides/conversation-state?api-mode=responses#managing-context-for-text-generation
	const modelSpec = MODEL_SPECS[settings.model];

	const outputTokensUsed = response.json?.usage?.completion_tokens || 0;
	const isOverlength = outputTokensUsed >= modelSpec.maxOutputTokens;

	const inputTokensUsed = response.json?.usage?.prompt_tokens || 0;
	const cost =
		(inputTokensUsed * modelSpec.costPerMillionTokens.input) / 1e6 +
		(outputTokensUsed * modelSpec.costPerMillionTokens.output) / 1e6;

	return { newText: newText, isOverlength: isOverlength, cost: cost };
}
