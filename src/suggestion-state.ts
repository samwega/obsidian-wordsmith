// src/suggestion-state.ts
import { StateField, StateEffect, MapMode, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export interface SuggestionMark {
	id: string;
	from: number;
	to: number;
	type: 'added' | 'removed';
    isNewlineChange?: boolean; 
    newlineChar?: '\n';       
}

export const setSuggestionsEffect = StateEffect.define<SuggestionMark[]>();
export const resolveSuggestionEffect = StateEffect.define<{ id: string }>();
export const clearAllSuggestionsEffect = StateEffect.define<null>();

export const suggestionStateField = StateField.define<SuggestionMark[]>({
	create() {
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
				newMarks = effect.value;
			} else if (effect.is(resolveSuggestionEffect)) {
				const idToResolve = effect.value.id;
				newMarks = newMarks.filter(m => m.id !== idToResolve);
			} else if (effect.is(clearAllSuggestionsEffect)) {
				newMarks = [];
			}
		}
		return newMarks;
	},
});

class SuggestionViewPluginClass {
	decorations: DecorationSet;

	constructor(view: EditorView) {
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
			 if (this.decorations.size > 0) {
                 this.decorations = Decoration.none;
             }
             return;
		}

		if (update.docChanged) needsRecompute = true;
		if (update.viewportChanged) needsRecompute = true;

		// @ts-expect-error prevState is not officially on ViewUpdate but is present
		const currentPrevState = update.prevState;
		if (currentPrevState) {
			const prevMarks = currentPrevState.field(suggestionStateField, false);
			const currentMarks = update.state.field(suggestionStateField, false);
			if (prevMarks !== currentMarks) {
				needsRecompute = true;
			}
		} else {
            needsRecompute = true;
		}

		if (update.transactions.some(tr => tr.effects.some(e => e.is(setSuggestionsEffect) || e.is(resolveSuggestionEffect) || e.is(clearAllSuggestionsEffect)))) {
			needsRecompute = true;
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

	computeDecorations(view: EditorView, _callContext: string): DecorationSet { // _callContext marked as unused
		if (!view || !view.state) {
			return Decoration.none;
		}

		const marks = view.state.field(suggestionStateField, false);

		if (!marks || marks.length === 0) {
			return Decoration.none;
		}

		const activeDecorations: Range<Decoration>[] = [];
		for (const mark of marks) {
			let className = "";
			if (mark.type === 'added') {
				className = "tt-added";
			} else if (mark.type === 'removed') {
				className = "tt-removed";
			}

			if (mark.from >= mark.to) {
				continue;
			}
			if (mark.from < 0 || mark.to > view.state.doc.length) {
				continue;
			}

			try {
				const decorationInstance = Decoration.mark({
					class: className
				}).range(mark.from, mark.to);
				activeDecorations.push(decorationInstance);
			} catch (e) {
				// console.error error
			}
		}
		const decoSet = Decoration.set(activeDecorations, true);
		return decoSet;
	}
}

const suggestionViewPlugin = ViewPlugin.fromClass(SuggestionViewPluginClass, {
	decorations: (pluginInstance: SuggestionViewPluginClass) => {
		if (pluginInstance && pluginInstance.decorations) {
			return pluginInstance.decorations;
		}
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