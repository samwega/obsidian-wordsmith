// src/ui/modals/single-input-modal.ts
import { App, Modal, Setting } from "obsidian";

export interface SingleInputModalOptions {
	title: string;
	placeholder: string;
	initialValue: string;
	onSubmit: (result: string) => void;
	onCancel: () => void;
}

export class SingleInputModal extends Modal {
	private result: string;
	private readonly onSubmit: (result: string) => void;
	private readonly onCancel: () => void;
	private readonly inputTitle: string;
	private readonly inputPlaceholder: string;
	private readonly initialValue: string;
	private submitted = false;

	constructor(app: App, options: SingleInputModalOptions) {
		super(app);
		this.inputTitle = options.title;
		this.inputPlaceholder = options.placeholder;
		this.initialValue = options.initialValue;
		this.onSubmit = options.onSubmit;
		this.onCancel = options.onCancel;
		this.result = options.initialValue;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: this.inputTitle });

		new Setting(contentEl).setName("Name").addText((text) => {
			text
				.setPlaceholder(this.inputPlaceholder)
				.setValue(this.initialValue)
				.onChange((value) => {
					this.result = value;
				});
			text.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
				if (evt.key === "Enter") {
					evt.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Generate")
				.setCta()
				.onClick(() => {
					this.submit();
				}),
		);
	}

	private submit(): void {
		if (this.result?.trim()) {
			this.submitted = true;
			this.close();
			this.onSubmit(this.result);
		}
	}

	override onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		if (!this.submitted) {
			this.onCancel();
		}
	}
}
