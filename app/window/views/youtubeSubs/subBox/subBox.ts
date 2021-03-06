import { MessageableWindow } from '../../../libs/embedmsg';
declare var window: MessageableWindow<SubBoxWindow>;

export interface SubBoxWindow extends Window {
	videos: VideoIdentifier;
	navToLink(link: string, video?: TransformedVideo): void;
	requestIdleCallback(callback: (deadline: {
		timeRemaining(): number;
	}) => void, options: {
		timeout?: number;
	}): void;
	signalledCompletion?: boolean;
}

interface YoutubeIconElement extends HTMLElement {
	iconName_: string;
	icon: string;
}

window.videos = null;
const PODCAST_VIDS = [
	'No Xcuses',
	'Darklight Sessions',
	'WE R Hardstyle',
	'Front Of House Radio',
	'Star Track Radio',
	'Corsten\'s Countdown',
	'Protocol Radio',
	'Revealed Radio',
	'Hardwell On Air',
	'Heldeep Radio',
	'Heartfeldt Radio',
	'ClubLife by Tiësto',
	'Spinnin\' Sessions',
	'Aoki\'s House',
	'Hysteria Radio',
	['#ASOT', 'A State Of Trance'],
	'Monstercat: Call of the Wild',
	'Future of Euphoric Stylez - ',
	'Phreshcast',
	'HARD with STYLE',
	'Global Dedication',
	'Flashover Radio',
	'Dannic presents Fonk Radio',
	'Corstens Countdown',
	'Fonk Radio',
	'ISAAC\'S HARDSTYLE SESSIONS #',
	'ultra music festival',
	'ultra miami',
	'Live at Tomorrowland',
	'Tomorrowland Belgium',
	'Tomorrowland Brasil',
	'Axtone Presents:',
	'WOLV Radio',
	'The Prophet - Louder',
].map(e => (Array.isArray(e) ? e : [e]).map(f => f.toLowerCase()));

const EXCLUDE = [
	'LIVESTREAM',
	'24/7'
].map(e => e.toLowerCase());

const PODCAST_CHANNELS: {
	always: string[];
	onLongerThanHour: string[];
	onLongerThan: [string, number][]
} = {
	always: [
		'Mainstage'
	].map(e => e.toLowerCase()),
	onLongerThanHour: [
		'GalaxyMusic'
	].map(e => e.toLowerCase()),
	onLongerThan: ([ 
		['Future Bass Mix', 30 * 60]
	] as [string, number][]).map(e => [e[0].toLowerCase(), e[1]]) as [string, number][]
};

const HOUR = 60 * 60;

let watchedSelected = 0;

