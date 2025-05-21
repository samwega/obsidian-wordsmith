// src/suggestion-state.ts
import { StateField, StateEffect, Facet, MapMode } from "@codemirror/state";
import { Decoration, DecorationSet } from "@codemirror/view";

export interface SuggestionMark {
    id: string;
    from: number;
    to: number;
    type: 'added' | 'removed';
}

export const setSuggestionsEffect = StateEffect.define<SuggestionMark[]>();
export const resolveSuggestionEffect = StateEffect.define<{ id: string }>();
export const clearAllSuggestionsEffect = StateEffect.define<null>();

export const suggestionStateField = StateField.define<SuggestionMark[]>({
    create() {
        return [];
    },
    update(marks, tr) {
        let newMarks = marks.map(mark => {
            const from = tr.changes.mapPos(mark.from, -1, MapMode.TrackDel);
            const to = tr.changes.mapPos(mark.to, 1, MapMode.TrackDel);

            // Check for null before using 'from' or 'to'
            if (from === null || to === null) {
                return null; // This mark was deleted or unmappable
            }

            if (from >= to) { // If the mark's range collapsed or inverted
                return null;
            }
            return { ...mark, from, to };
        }).filter(Boolean) as SuggestionMark[]; // filter(Boolean) removes nulls

        for (const effect of tr.effects) {
            if (effect.is(setSuggestionsEffect)) {
                newMarks = effect.value;
            } else if (effect.is(resolveSuggestionEffect)) {
                newMarks = newMarks.filter(m => m.id !== effect.value.id);
            } else if (effect.is(clearAllSuggestionsEffect)) {
                newMarks = [];
            }
        }
        return newMarks;
    },
});

export const suggestionDecorations = Facet.define<SuggestionMark[], DecorationSet>({
    combine: (values) => {
        const allMarks = values.flat();
        if (!allMarks.length) return Decoration.none;

        const decorations = allMarks.map(mark => {
            const className = `text-transformer-${mark.type}`;
            return Decoration.mark({
                class: className,
            }).range(mark.from, mark.to);
        });
        return Decoration.set(decorations, true);
    }
});

export const textTransformerSuggestionExtensions = () => [
    suggestionStateField,
    suggestionDecorations.from(suggestionStateField)
];

let _suggestionIdCounter = 0;
export function generateSuggestionId(): string {
    _suggestionIdCounter++;
    return `tt-suggestion-${_suggestionIdCounter}`;
}