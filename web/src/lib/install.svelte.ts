/** The browser's "install this app" offer, kept from the moment it arrives (it can come before the header mounts). */
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export const install = $state<{ offer: InstallPrompt | null }>({ offer: null });

if (typeof window !== 'undefined') {
	addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		install.offer = e as InstallPrompt;
	});
	addEventListener('appinstalled', () => (install.offer = null));
}

export async function promptInstall() {
	const offer = install.offer;
	if (!offer) return;
	await offer.prompt();
	await offer.userChoice;
	install.offer = null;
}
