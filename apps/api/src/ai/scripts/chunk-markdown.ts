/** Splits a Markdown doc on level-1/level-2 headings. Good enough for a
 *  hand-written spec doc; not a general Markdown parser. */
export function chunkMarkdown(
	content: string,
): Array<{ heading: string; text: string }> {
	const lines = content.split('\n');
	const chunks: Array<{ heading: string; text: string }> = [];
	let heading = '';
	let body: string[] = [];

	const flush = () => {
		const text = body.join('\n').trim();
		if (text) chunks.push({ heading, text });
		body = [];
	};

	for (const line of lines) {
		const match = /^#{1,2}\s+(.*)$/.exec(line);
		if (match) {
			flush();
			heading = match[1].trim();
		} else {
			body.push(line);
		}
	}
	flush();

	return chunks;
}
