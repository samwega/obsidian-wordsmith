import { Change, diffWords } from "diff";
import { Editor, Notice, getFrontMatterInfo } from "obsidian";
import { rejectChanges } from "./accept-reject-suggestions";
import Proofreader from "./main";
import { openAiRequest } from "./providers/openai";
import { ProofreaderPrompt, ProofreaderSettings } from "./settings";

// DOCS https://github.com/kpdecker/jsdiff#readme
function getDiffMarkdown(
	settings: ProofreaderSettings,
	oldText: string,
	newText: string,
	isOverlength?: boolean,
): { textWithSuggestions: string; changeCount: number } {
	// ENSURE SAME AMOUNT OF SURROUNDING WHITESPACE
	// (A selection can have surrounding whitespace, but the AI response usually
	// removes those. This results in the text effectively being trimmed.)
	const leadingWhitespace = oldText.match(/^(\s*)/)?.[0] || "";
	const trailingWhitespace = oldText.match(/(\s*)$/)?.[0] || "";
	newText = newText.replace(/^(\s*)/, leadingWhitespace).replace(/(\s*)$/, trailingWhitespace);

	// GET DIFF
	const diff = diffWords(oldText, newText);
	if (isOverlength) {
		// do not remove text after cutoff-length
		(diff.at(-1) as Change).removed = false;
		const cutOffCallout =
			"\n\n" +
			"> [!INFO] End of proofreading\n" +
			"> The input text was too long. Text after this point is unchanged." +
			"\n\n";
		diff.splice(-2, 0, { added: false, removed: false, value: cutOffCallout });
	}

	// CONVERT DIFF TO TEXT
	// with ==highlights== and ~~strikethrough~~ as suggestions
	let textWithChanges = diff
		.map((part) => {
			if (!part.added && !part.removed) return part.value;
			const withMarkup = part.added ? `==${part.value}==` : `~~${part.value}~~`;
			return withMarkup.replace(/^(==|~~)(\s)/, "$2$1"); // prevent leading spaces as they make markup invalid
		})
		.join("");

	// CLEANUP
	textWithChanges = textWithChanges
		.replace(/~~\[\^\w+\]~~/g, "$1") // preserve footnotes
		.replace(/~~"~~==[“”]==/g, '"') // preserve non-smart quotes
		.replace(/~~'~~==[‘’]==/g, "'")
		.replace(/~~(.+?)(.{1,2})~~==(\1)==/g, "$1~~$2~~") // only removal of 1-2 char, e.g. plural-s
		.replace(/~~(.+?)~~==(?:\1)(.{1,2})==/g, "$1==$2==") // only addition of 1-2 char
		.replace(/ {2}(?!$)/gm, " "); // rare double spaces created by diff (not EoL due to 2-space-rule)

	// PRESERVE QUOTES
	if (settings.preserveBlockquotes) {
		textWithChanges = textWithChanges
			.replace(/^~~>~~/gm, ">") // if AI removes blockquote marker
			.replace(/^~~(>[^~=]*)~~$/gm, "$1") // if AI removes blockquote itself
			.replace(/^>.*/gm, (blockquote) => rejectChanges(blockquote));
	}
	if (settings.preserveTextInsideQuotes) {
		textWithChanges = textWithChanges.replace(/"[^"]+"/g, (quote) => rejectChanges(quote));
	}

	const changeCount = (textWithChanges.match(/==|~~/g)?.length || 0) / 2;
	return { textWithSuggestions: textWithChanges, changeCount: changeCount };
}

async function validateAndGetChangesAndNotify(
	plugin: Proofreader,
	oldText: string,
	scope: string,
	prompt: ProofreaderPrompt,
): Promise<string | undefined> {
	// GUARD valid start-text
	if (oldText.trim() === "") {
		new Notice(`${scope} is empty.`);
		return;
	}
	if (oldText.match(/==|~~/)) {
		const warnMsg =
			`${scope} already has highlights or strikethroughs.\n\n` +
			"Please accept/reject the changes before making another proofreading request.";
		new Notice(warnMsg, 6000);
		return;
	}

	// parameters
	const { app, settings } = plugin;
	const fileBefore = app.workspace.getActiveFile()?.path;
	const longInput = oldText.length > 1500;
	const veryLongInput = oldText.length > 15000;
	// Proofreading a document likely takes longer, we want to keep the finishing
	// message in case the user went afk. (In the Notice API, duration 0 means
	// keeping the notice until the user dismisses it.)
	const notifDuration = longInput ? 0 : 4_000;

	// notify on start
	let msg = `🤖 ${scope} is being proofread…`;
	if (longInput) {
		msg += "\n\nDue to the length of the text, this may take a moment.";
		if (veryLongInput) msg += " (A minute or longer.)";
		msg += "\n\nDo not go to a different file or change the original text in the meantime.";
	}
	const notice = new Notice(msg, 0);

	// perform request
	const { newText, isOverlength, cost } = (await openAiRequest(settings, oldText, prompt)) || {};
	notice.hide();
	if (!newText) return;

	// check if active file changed
	const fileAfter = app.workspace.getActiveFile()?.path;
	if (fileBefore !== fileAfter) {
		const errmsg = "⚠️ The active file changed since the proofread has been triggered. Aborting.";
		new Notice(errmsg, notifDuration);
		return;
	}

	// check if diff is even needed
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

	// notify on changes
	if (isOverlength) {
		const msg =
			"Text is longer than the maximum output supported by the AI model.\n\n" +
			"Suggestions are thus only made until the cut-off point.";
		new Notice(msg, 10_000);
	}
	const pluralS = changeCount === 1 ? "" : "s";
	const msg2 = [
		`🤖 ${changeCount} change${pluralS} made.`,
		"",
		`est. cost: $${cost?.toFixed(4)}`,
	].join("\n");
	new Notice(msg2, notifDuration);

	return textWithSuggestions;
}

//──────────────────────────────────────────────────────────────────────────────

export async function proofreadDocument(
	plugin: Proofreader,
	editor: Editor,
	prompt?: ProofreaderPrompt,
): Promise<void> {
	const noteWithFrontmatter = editor.getValue();
	const bodyStart = getFrontMatterInfo(noteWithFrontmatter).contentStart || 0;
	const bodyEnd = noteWithFrontmatter.length;
	const oldText = noteWithFrontmatter.slice(bodyStart);

	// Use provided prompt or fallback to first enabled/default
	const usePrompt =
		prompt || plugin.settings.prompts.find((p) => p.enabled) || plugin.settings.prompts[0];

	const changes = await validateAndGetChangesAndNotify(plugin, oldText, "Document", usePrompt);
	if (!changes) return;

	const bodyStartPos = editor.offsetToPos(bodyStart);
	const bodyEndPos = editor.offsetToPos(bodyEnd);
	editor.replaceRange(changes, bodyStartPos, bodyEndPos);
	editor.setCursor(bodyStartPos); // to start of doc
}

export async function proofreadText(
	plugin: Proofreader,
	editor: Editor,
	prompt: ProofreaderPrompt,
): Promise<void> {
	const hasMultipleSelections = editor.listSelections().length > 1;
	if (hasMultipleSelections) {
		new Notice("Multiple selections are not supported.");
		return;
	}

	const cursor = editor.getCursor("from"); // `from` gives start if selection
	const selection = editor.getSelection();
	const oldText = selection || editor.getLine(cursor.line);
	const scope = selection ? "Selection" : "Paragraph";

	const changes = await validateAndGetChangesAndNotify(plugin, oldText, scope, prompt);
	if (!changes) return;

	if (selection) {
		editor.replaceSelection(changes);
		editor.setCursor(cursor); // to start of selection
	} else {
		editor.setLine(cursor.line, changes);
		editor.setCursor({ line: cursor.line, ch: 0 }); // to start of paragraph
	}
}
