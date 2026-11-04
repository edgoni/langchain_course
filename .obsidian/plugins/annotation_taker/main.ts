import { Editor, EditorPosition, Plugin } from "obsidian";

const HEADER = "> [!master]- Mi Aportación";
const HEADER_RE = /^>\s*\[!master\]/i;
const ANY_CALLOUT_RE = /^>\s*\[!/;

export default class MasterQuickNotes extends Plugin {
	async onload() {
		this.addCommand({
			id: "toggle-master-note",
			name: "Toggle / Insert Master Note",
			editorCallback: (editor) => this.toggle(editor),
		});
	}

	private toggle(editor: Editor) {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");

		// 1) Si el cursor está dentro de un callout master → desenvolver
		const block = this.findBlock(editor, from.line);
		if (block) return this.unwrap(editor, block.start, block.end);

		// 2) Con selección → envolver; sin selección → insertar vacío
		if (editor.somethingSelected()) this.wrap(editor, from, to);
		else this.insertEmpty(editor, from.line);
	}

	/** Localiza el callout [!master] que contiene la línea dada. */
	private findBlock(editor: Editor, line: number) {
		if (!editor.getLine(line).startsWith(">")) return null;

		let start = -1;
		for (let i = line; i >= 0 && editor.getLine(i).startsWith(">"); i--) {
			if (HEADER_RE.test(editor.getLine(i))) { start = i; break; }
			if (ANY_CALLOUT_RE.test(editor.getLine(i))) return null; // otro callout
		}
		if (start < 0) return null;

		let end = start;
		const last = editor.lastLine();
		while (end < last) {
			const next = editor.getLine(end + 1);
			if (!next.startsWith(">") || ANY_CALLOUT_RE.test(next)) break;
			end++;
		}
		return { start, end };
	}

	private unwrap(editor: Editor, start: number, end: number) {
		const body: string[] = [];
		for (let i = start + 1; i <= end; i++) {
			body.push(editor.getLine(i).replace(/^>\s?/, ""));
		}
		editor.replaceRange(
			body.join("\n"),
			{ line: start, ch: 0 },
			{ line: end, ch: editor.getLine(end).length }
		);
		editor.setCursor({ line: start, ch: 0 });
	}

	private wrap(editor: Editor, from: EditorPosition, to: EditorPosition) {
		// Trabajamos con líneas completas; si la selección termina en ch 0, esa línea no cuenta
		const endLine = to.ch === 0 && to.line > from.line ? to.line - 1 : to.line;

		const lines: string[] = [];
		for (let i = from.line; i <= endLine; i++) lines.push(editor.getLine(i));
		const body = lines.map((l) => (l.trim() ? `> ${l}` : ">"));

		const before = from.line > 0 && editor.getLine(from.line - 1).trim() ? "\n" : "";
		const after =
			endLine < editor.lastLine() && editor.getLine(endLine + 1).trim() ? "\n" : "";

		editor.replaceRange(
			before + [HEADER, ...body].join("\n") + after,
			{ line: from.line, ch: 0 },
			{ line: endLine, ch: editor.getLine(endLine).length }
		);

		const lastBodyLine = from.line + (before ? 1 : 0) + body.length;
		editor.setCursor({ line: lastBodyLine, ch: body[body.length - 1].length });
	}

	private insertEmpty(editor: Editor, line: number) {
		const current = editor.getLine(line);
		const isEmpty = current.trim() === "";
		const needsGap =
			line < editor.lastLine() && editor.getLine(line + 1).trim() !== "";

		const text = (isEmpty ? "" : "\n\n") + HEADER + "\n> " + (needsGap ? "\n" : "");
		editor.replaceRange(
			text,
			{ line, ch: isEmpty ? 0 : current.length },
			{ line, ch: current.length }
		);
		// Cursor en la línea interior, tras "> "
		editor.setCursor({ line: line + (isEmpty ? 0 : 2) + 1, ch: 2 });
	}
}
