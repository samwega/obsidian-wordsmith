import { Notice, Platform } from "obsidian";

export function logError(obj: unknown): void {
	if (Platform.isMobileApp) {
		// No issue way of checking the logs on mobile, thus recommending to
		// retrieve error via running on desktop instead.
		new Notice("Error. For details, run the respective function on the desktop.");
	} else {
		const hotkey = Platform.isMacOS ? "cmd+opt+i" : "ctrl+shift+i";
		new Notice(`Error. Check the console for more details (${hotkey}).`);
		console.error("[TextTransformer plugin] error", obj);
	}
}
