import { ConvertError, type Adapter } from '../../registry/types';
import { decodeImage } from './decode';
import { encodeImage } from './encode';
import { sniff } from './formats';
import { stripJpeg, stripPng, stripWebp, type Stripped } from './metadata';
import { output } from './output';

/** Removes EXIF/GPS/XMP without re-encoding (JPEG, PNG, WebP). */
const adapter: Adapter = {
	async convert(input) {
		const kind = sniff(input.bytes);
		let res: Stripped;
		try {
			if (kind === 'jpg') res = stripJpeg(input.bytes);
			else if (kind === 'png') res = stripPng(input.bytes);
			else if (kind === 'webp') res = stripWebp(input.bytes);
			else throw new ConvertError('wrong-type');
		} catch (e) {
			if (e instanceof ConvertError) throw e;
			throw new ConvertError('corrupted');
		}
		if (kind === 'jpg' && res.orientation !== 1) {
			// The rotation lived in the EXIF we remove: bake it into the pixels instead.
			const { image } = await decodeImage(input);
			return [output(input.name, 'jpg', await encodeImage(image, 'jpg', 0.92), 'orientation-applied')];
		}
		return [output(input.name, kind as 'jpg' | 'png' | 'webp', res.bytes, res.removed ? 'metadata-removed' : 'no-metadata')];
	}
};

export default adapter;
