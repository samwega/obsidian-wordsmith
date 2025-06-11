// src/ui/modals/single-input-modal.ts
import { App, Modal, Setting } from "obsidian";

export class SingleInputModal extends Modal {
	private result: string;
	private readonly onSubmit: (result: string) => void;
	private readonly onCancel: () => void;
	private readonly inputTitle: string;
	private readonly inputPlaceholder: string;
	private readonly initialValue: string;
	private submitted = false;

	constructor(
		app: App,
		title: string,
		placeholder: string,
		initialValue: string,
		onSubmit: (result: string) => void,
		onCancel: () => void,
	) {
		super(app);
		this.inputTitle = title;
		this.inputPlaceholder = placeholder;
		this.initialValue = initialValue;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		this.result = initialValue;
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
			setTimeout(() => text.inputEl.focus(), 0);
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
