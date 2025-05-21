// src/textTransformer.ts
import { diffWords } from "diff";
import { Editor, Notice, getFrontMatterInfo } from "obsidian"; // Removed TFile as it was unused
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state"; // Removed unused Transaction

import TextTransformer from "./main";
import { geminiRequest } from "./providers/gemini";
import { openAiRequest } from "./providers/openai";
import { TextTransformerPrompt } from "./settings"; // Removed unused TextTransformerSettings
import { ContextControlPanel, CONTEXT_CONTROL_VIEW_TYPE } from "./context-control-panel";

import { setSuggestionsEffect, SuggestionMark, generateSuggestionId, suggestionStateField, clearAllSuggestionsEffect } from "./suggestion-state";

function getCmEditorView(editor: Editor): EditorView | null {
    const cmInstance = editor.cm; // Access editor.cm
    return cmInstance instanceof EditorView ? cmInstance : null;
}

async function validateAndApplyAIDrivenChanges(
    plugin: TextTransformer,
    editor: Editor,
    originalText: string,
    scope: "Document" | "Selection" | "Paragraph",
    promptInfo: TextTransformerPrompt,
    scopeRangeCm: { from: number; to: number }
): Promise<boolean> {
    const cm = getCmEditorView(editor);
    if (!cm) {
        new Notice("Text Transformer requires CodeMirror 6. Cannot apply suggestions.");
        return false;
    }

    if (originalText.trim() === "") {
        new Notice(`${scope} is empty.`);
        return false;
    }

    const existingSuggestions = cm.state.field(suggestionStateField, false);
    if (existingSuggestions && existingSuggestions.length > 0) {
        const warnMsg = `${scope} already has active suggestions. Please accept or reject them first.`;
        new Notice(warnMsg, 6000);
        return false;
    }

    const { app, settings } = plugin;
    const fileBefore = app.workspace.getActiveFile()?.path;
    const longInput = originalText.length > 1500;
    const veryLongInput = originalText.length > 15000;
    const notifDuration = longInput ? 0 : 4_000;

    let additionalContextForAI = "";
    const contextPanelLeaves = app.workspace.getLeavesOfType(CONTEXT_CONTROL_VIEW_TYPE);
    let contextPanel: ContextControlPanel | null = null;
    if (contextPanelLeaves.length > 0) {
        const view = contextPanelLeaves[0].view;
        if (view instanceof ContextControlPanel) contextPanel = view;
    }

    const contextParts: string[] = [];
    const markerStart = "[[[USER_SELECTED_TEXT_STARTING_HERE>>>";
    const markerEnd = "<<<USER_SELECTED_TEXT_ENDING_HERE]]]";

    if (contextPanel) {
        const customText = contextPanel.getCustomContextText();
		const useWholeNote = contextPanel.getWholeNoteContextState();
		const useDynamic = contextPanel.getDynamicContextState();

		if (customText) {
			contextParts.push(`--- Custom User-Provided Context Start ---${customText}--- Custom User-Provided Context End ---`);
		}

		if (useDynamic) {
			const linesToIncludeAround = plugin.settings.dynamicContextLineCount;
			let selectionStartLine: number, selectionEndLine: number;

			if (scope === "Selection" && editor.somethingSelected()) {
                const sel = editor.listSelections()[0];
				selectionStartLine = Math.min(sel.anchor.line, sel.head.line);
				selectionEndLine = Math.max(sel.anchor.line, sel.head.line);
			} else {
				selectionStartLine = editor.getCursor("from").line;
				selectionEndLine = selectionStartLine;
			}

			const docFirstLine = 0;
			const docLastLine = editor.lastLine();
			const contextStartLine = Math.max(docFirstLine, selectionStartLine - linesToIncludeAround);
			const contextEndLine = Math.min(docLastLine, selectionEndLine + linesToIncludeAround);

			let dynamicContextLines: string[] = [];
			for (let i = contextStartLine; i <= contextEndLine; i++) {
				dynamicContextLines.push(editor.getLine(i));
			}
			let dynamicContextText = dynamicContextLines.join('\\n');

			if (dynamicContextText.includes(originalText)) {
				dynamicContextText = dynamicContextText.replace(originalText, `${markerStart}${originalText}${markerEnd}`);
			}
			contextParts.push(`--- Dynamic Context Start ---${dynamicContextText}--- Dynamic Context End ---`);

		} else if (useWholeNote) {
			const currentFile = app.workspace.getActiveFile();
			if (currentFile) {
				const fileContent = await app.vault.cachedRead(currentFile);
				let wholeNoteContext = fileContent;
				if (scope !== "Document" && fileContent.includes(originalText)) {
					wholeNoteContext = fileContent.replace(originalText, `${markerStart}${originalText}${markerEnd}`);
				}
				contextParts.push(`--- Whole Note Context Start ---${wholeNoteContext}--- Whole Note Context End ---`);
			}
		}
		if (contextParts.length > 0) additionalContextForAI = contextParts.join('\\n\\n');
    }

    let initialMsg = `🤖 ${scope} is being text transformed…`;
	if (additionalContextForAI) initialMsg += " (with additional context)";
    if (longInput) {
        initialMsg += `\n\nDue to the length of the text, this may take a moment.${veryLongInput ? " (A minute or longer.)" : ""}\n\nDo not go to a different file or change the original text in the meantime.`;
    }
    const notice = new Notice(initialMsg, longInput ? 0 : 4000);

    let currentPrompt: TextTransformerPrompt = { ...promptInfo };
	if (currentPrompt.id === "translate") {
		const targetLanguageSetting = plugin.settings.translationLanguage?.trim();
		currentPrompt.text = currentPrompt.text.replace(
            "{language}",
            targetLanguageSetting || "any suitable language based on the provided text"
        );
	}

    type ResponseType = Awaited<ReturnType<typeof geminiRequest>>;
    let response: ResponseType;
    if (settings.model.startsWith("gemini-")) {
        response = await geminiRequest(settings, originalText, currentPrompt, additionalContextForAI);
    } else {
        response = await openAiRequest(settings, originalText, currentPrompt, additionalContextForAI);
    }
    const { newText: newTextFromAI, isOverlength, cost } = response || {};
    notice.hide();

    if (!newTextFromAI) {
        new Notice("AI did not return new text.", notifDuration);
        return false;
    }

    if (fileBefore !== app.workspace.getActiveFile()?.path) {
        new Notice("⚠️ The active file changed. Aborting.", notifDuration);
        return false;
    }

    const diffResult = diffWords(originalText, newTextFromAI);
    if (!diffResult.some(part => part.added || part.removed)) {
        new Notice("✅ Text is good, AI suggested no changes.", notifDuration);
        return false;
    }

    let textToInsertInEditor = "";
    const suggestionMarks: SuggestionMark[] = [];
    let currentInsertOffset = 0;

    for (const part of diffResult) {
        const partStart = scopeRangeCm.from + currentInsertOffset;
        const partEnd = partStart + part.value.length;

        if (part.added) {
            suggestionMarks.push({
                id: generateSuggestionId(),
                from: partStart,
                to: partEnd,
                type: 'added',
            });
            textToInsertInEditor += part.value;
            currentInsertOffset += part.value.length;
        } else if (part.removed) {
            suggestionMarks.push({
                id: generateSuggestionId(),
                from: partStart,
                to: partEnd,
                type: 'removed',
            });
            textToInsertInEditor += part.value;
            currentInsertOffset += part.value.length;
        } else {
            textToInsertInEditor += part.value;
            currentInsertOffset += part.value.length;
        }
    }

    cm.dispatch(cm.state.update({
        changes: {
            from: scopeRangeCm.from,
            to: scopeRangeCm.to,
            insert: textToInsertInEditor,
        },
        effects: [
            clearAllSuggestionsEffect.of(null),
            setSuggestionsEffect.of(suggestionMarks)
        ],
        selection: EditorSelection.cursor(scopeRangeCm.from),
        scrollIntoView: true,
    }));

    if (isOverlength) {
        new Notice(`Text is longer than the maximum output supported by the AI model. Suggestions may be incomplete.`, 10_000);
    }
    const changeCount = suggestionMarks.length;
    const pluralS = changeCount === 1 ? "" : "s";
    new Notice(`🤖 ${changeCount} suggestion${pluralS} applied.\nEst. cost: $${cost?.toFixed(4)}`, notifDuration);

    return true;
}

