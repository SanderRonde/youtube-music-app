import { MessageableWindow } from '../../../libs/embedmsg';

declare var window: MessageableWindow;


Array.from(document.querySelectorAll('.item-section')).forEach((item) => {
	item.addEventListener('click', (e: MouseEvent & {
		path: HTMLElement[];
	}) => {
		e.preventDefault();
		e.stopPropagation();

		//Get the LI element
		let pathIndex = 0;
		let el = e.path[pathIndex];
		while (el.tagName !== 'LI') {
			el = e.path[++pathIndex];
		}

		const url = el.querySelector('.yt-uix-sessionlink').getAttribute('href');
		window.sendMessage('toWindow', 'downloadVideo', url);
	});
});