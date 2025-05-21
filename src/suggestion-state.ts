// src/suggestion-state.ts
import { StateField, StateEffect, MapMode } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export interface SuggestionMark {
	id: string;
	from: number;
	to: number;
	type: 'added' | 'removed';
}

export const setSuggestionsEffect = StateEffect.define<SuggestionMark[]>();
export const resolveSuggestionEffect = StateEffect.define<{ id: string }>(); // Effect carries object with id
export const clearAllSuggestionsEffect = StateEffect.define<null>();

export const suggestionStateField = StateField.define<SuggestionMark[]>({
	create() {
		console.log("TextTransformer State: suggestionStateField created."); // LOG
		return [];
	},
	update(marks, tr) {
		let newMarks = [...marks];

		if (tr.changes.length > 0) {
			newMarks = newMarks.map(mark => {
				const from = tr.changes.mapPos(mark.from, -1, MapMode.TrackDel);
				const to = tr.changes.mapPos(mark.to, 1, MapMode.TrackDel);
				if (from === null || to === null || from >= to) {
					return null;
				}
				return { ...mark, from, to };
			}).filter(Boolean) as SuggestionMark[];
		}

		for (const effect of tr.effects) {
			if (effect.is(setSuggestionsEffect)) {
				const idToResolve = effect.value.id; // This was a bug in my logging version, should be effect.value for setSuggestions
				console.log(`TextTransformer State: setSuggestionsEffect - New marks. Count: ${effect.value.length}`); // LOG
				newMarks = effect.value;
			} else if (effect.is(resolveSuggestionEffect)) {
				const idToResolve = effect.value.id;
				console.log(`TextTransformer State: resolveSuggestionEffect - Attempting to remove ID: '${idToResolve}'. Current count: ${newMarks.length}`); // LOG BEFORE

				const marksForLogging = [...newMarks];
				newMarks = newMarks.filter(m => {
					const isMatch = m.id === idToResolve;
					// console.log(`TextTransformer State: Filtering - Mark ID '${m.id}' vs Resolve ID '${idToResolve}'. Match: ${isMatch}`); // Can be noisy
					return !isMatch;
				});

				if (marksForLogging.length === newMarks.length && marksForLogging.some(m => m.id === idToResolve)) { // Check if it *should* have been removed
					console.warn(`TextTransformer State: resolveSuggestionEffect - Mark ID '${idToResolve}' WAS NOT REMOVED (filter failed or ID mismatch). Marks present before filter:`, JSON.stringify(marksForLogging.map(m => m.id))); // LOG WARN
				} else if (marksForLogging.length > newMarks.length) {
					console.log(`TextTransformer State: resolveSuggestionEffect - Mark ID '${idToResolve}' successfully removed. New count: ${newMarks.length}`); // LOG SUCCESS
				} else {
					// console.log(`TextTransformer State: resolveSuggestionEffect - Mark ID '${idToResolve}' not found (already gone or never existed). Count: ${newMarks.length}`);
				}

			} else if (effect.is(clearAllSuggestionsEffect)) {
				console.log("TextTransformer State: clearAllSuggestionsEffect - Clearing all marks."); // LOG
				newMarks = [];
			}
		}

		if (marks.length !== newMarks.length || (newMarks.length > 0 && JSON.stringify(marks) !== JSON.stringify(newMarks))) {
			console.log("TextTransformer State: suggestionStateField *final value updated*. Old count:", marks.length, "New count:", newMarks.length); // LOG
		}
		return newMarks;
	},
});