const bezFn = (() => {
	/**
	 * https://github.com/gre/bezier-easing
	 * BezierEasing - use bezier curve for transition easing function
	 * by Gaëtan Renaudeau 2014 - 2015 – MIT License
	 */

	// These values are established by empiricism with tests (tradeoff: performance VS precision)
	var NEWTON_ITERATIONS = 4;
	var NEWTON_MIN_SLOPE = 0.001;
	var SUBDIVISION_PRECISION = 0.0000001;
	var SUBDIVISION_MAX_ITERATIONS = 10;

	var kSplineTableSize = 11;
	var kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

	var float32ArraySupported = true;

	function _A(aA1: number, aA2: number): number { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
	function _B(aA1: number, aA2: number): number { return 3.0 * aA2 - 6.0 * aA1; }
	function _C(aA1: number): number { return 3.0 * aA1; }

	// Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
	function _calcBezier(aT: number, aA1: number, aA2: number): number {
		return ((_A(aA1, aA2) * aT + _B(aA1, aA2)) * aT + _C(aA1)) * aT;
	}

	// Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
	function _getSlope(aT: number, aA1: number, aA2: number): number { 
		return 3.0 * _A(aA1, aA2) * aT * aT + 2.0 * _B(aA1, aA2) * aT + _C(aA1);
	}

	function _binarySubdivide(aX: number, aA: number, aB: number, mX1: number, mX2: number): number {
		var currentX, currentT, i = 0;
		do {
			currentT = aA + (aB - aA) / 2.0;
			currentX = _calcBezier(currentT, mX1, mX2) - aX;
			if (currentX > 0.0) {
				aB = currentT;
			} else {
				aA = currentT;
			}
		} while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
		return currentT;
	}

	function _newtonRaphsonIterate(aX: number, aGuessT: number, mX1: number, mX2: number): number {
		for (var i = 0; i < NEWTON_ITERATIONS; ++i) {
			var currentSlope = _getSlope(aGuessT, mX1, mX2);
			if (currentSlope === 0.0) {
				return aGuessT;
			}
			var currentX = _calcBezier(aGuessT, mX1, mX2) - aX;
			aGuessT -= currentX / currentSlope;
		}
		return aGuessT;
	}

	return {
		bezier: function(mX1: number, mY1: number, mX2: number, mY2: number): (x: number) => number {
			if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
				throw new Error('bezier x values must be in [0, 1] range');
			}

			// Precompute samples table
			var sampleValues = float32ArraySupported ? new Float32Array(kSplineTableSize) : new Array(kSplineTableSize);
			if (mX1 !== mY1 || mX2 !== mY2) {
				for (var i = 0; i < kSplineTableSize; ++i) {
					sampleValues[i] = _calcBezier(i * kSampleStepSize, mX1, mX2);
				}
			}

			function getTForX(aX: number): number {
				var intervalStart = 0.0;
				var currentSample = 1;
				var lastSample = kSplineTableSize - 1;

				for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
					intervalStart += kSampleStepSize;
				}
				--currentSample;

				// Interpolate to provide an initial guess for t
				var dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
				var guessForT = intervalStart + dist * kSampleStepSize;

				var initialSlope = _getSlope(guessForT, mX1, mX2);
				if (initialSlope >= NEWTON_MIN_SLOPE) {
					return _newtonRaphsonIterate(aX, guessForT, mX1, mX2);
				} else if (initialSlope === 0.0) {
					return guessForT;
				} else {
					return _binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
				}
			}

			return function BezierEasing(x: number): number {
				if (mX1 === mY1 && mX2 === mY2) {
					return x; // linear
				}
				// Because JavaScript number are imprecise, we should guarantee the extremes are right.
				if (x === 0) {
					return 0;
				}
				if (x === 1) {
					return 1;
				}
				return _calcBezier(getTForX(x), mY1, mY2);
			};
		}
	};
})();

const bezierCurve = bezFn.bezier(0.25, 0.1, 0.25, 1);
function getCurrentTarget(time: number, target: number) {
	return bezierCurve(time) * target;
}

function doSmoothScroll(this: {
	from: number;
	to: number;
	target: number;
	progress: number;
	maxTime: number;
	startTime: number;
	lastAnimationFrame: number;
}, timestamp: number) {
	const data = this;

	if (data.startTime === null) {
		data.startTime = timestamp;
	}

	const passedTime = timestamp - data.startTime;

	if (passedTime >= data.maxTime) {
		window.scrollTo(0, data.to);
	} else {
		const currentTarget = getCurrentTarget(passedTime / data.maxTime,
			data.target);
		window.scrollTo(0, currentTarget + data.from);

		window.requestAnimationFrame(doSmoothScroll.bind(data));
	}
}

function smoothScroll(to: number) {
	const currentScroll = document.body.scrollTop;

	const time = Date.now();
	const data: {
		from: number;
		to: number;
		target: number;
		progress: number;
		maxTime: number;
		startTime: number;
		lastAnimationFrame: number;
	} = {
		from: currentScroll,
		to: to,
		target: to - currentScroll,
		progress: 0,
		maxTime: 250,
		startTime: null,
		lastAnimationFrame: time
	};

	//Do it in ~250ms
	window.requestAnimationFrame(doSmoothScroll.bind(data));
}

class SelectedVideo {
	current: TransformedVideo;
	rowWidth: {
		width: number;
		amount: number;
	};

	_focusCurrent() {
		this.current.element.classList.add('selectedVideo');
		smoothScroll(this.current.element.getBoundingClientRect().top +
			document.body.scrollTop - 302);
	}

	_deselectCurrent() {
		this.current && this.current.element.classList.remove('selectedVideo');
	}

