import { EditorView } from "@codemirror/view";
import { Editor, Notice, Platform } from "obsidian";

export function getCmEditorView(editor: Editor): EditorView | null {
	const cmInstance = editor.cm;
	// Ensure cmInstance is an EditorView, which is the CM6 instance
	// For CM5, cmInstance would be CodeMirror.Editor
	// The check editor.cm instanceof EditorView is a good way to ensure it's CM6
	if (cmInstance && cmInstance instanceof EditorView) {
		return cmInstance;
	}
	return null;
}

export function logError(obj: unknown): void {
	if (Platform.isMobileApp) {
		// No issue way of checking the logs on mobile, thus recommending to
		// retrieve error via running on desktop instead.
		new Notice("Error. For details, run the respective function on the desktop.");
	} else {
		const hotkey = Platform.isMacOS ? "cmd+opt+i" : "ctrl+shift+i";
		new Notice(`Error. Check the console for more details (${hotkey}).`);
		console.error("[WordSmith plugin] error", obj);
	}
}
