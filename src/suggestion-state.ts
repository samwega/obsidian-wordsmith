// src/suggestion-state.ts
import { Extension, MapMode, Range, StateEffect, StateField } from "@codemirror/state"; // Removed Text
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export interface SuggestionMark {
	id: string;
	from: number;
	to: number;
	type: "added" | "removed";
	isNewlineChange?: boolean;
	newlineChar?: "\n";
}

interface SuggestionState {
	marks: SuggestionMark[];
	activeScope: { from: number; to: number } | null;
}

export const setSuggestionsEffect = StateEffect.define<{
	marksToSet: SuggestionMark[];
	scope: { from: number; to: number };
}>();
export const resolveSuggestionEffect = StateEffect.define<{ id: string }>();
export const clearAllSuggestionsEffect = StateEffect.define<null>();

export const suggestionStateField = StateField.define<SuggestionState>({
	create(): SuggestionState {
		return { marks: [], activeScope: null };
	},
	update(value, tr): SuggestionState {
		let newMarks = [...value.marks];
		let newActiveScope = value.activeScope ? { ...value.activeScope } : null;

		if (tr.changes.length > 0) {
			newMarks = newMarks
				.map((mark) => {
					const from = tr.changes.mapPos(mark.from, -1, MapMode.TrackDel);
					const to = tr.changes.mapPos(mark.to, 1, MapMode.TrackDel);
					if (from === null || to === null || from >= to) {
						return null;
					}
					return { ...mark, from, to };
				})
				.filter(Boolean) as SuggestionMark[];

			if (newActiveScope) {
				const mappedFrom = tr.changes.mapPos(newActiveScope.from, -1, MapMode.TrackDel);
				const mappedTo = tr.changes.mapPos(newActiveScope.to, 1, MapMode.TrackDel);
				if (mappedFrom === null || mappedTo === null || mappedFrom >= mappedTo) {
					newActiveScope = null;
				} else {
					newActiveScope.from = mappedFrom;
					newActiveScope.to = mappedTo;
				}
			}
		}

		for (const effect of tr.effects) {
			if (effect.is(setSuggestionsEffect)) {
				newMarks = effect.value.marksToSet;
				newActiveScope = effect.value.scope;
			} else if (effect.is(resolveSuggestionEffect)) {
				const idToResolve = effect.value.id;
				newMarks = newMarks.filter((m) => m.id !== idToResolve);
				if (newMarks.length === 0) {
					newActiveScope = null; // Clear scope if all marks resolved
				}
			} else if (effect.is(clearAllSuggestionsEffect)) {
				newMarks = [];
				newActiveScope = null;
			}
		}
		return { marks: newMarks, activeScope: newActiveScope };
	},
});

class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = Decoration.none;
		try {
			this.decorations = this.computeDecorations(view);
		} catch (e) {
			console.error("TextTransformer ViewPlugin: Error in constructor computeDecorations:", e);
			this.decorations = Decoration.none;
		}
	}

	update(update: ViewUpdate): void {
		let needsRecompute = false;

		if (!update) {
			if (this.decorations.size > 0) {
				this.decorations = Decoration.none;
			}
			return;
		}

		if (update.docChanged) needsRecompute = true;
		if (update.viewportChanged) needsRecompute = true;

		// Compare relevant parts of the state field from startState and state
		const prevFullState = update.startState.field(suggestionStateField, false);
		const currentFullState = update.state.field(suggestionStateField, false);
		if (prevFullState !== currentFullState) { // This checks if the object reference changed or marks/scope changed
			needsRecompute = true;
		}


		if (
			update.transactions.some((tr) =>
				tr.effects.some(
					(e) =>
						e.is(setSuggestionsEffect) ||
						e.is(resolveSuggestionEffect) ||
						e.is(clearAllSuggestionsEffect),
				),
			)
		) {
			needsRecompute = true;
		}

		if (needsRecompute) {
			try {
				this.decorations = this.computeDecorations(update.view);
			} catch (e) {
				console.error("TextTransformer ViewPlugin: Error in update computeDecorations:", e);
				this.decorations = Decoration.none; // Fallback on error
			}
		}
	}

	computeDecorations(view: EditorView): DecorationSet {
		if (!view || !view.state) {
			return Decoration.none;
		}

		const suggestionFullState = view.state.field(suggestionStateField, false);
		if (!suggestionFullState) return Decoration.none;

		const { marks, activeScope } = suggestionFullState;
		const activeDecorations: Range<Decoration>[] = [];
		const doc = view.state.doc;

		// Apply spellcheck="false" to lines within the activeScope
		if (activeScope && activeScope.from < activeScope.to) {
			try {
				// Ensure from/to are within document bounds before getting lines
				const safeFrom = Math.max(0, Math.min(activeScope.from, doc.length));
				const safeTo = Math.max(0, Math.min(activeScope.to, doc.length));

                if (safeFrom < safeTo) { // Only proceed if there's a valid range
				    const fromLine = doc.lineAt(safeFrom).number;
				    const toLine = doc.lineAt(safeTo).number;

				    for (let i = fromLine; i <= toLine; i++) {
					    const line = doc.line(i);
					    if (line && line.from <= doc.length) { // Check if line.from is valid
						    activeDecorations.push(
							    Decoration.line({
								    attributes: { spellcheck: "false" },
							    }).range(line.from),
						    );
					    }
				    }
                }
			} catch (e) {
				console.error("TextTransformer ViewPlugin: Error processing activeScope for line decorations:", e, activeScope, doc.length);
			}
		}

		// Apply visual styling for individual suggestion marks
		if (marks && marks.length > 0) {
			for (const mark of marks) {
				let className = "";
				if (mark.type === "added") {
					className = "text-transformer-added";
				} else if (mark.type === "removed") {
					className = "text-transformer-removed";
				}

				if (!className) {
					console.warn("TextTransformer ViewPlugin: Mark with unknown type skipped:", mark);
					continue;
				}
				if (mark.from >= mark.to) {
					console.warn(
						"TextTransformer ViewPlugin: Invalid mark range (from >= to), skipping:",
						mark,
					);
					continue;
				}
				if (mark.from < 0 || mark.to > doc.length) {
					console.warn("TextTransformer ViewPlugin: Mark range out of bounds, skipping:", mark);
					continue;
				}

				try {
					activeDecorations.push(
						Decoration.mark({
							attributes: { class: className },
						}).range(mark.from, mark.to),
					);
				} catch (e) {
					console.error(
						`TextTransformer ViewPlugin: ERROR creating mark decoration for Mark ID ${mark.id}. Class: ${className} Error:`,
						e,
					);
				}
			}
		}

		if (activeDecorations.length === 0) return Decoration.none;
		return Decoration.set(activeDecorations, true);
	}
}

const suggestionViewPlugin = ViewPlugin.fromClass(SuggestionViewPluginClass, {
	decorations: (pluginInstance: SuggestionViewPluginClass): DecorationSet => {
		if (pluginInstance?.decorations) {
			return pluginInstance.decorations;
		}
		return Decoration.none;
	},
});

export const textTransformerSuggestionExtensions = (): Extension[] => {
	return [suggestionStateField, suggestionViewPlugin];
};

let _suggestionIdCounter = 0;
export function generateSuggestionId(): string {
	_suggestionIdCounter++;
	return `tt-suggestion-${_suggestionIdCounter}`;
}