	_updateSelected(video: TransformedVideo) {
		this._deselectCurrent();
		this.current = video;
		this._focusCurrent();
	}

	setCurrent(video: TransformedVideo) {
		this._updateSelected(video);
	}

	_getRowWidth() {
		if (this.rowWidth && this.rowWidth.width === window.innerWidth) {
			return this.rowWidth.amount;
		}

		let rowWidth = 1;
		const firstVidTop = this.videos[0].element.getBoundingClientRect().top - 
			document.body.getBoundingClientRect().top;

		while (this.videos[rowWidth++].element.getBoundingClientRect().top - 
			document.body.getBoundingClientRect().top === firstVidTop) {}
		rowWidth--;

		this.rowWidth = {
			width: window.innerWidth,
			amount: rowWidth
		};
		return rowWidth;
	}

	_findInNewContext(video: TransformedVideo): TransformedVideo {
		const title = video.title;
		const channel = video.channel;
		const length = video.length;

		for (let i = 0; i < this.videos.length; i++) {
			const candidate = this.videos[i];
			if (candidate.title === title && candidate.channel === channel &&
				candidate.length === length) {
					return candidate;
				}
		}

		return this.videos[0];
	}

	goUp() {
		let width = this._getRowWidth();
		let toSelect = this.current;
		for (let i = 0; i < width; i++) {
			if (toSelect.list !== this.videos) {
				toSelect = this._findInNewContext(toSelect);
			}
			do {
				if (toSelect.previous) {
					toSelect = toSelect.previous;
				}
			} while (toSelect.isHidden);
		}
		this._updateSelected(toSelect);
	}

	goDown() {
		let width = this._getRowWidth();
		let toSelect = this.current;
		for (let i = 0; i < width; i++) {
			if (toSelect.list !== this.videos) {
				toSelect = this._findInNewContext(toSelect);
			}
			do {
				if (toSelect.next) {
					toSelect = toSelect.next;
				}
			} while (toSelect.isHidden);
		}
		this._updateSelected(toSelect);
	}

	goLeft() {
		let toSelect = this.current;
		if (toSelect.list !== this.videos) {
			toSelect = this._findInNewContext(toSelect);
		}
		do {
			if (toSelect.previous) {
				toSelect = toSelect.previous;
			}
		} while (toSelect.isHidden);
		this._updateSelected(toSelect);
	}

	goRight() {
		let toSelect = this.current;
		if (toSelect.list !== this.videos) {
			toSelect = this._findInNewContext(toSelect);
		}
		do {
			if (toSelect.next) {
				toSelect = toSelect.next;
			}
		} while (toSelect.isHidden);
		this._updateSelected(toSelect);
	}

	launchCurrent() {
		window.navToLink(this.current.links[0]);
	}

	selectLatestWatched() {
		let foundSelected = watchedSelected;
		let newSelected = null;
		//Select latest watched video or last in general
		for (let i = 0; i < this.videos.length; i++) {
			if (this.videos[i].watched && !this.videos[i].isHidden) {
				newSelected = this.videos[i];
				if (foundSelected === 0) {
					this._updateSelected(newSelected);
					return;
				}
				foundSelected--;
			}
		}
		if (this.current) {
			return;
		}
		this._updateSelected(this.videos[this.videos.length - 1]);
	}

	constructor(public videos: TransformedVideo[], previousTitle: string, noCursorRefresh: boolean) {
		if (previousTitle) {
			for (let i = 0; i < videos.length; i++) {
				if (videos[i].title === previousTitle) {
					this.current = videos[i];
					break;
				}
			}
		}
		if (!this.current) {
			this.selectLatestWatched();
		}

		if (!noCursorRefresh) {
			this._focusCurrent();
		}

		if (!window.signalledCompletion) {
			localStorage.setItem('loaded', 'youtubeSubscriptions');
			window.signalledCompletion = true;
		}
	}
}

const toWatchLater: YoutubeIconElement[] = [];
let isHandlingWatchLater = false;
function clickWatchLater(deadline: {
	timeRemaining(): number;
}) {
	while (deadline.timeRemaining() > 0 && toWatchLater.length > 0 && toWatchLater[toWatchLater.length - 1]) {
		const firstButton = toWatchLater.shift();
		if (firstButton.icon === 'WATCH_LATER') {
			firstButton.click();
		}
	}

	if (toWatchLater.length > 0) {
		window.requestIdleCallback(clickWatchLater, {
			timeout: 10000
		});
	} else {
		isHandlingWatchLater = false;
	}
}

