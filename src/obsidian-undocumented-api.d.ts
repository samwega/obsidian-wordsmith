import "obsidian";

declare module "obsidian" {
	interface Editor {
		cm: {
			coordsAtPos: (
				pos: number,
			) => { top: number; bottom: number; left: number; right: number } | null;
		};
	}
}
