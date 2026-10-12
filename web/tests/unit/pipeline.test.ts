import { describe, expect, it } from 'vitest';
import { chainError, fits, nextTools, PRESETS, runChain, storableSteps, type RunStep } from '../../src/lib/pipeline';
import { toolById } from '../../src/lib/registry/tools';
import type { FileData, Tool } from '../../src/lib/registry/types';

const tool = (id: string) => toolById(id)!;
const file = (name: string, type = ''): FileData => ({ name, type, bytes: new Uint8Array([1]) });

describe('tool chains', () => {
	it('knows which tool can follow which', () => {
		expect(fits(tool('heic-to-jpg'), tool('compress-image'))).toBe(true);
		expect(fits(tool('compress-image'), tool('image-to-pdf'))).toBe(true);
		expect(fits(tool('merge-pdf'), tool('compress-pdf'))).toBe(true); // "same format" tools pass PDFs on
		expect(fits(tool('image-to-pdf'), tool('compress-image'))).toBe(false);
		const after = nextTools([{ tool: 'image-to-pdf', options: {} }]).map((t) => t.id);
		expect(after).toContain('compress-pdf');
		expect(after).not.toContain('convert-to-png');
		expect(after).not.toContain('sign-pdf'); // editors and own-page tools are not steps
	});

	it('every ready-made chain is valid, with real option values', () => {
		for (const chain of PRESETS) {
			expect(chainError(chain.steps), chain.id).toBeNull();
			for (const step of chain.steps) {
				const specs = tool(step.tool).options ?? [];
				for (const [id, value] of Object.entries(step.options)) {
					const spec = specs.find((o) => o.id === id);
					expect(spec, `${chain.id}: ${step.tool}.${id}`).toBeDefined();
					if (spec?.type === 'select') expect(spec.choices.map((c) => c.value), `${step.tool}.${id}`).toContain(value);
					if (spec?.type === 'range' || spec?.type === 'number') {
						expect(value as number).toBeGreaterThanOrEqual(spec.min);
						expect(value as number).toBeLessThanOrEqual(spec.max);
					}
				}
			}
		}
		expect(chainError([])).toBe('empty');
		expect(chainError([{ tool: 'image-to-pdf', options: {} }, { tool: 'convert-to-png', options: {} }])).toBe('mismatch:1');
	});

	it('runs files step by step: one by one, then all together for a combine step', async () => {
		const calls: string[] = [];
		const run: RunStep = async (t: Tool, inputs) => {
			calls.push(`${t.id}:${inputs.map((f) => f.name).join('+')}`);
			if (t.id === 'heic-to-jpg') return [file(inputs[0].name.replace('.heic', '.jpg'), 'image/jpeg')];
			if (t.id === 'image-to-pdf') return [file('all.pdf', 'application/pdf')];
			return inputs;
		};
		const steps = ['heic-to-jpg', 'compress-image', 'image-to-pdf'].map((id) => ({ tool: tool(id), options: {} }));
		const progress: number[] = [];
		const out = await runChain(steps, [file('a.heic'), file('b.heic')], run, (r) => progress.push(r));
		expect(out.map((f) => f.name)).toEqual(['all.pdf']);
		expect(calls).toEqual(['heic-to-jpg:a.heic', 'heic-to-jpg:b.heic', 'compress-image:a.jpg', 'compress-image:b.jpg', 'image-to-pdf:a.jpg+b.jpg']);
		expect(progress.at(-1)).toBe(1);
		expect([...progress].sort((x, y) => x - y)).toEqual(progress); // never goes back
	});

	it('passes along files a step does not take, and stops when a step gets nothing', async () => {
		const run: RunStep = async (_t, inputs) => inputs.map((f) => ({ ...f, name: `x-${f.name}` }));
		const out = await runChain([{ tool: tool('compress-pdf'), options: {} }], [file('a.pdf'), file('notes.txt')], run);
		expect(out.map((f) => f.name)).toEqual(['x-a.pdf', 'notes.txt']);
		await expect(runChain([{ tool: tool('compress-pdf'), options: {} }], [file('a.png')], run)).rejects.toMatchObject({ code: 'wrong-type' });
		await expect(runChain([{ tool: tool('merge-pdf'), options: {} }], [file('a.pdf')], run)).rejects.toMatchObject({ code: 'nothing' });
	});

	it('saved chains keep plain option values only (no picked files, never a password)', () => {
		expect(storableSteps([{ tool: 'protect-pdf', options: { password: 'secret', allowPrint: false } }])).toEqual([
			{ tool: 'protect-pdf', options: { allowPrint: false } }
		]);
		const logo: FileData = file('logo.png', 'image/png');
		expect(storableSteps([{ tool: 'watermark-pdf', options: { kind: 'logo', logo, opacity: 30 } }])).toEqual([
			{ tool: 'watermark-pdf', options: { kind: 'logo', opacity: 30 } }
		]);
	});
});