function addVideoToWatchLater(button: YoutubeIconElement) {
	if (button) {
		toWatchLater.push(button);
	}
	if (!isHandlingWatchLater) {
		isHandlingWatchLater = true;
		window.requestIdleCallback(clickWatchLater, {
			timeout: 10000
		});
	}
}

interface TransformedVideo {
    element: Thumbnail;
    watched: boolean;
    title: string;
    channel: string;
	length: number;
	isLiveStream: boolean;
	isPodcast: boolean;
	isHidden: boolean;
	links: string[];
	disabled: boolean;

	index: number;
	list: TransformedVideo[];
	next: TransformedVideo;
	previous: TransformedVideo;
};

interface Thumbnail extends HTMLElement {
	data: {
		title: {
			simpleText: string;
		}
		videoId: string;
	};
}

function fnInterval(fn: (done: () => void) => void, interval: number) {
	const index = window.setInterval(() => {
		fn(() => {
			window.clearInterval(index);
		});
	}, interval);
}

class VideoIdentifier {
	videos: TransformedVideo[];
	selected: SelectedVideo;

	getAmount() {
		return this.videos.length;
	}

	_objectify(video: Thumbnail): {
		element: Thumbnail;
	} {
		return {
			element: video
		};
	}

	_waitForReady(video: {
		element: Thumbnail
		disabled: boolean;
	}): Promise<{
		disabled: boolean;
		element: Thumbnail;
		isLiveStream: boolean;
	}> {
		return new Promise((resolve) => {
			//Make it non-clickable
			const anchors = <any>video.element.querySelectorAll('a') as (HTMLAnchorElement & {
				hasListener?: boolean;
			})[];
			anchors.forEach((anchor) => {
				anchor.addEventListener('click', (e) => {
					if (video.disabled) {
						e.preventDefault();
						e.stopPropagation();
					}
				});
			});
			fnInterval((done) => {
				if (video.element.querySelector('ytd-thumbnail-overlay-time-status-renderer')) {
					done();
					resolve(Object.assign(video, {
						isLiveStream: false
					}));
				} else if (video.element.querySelector('ytd-badge-supported-renderer') && 
					video.element.querySelector('ytd-badge-supported-renderer .badge-style-type-live-now')) {
						done();
						resolve(Object.assign(video, {
							isLiveStream: true
						}));
					}
			}, 100);
		});
	}

	_markWatched(video: {
		element: Thumbnail;
	}) {
		return Object.assign(video, {
			watched: !!video.element.querySelector('ytd-thumbnail-overlay-resume-playback-renderer') ||
				video.element.querySelector('ytd-thumbnail-overlay-playback-status-renderer')
		});
	}

	_parseTime(timeStr: HTMLElement): number {
		if (!timeStr) {
			return 0;
		}
		var [ secs, mins, hours ] = timeStr.innerText.split(':').reverse();
		return ~~secs + (60 * (~~mins + (60 * (~~hours))));
	}

	_setVideoMetaData(video: {
		element: Thumbnail;
		watched: boolean;	
		isLiveStream: boolean;
	}): Partial<TransformedVideo> {
		return Object.assign(video, {
			title: video.element.data.title.simpleText,
			channel: video.element.querySelector('#metadata').querySelector('#byline-container').querySelector('a').innerText,
			length: video.isLiveStream ? Infinity : this._parseTime(video.element.querySelector('ytd-thumbnail-overlay-time-status-renderer').querySelector('span') as HTMLElement)
		});
	}

	_hideVideo(video: TransformedVideo) {
		video.element.style.display = 'none';
		return video;
	}

	_containsPart(arr: string[], str: string) {
		for (let i = 0; i < arr.length; i++) {
			if (str.indexOf(arr[i]) > -1) {
				return true;
			}
		}
		return false;
	}

