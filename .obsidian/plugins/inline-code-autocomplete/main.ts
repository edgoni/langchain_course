import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	prepareFuzzySearch,
} from "obsidian";
import {
	BlankRange,
	PLAIN_CONTENT,
	TAIL_IDENT,
	classifyLines,
	extractCandidates,
	openSpan,
} from "./src/parse";

interface Settings {
	minQueryLength: number;
	maxSuggestions: number;
	identsFromSpans: boolean;
	includeCodeBlocks: boolean;
	suggestInCodeBlocks: boolean;
	skipClosingBacktick: boolean;
	acceptWithTab: boolean;
}

const DEFAULT_SETTINGS: Settings = {
	minQueryLength: 1,
	maxSuggestions: 8,
	identsFromSpans: true,
	includeCodeBlocks: true,
	suggestInCodeBlocks: false,
	skipClosingBacktick: true,
	acceptWithTab: true,
};

interface Suggestion {
	text: string;
	count: number;
	kind: "span" | "ident";
	matches: [number, number][];
}

class InlineCodeSuggest extends EditorSuggest<Suggestion> {
	private mode: "inline" | "code" = "inline";
	/** En modo inline, cuando ya hay código escrito dentro del span, solo se ofrecen identificadores. */
	private identOnly = false;
	private blank: BlankRange | undefined;

	constructor(app: App, private plugin: InlineCodeAutocomplete) {
		super(app);

		// Tab acepta la sugerencia seleccionada (solo mientras el popup está abierto).
		this.scope.register([], "Tab", (evt: KeyboardEvent) => {
			if (!this.plugin.settings.acceptWithTab) return true;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const chooser = (this as any).suggestions;
			if (chooser && typeof chooser.useSelectedItem === "function") {
				chooser.useSelectedItem(evt);
				return false;
			}
			return true;
		});
	}

	onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
		const s = this.plugin.settings;
		const lineText = editor.getLine(cursor.line);
		const before = lineText.slice(0, cursor.ch);

		const span = openSpan(before);
		if (!span && !s.suggestInCodeBlocks) return null;

		const lines = editor.getValue().split("\n");
		const kind = classifyLines(lines, cursor.line)[cursor.line];
		if (kind === "front" || kind === "fence") return null;

		// --- Dentro de un bloque de código: se sugiere por palabra ---
		if (kind === "code") {
			if (!s.suggestInCodeBlocks) return null;
			const m = TAIL_IDENT.exec(before);
			if (!m || m[0].length < Math.max(1, s.minQueryLength)) return null;
			const trailing = /^[\p{L}\p{N}_]*/u.exec(lineText.slice(cursor.ch))?.[0].length ?? 0;
			this.mode = "code";
			this.identOnly = true;
			this.blank = { line: cursor.line, from: cursor.ch - m[0].length, to: cursor.ch + trailing };
			return {
				start: { line: cursor.line, ch: cursor.ch - m[0].length },
				end: cursor,
				query: m[0],
			};
		}

		// --- Texto normal: hay que estar dentro de `...` ---
		if (!span) return null;
		const content = before.slice(span.contentStart);

		let startCh: number;
		let query: string;
		if (PLAIN_CONTENT.test(content)) {
			// Aún no hay puntuación: se puede completar el fragmento entero.
			startCh = span.contentStart;
			query = content;
			this.identOnly = false;
		} else {
			// Ya hay código (p. ej. `calcular(psi, en`): se completa el último identificador.
			const m = TAIL_IDENT.exec(content);
			if (!m) return null;
			query = m[0];
			startCh = cursor.ch - query.length;
			this.identOnly = true;
		}
		if (query.length < s.minQueryLength) return null;