const suggestionViewPlugin = ViewPlugin.fromClass(class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		console.log("TextTransformer ViewPlugin: constructor."); // LOG
		this.decorations = Decoration.none;
		try {
			this.decorations = this.computeDecorations(view, "constructor");
		} catch (e) {
			console.error("TextTransformer ViewPlugin: Error in constructor computeDecorations:", e);
			this.decorations = Decoration.none;
		}
	}

	update(update: ViewUpdate) {
		let needsRecompute = false;

		if (!update) {
			console.warn("TextTransformer ViewPlugin: update() called with undefined 'update' object."); // LOG WARN
			needsRecompute = true;
		} else {
			if (update.docChanged) needsRecompute = true;
			if (update.viewportChanged) needsRecompute = true;

			if (update.prevState) {
				const prevMarks = update.prevState.field(suggestionStateField, false);
				const currentMarks = update.state.field(suggestionStateField, false);
				if (prevMarks !== currentMarks) {
					needsRecompute = true;
				}
			} else {
				// console.warn("TextTransformer ViewPlugin: update.prevState is undefined."); // Can be noisy
			}

			if (update.transactions.some(tr => tr.effects.some(e => e.is(setSuggestionsEffect) || e.is(resolveSuggestionEffect) || e.is(clearAllSuggestionsEffect)))) {
				needsRecompute = true;
			}
		}

		if (needsRecompute) {
			try {
				this.decorations = this.computeDecorations(update.view, "update");
			} catch (e) {
				console.error("TextTransformer ViewPlugin: Error in update computeDecorations:", e);
				this.decorations = Decoration.none;
			}
		}
	}

	computeDecorations(view: EditorView, callContext: string): DecorationSet {
		if (!view || !view.state) {
			console.error(`TextTransformer ViewPlugin (${callContext}): computeDecorations - invalid view or view.state.`); // LOG ERROR
			return Decoration.none;
		}

		const marks = view.state.field(suggestionStateField, false);

		if (!marks) {
			console.warn(`TextTransformer ViewPlugin (${callContext}): suggestionStateField not found in view.state.`); // LOG WARN
			return Decoration.none;
		}

		if (marks.length === 0) {
			return Decoration.none;
		}
		console.log(`TextTransformer ViewPlugin (${callContext}): computeDecorations. Marks in state: ${marks.length}`); // LOG

		const activeDecorations: Decoration[] = [];
		for (const mark of marks) {
			let style = ""; // INLINE STYLES
			if (mark.type === 'added') {
				style = "background-color: lightgreen !important; color: black !important; display: inline !important; padding: 0 1px; border-bottom: 1px solid green;";
			} else if (mark.type === 'removed') {
				style = "background-color: pink !important; text-decoration: line-through !important; text-decoration-color: red !important; color: #555 !important; display: inline !important; padding: 0 1px;";
			}

			if (mark.from >= mark.to) {
				console.error(`TextTransformer ViewPlugin (${callContext}): SKIPPING Mark ID ${mark.id} (invalid range from ${mark.from} >= to ${mark.to}).`); // LOG ERROR
				continue;
			}
			if (mark.from < 0 || mark.to > view.state.doc.length) {
				console.error(`TextTransformer ViewPlugin (${callContext}): SKIPPING Mark ID ${mark.id} (out of bounds from ${mark.from}, to ${mark.to}, docLen ${view.state.doc.length}).`); // LOG ERROR
				continue;
			}

			try {
				const decorationInstance = Decoration.mark({
					attributes: { style: style } // INLINE STYLES
				}).range(mark.from, mark.to);
				activeDecorations.push(decorationInstance);
			} catch (e) {
				console.error(`TextTransformer ViewPlugin (${callContext}): ERROR creating deco for Mark ID ${mark.id}. Error:`, e); // LOG ERROR
			}
		}

		if (activeDecorations.length === 0 && marks.length > 0) {
			console.warn(`TextTransformer ViewPlugin (${callContext}): All marks were skipped or resulted in no decoration.`); // LOG WARN
		}

		const decoSet = Decoration.set(activeDecorations, true);
		// console.log(`TextTransformer ViewPlugin (${callContext}): Final DecorationSet created. Size: ${decoSet.size}`); // Can be noisy
		return decoSet;
	}
}, {
	decorations: (pluginInstance: SuggestionViewPluginClass) => {
		if (pluginInstance && pluginInstance.decorations) {
			if (pluginInstance.decorations.size > 0) {
				//    console.log("TextTransformer ViewPlugin: DECORATIONS ACCESSOR CALLED. Size:", pluginInstance.decorations.size); // Can be noisy
			}
			return pluginInstance.decorations;
		}
		console.warn("TextTransformer ViewPlugin: DECORATIONS ACCESSOR - pluginInstance or .decorations is null/undefined."); // LOG WARN
		return Decoration.none;
	}
});

export const textTransformerSuggestionExtensions = () => {
	return [
		suggestionStateField,
		suggestionViewPlugin
	];
};

let _suggestionIdCounter = 0;
export function generateSuggestionId(): string {
	_suggestionIdCounter++;
	return `tt-suggestion-${_suggestionIdCounter}`;
}