	_containsAllParts(arrOfArr: string[][], str: string) {
		for (let i = 0; i < arrOfArr.length; i++) {
			if (arrOfArr[i].filter((e) => {
				return str.indexOf(e) === -1;
			}).length === 0) {
				return true;
			}
		}
		return false;
	}

	_isPartOfLongerThan(channel: string, video: TransformedVideo) {
		for (let i = 0; i < PODCAST_CHANNELS.onLongerThan.length; i++) {
			const [ matchedChannel, minLength ] = PODCAST_CHANNELS.onLongerThan[i];
			if (matchedChannel.toLowerCase() === channel && video.length > minLength) {
				return true;
			}
		}
		return false;
	}

	_isPodcast(video: TransformedVideo, title: string, channel: string): boolean {
		if (video.length === Infinity) {
			return false;
		}

		if (this._containsPart(EXCLUDE, title)) {
			return false;
		}

		if (this._containsAllParts(PODCAST_VIDS, title) || 
			this._containsPart(PODCAST_CHANNELS.always, channel) ||
			this._isPartOfLongerThan(channel, video)) {
				return true;
			}
			
		return this._containsPart(PODCAST_CHANNELS.onLongerThanHour, channel) &&
				video.length > HOUR;
	}

	_addPocastToWatchLater(video: TransformedVideo): TransformedVideo {
		const title = video.title.toLowerCase();
		const channel = video.channel.toLowerCase();
		if (this._isPodcast(video, title, channel)) {
			video.isPodcast = true;
			this._hideVideo(video);
			video.isHidden = true;
			addVideoToWatchLater(video.element.querySelector('ytd-thumbnail-overlay-toggle-button-renderer').querySelector('yt-icon') as YoutubeIconElement);
			return video;
		}
		video.isPodcast = false;

		return video;
	}

	async _applyArrayTransformation(arr: Thumbnail[], fns: ((video: any) => any)[]): Promise<TransformedVideo[]> {
		return await Promise.all(arr.map(async (item) => {
			for (let i = 0; i < fns.length; i++) {
				item = await fns[i](item);
			}
			return <any>item as TransformedVideo;
		}));
	}

	_replaceLinks(videos: TransformedVideo[]) {
		videos.forEach((video) => {
			const anchors = <any>video.element.querySelectorAll('a') as (HTMLAnchorElement & {
				hasListener?: boolean;
			})[];
			video.links = [];
			Array.from(anchors).forEach((anchor) => {
				const link = `https://www.youtube.com/watch?v=${video.element.data.videoId}`;
				if (!anchor.hasListener) {
					anchor.href = '#';
					anchor.addEventListener('click', (e) => {
						if (e.defaultPrevented || (e.clientX === 0 && e.clientY === 0)) {
							return;
						}
						e.preventDefault();
						e.stopPropagation();
						window.navToLink(link, video);
					});
					anchor.addEventListener('contextmenu', () => {
						require('electron').clipboard.writeText(link);
						window.sendMessage('log', 'toast', 'Copied to clipboard 📋');
					});
					anchor.hasListener = true;
				}
				video.links.push(link);
			});
			video.disabled = false;
		});
	}

	_setContext(videos: TransformedVideo[]): TransformedVideo[] {
		for (let i = 0; i < videos.length; i++) {
			videos[i].next = videos[i + 1] || null;
			videos[i].previous = videos[i - 1] || null;
			videos[i].index = i;
			videos[i].list = videos;
		}
		return videos;
	}

	async init(videos: NodeListOf<Thumbnail>, noCursorRefresh: boolean = false) {
		this.videos = this._setContext(await this._applyArrayTransformation(Array.from(videos), [
			this._objectify.bind(this),
			this._waitForReady.bind(this),
			this._markWatched.bind(this),
			this._setVideoMetaData.bind(this),
			this._addPocastToWatchLater.bind(this)
		]));
		this.selected = new SelectedVideo(this.videos, (
			window.videos && window.videos.selected && 
			window.videos.selected.current && window.videos.selected.current.title
		) || null, noCursorRefresh);

		this._replaceLinks(this.videos);

		return this;
	}

	async update(videos: NodeListOf<Thumbnail>) {
		return this.init(videos, true);
	}

	constructor() { }
}

