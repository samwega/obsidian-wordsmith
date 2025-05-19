import { Change, diffWords } from "diff";
import { Editor, Notice, getFrontMatterInfo, App } from "obsidian";
import { rejectChanges } from "./accept-reject-suggestions";
import TextTransformer from "./main";
import { geminiRequest } from "./providers/gemini";
import { openAiRequest } from "./providers/openai";
import { TextTransformerPrompt, TextTransformerSettings } from "./settings";
import { ContextControlPanel, CONTEXT_CONTROL_VIEW_TYPE } from "./context-control-panel";

// DOCS https://github.com/kpdecker/jsdiff#readme
function getDiffMarkdown(
	settings: TextTransformerSettings,
	oldText: string,
	newText: string,
	isOverlength?: boolean,
): { textWithSuggestions: string; changeCount: number } {
	const leadingWhitespace = oldText.match(/^(\s*)/)?.[0] || "";
	const trailingWhitespace = oldText.match(/(\s*)$/)?.[0] || "";
	newText = newText.replace(/^(\s*)/, leadingWhitespace).replace(/(\s*)$/, trailingWhitespace);

	const diff = diffWords(oldText, newText);
	if (isOverlength) {
		(diff.at(-1) as Change).removed = false;
		const cutOffCallout = `

> [!INFO] End of text transforming
> The input text was too long. Text after this point is unchanged.

`;
		diff.splice(-2, 0, { added: false, removed: false, value: cutOffCallout });
	}

	let textWithChanges = diff
		.map((part) => {
			if (!part.added && !part.removed) return part.value;
			const withMarkup = part.added ? `==${part.value}==` : `~~${part.value}~~`;
			return withMarkup.replace(/^(==|~~)(\s)/, "$2$1");
		})
		.join("");

	textWithChanges = textWithChanges
		.replace(/~~\[\^\w+\]~~/g, "$1")
		.replace(/~~"~~==[“”]==/g, '"')
		.replace(/~~'~~==[‘’]==/g, "'")
		.replace(/~~(.+?)(.{1,2})~~==(\1)==/g, "$1~~$2~~")
		.replace(/~~(.+?)~~==(?:\1)(.{1,2})==/g, "$1==$2==")
		.replace(/ {2}(?!$)/gm, " ");

	if (settings.preserveBlockquotes) {
		textWithChanges = textWithChanges
			.replace(/^~~>~~/gm, ">")
			.replace(/^~~(>[^~=]*)~~$/gm, "$1")
			.replace(/^>.*/gm, (blockquote) => rejectChanges(blockquote));
	}
	if (settings.preserveTextInsideQuotes) {
		textWithChanges = textWithChanges.replace(/"[^"]+"/g, (quote) => rejectChanges(quote));
	}

	const changeCount = (textWithChanges.match(/==|~~/g)?.length || 0) / 2;
	return { textWithSuggestions: textWithChanges, changeCount: changeCount };
}

async function validateAndGetChangesAndNotify(
	plugin: TextTransformer,
	oldText: string,
	scope: string,
	prompt: TextTransformerPrompt,
): Promise<string | undefined> {
	if (oldText.trim() === "") {
		new Notice(`${scope} is empty.`);
		return;
	}
	if (oldText.match(/==|~~/)) {
		const warnMsg = `${scope} already has highlights or strikethroughs.
Please accept/reject the changes before making another text transforming request.`;
		new Notice(warnMsg, 6000);
		return;
	}

	const { app, settings } = plugin;
	const fileBefore = app.workspace.getActiveFile()?.path;
	const longInput = oldText.length > 1500;
	const veryLongInput = oldText.length > 15000;
	const notifDuration = longInput ? 0 : 4_000;

	let additionalContextForAI = "";
	const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
	let contextPanel: ContextControlPanel | null = null;
	if (contextPanelLeaves.length > 0) {
		const view = contextPanelLeaves[0].view;
		if (view instanceof ContextControlPanel) {
			contextPanel = view;
		}
	}

	const contextParts: string[] = [];
	if (contextPanel) {
		const customText = contextPanel.getCustomContextText();
		const useWholeNote = contextPanel.getWholeNoteContextState();
		const useDynamic = contextPanel.getDynamicContextState();

		if (customText) {
			contextParts.push(`--- Custom User-Provided Context Start ---
${customText}
--- Custom User-Provided Context End ---`);
		}

		if (useWholeNote) {
			const currentFile = app.workspace.getActiveFile();
			if (currentFile) {
				const fileContent = await app.vault.cachedRead(currentFile);
				let wholeNoteContext = fileContent;

				if (scope !== "Document" && fileContent.includes(oldText)) {
					const markerStart = "[[[USER_SELECTED_TEXT_STARTING_HERE>>>";
					const markerEnd = "<<<USER_SELECTED_TEXT_ENDING_HERE]]]";
					wholeNoteContext = fileContent.replace(
						oldText,
						`${markerStart}${oldText}${markerEnd}`,
					);
				}
				contextParts.push(`--- Whole Note Context Start (The text to be modified is marked as USER_SELECTED_TEXT_STARTING_HERE...USER_SELECTED_TEXT_ENDING_HERE or is the entirety of this content if the 'scope' was 'Document') ---
${wholeNoteContext}
--- Whole Note Context End ---`);
			}
		} else if (useDynamic) {
			contextParts.push("--- Dynamic Context (Placeholder - Not Yet Implemented) ---");
		}

		if (contextParts.length > 0) {
			additionalContextForAI = contextParts.join(`

`);
		}
	}

	let initialMsg = `🤖 ${scope} is being text transformed…`;
	if (additionalContextForAI) {
		initialMsg += " (with additional context)";
	}
	if (longInput) {
		initialMsg += `

Due to the length of the text, this may take a moment.${veryLongInput ? " (A minute or longer.)" : ""}

Do not go to a different file or change the original text in the meantime.`;
	}
	const notice = new Notice(initialMsg, longInput ? 0 : 4000);

	type ResponseType = Awaited<ReturnType<typeof geminiRequest>>;
	let response: ResponseType;
	if (settings.model.startsWith("gemini-")) {
		response = await geminiRequest(settings, oldText, prompt, additionalContextForAI);
	} else {
		response = await openAiRequest(settings, oldText, prompt, additionalContextForAI);
	}
	const { newText, isOverlength, cost } = response || {};
	notice.hide();
	if (!newText) return;

	const fileAfter = app.workspace.getActiveFile()?.path;
	if (fileBefore !== fileAfter) {
		const errmsg =
			"⚠️ The active file changed since the text transformer has been triggered. Aborting.";
		new Notice(errmsg, notifDuration);
		return;
	}

	const { textWithSuggestions, changeCount } = getDiffMarkdown(
		settings,
		oldText,
		newText,
		isOverlength,
	);
	if (textWithSuggestions === oldText) {
		new Notice("✅ Text is good, nothing to change.", notifDuration);
		return;
	}

	if (isOverlength) {
		const msg = `Text is longer than the maximum output supported by the AI model.

Suggestions are thus only made until the cut-off point.`;
		new Notice(msg, 10_000);
	}
	const pluralS = changeCount === 1 ? "" : "s";
	const msg2 = `🤖 ${changeCount} change${pluralS} made.

est. cost: $${cost?.toFixed(4)}`;
	new Notice(msg2, notifDuration);

	return textWithSuggestions;
}

export async function textTransformerDocument(
	plugin: TextTransformer,
	editor: Editor,
	prompt?: TextTransformerPrompt,
): Promise<void> {
	const noteWithFrontmatter = editor.getValue();
	const { contentStart } = getFrontMatterInfo(noteWithFrontmatter);
	const body = noteWithFrontmatter.slice(contentStart);

	const usePrompt =
		prompt || plugin.settings.prompts.find((p) => p.enabled) || plugin.settings.prompts[0];

	const changes = await validateAndGetChangesAndNotify(plugin, body, "Document", usePrompt);
	if (!changes) return;

	const bodyStartPos = editor.offsetToPos(contentStart);
	const bodyEndPos = editor.offsetToPos(noteWithFrontmatter.length);
	editor.replaceRange(changes, bodyStartPos, bodyEndPos);
	editor.setCursor(bodyStartPos);
}

export async function textTransformerText(
	plugin: TextTransformer,
	editor: Editor,
	prompt: TextTransformerPrompt,
): Promise<void> {
	const hasMultipleSelections = editor.listSelections().length > 1;
	if (hasMultipleSelections) {
		new Notice("Multiple selections are not supported.");
		return;
	}

	const cursor = editor.getCursor("from");
	const selection = editor.getSelection();
	const oldText = selection || editor.getLine(cursor.line);
	const scope = selection ? "Selection" : "Paragraph";

	const changes = await validateAndGetChangesAndNotify(plugin, oldText, scope, prompt);
	if (!changes) return;

	if (selection) {
		editor.replaceSelection(changes);
	} else {
		editor.setLine(cursor.line, changes);
	}
	if (selection) {
		editor.setCursor(editor.getCursor("from"));
	} else {
		editor.setCursor({ line: cursor.line, ch: 0 });
	}
}
