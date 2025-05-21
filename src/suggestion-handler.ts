// src/suggestion-handler.ts
import { Editor, Notice } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorSelection, TransactionSpec, StateEffect } from "@codemirror/state"; // Added TransactionSpec, StateEffect

import { suggestionStateField, resolveSuggestionEffect, SuggestionMark, clearAllSuggestionsEffect } from "./suggestion-state";

function getCmEditorView(editor: Editor): EditorView | null {
    const cmInstance = editor.cm;
    return cmInstance instanceof EditorView ? cmInstance : null;
}

function findNextSuggestionMark(cm: EditorView, fromPos?: number): SuggestionMark | null {
    const marks = cm.state.field(suggestionStateField);
    if (!marks || marks.length === 0) return null;

    const searchStartPos = fromPos !== undefined ? fromPos : cm.state.selection.main.head;
    const sortedMarks = [...marks].sort((a, b) => a.from - b.from);

    for (const mark of sortedMarks) {
        if (mark.from >= searchStartPos) return mark;
    }
    return sortedMarks.length > 0 ? sortedMarks[0] : null;
}

function isPositionVisible(cm: EditorView, pos: number): boolean {
    const coords = cm.coordsAtPos(pos);
    if (!coords) return false;
    const viewRect = cm.scrollDOM.getBoundingClientRect(); // Use scrollDOM for accurate viewport
    // Check if the coordinate is within the visible area of the scrollDOM
    return coords.top >= viewRect.top && coords.top <= viewRect.bottom &&
           coords.left >= viewRect.left && coords.left <= viewRect.right;
}


export function resolveNextSuggestionCM6(editor: Editor, action: 'accept' | 'reject'): void {
    const cm = getCmEditorView(editor);
    if (!cm) { new Notice("CodeMirror 6 view not found."); return; }

    const marks = cm.state.field(suggestionStateField);
    if (!marks || marks.length === 0) { new Notice("No suggestions to resolve.", 3000); return; }

    const cursorHead = cm.state.selection.main.head;
    let targetMark = findNextSuggestionMark(cm, cursorHead);

    if (!targetMark) { new Notice("Could not find a next suggestion.", 3000); return; }
    
    if (!isPositionVisible(cm, targetMark.from)) {
        cm.dispatch({
            effects: EditorView.scrollIntoView(targetMark.from, { y: "center" }),
            selection: EditorSelection.cursor(targetMark.from)
        });
        new Notice(`Scrolled to the next suggestion. Press again to ${action}.`, 3000);
        return;
    }

    let textChange: { from: number; to: number; insert: string } | undefined = undefined;
    let newCursorPos = targetMark.from;

    if (action === 'accept') {
        if (targetMark.type === 'removed') {
            textChange = { from: targetMark.from, to: targetMark.to, insert: "" };
        }
    } else { // 'reject'
        if (targetMark.type === 'added') {
            textChange = { from: targetMark.from, to: targetMark.to, insert: "" };
        } else { // 'removed' rejected means keep text, cursor might go to end of it
             newCursorPos = targetMark.to;
        }
    }

    const transactionSpec: TransactionSpec = {
        effects: resolveSuggestionEffect.of({ id: targetMark.id })
    };

    if (textChange) {
        transactionSpec.changes = textChange;
        transactionSpec.selection = EditorSelection.cursor(textChange.from);
    } else {
        transactionSpec.selection = EditorSelection.cursor(newCursorPos);
    }
    cm.dispatch(cm.state.update(transactionSpec));

    const remainingMarks = cm.state.field(suggestionStateField).filter(m => m.id !== targetMark!.id);
    if (remainingMarks.length === 0) {
        new Notice(`Last suggestion ${action}ed. All suggestions resolved!`, 3000);
    } else {
        new Notice(`Suggestion ${action}ed. ${remainingMarks.length} remaining.`, 3000);
        const nextAfterResolve = findNextSuggestionMark(cm, cm.state.selection.main.head);
        if (nextAfterResolve) {
            cm.dispatch({ // Separate transaction for scrolling if needed
                effects: EditorView.scrollIntoView(nextAfterResolve.from, { y: "center", yMargin: 50 }),
                selection: EditorSelection.cursor(nextAfterResolve.from)
            });
        }
    }
}


export function resolveSuggestionsInSelectionCM6(editor: Editor, action: 'accept' | 'reject'): void {
    const cm = getCmEditorView(editor);
    if (!cm) { new Notice("CodeMirror 6 view not found."); return; }

    const currentCmSelection = cm.state.selection.main;
    if (currentCmSelection.empty) {
        new Notice("No text selected. Use 'Accept/Reject Next' or select text containing suggestions.");
        return;
    }

    const allMarks = cm.state.field(suggestionStateField);
    const marksInSelection = allMarks.filter(mark =>
        mark.from < currentCmSelection.to && mark.to > currentCmSelection.from
    );

    if (marksInSelection.length === 0) { new Notice("No suggestions found in the current selection.", 3000); return; }

    const changesArray: { from: number; to: number; insert: string }[] = [];
    const effectsArray: StateEffect<{ id: string; }>[] = marksInSelection.map(mark => resolveSuggestionEffect.of({ id: mark.id }));
    const sortedMarksInSelection = [...marksInSelection].sort((a, b) => b.from - a.from);

    for (const mark of sortedMarksInSelection) {
        if (action === 'accept') {
            if (mark.type === 'removed') {
                changesArray.push({ from: mark.from, to: mark.to, insert: "" });
            }
        } else { // 'reject'
            if (mark.type === 'added') {
                changesArray.push({ from: mark.from, to: mark.to, insert: "" });
            }
        }
    }
    
    const transactionSpec: TransactionSpec = {
        effects: effectsArray,
        selection: EditorSelection.cursor(currentCmSelection.from)
    };
    if (changesArray.length > 0) {
        transactionSpec.changes = changesArray;
    }
    cm.dispatch(cm.state.update(transactionSpec));

    new Notice(`${marksInSelection.length} suggestion(s) in selection ${action}ed.`, 3000);
    const remainingMarksAfterOp = cm.state.field(suggestionStateField).filter(m => !marksInSelection.find(ms => ms.id === m.id));
    if (remainingMarksAfterOp.length === 0 && marksInSelection.length > 0) {
        new Notice(`All suggestions resolved!`, 2000);
    }
}

export function clearAllActiveSuggestionsCM6(editor: Editor): void {
    const cm = getCmEditorView(editor);
    if (!cm) { new Notice("CodeMirror 6 view not found."); return; }

    const marks = cm.state.field(suggestionStateField);
    if (!marks || marks.length === 0) { new Notice("No suggestions to clear.", 3000); return; }

    const changesArray: { from: number; to: number; insert: string }[] = [];
    const sortedMarks = [...marks].sort((a,b) => b.from - a.from);

    for (const mark of sortedMarks) {
        if (mark.type === 'added') {
            changesArray.push({ from: mark.from, to: mark.to, insert: "" });
        }
    }

    const transactionSpec: TransactionSpec = {
        effects: clearAllSuggestionsEffect.of(null)
    };
    if (changesArray.length > 0) {
        transactionSpec.changes = changesArray;
    }
    cm.dispatch(cm.state.update(transactionSpec));
    new Notice("All active suggestions cleared (changes rejected).", 3000);
}