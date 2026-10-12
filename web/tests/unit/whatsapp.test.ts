import { describe, expect, it } from 'vitest';
import { chatName, dayToDate, parseChat } from '../../src/lib/whatsapp/parse';

// Built from code points so the invisible marks phones add are really in the text.
const LRM = String.fromCharCode(0x200e);
const RLM = String.fromCharCode(0x200f);
const NNBSP = String.fromCharCode(0x202f);

describe('WhatsApp export parser', () => {
	it('reads an English Android export (12-hour clock, month first, multi-line, media)', () => {
		const chat = parseChat(
			[
				`12/31/23, 9:41${NNBSP}PM - Messages and calls are end-to-end encrypted.`,
				`12/31/23, 9:41${NNBSP}PM - Ahmed: Happy new year!`,
				'Second line',
				`12/31/23, 9:45${NNBSP}PM - Sara: IMG-20231231-WA0001.jpg (file attached)`,
				'Look at this',
				`12/31/23, 9:46${NNBSP}PM - Sara: <Media omitted>`,
				`1/1/24, 10:02${NNBSP}AM - Ahmed: Thanks <This message was edited>`
			].join('\n')
		);
		expect(chat.dayFirst).toBe(false);
		expect(chat.authors).toEqual(['Ahmed', 'Sara']);
		const [sys, multi, photo, omitted, edited] = chat.messages;
		expect(sys).toMatchObject({ author: null, day: '31/12/23', time: '9:41 PM' });
		expect(multi.text).toBe('Happy new year!\nSecond line');
		expect(photo).toMatchObject({ attachment: 'IMG-20231231-WA0001.jpg', text: 'Look at this' });
		expect(omitted).toMatchObject({ omitted: true, text: '' });
		expect(edited).toMatchObject({ day: '1/1/24', text: 'Thanks', edited: true });
		expect(chat.rtl).toBe(false);
	});

	it('reads an Arabic Android export (Arabic digits, ، and ص/م, direction marks)', () => {
		const chat = parseChat(
			[
				`٣١${RLM}/١٢${RLM}/٢٠٢٣، ٩:٤١ م - أحمد: كل عام وأنتم بخير`,
				`٣١${RLM}/١٢${RLM}/٢٠٢٣، ٩:٤٥ م - سارة: IMG-20231231-WA0001.jpg (ملف مرفق)`,
				`٣١${RLM}/١٢${RLM}/٢٠٢٣، ٩:٤٦ م - سارة: <تم استبعاد الوسائط>`
			].join('\n')
		);
		expect(chat.dayFirst).toBe(true);
		expect(chat.rtl).toBe(true);
		expect(chat.messages[0]).toMatchObject({ day: '31/12/2023', time: '9:41 م', author: 'أحمد', text: 'كل عام وأنتم بخير' });
		expect(chat.messages[1].attachment).toBe('IMG-20231231-WA0001.jpg');
		expect(chat.messages[2].omitted).toBe(true);
	});

	it('reads an iPhone export (brackets, seconds, <attached: …>)', () => {
		const chat = parseChat(
			[
				`[31/12/2023, 21:41:05] Ahmed: ${LRM}Messages and calls are end-to-end encrypted.`,
				`${LRM}[31/12/2023, 21:42:10] Sara: ${LRM}<attached: 00000012-PHOTO-2023-12-31-21-42-10.jpg>`,
				'[01/01/2024, 08:00:00] Ahmed: صباح الخير'
			].join('\n')
		);
		expect(chat.messages).toHaveLength(3);
		expect(chat.messages[1]).toMatchObject({ time: '21:42', author: 'Sara', attachment: '00000012-PHOTO-2023-12-31-21-42-10.jpg' });
		expect(chat.messages[2]).toMatchObject({ day: '1/1/2024', text: 'صباح الخير' });
	});

	it('turns days into dates and finds the chat name', () => {
		expect(dayToDate('31/12/23')?.toISOString().slice(0, 10)).toBe('2023-12-31');
		expect(dayToDate('31/2/2024')).toBeNull();
		expect(chatName('WhatsApp Chat with Office Team.txt')).toBe('Office Team');
		expect(chatName('محادثة واتساب مع أحمد.txt')).toBe('أحمد');
		expect(chatName('_chat.txt')).toBe('_chat');
	});
});
