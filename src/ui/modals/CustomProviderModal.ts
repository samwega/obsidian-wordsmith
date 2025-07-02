// src/ui/modals/CustomProviderModal.ts
import { App, ButtonComponent, Modal, Notice, Setting, TextComponent } from "obsidian";
import type { CustomProvider } from "../../lib/settings-data";
import type TextTransformer from "../../main";

interface QuickSetupProvider {
	name: string;
	endpoint: string;
	apiKeyRequired: boolean;
	isLocal: boolean;
}

const QUICK_SETUP_PROVIDERS: QuickSetupProvider[] = [
	{ name: "OpenAI", endpoint: "https://api.openai.com/v1", apiKeyRequired: true, isLocal: false },
	{
		name: "Anthropic",
		endpoint: "https://api.anthropic.com/v1/messages",
		apiKeyRequired: true,
		isLocal: false,
	},
	{
		name: "Google AI Studio",
		endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
		apiKeyRequired: true,
		isLocal: false,
	},
	{
		name: "OpenRouter",
		endpoint: "https://openrouter.ai/api/v1",
		apiKeyRequired: true,
		isLocal: false,
	},
	{
		name: "Ollama (Local)",
		endpoint: "http://localhost:11434/v1",
		apiKeyRequired: false,
		isLocal: true,
	},
	{
		name: "LM Studio (Local)",
		endpoint: "http://localhost:1234/v1",
		apiKeyRequired: false,
		isLocal: true,
	},
];

export interface CustomProviderModalOptions {
	plugin: TextTransformer;
	provider: CustomProvider | null;
	onSave: (provider: CustomProvider) => void;
}

export class CustomProviderModal extends Modal {
	private provider: CustomProvider;
	private onSave: (provider: CustomProvider) => void;
	private isEditMode: boolean;
	private plugin: TextTransformer;

	private nameInput!: TextComponent;
	private endpointInput!: TextComponent;
	private apiKeyInput!: TextComponent;

	constructor(app: App, options: CustomProviderModalOptions) {
		super(app);
		this.plugin = options.plugin;
		this.onSave = options.onSave;
		this.isEditMode = options.provider !== null;
		this.provider =
			options.provider ||
			({
				id: `custom-provider-${Date.now()}`,
				name: "",
				endpoint: "",
				apiKey: "",
				isEnabled: true,
			} as CustomProvider);
	}

	override onOpen(): void {
		const { contentEl } = this;
		const title = this.isEditMode ? "Edit custom provider" : "Add custom provider";
		this.setTitle(title);

		// This is crucial to clear the modal body before re-rendering.
		contentEl.empty();

		this.renderQuickSetup(contentEl);
		this.renderForm(contentEl);
		this.renderActions(contentEl);
	}

	private renderQuickSetup(container: HTMLElement): void {
		const quickSetupContainer = container.createDiv({ cls: "tt-quick-setup-container" });
		quickSetupContainer.createEl("p", {
			text: "Quick setup",
			cls: "tt-quick-setup-title",
		});

		const buttonsContainer = quickSetupContainer.createDiv({ cls: "tt-quick-setup-buttons" });
		for (const provider of QUICK_SETUP_PROVIDERS) {
			new ButtonComponent(buttonsContainer).setButtonText(provider.name).onClick(() => {
				this.nameInput.setValue(provider.name);
				this.endpointInput.setValue(provider.endpoint);
				this.apiKeyInput.setPlaceholder(
					provider.apiKeyRequired ? "API key is required" : "API key is optional",
				);
				this.apiKeyInput.inputEl.focus();
			});
		}
	}

	private renderForm(container: HTMLElement): void {
		new Setting(container).setName("Provider name").addText((text) => {
			this.nameInput = text;
			text.setPlaceholder("e.g., My Ollama server").setValue(this.provider.name);
		});

		new Setting(container).setName("API endpoint URL").addText((text) => {
			this.endpointInput = text;
			text.setPlaceholder("e.g., http://localhost:11434/v1").setValue(this.provider.endpoint);
		});

		new Setting(container).setName("API key").addText((text) => {
			this.apiKeyInput = text;
			text.inputEl.type = "password";
			text.setPlaceholder("Optional for some local providers").setValue(this.provider.apiKey);
		});
	}

	private renderActions(container: HTMLElement): void {
		const setting = new Setting(container);
		setting.addButton((button) =>
			button
				.setButtonText(this.isEditMode ? "Save changes" : "Add provider")
				.setCta()
				.onClick(() => this.handleSave()),
		);
	}

	private async handleSave(): Promise<void> {
		const name = this.nameInput.getValue().trim();
		const endpoint = this.endpointInput.getValue().trim();
		const apiKey = this.apiKeyInput.getValue().trim();

		if (!name || !endpoint) {
			new Notice("Provider name and API endpoint are required.");
			return;
		}

		this.provider.name = name;
		this.provider.endpoint = endpoint;
		this.provider.apiKey = apiKey;

		const notice = new Notice(`Testing connection to ${name}...`, 0);
		try {
			const isConnected = await this.plugin.customProviderService.testConnection(this.provider);
			notice.hide();

			if (isConnected) {
				new Notice(`✅ Successfully connected to ${name}.`, 4000);
				this.onSave(this.provider);
				this.close();
			} else {
				new Notice(
					`⚠️ Could not connect to ${name}. Please check settings and try again. Provider saved anyway.`,
					8000,
				);
				this.onSave(this.provider);
				this.close();
			}
		} catch (_error) {
			notice.hide();
			// Error notice is handled within the service, but we'll add one here as a fallback
			new Notice(
				`Error connecting to ${name}. Provider saved, but please verify settings.`,
				8000,
			);
			this.onSave(this.provider);
			this.close();
		}
	}
}
