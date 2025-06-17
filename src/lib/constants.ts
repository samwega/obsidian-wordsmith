// src/lib/constants.ts

/**
 * Symbol used by GhostTextWidget for visual representation of a newline character
 * in an "added" suggestion.
 */
export const NEWLINE_ADD_SYMBOL = "↵";

/**
 * Symbol used by GhostTextWidget for visual representation of a newline character
 * in a "removed" suggestion.
 */
export const NEWLINE_REMOVE_SYMBOL = "¶";

/**
 * Marker inserted into context text to indicate the precise cursor position
 * for generation tasks. LLM prompts are instructed to use this marker.
 */
export const GENERATION_TARGET_CURSOR_MARKER = "<<<GENERATION_TARGET_CURSOR_POSITION>>>";

/**
 * Marker inserted before the user's selected text when providing context
 * for transformation tasks.
 */
export const USER_SELECTED_TEXT_START_MARKER = "[[[USER_SELECTED_TEXT_STARTING_HERE>>>";

/**
 * Marker inserted after the user's selected text when providing context
 * for transformation tasks.
 */
export const USER_SELECTED_TEXT_END_MARKER = "<<<USER_SELECTED_TEXT_ENDING_HERE]]]";

/**
 * Defines the types of AI tasks.
 */
export const AITaskType = {
	Generation: "generation",
	Transformation: "transformation",
} as const;
export type AITaskType = (typeof AITaskType)[keyof typeof AITaskType];

/**
 * Defines the scope of text being processed.
 */
export const AITaskScope = {
	Selection: "Selection",
	Paragraph: "Paragraph",
} as const;
export type AITaskScopeType = (typeof AITaskScope)[keyof typeof AITaskScope];

/**
 * Defines the actions that can be taken on a suggestion.
 */
export const SuggestionAction = {
	Accept: "accept",
	Reject: "reject",
} as const;
export type SuggestionActionType = (typeof SuggestionAction)[keyof typeof SuggestionAction];
