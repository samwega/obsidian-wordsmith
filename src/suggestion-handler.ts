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

const SCROLL_COMFORT_ZONE_PX = 200; // Pixels for yMargin

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
			effects: EditorView.scrollIntoView(targetMark.from, {
				y: "nearest",
				yMargin: SCROLL_COMFORT_ZONE_PX,
			}),
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
			effects: EditorView.scrollIntoView(targetMark.from, {
				y: "nearest",
				yMargin: SCROLL_COMFORT_ZONE_PX,
			}),
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

	if (!shouldForceResolve && !effectivelyOnTarget) {
		cm.dispatch({
			effects: EditorView.scrollIntoView(targetMark.from, {
				y: "nearest",
				yMargin: SCROLL_COMFORT_ZONE_PX,
			}),
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
					? targetMark.newlineChar
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
		// Cursor position logic for reject remains the same
		if (targetMark.type === "added") {
			newCursorPosAfterResolve = targetMark.from;
		} else if (targetMark.type === "removed") {
			newCursorPosAfterResolve = targetMark.from;
		}
	}

	const currentEffects: StateEffect<unknown>[] = [
		resolveSuggestionEffect.of({ id: targetMark.id }),
	];

	if (shouldForceResolve) {
		currentEffects.push(
			EditorView.scrollIntoView(newCursorPosAfterResolve, {
				y: "nearest",
				yMargin: SCROLL_COMFORT_ZONE_PX,
			}),
		);
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

		if (nextSuggestionToFocus && cm.state.selection.main.head !== nextSuggestionToFocus.from) {
			cm.dispatch({
				effects: EditorView.scrollIntoView(nextSuggestionToFocus.from, {
					y: "nearest",
					yMargin: SCROLL_COMFORT_ZONE_PX,
				}),
				selection: EditorSelection.cursor(nextSuggestionToFocus.from),
			});
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	// Simplified: if on an empty line, it's its own paragraph.
	// Otherwise, expand to nearest empty lines or document boundaries.
	if (lineFrom.text.trim() === "") {
		// For an empty line, the paragraph is just this line.
		// However, the original logic of finding the *next* paragraph with suggestions
		// when the current is empty of suggestions will handle this.
		// The key is that getParagraphBoundaries is used to define the *scope*
		// if the cursor is in an empty line, this still correctly gives the bounds of that empty line.
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
	if (currentPos >= doc.length && doc.length > 0) return; // Handle empty doc or start past end

	while (currentPos < doc.length) {
		// Find the start of the next non-empty line block
		let paragraphBeginLineNum = -1;
		let firstLineAtCurrentSearch = doc.lineAt(currentPos);

		// Skip initial empty lines at currentPos to find the actual start of a paragraph
		for (let n = firstLineAtCurrentSearch.number; n <= doc.lines; n++) {
			const line = doc.line(n);
			if (currentPos > line.from && currentPos <= line.to && line.text.trim() === "") {
				// currentPos is within an empty line, advance to next line
				if (n < doc.lines) {
					currentPos = doc.line(n + 1).from;
					firstLineAtCurrentSearch = doc.lineAt(currentPos); // Re-evaluate starting line
					continue;
				}
				return; // End of document consisting of empty lines
			}
			if (currentPos > line.to) {
				// currentPos is beyond this line
				continue;
			}

			if (line.text.trim() !== "") {
				paragraphBeginLineNum = n;
				break;
			}
			// If it's an empty line and we are looking for start of paragraph,
			// update currentPos to start of next line to continue search for non-empty.
			if (n < doc.lines) {
				currentPos = doc.line(n + 1).from;
			} else {
				// Reached end of document with empty lines
				return;
			}
		}

		if (paragraphBeginLineNum === -1) return; // No more non-empty paragraphs

		const paragraphStartLine = doc.line(paragraphBeginLineNum);
		let paragraphEndLine = paragraphStartLine;

		// Find the end of this block of non-empty lines
		while (paragraphEndLine.number < doc.lines) {
			const nextLine = doc.line(paragraphEndLine.number + 1);
			if (nextLine.text.trim() === "") break;
			paragraphEndLine = nextLine;
		}

		yield { from: paragraphStartLine.from, to: paragraphEndLine.to };
		currentPos = paragraphEndLine.to + 1; // Move to the position after the yielded paragraph
		if (currentPos >= doc.length && paragraphEndLine.number === doc.lines) return; // End of doc
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
	let targetParagraphForFocusAfterOp: { from: number; to: number } | null = null;

	if (currentSelection.empty) {
		isOperatingOnIdentifiedParagraph = true;
		operationRange = getParagraphBoundaries(doc, cursorOriginalPos);
		targetParagraphForFocusAfterOp = operationRange; // Initially assume current paragraph

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
			// Start iterating from the beginning of the document to find the *next* paragraph with suggestions
			// relative to the current paragraph's *end*.
			const searchStartOffset = operationRange.to + 1;
			const paragraphIterator = iterateParagraphs(doc, searchStartOffset);

			for (const p of paragraphIterator) {
				const marksInThisP = allMarks.filter((mark) => {
					if (mark.type === "added") {
						return mark.from >= p.from && mark.from <= p.to;
					}
					return mark.from < p.to && mark.to > p.from;
				});

				if (marksInThisP.length > 0) {
					operationRange = p;
					targetParagraphForFocusAfterOp = p;
					// finalCursorPos should be start of this new paragraph for focus
					finalCursorPos = p.from;
					foundNextParagraphWithSuggestions = true;
					new Notice(
						`No suggestions in current paragraph. Moved to next paragraph with suggestions. Press again to ${action} all in this paragraph.`,
						4000,
					);
					// Dispatch scroll and selection change immediately to show the user the new target
					cm.dispatch({
						selection: EditorSelection.cursor(finalCursorPos),
						effects: EditorView.scrollIntoView(finalCursorPos, {
							y: "nearest",
							yMargin: SCROLL_COMFORT_ZONE_PX,
						}),
					});
					return; // User needs to press again
				}
			}
			// If still no suggestions found after checking subsequent paragraphs
			if (!foundNextParagraphWithSuggestions) {
				// As a fallback, check paragraphs *before* the current one if no suggestions were found after.
				const preParagraphIterator = iterateParagraphs(doc, 0);
				let lastParagraphWithSuggestionsBeforeCurrent: { from: number; to: number } | null =
					null;
				for (const p of preParagraphIterator) {
					if (p.from >= operationRange.from) break; // Stop if we've reached or passed the original paragraph

					const marksInThisP = allMarks.filter((mark) => {
						if (mark.type === "added") return mark.from >= p.from && mark.from <= p.to;
						return mark.from < p.to && mark.to > p.from;
					});
					if (marksInThisP.length > 0) {
						lastParagraphWithSuggestionsBeforeCurrent = p;
					}
				}
				if (lastParagraphWithSuggestionsBeforeCurrent) {
					operationRange = lastParagraphWithSuggestionsBeforeCurrent;
					targetParagraphForFocusAfterOp = lastParagraphWithSuggestionsBeforeCurrent;
					finalCursorPos = lastParagraphWithSuggestionsBeforeCurrent.from;
					foundNextParagraphWithSuggestions = true;
					new Notice(
						`No suggestions in current paragraph or following. Moved to a previous paragraph with suggestions. Press again to ${action} all in this paragraph.`,
						4000,
					);
					cm.dispatch({
						selection: EditorSelection.cursor(finalCursorPos),
						effects: EditorView.scrollIntoView(finalCursorPos, {
							y: "nearest",
							yMargin: SCROLL_COMFORT_ZONE_PX,
						}),
					});
					return; // User needs to press again
				}
			}

			if (!foundNextParagraphWithSuggestions) {
				new Notice(
					"No suggestions found in the current paragraph or any other paragraph.",
					4000,
				);
				return;
			}
		}
	} else {
		// Selection is not empty
		operationRange = { from: currentSelection.from, to: currentSelection.to };
		finalCursorPos = currentSelection.from; // Default to start of selection
		targetParagraphForFocusAfterOp = operationRange; // The selection itself is the target
	}

	const marksInScope = allMarks.filter((mark) => {
		const pFrom = operationRange.from;
		const pTo = operationRange.to;
		if (mark.type === "added") {
			return mark.from >= pFrom && mark.from <= pTo;
		}
		// For removed, ensure the mark overlaps with the paragraph
		return mark.from < pTo && mark.to > pFrom;
	});

	if (marksInScope.length === 0) {
		// This check might be redundant if the logic above (finding next/prev paragraph) correctly informs the user and returns.
		// However, keeping it as a safeguard.
		const message = isOperatingOnIdentifiedParagraph
			? "Target paragraph has no suggestions. Cursor moved if another paragraph with suggestions was found."
			: "No suggestions found in the current selection.";
		new Notice(message, 3000);
		return;
	}

	const changesArray: { from: number; to: number; insert: string }[] = [];
	const effectsArray: StateEffect<{ id: string }>[] = [];
	const sortedMarksInScope = [...marksInScope].sort((a, b) => b.from - a.from); // Process from end to start

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
		// For 'reject', no text change is made, the mark is just removed from state.
		if (textChange) changesArray.push(textChange);
	}

	// Determine the cursor position *after* changes are applied.
	// If operating on an identified paragraph, place cursor at its start.
	// If operating on a text selection, place cursor at its original start.
	// This simplifies cursor logic compared to complex adjustment calculations.
	let newCursorPos = finalCursorPos; // Default to original logic (start of selection or start of found paragraph)

	if (isOperatingOnIdentifiedParagraph && targetParagraphForFocusAfterOp) {
		newCursorPos = targetParagraphForFocusAfterOp.from;
	} else if (!isOperatingOnIdentifiedParagraph) {
		// Explicit text selection
		newCursorPos = currentSelection.from;
	}
	// If changes occurred, and we're accepting, the cursor might need to shift *if* it was within a modified part.
	// However, for bulk operations, placing it at the start of the operation range is often more predictable.
	// The previously complex cursor adjustment logic is simplified for bulk ops.

	const transactionSpec: TransactionSpec = {
		effects: effectsArray,
		selection: EditorSelection.cursor(newCursorPos),
	};

	if (changesArray.length > 0) {
		transactionSpec.changes = changesArray;
	}

	const scrollTargetPos =
		"main" in (transactionSpec.selection || {})
			? (transactionSpec.selection as EditorSelection).main.head
			: newCursorPos;

	const scrollEffect = EditorView.scrollIntoView(scrollTargetPos, {
		y: "nearest",
		yMargin: SCROLL_COMFORT_ZONE_PX,
	});

	let allEffects: StateEffect<unknown>[];
	if (Array.isArray(transactionSpec.effects)) {
		allEffects = transactionSpec.effects as StateEffect<unknown>[];
	} else if (transactionSpec.effects) {
		allEffects = [transactionSpec.effects as StateEffect<unknown>];
	} else {
		allEffects = [];
	}
	allEffects.push(scrollEffect);
	transactionSpec.effects = allEffects;

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