function el<T extends keyof HTMLElementTagNameMap>(tagName: T, className: string, 
	children: string|HTMLElement|(HTMLElement|string)[] = [], id?: string): HTMLElementTagNameMap[T] {
		const element = document.createElement(tagName);
		if (className && className.length > 0) {
			element.classList.add(...className.split(' '));
		}
		if (id && id.length > 0) {
			element.id = id;
		}

		let childrenArr: (HTMLElement|string)[] = Array.isArray(children) ?
			children : [children];

		for (let child of childrenArr) {
			if (typeof child === 'string') {
				element.innerText = child;
			} else {
				element.appendChild(child);
			}
		}

		return element;
	}

class Spinner {
	private element: HTMLElement;

	constructor() {
		this.element = el('div', 'small', [
			el('div', '', [
				el('div', 'spinner-layer layer-1', [
					el('div', 'circle-clipper left', [
						el('div', 'circle')
					]),
					el('div', 'gap-patch', [
						el('div', 'circle')
					]),
					el('div', 'circle-clipper right', [
						el('div', 'circle')
					])
				]),
				el('div', 'spinner-layer layer-2', [
					el('div', 'circle-clipper left', [
						el('div', 'circle')
					]),
					el('div', 'gap-patch', [
						el('div', 'circle')
					]),
					el('div', 'circle-clipper right', [
						el('div', 'circle')
					])
				]),
				el('div', 'spinner-layer layer-3', [
					el('div', 'circle-clipper left', [
						el('div', 'circle')
					]),
					el('div', 'gap-patch', [
						el('div', 'circle')
					]),
					el('div', 'circle-clipper right', [
						el('div', 'circle')
					])
				]),
				el('div', 'spinner-layer layer-4', [
					el('div', 'circle-clipper left', [
						el('div', 'circle')
					]),
					el('div', 'gap-patch', [
						el('div', 'circle')
					]),
					el('div', 'circle-clipper right', [
						el('div', 'circle')
					])
				])
			], 'spinnerContainer')
		], 'spinner');

		document.body.insertBefore(this.element, document.body.children[0]);
	}

	public show() {
		this.element.classList.add('active');
	}

	public hide() {
		this.element.classList.remove('active');
	}
}

async function identifyVideos(spinner: Spinner) {
	const vids = document.querySelectorAll('ytd-grid-video-renderer');
	if (!window.videos) {
		spinner.show();
		const videoIndentifier = new VideoIdentifier();
		window.videos = await videoIndentifier.init(vids as NodeListOf<Thumbnail>);
	} else if (window.videos.getAmount() !== vids.length) {
		spinner.show();
		window.videos = await window.videos.update(vids as NodeListOf<Thumbnail>);
	}
	spinner.hide();
}

window.navToLink = (link, video) => {
	window.sendMessage('toWindow', 'changeYoutubeSubsLink', link);
	if (video) {
		window.videos.selected.setCurrent(video);
	}
};

async function initVideoIdentification() {
	const spinner = new Spinner();
	while (true) {
		await identifyVideos(spinner);
		await new Promise((resolve) => {
			window.setTimeout(resolve, 1000);
		});
	}
}
initVideoIdentification();

window.addEventListener('keydown', (e) => {
	switch (e.key) {
		case 'l':
			watchedSelected++;
			window.videos.selected.selectLatestWatched();
			break;
		case 'k':
			watchedSelected = watchedSelected - 1 || 0;
			window.videos.selected.selectLatestWatched();
			break;
		case 'ArrowLeft':
			window.videos.selected.goLeft();
			e.stopPropagation();
			e.preventDefault();
			break;
		case 'ArrowRight':
			window.videos.selected.goRight();
			e.stopPropagation();
			e.preventDefault();
			break;
		case 'ArrowUp':
			window.videos.selected.goUp();
			e.stopPropagation();
			e.preventDefault();
			break;
		case 'ArrowDown':
			window.videos.selected.goDown();
			e.stopPropagation();
			e.preventDefault();
			break;
		case 'Enter':
		case ' ': //Space... wtf is this google
			window.videos.selected.launchCurrent();
			e.stopPropagation();
			e.preventDefault();
			break;
	}
});