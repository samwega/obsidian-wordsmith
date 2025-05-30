// src/suggestion-handler.ts
import { EditorSelection, StateEffect, Text, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Editor, Notice, TFile } from "obsidian";

import TextTransformer from "./main";
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	resolveSuggestionEffect,
	suggestionStateField,
} from "./suggestion-state";
import { getCmEditorView } from "./utils";

function findNextFocusTarget(
	marks: SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	for (const mark of sortedMarks) {
		if (mark.from > currentSelectionHead) return mark;
	}
	return sortedMarks[0];
}

function findPreviousFocusTarget(
	marks: SuggestionMark[],
	currentSelectionHead: number,
): SuggestionMark | null {
	if (marks.length === 0) return null;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	let foundMark: SuggestionMark | null = null;
	for (let i = sortedMarks.length - 1; i >= 0; i--) {
		const mark = sortedMarks[i];
		if (mark.from < currentSelectionHead) {
			foundMark = mark;
			break;
		}
	}
	return (foundMark || sortedMarks.at(-1)) ?? null;
}

export function focusNextSuggestionCM6(_plugin: TextTransformer, editor: Editor): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}
	const allMarks = cm.state.field(suggestionStateField, false) || [];
	if (allMarks.length === 0) {
		new Notice("No suggestions to navigate.", 2000);
		return;
	}
	const currentPos = cm.state.selection.main.head;
	const targetMark = findNextFocusTarget(allMarks, currentPos);
	if (targetMark) {
		cm.dispatch({
			selection: EditorSelection.cursor(targetMark.from),
			effects: EditorView.scrollIntoView(targetMark.from, { y: "nearest" }),
		});
	}
}

export function focusPreviousSuggestionCM6(_plugin: TextTransformer, editor: Editor): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}
	const allMarks = cm.state.field(suggestionStateField, false) || [];
	if (allMarks.length === 0) {
		new Notice("No suggestions to navigate.", 2000);
		return;
	}
	const currentPos = cm.state.selection.main.head;
	const targetMark = findPreviousFocusTarget(allMarks, currentPos);
	if (targetMark) {
		cm.dispatch({
			selection: EditorSelection.cursor(targetMark.from),
			effects: EditorView.scrollIntoView(targetMark.from, { y: "nearest" }),
		});
	}
}

function findNextSuggestionMark(cm: EditorView, fromPos?: number): SuggestionMark | null {
	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) return null;
	const searchStartPos = fromPos !== undefined ? fromPos : cm.state.selection.main.head;
	const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
	for (const mark of sortedMarks) {
		if (mark.from >= searchStartPos) return mark;
	}
	return sortedMarks.length > 0 ? sortedMarks[0] : null;
}

