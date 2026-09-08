import { chunkMarkdown } from './chunk-markdown';

describe('chunkMarkdown', () => {
	it('splits on level-2 headings and keeps the heading text with its section', () => {
		const md = `# Title\n\nIntro paragraph.\n\n## First Section\nBody one.\n\n## Second Section\nBody two.\n`;
		const chunks = chunkMarkdown(md);

		expect(chunks).toEqual([
			{ heading: 'Title', text: 'Intro paragraph.' },
			{ heading: 'First Section', text: 'Body one.' },
			{ heading: 'Second Section', text: 'Body two.' },
		]);
	});

	it('drops empty sections', () => {
		const md = `# Title\n\n## Empty\n\n## Has content\nSomething.\n`;
		const chunks = chunkMarkdown(md);

		expect(chunks.map((c) => c.heading)).toEqual(['Has content']);
	});
});