		const rest = lineText.slice(cursor.ch);
		const closing = /`+/.exec(rest);
		this.mode = "inline";
		this.blank = {
			line: cursor.line,
			from: span.runStart,
			to: closing ? cursor.ch + closing.index + closing[0].length : lineText.length,
		};
		return { start: { line: cursor.line, ch: startCh }, end: cursor, query };
	}

	getSuggestions(context: EditorSuggestContext): Suggestion[] {
		const s = this.plugin.settings;
		const lines = context.editor.getValue().split("\n");
		const map = extractCandidates(
			lines,
			{ identsFromSpans: s.identsFromSpans, includeCodeBlocks: s.includeCodeBlocks },
			this.blank,
		);

		let list = [...map.values()];
		if (this.identOnly) list = list.filter((c) => c.kind === "ident");

		const q = context.query;
		const ql = q.toLowerCase();

		if (q === "") {
			return list
				.sort((a, b) => b.count - a.count || a.text.length - b.text.length)
				.slice(0, s.maxSuggestions)
				.map((c) => ({ ...c, matches: [] }));
		}

		const fuzzy = prepareFuzzySearch(q);
		const scored: { c: (typeof list)[number]; score: number; matches: [number, number][]; prefix: number }[] = [];
		for (const c of list) {
			if (c.text === q) continue;
			const r = fuzzy(c.text);
			if (!r) continue;
			scored.push({
				c,
				score: r.score,
				matches: r.matches as [number, number][],
				prefix: c.text.toLowerCase().startsWith(ql) ? 1 : 0,
			});
		}
		scored.sort(
			(a, b) =>
				b.prefix - a.prefix ||
				b.score - a.score ||
				b.c.count - a.c.count ||
				a.c.text.length - b.c.text.length,
		);
		return scored.slice(0, s.maxSuggestions).map((x) => ({ ...x.c, matches: x.matches }));
	}

	renderSuggestion(sug: Suggestion, el: HTMLElement): void {
		el.addClass("ica-item");
		const main = el.createDiv({ cls: "ica-text" });
		let pos = 0;
		for (const [a, b] of sug.matches) {
			if (a > pos) main.appendText(sug.text.slice(pos, a));
			main.createSpan({ cls: "ica-match", text: sug.text.slice(a, b) });
			pos = b;
		}
		if (pos < sug.text.length) main.appendText(sug.text.slice(pos));
		el.createDiv({
			cls: "ica-meta",
			text: sug.kind === "span" ? `fragmento · ×${sug.count}` : `×${sug.count}`,
		});
	}

	selectSuggestion(sug: Suggestion, _evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) return;
		const { editor, start, end } = ctx;

		editor.replaceRange(sug.text, start, end);
		let newCh = start.ch + sug.text.length;
		if (this.mode === "inline" && this.plugin.settings.skipClosingBacktick) {
			if (editor.getLine(start.line)[newCh] === "`") newCh++;
		}
		editor.setCursor({ line: start.line, ch: newCh });
		this.close();
	}
}

export default class InlineCodeAutocomplete extends Plugin {
	settings: Settings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();
		this.registerEditorSuggest(new InlineCodeSuggest(this.app, this));
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: InlineCodeAutocomplete) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();

		new Setting(containerEl)
			.setName("Caracteres mínimos para sugerir")
			.setDesc("Cuántas letras hay que escribir tras el ` antes de que aparezca la lista.")
			.addSlider((sl) =>
				sl.setLimits(0, 4, 1).setValue(s.minQueryLength).setDynamicTooltip().onChange(async (v) => {
					s.minQueryLength = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Máximo de sugerencias")
			.addSlider((sl) =>
				sl.setLimits(3, 20, 1).setValue(s.maxSuggestions).setDynamicTooltip().onChange(async (v) => {
					s.maxSuggestions = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Indexar identificadores dentro de fragmentos")
			.setDesc("Si en la nota hay `calcular(psi, h)`, también se ofrecen `calcular`, `psi` y `h` por separado.")
			.addToggle((t) =>
				t.setValue(s.identsFromSpans).onChange(async (v) => {
					s.identsFromSpans = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Usar también los bloques de código de la nota")
			.setDesc("Los identificadores de los bloques ``` de la misma nota se añaden a las sugerencias.")
			.addToggle((t) =>
				t.setValue(s.includeCodeBlocks).onChange(async (v) => {
					s.includeCodeBlocks = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Sugerir también al escribir dentro de bloques de código")
			.setDesc("Autocompleta por palabra dentro de ``` ... ```. Desactivado por defecto para no molestar al programar.")
			.addToggle((t) =>
				t.setValue(s.suggestInCodeBlocks).onChange(async (v) => {
					s.suggestInCodeBlocks = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Saltar el ` de cierre al aceptar")
			.setDesc("Si el cursor queda justo antes de un ` de cierre, se coloca después de él.")
			.addToggle((t) =>
				t.setValue(s.skipClosingBacktick).onChange(async (v) => {
					s.skipClosingBacktick = v;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Aceptar con Tab")
			.setDesc("Además de Enter, Tab acepta la sugerencia seleccionada.")
			.addToggle((t) =>
				t.setValue(s.acceptWithTab).onChange(async (v) => {
					s.acceptWithTab = v;
					await save();
				}),
			);
	}
}
