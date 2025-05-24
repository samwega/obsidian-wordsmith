import { EditorSelection, StateEffect, Text, TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
// src/suggestion-handler.ts
import { Editor, Notice } from "obsidian";

import TextTransformer from "./main"; // Import plugin class
import {
	SuggestionMark,
	clearAllSuggestionsEffect,
	resolveSuggestionEffect,
	suggestionStateField,
} from "./suggestion-state";

function getCmEditorView(editor: Editor): EditorView | null {
	const cmInstance = editor.cm;
	return cmInstance instanceof EditorView ? cmInstance : null;
}

// Helper for Feature 2: Find next suggestion mark for focusing
function findNextMarkToFocus(marks: SuggestionMark[], currentPos: number): SuggestionMark | null {
    if (marks.length === 0) return null;
    const sortedMarks = [...marks].sort((a, b) => a.from - b.from);
    
    // Find first mark strictly AFTER currentPos
    for (const mark of sortedMarks) {
        if (mark.from > currentPos) return mark;
    }
    // If no mark is after currentPos (i.e., cursor is at or after the last mark), cycle to the first mark.
    return sortedMarks[0]; 
}

// Helper for Feature 2: Find previous suggestion mark for focusing
function findPreviousMarkToFocus(marks: SuggestionMark[], currentPos: number): SuggestionMark | null {
    if (marks.length === 0) return null;
    const sortedMarks = [...marks].sort((a, b) => a.from - b.from); // Sort ascending

    // Find the last mark whose 'from' is strictly BEFORE currentPos
    let foundMark: SuggestionMark | null = null;
    for (let i = sortedMarks.length - 1; i >= 0; i--) {
        const mark = sortedMarks[i];
        if (mark.from < currentPos) {
            foundMark = mark;
            break; 
        }
    }
    // If a mark before currentPos was found, return it.
    // Otherwise (cursor is at or before the first mark), cycle to the last mark.
    return foundMark || sortedMarks[sortedMarks.length - 1];
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
    const targetMark = findNextMarkToFocus(allMarks, currentPos);

    if (targetMark) { // Should always find a mark if allMarks.length > 0 due to cycling
        cm.dispatch({
            selection: EditorSelection.cursor(targetMark.from),
            effects: EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 })
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
    const targetMark = findPreviousMarkToFocus(allMarks, currentPos); 

    if (targetMark) { // Should always find a mark if allMarks.length > 0 due to cycling
        cm.dispatch({
            selection: EditorSelection.cursor(targetMark.from),
            effects: EditorView.scrollIntoView(targetMark.from, { y: "center", yMargin: 50 })
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
			if (targetMark.isNewlineChange && targetMark.newlineChar) {
				textChangeSpec = {
					from: targetMark.from,
					to: targetMark.to,
					insert: targetMark.newlineChar,
				};
				newCursorPosAfterResolve = targetMark.from + targetMark.newlineChar.length;
			} else {
                newCursorPosAfterResolve = targetMark.to;
            }
		} else if (targetMark.type === "removed") {
			textChangeSpec = { from: targetMark.from, to: targetMark.to, insert: "" };
		}
	} else if (action === "reject") {
		if (targetMark.type === "added") {
			textChangeSpec = { from: targetMark.from, to: targetMark.to, insert: "" };
		} else if (targetMark.type === "removed") {
			if (targetMark.isNewlineChange && targetMark.newlineChar) {
				textChangeSpec = {
					from: targetMark.from,
					to: targetMark.to,
					insert: targetMark.newlineChar, 
				};
				newCursorPosAfterResolve = targetMark.from + targetMark.newlineChar.length;
			} else {
                newCursorPosAfterResolve = targetMark.to;
            }
		}
	}

	let currentEffects: StateEffect<any>[] = [resolveSuggestionEffect.of({ id: targetMark.id })];

    if (shouldForceResolve && !isPositionVisible(cm, newCursorPosAfterResolve)){
        currentEffects.push(EditorView.scrollIntoView(newCursorPosAfterResolve, {y: "center"}));
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
		if (!shouldForceResolve && marksAfterResolution.length > 0) {
			const nextSuggestionToFocus = findNextSuggestionMark(cm, cm.state.selection.main.head);
			if (nextSuggestionToFocus) {
                if (cm.state.selection.main.head !== nextSuggestionToFocus.from || !isPositionVisible(cm, nextSuggestionToFocus.from)) {
                    cm.dispatch({
                        effects: isPositionVisible(cm, nextSuggestionToFocus.from) ? [] : EditorView.scrollIntoView(nextSuggestionToFocus.from, {
                            y: "center",
                            yMargin: 50,
                        }),
                        selection: EditorSelection.cursor(nextSuggestionToFocus.from),
                    });
                }
			}
		}
	}
}

function getParagraphBoundaries(doc: Text, pos: number): { from: number; to: number } {
	let lineFrom = doc.lineAt(pos);
	let lineTo = doc.lineAt(pos);

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
		const line = doc.lineAt(currentPos);
		let paragraphBeginLineNum = -1;

		for (let n = line.number; n <= doc.lines; n++) {
			const l = doc.line(n);
			if (currentPos > l.to && n > line.number) continue;
			if (l.text.trim() !== "") {
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

	let paragraphToOperateOn: { from: number; to: number } | null = null;
	let finalCursorPos = cursorOriginalPos;
	let isOperatingOnIdentifiedParagraph = false;

	if (currentSelection.empty) {
		isOperatingOnIdentifiedParagraph = true;
		const paragraphAtCursor = getParagraphBoundaries(doc, cursorOriginalPos);
		let pToProcess: { from: number; to: number } | null = null;

		let iterator = iterateParagraphs(doc, paragraphAtCursor.from);
		for (const p of iterator) {
			const marksInP = allMarks.filter((mark) => mark.from < p.to && mark.to > p.from);
			if (marksInP.length > 0) {
				pToProcess = p;
				break;
			}
		}

		if (!pToProcess && paragraphAtCursor.from > 0) {
			iterator = iterateParagraphs(doc, 0);
			for (const p of iterator) {
				if (p.from >= paragraphAtCursor.from) break;
				const marksInP = allMarks.filter((mark) => mark.from < p.to && mark.to > p.from);
				if (marksInP.length > 0) {
					pToProcess = p;
					break;
				}
			}
		}

		paragraphToOperateOn = pToProcess;

		if (paragraphToOperateOn) {
			if (
				paragraphToOperateOn.from === paragraphAtCursor.from &&
				paragraphToOperateOn.to === paragraphAtCursor.to
			) {
				finalCursorPos = cursorOriginalPos;
			} else {
				finalCursorPos = paragraphToOperateOn.from;
			}
		} else {
			const initialParagraphContent = doc
				.sliceString(paragraphAtCursor.from, paragraphAtCursor.to)
				.trim();
			if (initialParagraphContent === "") {
				new Notice(
					"Cursor is in an empty paragraph. No suggestions found elsewhere in the document.",
					4000,
				);
			} else {
				new Notice(
					"No suggestions found in the current paragraph or elsewhere in the document.",
					4000,
				);
			}
			return;
		}
	} else {
		paragraphToOperateOn = { from: currentSelection.from, to: currentSelection.to };
		finalCursorPos = currentSelection.from;
	}

	if (!paragraphToOperateOn) {
		new Notice("Could not determine a paragraph or selection to process.", 3000);
		return;
	}

	const marksInScope = allMarks.filter(
		(mark) => mark.from < paragraphToOperateOn?.to && mark.to > paragraphToOperateOn?.from,
	);

	if (marksInScope.length === 0) {
		const message = isOperatingOnIdentifiedParagraph
			? "Error: Target paragraph has no suggestions after selection."
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
				if (mark.isNewlineChange && mark.newlineChar) {
					textChange = { from: mark.from, to: mark.to, insert: mark.newlineChar };
				}
			} else if (mark.type === "removed") {
				textChange = { from: mark.from, to: mark.to, insert: "" };
			}
		} else if (action === "reject") {
			if (mark.type === "added") {
				textChange = { from: mark.from, to: mark.to, insert: "" };
			} else if (mark.type === "removed" && mark.isNewlineChange && mark.newlineChar) {
				textChange = { from: mark.from, to: mark.to, insert: mark.newlineChar };
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
		let finalEffectiveCursorPos = finalCursorPos;
		const sortedChangesArrayForCursor = [...changesArray].sort((a, b) => a.from - b.from);
		for (const change of sortedChangesArrayForCursor) {
			if (finalEffectiveCursorPos > change.from) {
				if (finalEffectiveCursorPos <= change.to) {
					finalEffectiveCursorPos = change.from + change.insert.length;
				} else {
					finalEffectiveCursorPos += change.insert.length - (change.to - change.from);
				}
			}
		}
		transactionSpec.selection = EditorSelection.cursor(finalEffectiveCursorPos);
	}
	cm.dispatch(cm.state.update(transactionSpec));

	const noticeMessage = `${marksInScope.length} suggestion(s) in ${isOperatingOnIdentifiedParagraph ? "paragraph" : "selection"} ${action}ed.`;
	new Notice(noticeMessage, 3000);

	const remainingMarksAfterOp = cm.state.field(suggestionStateField, false) || [];
	if (remainingMarksAfterOp.length === 0 && marksInScope.length > 0) {
		new Notice("All suggestions resolved!", 2000);
	}
}

export function clearAllActiveSuggestionsCM6(_plugin: TextTransformer, editor: Editor): void {
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

	const changesArray: { from: number; to: number; insert: string }[] = [];
	const sortedMarks = [...marks].sort((a, b) => b.from - a.from);

	for (const mark of sortedMarks) {
		if (mark.type === "added") {
			changesArray.push({ from: mark.from, to: mark.to, insert: "" });
		} else if (mark.type === "removed" && mark.isNewlineChange && mark.newlineChar) {
			changesArray.push({ from: mark.from, to: mark.to, insert: mark.newlineChar });
		}
	}

	const transactionSpec: TransactionSpec = {
		effects: clearAllSuggestionsEffect.of(null),
	};
	if (changesArray.length > 0) {
		let finalCursorPos = cm.state.selection.main.head;
		const sortedChangesForCursor = [...changesArray].sort((a,b) => a.from - b.from);
		for (const change of sortedChangesForCursor) {
			if (finalCursorPos > change.from) {
				if (finalCursorPos <= change.to) {
					finalCursorPos = change.from + change.insert.length;
				} else {
					finalCursorPos += change.insert.length - (change.to - change.from);
				}
			}
		}
		transactionSpec.selection = EditorSelection.cursor(finalCursorPos);
		transactionSpec.changes = changesArray;
	} else {
		transactionSpec.selection = cm.state.selection;
	}
	cm.dispatch(cm.state.update(transactionSpec));
	new Notice("All active suggestions cleared (changes rejected).", 3000);
}