export function resolveNextSuggestionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
	action: "accept" | "reject",
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}

	const allMarksInState = cm.state.field(suggestionStateField, false);
	if (!allMarksInState || allMarksInState.length === 0) {
		new Notice("No suggestions to resolve.", 3000);
		return;
	}

	let targetMark: SuggestionMark | null;
	let shouldForceResolve = false;

	if (allMarksInState.length === 1) {
		targetMark = allMarksInState[0];
		shouldForceResolve = true;
	} else {
		const currentSelection = cm.state.selection.main;
		targetMark = findNextSuggestionMark(cm, currentSelection.head);
	}

	if (!targetMark) {
		new Notice("Could not find a suggestion to resolve.", 3000);
		return;
	}

	const currentSelection = cm.state.selection.main;
	const effectivelyOnTarget = currentSelection.empty && currentSelection.head === targetMark.from;

	// If not forcing resolve and cursor is not effectively on the target mark,
	// scroll to it and notify the user to press again.
	// `y: "nearest"` will handle not scrolling if already well-positioned.
	if (!shouldForceResolve && !effectivelyOnTarget) {
		cm.dispatch({
			effects: EditorView.scrollIntoView(targetMark.from, { y: "nearest" }),
			selection: EditorSelection.cursor(targetMark.from),
		});
		new Notice(`Scrolled to the next suggestion. Press again to ${action}.`, 3000);
		return;
	}

	let textChangeSpec: { from: number; to: number; insert: string } | undefined;
	let newCursorPosAfterResolve = targetMark.from;

	if (action === "accept") {
		if (targetMark.type === "added") {
			const textToInsert =
				targetMark.isNewlineChange && targetMark.newlineChar
					? targetMark.newlineChar // Should be '\n'
					: (targetMark.ghostText ?? "");
			textChangeSpec = {
				from: targetMark.from,
				to: targetMark.from,
				insert: textToInsert,
			};
			newCursorPosAfterResolve = targetMark.from + textToInsert.length;
		} else if (targetMark.type === "removed") {
			textChangeSpec = { from: targetMark.from, to: targetMark.to, insert: "" };
			newCursorPosAfterResolve = targetMark.from;
		}
	} else if (action === "reject") {
		if (targetMark.type === "added") {
			newCursorPosAfterResolve = targetMark.from;
		} else if (targetMark.type === "removed") {
			newCursorPosAfterResolve = targetMark.from;
		}
	}

	const currentEffects: StateEffect<unknown>[] = [
		resolveSuggestionEffect.of({ id: targetMark.id }),
	];

	// If forcing resolve (e.g. last suggestion), ensure the new cursor position is visible.
	if (shouldForceResolve) {
		// This check is a bit heuristic; `y: "nearest"` will do its best.
		// We add it to ensure an explicit scroll attempt if it was the last item.
		currentEffects.push(EditorView.scrollIntoView(newCursorPosAfterResolve, { y: "nearest" }));
	}

	const transactionSpec: TransactionSpec = {
		effects: currentEffects,
		selection: EditorSelection.cursor(newCursorPosAfterResolve),
	};

	if (textChangeSpec) {
		transactionSpec.changes = textChangeSpec;
	}

	cm.dispatch(cm.state.update(transactionSpec));

	const marksAfterResolution = cm.state.field(suggestionStateField, false) || [];

	if (marksAfterResolution.length === 0) {
		new Notice(`Last suggestion ${action}ed. All suggestions resolved!`, 3000);
	} else {
		new Notice(`Suggestion ${action}ed. ${marksAfterResolution.length} remaining.`, 3000);
		const nextSuggestionToFocus = findNextSuggestionMark(cm, cm.state.selection.main.head);

		if (nextSuggestionToFocus) {
			// If the cursor is not already at the next suggestion, or to ensure it's well-positioned.
			if (cm.state.selection.main.head !== nextSuggestionToFocus.from) {
				cm.dispatch({
					effects: EditorView.scrollIntoView(nextSuggestionToFocus.from, {
						y: "nearest",
					}),
					selection: EditorSelection.cursor(nextSuggestionToFocus.from),
				});
			}
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	if (lineFrom.text.trim() === "") {
		// Empty line paragraph logic can remain as is
	}

	while (lineFrom.number > 1) {
		const prevLine = doc.line(lineFrom.number - 1);
		if (prevLine.text.trim() === "") break;
		lineFrom = prevLine;
	}
	while (lineTo.number < doc.lines) {
		const nextLine = doc.line(lineTo.number + 1);
		if (nextLine.text.trim() === "") break;
		lineTo = nextLine;
	}
	return { from: lineFrom.from, to: lineTo.to };
}

function* iterateParagraphs(
	doc: Text,
	startPosition = 0,
): Generator<{ from: number; to: number }, void, undefined> {
	let currentPos = startPosition;
	if (currentPos >= doc.length && doc.length > 0) return; 

	while (currentPos < doc.length) {
		const firstLineAtCurrentPos = doc.lineAt(currentPos);
		let paragraphBeginLineNum = -1;

		for (let n = firstLineAtCurrentPos.number; n <= doc.lines; n++) {
			const line = doc.line(n);
			if (currentPos > line.to && n > firstLineAtCurrentPos.number) continue;
			if (line.text.trim() !== "") {
				paragraphBeginLineNum = n;
				break;
			}
		}

		if (paragraphBeginLineNum === -1) return;

		const paragraphStartLine = doc.line(paragraphBeginLineNum);
		let paragraphEndLine = paragraphStartLine;

		while (paragraphEndLine.number < doc.lines) {
			const nextLine = doc.line(paragraphEndLine.number + 1);
			if (nextLine.text.trim() === "") break;
			paragraphEndLine = nextLine;
		}

		yield { from: paragraphStartLine.from, to: paragraphEndLine.to };
		currentPos = paragraphEndLine.to + 1; 
		if (currentPos >= doc.length) return;
	}
}

export function resolveSuggestionsInSelectionCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
	action: "accept" | "reject",
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}

	const allMarks = cm.state.field(suggestionStateField, false);
	if (!allMarks || allMarks.length === 0) {
		new Notice("No suggestions found in the document.", 3000);
		return;
	}

	const doc = cm.state.doc;
	const currentSelection = cm.state.selection.main;
	const cursorOriginalPos = currentSelection.head;

	let operationRange: { from: number; to: number };
	let finalCursorPos = cursorOriginalPos;
	let isOperatingOnIdentifiedParagraph = false;

	if (currentSelection.empty) {
		isOperatingOnIdentifiedParagraph = true;
		operationRange = getParagraphBoundaries(doc, cursorOriginalPos);
		finalCursorPos = cursorOriginalPos;

		const initialMarksInParagraph = allMarks.filter((mark) => {
			const pFrom = operationRange.from;
			const pTo = operationRange.to;
			if (mark.type === "added") {
				return mark.from >= pFrom && mark.from <= pTo;
			}
			return mark.from < pTo && mark.to > pFrom;
		});

		if (initialMarksInParagraph.length === 0) {
			let foundNextParagraphWithSuggestions = false;
			const paragraphIterator = iterateParagraphs(doc, 0); 
			for (const p of paragraphIterator) {
				if (p.from === operationRange.from && p.to === operationRange.to) continue;

				const marksInThisP = allMarks.filter((mark) => {
					if (mark.type === "added") {
						return mark.from >= p.from && mark.from <= p.to;
					}
					return mark.from < p.to && mark.to > p.from;
				});

				if (marksInThisP.length > 0) {
					operationRange = p;
					finalCursorPos = p.from; 
					foundNextParagraphWithSuggestions = true;
					break;
				}
			}
			if (!foundNextParagraphWithSuggestions && initialMarksInParagraph.length === 0) {
				new Notice(
					"No suggestions found in the current paragraph or elsewhere in the document.",
					4000,
				);
				return;
			}
		}
	} else {
		operationRange = { from: currentSelection.from, to: currentSelection.to };
		finalCursorPos = currentSelection.from; 
	}

	const marksInScope = allMarks.filter((mark) => {
		const pFrom = operationRange.from;
		const pTo = operationRange.to;
		if (mark.type === "added") {
			return mark.from >= pFrom && mark.from <= pTo;
		}
		return mark.from < pTo && mark.to > pFrom;
	});

	if (marksInScope.length === 0) {
		const message = isOperatingOnIdentifiedParagraph
			? "Target paragraph has no suggestions."
			: "No suggestions found in the current selection.";
		new Notice(message, 3000);
		return;
	}

	const changesArray: { from: number; to: number; insert: string }[] = [];
	const effectsArray: StateEffect<{ id: string }>[] = [];
	const sortedMarksInScope = [...marksInScope].sort((a, b) => b.from - a.from); 

	for (const mark of sortedMarksInScope) {
		effectsArray.push(resolveSuggestionEffect.of({ id: mark.id }));
		let textChange: { from: number; to: number; insert: string } | undefined;
		if (action === "accept") {
			if (mark.type === "added") {
				const textToInsert =
					mark.isNewlineChange && mark.newlineChar ? mark.newlineChar : (mark.ghostText ?? "");
				textChange = { from: mark.from, to: mark.from, insert: textToInsert };
			} else if (mark.type === "removed") {
				textChange = { from: mark.from, to: mark.to, insert: "" };
			}
		}
		if (textChange) changesArray.push(textChange);
	}

	const transactionSpec: TransactionSpec = {
		effects: effectsArray,
		selection: EditorSelection.cursor(finalCursorPos), 
	};

	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
		let adjustedCursorPos = finalCursorPos;
		const sortedChangesForCursor = [...changesArray].sort((a, b) => a.from - b.from); 
		for (const change of sortedChangesForCursor) {
			if (adjustedCursorPos > change.from) {
				if (adjustedCursorPos <= change.to) {
					adjustedCursorPos = change.from + change.insert.length;
				} else {
					adjustedCursorPos += change.insert.length - (change.to - change.from);
				}
			} else if (adjustedCursorPos === change.from && change.to === change.from) {
				adjustedCursorPos += change.insert.length;
			}
		}
		transactionSpec.selection = EditorSelection.cursor(adjustedCursorPos);
	}
    // Add a scroll effect to ensure the final cursor position is comfortably visible.
    // This is especially useful after bulk operations.
    const scrollEffect = EditorView.scrollIntoView(
        'main' in (transactionSpec.selection || {}) 
            ? (transactionSpec.selection as EditorSelection).main.head 
            : finalCursorPos, 
        {y: "nearest"}
    );
    
    // Handle effects array properly
    const currentEffects = transactionSpec.effects || [];
    const effectsList = Array.isArray(currentEffects) ? currentEffects : [currentEffects];
    transactionSpec.effects = [...effectsList, scrollEffect];

	cm.dispatch(cm.state.update(transactionSpec));

	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} ${action}ed.`;
	new Notice(noticeMessage, 3000);

	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		new Notice("All suggestions resolved!", 2000);
	}
}

export function clearAllActiveSuggestionsCM6(
	_plugin: TextTransformer,
	editor: Editor,
	_file: TFile,
): void {
	const cm = getCmEditorView(editor);
	if (!cm) {
		new Notice("Modern editor version required.");
		return;
	}

	const marks = cm.state.field(suggestionStateField, false);
	if (!marks || marks.length === 0) {
		new Notice("No suggestions to clear.", 3000);
		return;
	}

	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null),
		selection: cm.state.selection, // Retain current selection
	};

	cm.dispatch(cm.state.update(transactionSpec));
	new Notice("All active suggestions cleared (changes rejected).", 3000);
}