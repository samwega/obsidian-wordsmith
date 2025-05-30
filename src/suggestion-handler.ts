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

// NEW helper function
function isPositionComfortablyVisible(cm: EditorView, pos: number): boolean {
	try {
		const coords = cm.coordsAtPos(pos); // Returns null if pos is not in the rendered part of the doc
		if (!coords) {
			return false;
		}

		// coords.top is the top of the character, in document pixels (relative to document top)
		const charTopInDocument = coords.top;

		const scrollTop = cm.scrollDOM.scrollTop; // Current scroll position of the editor
		const viewportHeight = cm.scrollDOM.clientHeight; // Visible height of the editor's scrollable content

		const comfortMarginRatio = 0.2;
		// Comfort zone boundaries, in document pixels
		const comfortZoneTopInDocument = scrollTop + viewportHeight * comfortMarginRatio;
		const comfortZoneBottomInDocument = scrollTop + viewportHeight * (1 - comfortMarginRatio);

		// Check if the character's top position falls within the comfort zone of the current viewport
		return (
			charTopInDocument >= comfortZoneTopInDocument &&
			charTopInDocument <= comfortZoneBottomInDocument
		);
	} catch (e) {
		// Fallback if coordsAtPos fails for any reason (e.g., view not fully initialized, unusual state)
		console.warn(
			"WordSmith: Error in isPositionComfortablyVisible, assuming not comfortably visible.",
			e,
		);
		return false;
	}
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
		const effects: StateEffect<unknown>[] = [];
		if (!isPositionComfortablyVisible(cm, targetMark.from)) {
			effects.push(EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 }));
		}
		cm.dispatch({
			selection: EditorSelection.cursor(targetMark.from),
			effects: effects,
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
		const effects: StateEffect<unknown>[] = [];
		if (!isPositionComfortablyVisible(cm, targetMark.from)) {
			effects.push(EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 }));
		}
		cm.dispatch({
			selection: EditorSelection.cursor(targetMark.from),
			effects: effects,
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

	if (
		!shouldForceResolve &&
		(!effectivelyOnTarget || !isPositionComfortablyVisible(cm, targetMark.from))
	) {
		const effectsToDispatch: StateEffect<unknown>[] = [];
		if (!isPositionComfortablyVisible(cm, targetMark.from)) {
			effectsToDispatch.push(
				EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 }),
			);
		}
		cm.dispatch({
			effects: effectsToDispatch,
			selection: EditorSelection.cursor(targetMark.from),
		});
		new Notice(`Next suggestion is active. Press again to ${action}.`, 3000);
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
		if (targetMark.type === "added") {
			newCursorPosAfterResolve = targetMark.from;
		} else if (targetMark.type === "removed") {
			newCursorPosAfterResolve = targetMark.from;
		}
	}

	const currentEffects: StateEffect<unknown>[] = [
		resolveSuggestionEffect.of({ id: targetMark.id }),
	];

	if (shouldForceResolve && !isPositionComfortablyVisible(cm, newCursorPosAfterResolve)) {
		currentEffects.push(
			EditorView.scrollIntoView(newCursorPosAfterResolve, { y: "center", yMargin: 50 }),
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
		if (nextSuggestionToFocus) {
			const nextTargetPos = nextSuggestionToFocus.from;
			const isCursorAlreadyAtNextTarget =
				cm.state.selection.main.head === nextTargetPos && cm.state.selection.main.empty;

			const effectsToDispatch: StateEffect<unknown>[] = [];
			let needsDispatch = false;

			if (!isCursorAlreadyAtNextTarget) {
				needsDispatch = true;
			}

			if (!isPositionComfortablyVisible(cm, nextTargetPos)) {
				effectsToDispatch.push(
					EditorView.scrollIntoView(nextTargetPos, { y: "center", yMargin: 50 }),
				);
				needsDispatch = true;
			}

			if (needsDispatch) {
				cm.dispatch({
					effects: effectsToDispatch,
					selection: EditorSelection.cursor(nextTargetPos),
				});
			}
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

	if (lineFrom.text.trim() === "") {
		// Empty line logic remains
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
