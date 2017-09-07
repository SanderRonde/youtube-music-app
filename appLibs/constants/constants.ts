export const REMOTE_PORT = 1234;

export const INDEX_PATH = 'page.html';

export const PAPER_RIPPLE_DIR = '../../../node_modules/paper-ripple/dist/'

export type EXTERNAL_EVENT = 'focus'|'lowerVolume'|'raiseVolume'|'pausePlay'|
	'magicButton'|'pause'|'pausePlay'|'youtubeSubscriptions'|'youtubeMusic'|
	'youtubeSearch'|'netflix'|'up'| 'down'| 'left'| 'right'|'toggleVideo';

export const EXTERNAL_EVENTS: EXTERNAL_EVENT[] = [
	'focus',
	'lowerVolume',
	'raiseVolume',
	'pausePlay',
	'magicButton',
	'pause',
	'pausePlay',
	'youtubeSubscriptions',
	'youtubeMusic',
	'youtubeSearch',
	'netflix',
	'up', 'down', 'left', 'right',
	'toggleVideo'
]