import { expect, test, type Page } from '@playwright/test';
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fx = (name: string) => fileURLToPath(new URL(`../fixtures/media/${name}`, import.meta.url));

async function run(page: Page, tool: string, file: string, setOptions?: () => Promise<void>) {
	await page.goto(`en/${tool}/`);
	await page.getByTestId('file-input').setInputFiles(fx(file));
	if (setOptions) await setOptions();
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await expect(page.locator('[data-status="waiting"], [data-status="working"]')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.locator('[data-status="done"]')).toHaveCount(1);
	const dl = page.waitForEvent('download');
	await page.getByRole('button', { name: /^Download (?!all)/ }).first().click();
	const d = await dl;
	return { name: d.suggestedFilename(), bytes: readFileSync((await d.path())!) };
}

/** Reads what came out with Mediabunny in Node: container, tracks and length. */
async function probe(bytes: Buffer) {
	const input = new Input({ source: new BlobSource(new Blob([new Uint8Array(bytes)])), formats: ALL_FORMATS });
	const video = await input.getPrimaryVideoTrack();
	const audio = await input.getPrimaryAudioTrack();
	return {
		mime: await input.getMimeType(),
		duration: await input.computeDuration(),
		video: video ? { codec: await video.getCodec(), w: await video.getDisplayWidth(), h: await video.getDisplayHeight() } : null,
		audio: audio ? await audio.getCodec() : null
	};
}

test.describe('audio and video in the browser', () => {
	test('WebM → MP4 plays everywhere (H.264 if the browser has it)', async ({ page }) => {
		const out = await run(page, 'video-to-mp4', 'clip.webm');
		expect(out.name).toBe('clip.mp4');
		const p = await probe(out.bytes);
		expect(p.mime).toMatch(/^video\/mp4/);
		expect(p.video).not.toBeNull();
		expect(p.audio).not.toBeNull();
		expect(p.duration).toBeGreaterThan(2.5);
	});

	test('compress to 360p and remove the sound', async ({ page }) => {
		const out = await run(page, 'compress-video', 'clip.mp4', async () => {
			await page.getByLabel('Resolution').selectOption('360');
			await page.getByLabel('Remove the sound').check();
		});
		const p = await probe(out.bytes);
		expect(p.audio).toBeNull();
		// 320×240 is already under 360p: the size stays.
		expect(p.video).toMatchObject({ w: 320, h: 240 });
	});

	test('extract the audio as MP3', async ({ page }) => {
		const out = await run(page, 'video-to-mp3', 'clip.mp4');
		expect(out.name).toBe('clip.mp3');
		const p = await probe(out.bytes);
		expect(p).toMatchObject({ mime: 'audio/mpeg', video: null, audio: 'mp3' });
		expect(p.duration).toBeGreaterThan(2.5);
	});

	test('a WhatsApp-style voice note (Opus) → WAV', async ({ page }) => {
		const out = await run(page, 'convert-audio', 'voice.ogg', async () => {
			await page.getByLabel('To format').selectOption('wav');
		});
		expect(out.name).toBe('voice.wav');
		expect(out.bytes.subarray(0, 4).toString()).toBe('RIFF');
	});

	test('trim keeps only the part asked for', async ({ page }) => {
		const out = await run(page, 'trim-media', 'tone.mp3', async () => {
			await page.getByLabel('From (min:sec)').fill('0:01');
			await page.getByLabel('To (empty = the end)').fill('0:02');
		});
		expect(out.name).toBe('tone-cut.mp3');
		const p = await probe(out.bytes);
		expect(p.duration).toBeGreaterThan(0.8);
		expect(p.duration).toBeLessThan(1.3);
	});

	test('mute and rotate keep the picture', async ({ page }) => {
		const muted = await probe((await run(page, 'mute-video', 'clip.mp4')).bytes);
		expect(muted.audio).toBeNull();
		expect(muted.video).not.toBeNull();
		const turned = await probe((await run(page, 'rotate-video', 'clip.mp4')).bytes);
		expect(turned.video).toMatchObject({ w: 240, h: 320 });
	});

	test('video → GIF', async ({ page }) => {
		const out = await run(page, 'video-to-gif', 'clip.mp4', async () => {
			await page.getByLabel('Length (seconds, up to 30)').fill('2');
			await page.getByLabel('Width').fill('160');
		});
		expect(out.name).toBe('clip.gif');
		expect(out.bytes.subarray(0, 4).toString()).toBe('GIF8');
		expect(out.bytes.readUInt16LE(6)).toBe(160);
	});

	test('an AVI says it needs the server version', async ({ page }) => {
		await page.goto('en/video-to-mp4/');
		await page.getByTestId('file-input').setInputFiles(fx('clip.avi'));
		await expect(page.getByText("This file type isn't supported by this tool.")).toBeVisible();
	});
});