export async function textTransformerDocumentCM6(
    plugin: TextTransformer,
    editor: Editor,
    prompt?: TextTransformerPrompt,
): Promise<void> {
    const cm = getCmEditorView(editor);
    if (!cm) {
        new Notice("CodeMirror 6 is required for this feature.");
        return;
    }

    const fullDocText = editor.getValue();
    const fmInfo = getFrontMatterInfo(fullDocText);
    const bodyTextOffsetStart = fmInfo.contentStart;
    const bodyText = fullDocText.substring(bodyTextOffsetStart);
    const bodyEndOffset = bodyTextOffsetStart + bodyText.length;

    const usePrompt = prompt || plugin.settings.prompts.find((p) => p.enabled) || plugin.settings.prompts[0];
    if (!usePrompt) {
        new Notice("No prompt configured for document transformation.");
        return;
    }

    await validateAndApplyAIDrivenChanges(
        plugin,
        editor,
        bodyText,
        "Document",
        usePrompt,
        { from: bodyTextOffsetStart, to: bodyEndOffset }
    );
}

export async function textTransformerTextCM6(
    plugin: TextTransformer,
    editor: Editor,
    prompt: TextTransformerPrompt,
): Promise<void> {
    const cm = getCmEditorView(editor);
    if (!cm) {
        new Notice("CodeMirror 6 is required for this feature.");
        return;
    }

    if (editor.listSelections().length > 1) {
        new Notice("Multiple selections are not yet supported with the new suggestion system.");
        return;
    }

    let originalText: string;
    let textScope: "Selection" | "Paragraph";
    let rangeCm: { from: number; to: number };

    const currentSelection = cm.state.selection.main;
    if (!currentSelection.empty) {
        originalText = cm.state.sliceDoc(currentSelection.from, currentSelection.to);
        textScope = "Selection";
        rangeCm = { from: currentSelection.from, to: currentSelection.to };
    } else {
        const cursorLineNum = editor.getCursor("from").line;
        const line = cm.state.doc.line(cursorLineNum + 1);
        originalText = line.text;
        textScope = "Paragraph";
        rangeCm = { from: line.from, to: line.to };
    }

    if (!prompt) {
        new Notice("No prompt provided for text transformation.");
        return;
    }

    await validateAndApplyAIDrivenChanges(
        plugin,
        editor,
        originalText,
        textScope,
        prompt,
        rangeCm
    );
}