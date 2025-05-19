import { Change, diffWords } from "diff";
import { Editor, Notice, getFrontMatterInfo, App, EditorSelectionOrCaret } from "obsidian"; // Added EditorSelectionOrCaret
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
	editor: Editor, // Added editor parameter
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
	const markerStart = "[[[USER_SELECTED_TEXT_STARTING_HERE>>>";
	const markerEnd = "<<<USER_SELECTED_TEXT_ENDING_HERE]]]";

	if (contextPanel) {
		const customText = contextPanel.getCustomContextText();
		const useWholeNote = contextPanel.getWholeNoteContextState();
		const useDynamic = contextPanel.getDynamicContextState();

		if (customText) {
			contextParts.push(`--- Custom User-Provided Context Start ---
${customText}
--- Custom User-Provided Context End ---`);
		}

		// Logic for Dynamic Context
		if (useDynamic) { 
			const linesToIncludeAround = 15; // Configurable: number of lines before and after
			let selectionStartLine: number;
			let selectionEndLine: number;

			// Determine the line range of oldText
			if (scope === "Selection") {
				// For a true editor selection, get its start and end lines
				const sel = editor.listSelections()[0]; 
				selectionStartLine = Math.min(sel.anchor.line, sel.head.line);
				selectionEndLine = Math.max(sel.anchor.line, sel.head.line);
			} else { // Handles "Paragraph" (where oldText is a single line)
				selectionStartLine = editor.getCursor("from").line;
				selectionEndLine = selectionStartLine; // oldText is a single line
			}

			const docFirstLine = 0;
			const docLastLine = editor.lastLine();

			const contextStartLine = Math.max(docFirstLine, selectionStartLine - linesToIncludeAround);
			const contextEndLine = Math.min(docLastLine, selectionEndLine + linesToIncludeAround);

			let dynamicContextLines: string[] = [];
			for (let i = contextStartLine; i <= contextEndLine; i++) {
				dynamicContextLines.push(editor.getLine(i));
			}
			let dynamicContextText = dynamicContextLines.join("
");
			
			// Mark oldText within the dynamic context
			// This replace should work even if oldText is multi-line from a selection,
			// or a single line from a paragraph context, as long as oldText is a direct substring.
			if (dynamicContextText.includes(oldText)) {
				dynamicContextText = dynamicContextText.replace(oldText, `${markerStart}${oldText}${markerEnd}`);
			} else {
                // Fallback or warning if oldText (e.g. complex selection) isn't found directly. 
                // For simple paragraph scope, this should ideally not happen.
                console.warn("TextTransformer: oldText not found in dynamic context for marking. Context sent without marker for oldText.");
            }

			contextParts.push(`--- Dynamic Context Start (Original text to transform is marked if found) ---
${dynamicContextText}
--- Dynamic Context End ---`);

		} else if (useWholeNote) { // Only use whole note if dynamic is not active
			const currentFile = app.workspace.getActiveFile();
			if (currentFile) {
				const fileContent = await app.vault.cachedRead(currentFile);
				let wholeNoteContext = fileContent;

				// Mark oldText within the whole note context if not transforming the whole document
				if (scope !== "Document" && fileContent.includes(oldText)) {
					wholeNoteContext = fileContent.replace(oldText, `${markerStart}${oldText}${markerEnd}`);
				}
				contextParts.push(`--- Whole Note Context Start (Original text to transform is marked if not entire document) ---
${wholeNoteContext}
--- Whole Note Context End ---`);
			}
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

	// Pass editor to validateAndGetChangesAndNotify
	const changes = await validateAndGetChangesAndNotify(plugin, editor, body, "Document", usePrompt);
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

	// Pass editor to validateAndGetChangesAndNotify
	const changes = await validateAndGetChangesAndNotify(plugin, editor, oldText, scope, prompt);
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
