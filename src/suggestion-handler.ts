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
			effects: EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 }),
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
			effects: EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 }),
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

function isPositionVisible(cm: EditorView, pos: number): boolean {
	return pos >= cm.viewport.from && pos <= cm.viewport.to;
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

	if (!shouldForceResolve && (!effectivelyOnTarget || !isPositionVisible(cm, targetMark.from))) {
		cm.dispatch({
			effects: EditorView.scrollIntoView(targetMark.from, { y: "center" }),
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
			// No document change, ghost text just disappears
			newCursorPosAfterResolve = targetMark.from;
		} else if (targetMark.type === "removed") {
			// No document change, marked text remains
			newCursorPosAfterResolve = targetMark.from; // Stay at the start of the "kept" text
		}
	}

	const currentEffects: StateEffect<unknown>[] = [
		resolveSuggestionEffect.of({ id: targetMark.id }),
	];

	if (shouldForceResolve && !isPositionVisible(cm, newCursorPosAfterResolve)) {
		currentEffects.push(EditorView.scrollIntoView(newCursorPosAfterResolve, { y: "center" }));
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
		if (
			nextSuggestionToFocus &&
			(cm.state.selection.main.head !== nextSuggestionToFocus.from ||
				!isPositionVisible(cm, nextSuggestionToFocus.from))
		) {
			cm.dispatch({
				effects: isPositionVisible(cm, nextSuggestionToFocus.from)
					? []
					: EditorView.scrollIntoView(nextSuggestionToFocus.from, {
							y: "center",
							yMargin: 50,
						}),
				selection: EditorSelection.cursor(nextSuggestionToFocus.from),
			});
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	// If the line at pos is empty, and it's not the first line,
	// and the previous line is also empty, this is likely an empty paragraph
	// between two other paragraphs. In this case, the paragraph is just this line.
	if (lineFrom.text.trim() === "") {
		// If it's an empty line, the paragraph is just this line itself.
		// However, if we are looking for suggestions, they might be AT this position.
		// The original logic expanded outwards. Let's keep that for finding content blocks.
		// The crucial part is how this range is used to filter suggestions later.
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
	if (currentPos >= doc.length && doc.length > 0) return; // Handle empty or fully iterated doc

	while (currentPos < doc.length) {
		const firstLineAtCurrentPos = doc.lineAt(currentPos);
		let paragraphBeginLineNum = -1;

		// Find the start of the next non-empty paragraph block
		for (let n = firstLineAtCurrentPos.number; n <= doc.lines; n++) {
			const line = doc.line(n);
			// Ensure we don't re-process lines already passed by currentPos if currentPos is not at line.from
			if (currentPos > line.to && n > firstLineAtCurrentPos.number) continue;
			if (line.text.trim() !== "") {
				paragraphBeginLineNum = n;
				break;
			}
		}

		if (paragraphBeginLineNum === -1) return; // No more non-empty lines

		const paragraphStartLine = doc.line(paragraphBeginLineNum);
		let paragraphEndLine = paragraphStartLine;

		// Find the end of this paragraph block
		while (paragraphEndLine.number < doc.lines) {
			const nextLine = doc.line(paragraphEndLine.number + 1);
			if (nextLine.text.trim() === "") break;
			paragraphEndLine = nextLine;
		}

		yield { from: paragraphStartLine.from, to: paragraphEndLine.to };
		currentPos = paragraphEndLine.to + 1; // Move to the start of the character after this paragraph
		if (currentPos >= doc.length) return; // Re-check if we've reached the end
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
		// For an empty selection, the operation range is the paragraph at the cursor.
		// This includes the case of an empty line where suggestions might have been generated.
		operationRange = getParagraphBoundaries(doc, cursorOriginalPos);
		finalCursorPos = cursorOriginalPos; // Keep cursor where it was if in paragraph mode

		// Check if any suggestions exist within this identified paragraph.
		// If not, and we are in "paragraph mode", try to find the *next* paragraph with suggestions.
		const initialMarksInParagraph = allMarks.filter((mark) => {
			const pFrom = operationRange.from;
			const pTo = operationRange.to;
			if (mark.type === "added") {
				return mark.from >= pFrom && mark.from <= pTo;
			}
			return mark.from < pTo && mark.to > pFrom;
		});

		if (initialMarksInParagraph.length === 0) {
			// Current paragraph has no suggestions, try to find the next one.
			let foundNextParagraphWithSuggestions = false;
			const paragraphIterator = iterateParagraphs(doc, 0); // Start from beginning
			for (const p of paragraphIterator) {
				// Skip if this paragraph is the one at cursor (already checked)
				if (p.from === operationRange.from && p.to === operationRange.to) continue;

				const marksInThisP = allMarks.filter((mark) => {
					if (mark.type === "added") {
						return mark.from >= p.from && mark.from <= p.to;
					}
					return mark.from < p.to && mark.to > p.from;
				});

				if (marksInThisP.length > 0) {
					operationRange = p;
					finalCursorPos = p.from; // Move cursor to start of this new paragraph
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
		// Selection is not empty, operate on the selection range.
		operationRange = { from: currentSelection.from, to: currentSelection.to };
		finalCursorPos = currentSelection.from; // Move cursor to start of selection after operation
	}

	const marksInScope = allMarks.filter((mark) => {
		const pFrom = operationRange.from;
		const pTo = operationRange.to;
		if (mark.type === "added") {
			// 'added' mark is a point. It's in scope if its point is within or at boundaries.
			// This handles cases where pFrom === pTo (e.g., empty line).
			return mark.from >= pFrom && mark.from <= pTo;
		}
		// 'removed' mark spans a range. It's in scope if it overlaps.
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
	const sortedMarksInScope = [...marksInScope].sort((a, b) => b.from - a.from); // Process from end to start for changes

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
		// No document changes for "reject"
		if (textChange) changesArray.push(textChange);
	}

	const transactionSpec: TransactionSpec = {
		effects: effectsArray,
		selection: EditorSelection.cursor(finalCursorPos), // Initial cursor position for adjustment
	};

	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
		// Calculate final cursor position after all changes
		let adjustedCursorPos = finalCursorPos;
		const sortedChangesForCursor = [...changesArray].sort((a, b) => a.from - b.from); // Sort start to end for calculation
		for (const change of sortedChangesForCursor) {
			if (adjustedCursorPos > change.from) {
				if (adjustedCursorPos <= change.to) {
					// Cursor was inside the deleted/modified part
					adjustedCursorPos = change.from + change.insert.length;
				} else {
					// Cursor was after the change
					adjustedCursorPos += change.insert.length - (change.to - change.from);
				}
			} else if (adjustedCursorPos === change.from && change.to === change.from) {
				// Insertion at cursor (e.g. "added" mark)
				adjustedCursorPos += change.insert.length;
			}
		}
		transactionSpec.selection = EditorSelection.cursor(adjustedCursorPos);
	}

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
		selection: cm.state.selection,
	};

	cm.dispatch(cm.state.update(transactionSpec));
	new Notice("All active suggestions cleared (changes rejected).", 3000);
}
