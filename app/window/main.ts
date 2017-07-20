/// <reference path="../../typings/chrome.d.ts" />

interface Window {
	baseView: ViewNames;
	Helpers: typeof Helpers;
	Netflix: typeof Netflix;
	AppWindow: typeof AppWindow;
	YoutubeMusic: typeof YoutubeMusic;
	YoutubeSearch: typeof YoutubeSearch;
	YoutubeSubscriptions: typeof YoutubeSubscriptions;
}

interface ReducedElement {
	id: string;
	classList: Array<string>;
	tagName: string;
}

interface LoadCommitEvent extends Event {
	url: string;
	isTopLevel: boolean;
}

type MappedKeyboardEvent = KeyboardEvent & {
	currentTarget: ReducedElement;
	path: Array<ReducedElement>;
	srcElement: ReducedElement;
	target: ReducedElement;
}

const $ = <K extends keyof ElementTagNameMap>(selector: K|string,
	base: HTMLElement|Element|Document = document): HTMLElement => {
		return base.querySelector(selector) as HTMLElement;
	}
const $$ = <K extends keyof ElementListTagNameMap>(selector: K|string,
	base: HTMLElement|Element|Document = document): Array<HTMLElement> => {
		return Array.from(base.querySelectorAll(selector)) as Array<HTMLElement>;
	}

function arr(first: number, last: number): Array<number> {
	return Array.from(new Array(1 + last - first)).map((_, index) => {
		return first + index;
	});
}

const VALID_INPUT = arr(65, 90).map((charCode) => {
	return String.fromCharCode(charCode);
}).concat(arr(65,90).map((charCode) => {
	return String.fromCharCode(charCode).toLowerCase();
})).concat(arr(0, 9).map(num => num + '')).concat([
	'!','@','#','$','%','^','&','*','(',')','-','_','+','=','\'','"',
	';',':',',','.','<','>','/','?','\\','|','`','~'
]);

namespace AdBlocking {
	let ready: boolean = false;
	let rules: {
		fullMatch: Array<RegExp>;
		endsWith: Array<RegExp>;
		path: Array<RegExp>;
	} = null;

	interface RuleBase {
		type: 'fullMatch'|'endsWith'|'path';
		rule: RegExp;
	}

	interface FullMatchType extends RuleBase {
		type: 'fullMatch';
	}

	interface EndsWithType extends RuleBase {
		type: 'endsWith';
	}

	interface PathType extends RuleBase {
		type: 'path';
	}

	type Rule = FullMatchType|EndsWithType|PathType;

	function getList(): Promise<string> { 
		return window.fetch(chrome.runtime.getURL('/adblocking/easylist.txt')).then((response) => {
			return response.text();
		});
	}

	const alphabetChar = /[a-z|A-Z]/;
	function stringToRegex(url: string): RegExp {
		return new RegExp(url.split('').map((char) => {
			if (char === '*') {
				return '([a-z|A-Z]|[0-9])+';
			}
			return (alphabetChar.exec(char) ? char : '\\' + char);
		}).join(''));
	}

	function processLine(line: string): Rule {
		if (line.indexOf('##') > -1) {
			return null;
		}

		if (line.startsWith('/')) {
			return {
				type: 'path',
				rule: stringToRegex(line)
			};
		} else if (line.startsWith('||') && line.endsWith('^')) {
			return {
				type: 'endsWith',
				rule: stringToRegex(line)
			}
		} else if (line.startsWith('|') && line.endsWith('|')) {
			return {
				type: 'fullMatch',
				rule: stringToRegex(line)
			};
		}
		return null;
	}

	function preProcessList(list: Array<string>): {
		fullMatch: Array<RegExp>;
		endsWith: Array<RegExp>;
		path: Array<RegExp>;
	} {
		const res = list.map((line) => {
			return processLine(line);
		}).filter((el) => {
			return el !== null;
		});
		return {
			fullMatch: res.filter(item => item.type === 'fullMatch').map(item => item.rule),
			endsWith: res.filter(item => item.type === 'endsWith').map(item => item.rule),
			path: res.filter(item => item.type === 'path').map(item => item.rule)
		}
	}

	new Promise((resolve) => {
		getList().then((fetchedList) => {
			rules = preProcessList(fetchedList.split('\n'));
			resolve();
		});
	}).then(() => {
		ready = true;
	});

	function splitURL(url: string): {
		path: string;
		host: string;
	} {
		const noProtocol = url.split('://')[1];
		const hostAndPathSplit = noProtocol.split('/');
		return {
			path: hostAndPathSplit[1],
			host: hostAndPathSplit[0]
		}
	}

	function isBlocked(url: string): boolean {
		const { path, host } = splitURL(url);

		for (let i = 0; i < rules.fullMatch.length; i++) {
			if (rules.fullMatch[i].exec(url)) {
				return true;
			}
		}
		for (let i = 0; i < rules.endsWith.length; i++) {
			if (rules.endsWith[i].exec(url) && host.endsWith(rules.endsWith[i].exec(url)[0])) {
				return true;
			}
		}
		for (let i = 0; i < rules.path.length; i++) {
			if (rules.path[i].exec(url) && path.endsWith(rules.path[i].exec(url)[0])) {
				return true;
			}
		}
		return false;
	}

	export function BlockAd(url: string): boolean {
		if (!ready) {
			return false;
		}

		if (isBlocked(url)) {
			console.log(`Blocked ad from loading ${url}`);
			return true;
		}
		return false;
	}
}

interface InjectDetails {
	code?: string;
	file?: string; 
}

interface NewWindowEvent extends Event {
	window: Window;
	targetUrl: string;
	initialWidth: number;
	initialHeight: number;
	name: string;
	windowOpenPosition: string;
}

interface WebRequestListenerResult {
	requestId: string;
	url: string;
	method: string;
	frameId: number;
	parentFrameId: number;
	requestBody?: {
		error: string;
		formData: Object;
		raw: Array<{
			bytes?: any;
			file?: string;
		}>;
	};
	tabId: number;
	type: 'main_frame'|'sub_frame'|'stylesheet'|'script'|'image'|'font'|'object'|'xmlhttprequest'|'ping'|'other';
	timestamp: number;
}

interface InjectionItems {
	code?: string;
	files?: Array<string>;
}

interface ContentScriptDetails {
	name: string;
	matches: Array<string>|string;
	exclude_matches?: Array<string>|string;
	match_about_blank?: boolean;
	css?: InjectionItems;
	js?: InjectionItems;
	run_at?: 'document_start'|'document_end'|'document_idle';
	all_frames?: boolean;
	include_globs?: Array<string>;
	exclude_globs?: Array<string>; 
}

interface WebView extends HTMLElement {
	executeScript: (details: InjectDetails, callback?: (result: Array<any>) => void) => void;
	request: {
		onBeforeRequest: {
			addListener: (listener: (details: WebRequestListenerResult) => void|{
				cancel: boolean
			}, urls: {
				urls: Array<string>;
			}, permissions?: Array<string>) => void;
		}
	};
	addContentScripts: (scripts: Array<ContentScriptDetails>) => void;
	src: string;
	back: (callback?: () => void) => void;
	canGoBack<T extends boolean>(value: T): T;
	canGoForward<T extends boolean>(value: T): T;
}

interface YoutubeVideoPlayer extends HTMLElement {
	getVolume(): number;
	isMuted(): boolean;
	setVolume(volume: number): void;
	unMute(): void;
	getPlayerState(): number;
	playVideo(): void;
	pauseVideo(): void;
	getAdState(): number;
	setPlaybackQuality(quality: string): void;
	getPlaybackQuality(): string;
	setSizeStyle(expanded: boolean, expandedAgain: boolean): void;
	setSize(): void;
	getCurrentTime(): number;
	seekTo(seconds: number): void;
}

type ViewNames = 'ytmusic'|'netflix'|'youtubeSubscriptions'|'youtubesearch';

namespace Helpers {
	export function stringifyFunction(fn: Function): string {
		return `(${fn.toString()})();`;
	}

	export function toQueryString(obj: {
		[key: string]: any;
	}): string {
		const parts: Array<string> = [];
		for (let key in obj) {
			parts.push(`${key}=${obj[key]}`);
		}
		return `?${parts.join('&')}`;
	}

	function createTag(fn: Function): string {
		const str = fn.toString();
		return (() => {
			const tag = document.createElement('script');
			tag.innerHTML = `(${str})();`;
			document.documentElement.appendChild(tag);
			document.documentElement.removeChild(tag);
		}).toString().replace('str', str);
	}

	function replaceParameters(code: string, parameters: {
		[key: string]: number|string|boolean;
	}): string {
		Object.getOwnPropertyNames(parameters).forEach((key) => {
			const arg = parameters[key];
			if (typeof arg === 'string' && arg.split('\n').length > 1) {
				code = code.replace(new RegExp(`REPLACE\.${key}`, 'g'), 
					`' + ${JSON.stringify(arg.split('\n'))}.join('\\n') + '`);
			} else {
				code = code.replace(new RegExp(`REPLACE\.${key}`, 'g'), 
					arg !== undefined && arg !== null && typeof arg === 'string' ?
						arg.replace(/\\\"/g, `\\\\\"`) : arg.toString());
			}
		});
		return code;
	}

	export function hacksecute<T extends {
		[key: string]: number|string|boolean;
	}>(view: WebView, fn: (REPLACE: T) => void, parameters?: T) {
		if (!view.src) {
			return;
		}
		view.executeScript({
			code: replaceParameters(`(${createTag(fn).toString()})();`
				.replace(/\$\{EXTENSIONIDSTRING\}/,
					chrome.runtime.id), parameters || {})
		});
	}

	let taskIds = 0;
	const taskListeners: {
		[id: number]: (result: any) => void;
	} = {};
	export function returnTaskValue(result: any, id: number) {
		if (taskListeners[id]) {
			taskListeners[id](result);
		}
		delete taskListeners[id];
	};

	export function sendTaskToPage(name: string, page: string, callback: (result: any) => void) {
		chrome.storage.local.get('tasks', (data) => {
			data['tasks'] = data['tasks'] || [];
			data['tasks'].push({
				name: name,
				page: page,
				id: ++taskIds
			});

			taskListeners[taskIds] = callback;

			chrome.storage.local.set({
				tasks: data['tasks']
			});
		});
	}

	export function toArr(iterable: any): Array<any> {
		const arr = [];
		for (let i = 0; i < iterable.length; i++) {
			arr[i] = iterable[i];
		}
		return arr;
	}

	export function downloadVideo(url: string, removeOverlay: boolean = false) {
		if (removeOverlay) {
			const searchPageView = $('#youtubeSearchPageView');
			searchPageView && searchPageView.remove();
		}
		window.open(`http://www.youtube-mp3.org/#v${url.split('?v=')[1]}`, '_blank');
	}
}

namespace YoutubeMusic {
	let view: WebView = null;

	namespace Visualization {
		let visualizing = false;

		export function isVisualizing() {
			return visualizing;
		}

		export function toggle() {
			visualizing = !visualizing;
		}
	}

	namespace Content {
		export function init() {
			Helpers.hacksecute(view, () => {
				if ((window as any).executedYTCA) {
					return;
				}
				(window as any).executedYTCA = location.href;

				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				const playerApi = document.getElementById('player-api');
				const volumeBar = document.createElement('div');
				const volumeBarBar = document.createElement('div');
				const volumeBarNumber = document.createElement('div');
				const visualizer = document.createElement('div');
				visualizer.classList.add('ytma_visualization_cont');
				document.body.insertBefore(visualizer, document.body.children[0]);

				volumeBar.id = 'yt-ca-volumeBar';
				volumeBarBar.id = 'yt-ca-volumeBarBar';
				volumeBarNumber.id = 'yt-ca-volumeBarNumber';

				let volumeBarTimeout: number = null;
				let visualizing = false;

				volumeBar.appendChild(volumeBarNumber);
				volumeBar.appendChild(volumeBarBar);
				document.body.appendChild(volumeBar);

				function cleanupData(dataArray: Float32Array): Array<number> {
					for (let i in dataArray) {
						if (dataArray[i] <= -100 || dataArray[i] === -80 || dataArray[i] === -50) {
							dataArray[i] = 0;
							continue;
						}
						dataArray[i] = (dataArray[i] + 100) / 100;
					}

					const newArray = [];

					//Compress it into a max of 120 bars
					const delta = (dataArray.length / 120);
					for (let i = 0; i < dataArray.length; i += delta) {
						let average = dataArray.slice(i, i + delta).reduce((a, b) => {
							return a + b;
						}) / delta;
						newArray.push(average);
					}

					return newArray;
				}

				function renderBars(data: AudioVisualizerSettings) {
					data.bars.forEach((element, index) => {
						element.style.transform = `scaleY(${data.parsedArray[index] * 1.5})`;
					});
				}

				function visualize(this: AudioVisualizerSettings) { 
					this.analyser.getFloatFrequencyData(this.dataArray);
					this.parsedArray = cleanupData(this.dataArray);

					renderBars(this);

					if (visualizing) {
						window.requestAnimationFrame(visualize.bind(this));
					}
				}

				interface AudioVisualizerSettings {
					video: HTMLVideoElement;
					ctx: AudioContext;
					analyser: AnalyserNode;
					vidSrc: MediaElementAudioSourceNode;
					dataArray: Float32Array;
					bars: Array<HTMLElement>;
					parsedArray?: Array<number>;
				}

				function checkForVisualizer(data: AudioVisualizerSettings) {
					const shouldVisualize = document.body.classList.contains('showVisualizer');
					if (visualizing === shouldVisualize) {
						return;
					}
					if (shouldVisualize) {
						visualizing = true;
						localStorage.setItem('visualizing', JSON.stringify(true));
						document.body.classList.add('showVisualizer');
						window.requestAnimationFrame(visualize.bind(data));
					} else {
						document.body.classList.remove('showVisualizer');
						localStorage.setItem('visualizing', JSON.stringify(false));
						visualizing = false;
					}
				}

				function setupVisualizer() {
					const data: AudioVisualizerSettings = {} as any;
					data.video = document.querySelector('video') as HTMLVideoElement;
					data.ctx = new AudioContext();
					data.analyser = data.ctx.createAnalyser();
					data.vidSrc = data.ctx.createMediaElementSource(data.video);
					
					data.vidSrc.connect(data.analyser);
					data.vidSrc.connect(data.ctx.destination);

					data.dataArray = new Float32Array(data.analyser.frequencyBinCount);
					data.analyser.getFloatFrequencyData(data.dataArray);

					data.bars = Array(100).join('a').split('a').map((el) => {
						let bar = document.createElement('div');
						bar.classList.add('ytma_visualization_bar');
						visualizer.appendChild(bar);
						return bar;
					});

					const shouldVisualize = JSON.parse(localStorage.getItem('visualizing') || JSON.stringify(false));
					visualizing = shouldVisualize;
					if (shouldVisualize) {
						document.body.classList.add('showVisualizer');
					}

					window.setInterval(() => {
						checkForVisualizer(data);
					}, 50);
				}

				function prepareVideo() {
					let timePassed: number = 0;
					setTimeout(() => {
						timePassed += 500;
						function reloadIfAd() {
							if (player.getAdState() === 1) {
								window.location.reload();
							}

							if (player.getPlayerState() === 3) {
								window.setTimeout(reloadIfAd, 250);
								timePassed += 250;
							} else {
								window.setTimeout(() => {
									player.setPlaybackQuality('hd1080');
									if (player.getPlaybackQuality() !== 'hd1080') {
										player.setPlaybackQuality('hd720');
									}
									
									if (document.querySelector('.ytp-size-button')
											.getAttribute('title') === 'Theatermodus') {
										player.setSizeStyle(true, true);
									}
									setupVisualizer();

									localStorage.setItem('loaded', 'ytmusic');
								}, Math.max(2500 - timePassed, 0));
							}
						}
						reloadIfAd();
					}, 500);
				}

				prepareVideo();

				document.body.addEventListener('keypress', (e) => {
					if (e.key === 'h') {
						//Hide or show video
						document.body.classList.toggle('showHiddens');
					}
				});

				function updateSizes() {
					playerApi.style.width = window.innerWidth + 'px';
					playerApi.style.height = (window.innerHeight - 15) + 'px';

					player.setSize();
				}

				updateSizes();
				window.addEventListener('resize', updateSizes);

				function setPlayerVolume(volume: number) {
					player.setVolume(volume);

					localStorage.setItem('yt-player-volume', JSON.stringify({
						data: JSON.stringify({
							volume: volume,
							muted: (volume === 0)
						}),
						creation: Date.now(),
						expiration: Date.now() + (30 * 24 * 60 * 60 * 1000) //30 days
					}));
				}

				//Code that has to be executed "inline"
				function increaseVolume() {
					let vol = player.getVolume();
					if (player.isMuted()) {
						//Treat volume as 0
						vol = 0;
						player.unMute();
					}

					if (vol <= 10) {
						vol += 1;
					} else {
						vol += 5;
					}
					vol = (vol > 100 ? 100 : vol);
					setPlayerVolume(vol);
				}

				function lowerVolume() {
					let vol = player.getVolume();
					if (!player.isMuted()) {
						if (vol <= 10) {
							vol -= 1;
						} else {
							vol -= 5;
						}
						
						vol = (vol < 0 ? 0 : vol);
						setPlayerVolume(vol);
					}
				}

				function showVolumeBar() {
					const volume = player.getVolume();
					localStorage.setItem('volume', volume + '');
					volumeBarNumber.innerHTML = volume + '';
					volumeBarBar.style.transform = `scaleX(${volume / 100})`;
					volumeBar.classList.add('visible');
					if (volumeBarTimeout !== null) {
						window.clearTimeout(volumeBarTimeout);
					}
					volumeBarTimeout = window.setTimeout(() => {
						volumeBar.classList.remove('visible');
						volumeBarTimeout = null;
					}, 2000);
				}

				function onScroll(isDown: boolean) {
					if (isDown) {
						lowerVolume();
					} else {
						increaseVolume();
					}
					showVolumeBar();
				}

				function addListeners() {
					window.onwheel = (e) => {
						onScroll(e.deltaY > 0);
					};
				}

				addListeners();

				function executeTask(name: string, id: number) {
					let result = null;
					switch (name) {
						case 'getTime':
							result = (
								document.querySelector('.html5-video-player') as YoutubeVideoPlayer
							).getCurrentTime();
							break;
						default:
							if (name.indexOf('getSongName') > -1) {
								let timestampContainers = document
									.querySelector('#eow-description')
									.querySelectorAll('a[href="#"]');
								const index = ~~name.split('getSongName')[1];
								const textNodes = [];
								if (!isNaN(index) && timestampContainers[index]) {
									let currentNode = timestampContainers[index].previousSibling as HTMLElement;

									//Search back until a <br> is found
									while (currentNode && currentNode.tagName !== 'BR') {
										if (!currentNode.tagName) {
											textNodes.push(currentNode.nodeValue);
										}
										currentNode = currentNode.previousSibling as HTMLElement;
									}

									currentNode = timestampContainers[index].nextSibling as HTMLElement;

									//Search forward until a <br> is found
									while (currentNode && currentNode.tagName !== 'BR') {
										if (!currentNode.tagName) {
											textNodes.push(currentNode.nodeValue);
										}
										currentNode = currentNode.nextSibling as HTMLElement;
									}

									//Go through list and find something that resembles a song
									for (let i = 0; i < textNodes.length; i++) {
										if (/.+-.+/.test(textNodes[i])) {
											//This is a song
											result = textNodes[i];
											break;
										}
									}

									if (!result) {
										//Just try this instead
										result = textNodes[0];
									}
								} else {
									result = null;
								}
							}
							break;
					}

					localStorage.setItem(`taskResult${id}`, result + '');
				}

				function checkForTasks() {
					let tasks;
					if ((tasks = localStorage.getItem('tasks'))) {
						try {
							tasks = JSON.parse(tasks);
						} catch(e) {
							tasks = [];
						}
						if (Array.isArray(tasks) && tasks.length > 0) {
							tasks.forEach((task) => {
								executeTask(task.name, task.id);
							});
							localStorage.setItem('tasks', '[]');
						}
					}
				}

				window.setInterval(checkForTasks, 50);
			});
		}
	}

	namespace Downloading {
		let songFoundTimeout: number = null;
		let songFoundName = '';
		export function downloadSong() {
			//Search for it on youtube
			const view: WebView = document.createElement('webview') as WebView;
			view.id = 'youtubeSearchPageView';

			view.addContentScripts([{
				name: 'youtubeSearchJs',
				matches: ['*://www.youtube.com/*'],
				js: {
					files: ['/youtube/youtubeSearch/youtubeSearch.js', 
						'/genericJs/keypress.js']
				},
				run_at: 'document_end'
			}, {
				name: 'youtubeSearchCss',
				matches: ['*://www.youtube.com/*'],
				css: {
					files: ['/youtube/youtubeSearch/youtubeSearch.css']
				},
				run_at: "document_start"
			}]);

			view.src = `https://www.youtube.com/results?search_query=${
				encodeURIComponent(songFoundName.trim().replace(/ /g, '+')).replace(/%2B/g, '+')
			}&page=&utm_source=opensearch`;
			document.body.appendChild(view);
		}
		$('#getSongDownload').addEventListener('click', downloadSong);

		function displayFoundSong(name: string) {
			$('#getSongName').innerHTML = name;
			const dialog = $('#getSongDialog');
			dialog.classList.add('visible');
			dialog.classList.add('hoverable');
			if (songFoundTimeout !== null) {
				window.clearTimeout(songFoundTimeout);
			}
			songFoundName = name;
			songFoundTimeout = window.setTimeout(() => {
				dialog.classList.remove('visible');
				window.setTimeout(() => {
					dialog.classList.remove('hoverable');
				}, 200);
			}, 5000);
		}

		function timestampToSeconds(timestamp: string): number {
			const split = timestamp.split(':');
			let seconds = 0;
			for (let i = split.length - 1; i >= 0; i--) {
				seconds = Math.pow(60, (split.length - (i + 1))) * ~~split[i];
			}
			return seconds;
		}

		function getSongIndex(timestamps: Array<number|null>, time: number): number {
			for (let i = 0; i < timestamps.length; i++) {
				if (timestamps[i] <= time && timestamps[i + 1] >= time) {
					return i;
				}
			}
			return timestamps.length - 1;
		}

		function findOn1001Tracklists(name: string, url: string): Promise<boolean> {
			return new Promise((resolve) => {
				const websiteWebview = document.createElement('webview') as WebView;
				let currentPage: 'main'|'results'|'none' = 'none';
				websiteWebview.addContentScripts([{
					name: 'comm',
					matches: ['*://*/*'],
					js: {
						files: [
							'/genericJs/comm.js',
							'/genericJs/keypress.js',
							'/youtube/1001tracklists/content.js'
						]
					}
				}]);
				websiteWebview.addEventListener('contentload', () => {
					if (currentPage === 'none') {
						currentPage = 'main';
					} else if (currentPage === 'main') {
						currentPage = 'results';
					}

					if (currentPage === 'main') {
						Helpers.sendTaskToPage(JSON.stringify([
							'searchFor', name
						]), '1001tracklists', () => {

						});
					} else if (currentPage === 'results') {
						Helpers.sendTaskToPage(JSON.stringify([
							'findItem', url
						]), '1001tracklists', (result: false|string) => {
							if (result !== 'null' && result !== 'false' && result) {
								getTrackFrom1001TracklistsUrl(result);
							} else {
								resolve(false);
							}
							websiteWebview.remove();
						});
					}
				});
				websiteWebview.src = 'https://www.1001tracklists.com';
				document.body.appendChild(websiteWebview);
			});
		}

		function getUrlHTML(url: string, data: RequestInit = {
			method: 'GET'
		}): Promise<DocumentFragment> {
			return new Promise((resolve) => {
				window.fetch(url, data).then((response) => {
					return response.text();
				}).then((html) => {
					const doc = document.createRange().createContextualFragment(html);
					resolve(doc);
				});
			});
		}

		function getTrackFrom1001TracklistsUrl(url: string) {
			getUrlHTML(url).then((doc) => {
				const tracks = Helpers.toArr(doc.querySelectorAll('.tlpTog')).map((songContainer) => {
					try {
						const nameContainer = songContainer.querySelector('.trackFormat');
						const namesContainers = nameContainer.querySelectorAll('.blueTxt, .blackTxt');
						const artist = namesContainers[0].innerText; 
						const songName = namesContainers[1].innerText;
						let remix = '';
						if (namesContainers[2]) {
							remix = ` (${namesContainers[2].innerText} ${namesContainers[3].innerText})`;
						}

						if (songContainer.querySelector('.cueValueField').innerText === '') {
							return null;
						}

						const timeField = songContainer.querySelector('.cueValueField').innerText;
						return {
							startTime: timeField === '' ? timestampToSeconds(timeField) : null,
							songName: `${artist} - ${songName}${remix}`
						};
					} catch(e) {
						return null;
					}
				});

				Helpers.sendTaskToPage('getTime', 'youtube', (time) => {
					const index = getSongIndex(tracks.filter((track) => {
						return !!track;
					}).map((track) => {
						return track.startTime;
					}), ~~time);

					let unsure = false;
					if (tracks[index - 1] && tracks[index - 1].startTime === null) {
						unsure = true;
					} else if (tracks[index + 1] && tracks[index + 1].startTime === null) {
						unsure = true;
					}
					const trackName = tracks[index].songName;
					displayFoundSong(unsure ? `???${trackName}???` : trackName);
				});
			});
		}

		export function getCurrentSong() {
			Helpers.sendTaskToPage('getTimestamps', 'youtube', (timestamps: {
				found: true;
				data: Array<number>|string
			}|{
				found: false;
				data: {
					name: string;
					url: string;
				}
			}) => {
				const enableOCR = false;
				if (enableOCR && !timestamps) {
					//Do some OCR magic
					//getSongFromOCR(displayFoundSong);
				} else if (timestamps.found === true) {
					const data = timestamps.data;
					if (!Array.isArray(data)) {
						//It's a link to the tracklist
						getTrackFrom1001TracklistsUrl(data);
					} else {
						Helpers.sendTaskToPage('getTime', 'youtube', (time) => {
							const index = getSongIndex(data, ~~time);
							Helpers.sendTaskToPage('getSongName' + index, 'youtube', (name) => {
								displayFoundSong(name);
							});
						});
					}
				} else {
					//Look if the podcast exists on 1001tracklists
					findOn1001Tracklists(timestamps.data.name, timestamps.data.url).then((found) => {
						if (!found) {
							//Show not found toast
							const toast = $('#mainToast');
							toast.classList.add('visible');
							window.setTimeout(() => {
								toast.classList.remove('visible');
							}, 5000);
						}
					});
				}
			});
		}
	}

	export function getCurrentSong() {
		Downloading.getCurrentSong();
	}

	export namespace Commands {
		export function lowerVolume() {
			Helpers.hacksecute(view, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (!player.isMuted()) {
					if (vol <= 10) {
						vol -= 1;
					}
					
					vol = (vol < 0 ? 0 : vol);
					player.setVolume(vol);
				}
			});
		}

		export function raiseVolume() {
			Helpers.hacksecute(view, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (player.isMuted()) {
					//Treat volume as 0
					vol = 0;
					player.unMute();
				}

				if (vol <= 10) {
					vol += 1;
				}
				vol = (vol > 100 ? 100 : vol);
				player.setVolume(vol);
			});
		}

		export function togglePlay() {
			Helpers.hacksecute(view, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				const state = player.getPlayerState();
				if (state === 2) {
					//Paused
					player.playVideo();
				} else if (state === 1) {
					//Playing
					player.pauseVideo();
				} else {
					//???
				}
			});
		}

		export function pause() {
			Helpers.hacksecute(view, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.pauseVideo();
			});
		}

		export function play() {
			Helpers.hacksecute(view, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.playVideo();
			});
		}
	}

	function blockViewAds() {
		const CANCEL = {
			cancel: true
		};
		view.request.onBeforeRequest.addListener((request) => {
			if (AdBlocking.BlockAd(request.url)) {
				return CANCEL;
			}
			return {
				cancel: false
			};
		}, {
			urls: ['*://*/*']
		}, ['blocking']);
	}

	function addViewListeners() {
		blockViewAds();
		view.addContentScripts([{
			name: 'js',
			matches: ['*://www.youtube.com/*'],
			js: {
				files: [
					'/genericJs/comm.js',
					'/genericJs/keypress.js',
					'/youtube/content/content.js'
				]
			},
			run_at: 'document_end'
		}, {
			name: 'css',
			matches: ['*://www.youtube.com/*'],
			css: {
				files: ['/youtube/content/content.css']
			},
			run_at: 'document_start'
		}]);

		view.addEventListener('contentload', () => {
			Content.init();
		});

		view.addEventListener('loadcommit', (e: LoadCommitEvent) => {
			if (e.isTopLevel) {
				window.setTimeout(Content.init, 1000);
			}
		});

		view.addEventListener('newwindow', (e: NewWindowEvent) => {
			window.open(e.targetUrl, '_blank');
		});

		view.addEventListener('keydown', (e) => {
			if (e.key === '?') {
				YoutubeMusic.getCurrentSong();
			}
		});
	}

	function launch(url: string) {
		view.src = url;
	}

	export function respondUrl(response: string|null) {
		if (response && typeof response === 'string') {
			launch(response);
		} else {
			//Do setup
			$('#setupCenterer').style.display = 'block';
		}
	}

	function addListeners() {
		AppWindow.listen('onMinimized', () => {
			if (Visualization.isVisualizing()) {
				Helpers.hacksecute(view, () => {
					document.body.classList.remove('showVisualizer');
				});
			}
		});
		AppWindow.listen('onRestored', () => {
			if (!AppWindow.app.isMinimized() && Visualization.isVisualizing()) {
				Helpers.hacksecute(view, () => {
					document.body.classList.add('showVisualizer');
				});
			}
		});
		Helpers.toArr(document.querySelectorAll('.toast .dismissToast')).forEach((toastButton) => {
			toastButton.addEventListener('click', () => {
				toastButton.parentNode.classList.remove('visible');
			});
		});
	}

	export function init() {
		chrome.runtime.sendMessage({
			cmd: 'getUrl'
		});
	}

	export function setup() {
		view = document.createElement('webview') as WebView;
		view.id = 'ytmaWebview';
		view.setAttribute('partition', 'persist:main-music');
		window.setTimeout(() => {
			addViewListeners();
			document.querySelector('#youtubePlaylistCont').appendChild(view);
			addListeners();
		}, 10);
	}

	export function onClose() {
		//Save progress
		view.executeScript({
			code: `(${(() => {
				const vidId = location.href.split('v=')[1].split('&')[0];
				let vidIndex = location.href.split('index=')[1];
				if (vidIndex.indexOf('&') > -1) {
					vidIndex = vidIndex.split('&')[0];
				}
				const [mins, secs] = document.querySelector('.ytp-time-current').innerHTML.split(':');
				const address = 'https://www.youtube.com/watch';
				const url = `${address}?v=${vidId}&list=WL&index=${vidIndex}&t=${mins}m${secs}s`;
				chrome.runtime.sendMessage({
					cmd: 'setUrl',
					url: url
				});
			}).toString()})()`
		});
	}

	export function onFocus() {
		view.focus();
	}

	export function getView(): WebView {
		return view;
	}

	export function onKeyPress(event: MappedKeyboardEvent): boolean {
		if (AppWindow.getActiveViewName() !== 'ytmusic') {
			return false;
		}
		if (event.key === 'd') {
			Downloading.downloadSong();
			return true;
		} else if (event.key === 'v') {
			Visualization.toggle();
			Helpers.hacksecute(view, () => {
				document.body.classList.toggle('showVisualizer');
			});
			return true;
		}
		return false;
	}
}

namespace Netflix {
	function initView(): WebView {
		const view = document.createElement('webview') as WebView;
		view.setAttribute('partition', 'persist:netflix');

		view.addEventListener('newwindow', (e: NewWindowEvent) => {
			window.open(e.targetUrl, '_blank');
		});
		
		document.querySelector('#netflixCont').appendChild(view);

		return view;
	}

	namespace Video {
		export let videoView: WebView = null;

		export function setup() {
			videoView = initView();
			videoView.id = 'netflixWebView';

			window.setTimeout(() => {
				videoView.addContentScripts([{
					name: 'js',
					matches: ['*://*/*'],
					js: {
						files: [
							'/genericJs/comm.js',
							'/genericJs/keypress.js',
							'/netflix/video/video.js'
						]
					},
					run_at: 'document_idle'
				}])
			}, 10);
		}
	}

	export namespace Commands {
		export function lowerVolume() {
			//Not possible
		}

		export function raiseVolume() {
			//Not possible
		}

		export function togglePlay() {
			Helpers.hacksecute(Video.videoView, () => {
				const video = (document.querySelector('video') as HTMLVideoElement);

				if (!(window as any).playerStatus) {
					//The states should be matching now
					(window as any).playerStatus = video.paused ? 
						'paused' : 'playing';
				}

				const playerStatus = (window as any).playerStatus;
				const videoStatus = video.paused ? 
						'paused' : 'playing';
				const playButton = (document.querySelector('.player-control-button') as ClickableElement);

				if (playerStatus === videoStatus) {
					//Statusses match up, switch it the normal way
					playButton.click();
					(window as any).playerStatus = ((window as any).playerStatus === 'playing' ? 'paused' : 'playing');
				} else {
					//Statusses don't match up, hit the button twice
					playButton.click();
					playButton.click();
				}
			});
		}

		export function pause() {
			Helpers.hacksecute(Video.videoView, () => {
				const video = (document.querySelector('video') as HTMLVideoElement);
				video.pause();
			});
		}

		export function play() {
			Helpers.hacksecute(Video.videoView, () => {
				const video = (document.querySelector('video') as HTMLVideoElement);
				video.play();
			});
		}
	}

	export function setup() {
		Video.setup();
	}

	interface ClickableElement extends Element {
		click: () => void;
	}

	export function init() {
		window.setTimeout(() => {
			Video.videoView.src = 'https://www.netflix.com/browse';
		}, 15);
	}

	export function onClose() {
		//Go for a semi-clean exit
		Video.videoView.src && Video.videoView.back();
	}

	export function onFocus() {
		Video.videoView.focus();
	}

	export function getView(): WebView {
		return Video.videoView;
	}

	export function onKeyPress(event: MappedKeyboardEvent) { 
		return false;
	}
}

namespace YoutubeSubscriptions {
	function initView(): WebView {
		const view = document.createElement('webview') as WebView;
		view.setAttribute('partition', 'persist:youtubeSubscriptions');

		view.addEventListener('newwindow', (e: NewWindowEvent) => {
			window.open(e.targetUrl, '_blank');
		});
		
		document.querySelector('#youtubeSubsCont').appendChild(view);

		return view;
	}

	export namespace Commands {
		export function lowerVolume() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (!player.isMuted()) {
					vol -= 5;
					
					vol = (vol < 0 ? 0 : vol);
					player.setVolume(vol);
				}
			});
		}

		export function raiseVolume() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (player.isMuted()) {
					//Treat volume as 0
					vol = 0;
					player.unMute();
				}

				vol += 5;
				vol = (vol > 100 ? 100 : vol);
				player.setVolume(vol);
			});
		}

		export function togglePlay() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				const state = player.getPlayerState();
				if (state === 2) {
					//Paused
					player.playVideo();
				} else if (state === 1) {
					//Playing
					player.pauseVideo();
				} else {
					//???
				}
			});
		}

		export function pause() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.pauseVideo();
			});
		}

		export function play() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.playVideo();
			});
			if (Video.videoView.src) {
				showVideo();
			}
		}

		export function magicButton() {
			SubBox.subBoxView.executeScript({
				code: Helpers.stringifyFunction(() => {
					(window as any).videos.selected.goLeft();
					(window as any).videos.selected.launchCurrent();
				})
			})
		}
	}

	namespace Video {
		export let videoView: WebView = null;

		export function setup() {
			videoView = initView();
			videoView.id = 'youtubeSubsVideoView';

			window.setTimeout(() => {
				videoView.addContentScripts([{
					name: 'js',
					matches: ['*://www.youtube.com/*'],
					js: {
						files: [
							'/genericJs/keypress.js'
						]
					},
					run_at: 'document_end'
				}, {
					name: 'css',
					matches: ['*://www.youtube.com/*'],
					css: {
						files: [
							'/youtube/content/content.css',
							'/youtubeSubs/video/youtubeVideo.css'
						]
					},
					run_at: 'document_start'
				}]);

				videoView.addEventListener('contentload', () => {
					Helpers.hacksecute(videoView, () => {
						const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
						const playerApi = document.getElementById('player-api');
						const volumeBar = document.createElement('div');
						const volumeBarBar = document.createElement('div');
						const volumeBarNumber = document.createElement('div');
						let volumeBarTimeout: number = null;

						volumeBar.id = 'yt-ca-volumeBar';
						volumeBarBar.id = 'yt-ca-volumeBarBar';
						volumeBarNumber.id = 'yt-ca-volumeBarNumber';

						volumeBar.appendChild(volumeBarNumber);
						volumeBar.appendChild(volumeBarBar);
						document.body.appendChild(volumeBar);

						function prepareVideo() {
							setTimeout(() => {							
								function reloadIfAd() {
									if (player.getAdState() === 1) {
										window.location.reload();
									}

									if (player.getPlayerState() === 3) {
										window.setTimeout(reloadIfAd, 250);
									} else {
										player.setPlaybackQuality('hd1080');
										if (player.getPlaybackQuality() !== 'hd1080') {
											player.setPlaybackQuality('hd720');
										}
										
										if (document.querySelector('.ytp-size-button')
												.getAttribute('title') === 'Theatermodus') {
											player.setSizeStyle(true, true);
										}

										localStorage.setItem('loaded', 'ytmusic');
									}
								}
								reloadIfAd();
							}, 2500);
						}

						prepareVideo();

						document.body.addEventListener('keydown', (e) => {
							if (e.key === 'k') {
								//Hide or show video
								document.body.classList.toggle('showHiddens');
							}
						});

						function updateSizes() {
							playerApi.style.width = window.innerWidth + 'px';
							playerApi.style.height = (window.innerHeight - 15) + 'px';

							player.setSize();
						}

						updateSizes();
						window.addEventListener('resize', updateSizes);

						function setPlayerVolume(volume: number) {
							player.setVolume(volume);

							localStorage.setItem('yt-player-volume', JSON.stringify({
								data: JSON.stringify({
									volume: volume,
									muted: (volume === 0)
								}),
								creation: Date.now(),
								expiration: Date.now() + (30 * 24 * 60 * 60 * 1000) //30 days
							}));
						}

						//Code that has to be executed "inline"
						function increaseVolume() {
							let vol = player.getVolume();
							if (player.isMuted()) {
								//Treat volume as 0
								vol = 0;
								player.unMute();
							}

							vol += 5;
							vol = (vol > 100 ? 100 : vol);
							setPlayerVolume(vol);
						}

						function lowerVolume() {
							let vol = player.getVolume();
							if (!player.isMuted()) {
								vol -= 5;
								
								vol = (vol < 0 ? 0 : vol);
								setPlayerVolume(vol);
							}
						}

						function showVolumeBar() {
							const volume = player.getVolume();
							localStorage.setItem('volume', volume + '');
							volumeBarNumber.innerHTML = volume + '';
							volumeBarBar.style.transform = `scaleX(${volume / 100})`;
							volumeBar.classList.add('visible');
							if (volumeBarTimeout !== null) {
								window.clearTimeout(volumeBarTimeout);
							}
							volumeBarTimeout = window.setTimeout(() => {
								volumeBar.classList.remove('visible');
								volumeBarTimeout = null;
							}, 2000);
						}

						function onScroll(isDown: boolean) {
							if (isDown) {
								lowerVolume();
							} else {
								increaseVolume();
							}
							showVolumeBar();
						}

						function addListeners() {
							window.onwheel = (e) => {
								onScroll(e.deltaY > 0);
							};
						}

						addListeners();
					});
				});
			}, 10);
		}
	}

	namespace SubBox {
		export let subBoxView: WebView = null;

		export function setup() {
			subBoxView = initView();
			subBoxView.id = 'youtubeSubsSubBoxView';

			window.setTimeout(() => {
				subBoxView.addContentScripts([{
					name: 'js',
					matches: ['*://www.youtube.com/*'],
					js: {
						files: [
							'/genericJs/comm.js',
							'/genericJs/keypress.js',
							'/youtubeSubs/subBox/subBox.js'
						]
					},
					run_at: 'document_end'
				}, {
					name: 'css',
					matches: ['*://www.youtube.com/*'],
					css: {
						files: ['/youtubeSubs/subBox/subBox.css']
					},
					run_at: 'document_start'
				}]);
			}, 10);
		}
	}

	function showVideo() {
		$('#youtubeSubsCont').classList.add('showVideo');
		Video.videoView.focus();
	}

	export function changeVideo(url: string) {
		Video.videoView.src = url;
		showVideo();
	}

	export function setup() {
		SubBox.setup();
		Video.setup();
	}

	export function init() {
		window.setTimeout(() => {
			SubBox.subBoxView.src = 'http://www.youtube.com/feed/subscriptions';
		}, 15);
	}

	export function onClose() {
		//Nothing really
	}

	export function onFocus() {
		if ($('#youtubeSubsCont').classList.contains('showVideo')) {
			Video.videoView.focus();
		} else {
			SubBox.subBoxView.focus();
		}
	}

	export function getView(): WebView {
		if ($('#youtubeSubsCont').classList.contains('showVideo')) {
			return Video.videoView;
		} else {
			return SubBox.subBoxView;
		}
	}

	export function onKeyPress(event: MappedKeyboardEvent): boolean {
		if (AppWindow.getActiveViewName() !== 'youtubeSubscriptions') {
			return false;
		}

		const subsCont = $('#youtubeSubsCont');
		if (event.key === 'h') {
			if (subsCont.classList.contains('showVideo')) {
				subsCont.classList.remove('showVideo');
				SubBox.subBoxView.focus();
			} else {
				subsCont.classList.add('showVideo');
				Video.videoView.focus();
			}
			return true;
		} else if (event.key === 'd') {
			if (subsCont.classList.contains('showVideo')) {
				Helpers.downloadVideo(Video.videoView.src)
				return true;
			}
		}
		return false;
	}
}

namespace YoutubeSearch {
	let activePage: 'video'|'results' = 'results';

	function initView(): WebView {
		const view = document.createElement('webview') as WebView;
		view.setAttribute('partition', 'persist:youtubeSubscriptions');

		view.addEventListener('newwindow', (e: NewWindowEvent) => {
			window.open(e.targetUrl, '_blank');
		});

		document.querySelector('#youtubeSearchCont').appendChild(view);
		view.addEventListener('loadabort', (e) => {
			e.preventDefault();
		});

		return view;
	}

	export namespace Commands {
		export function lowerVolume() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (!player.isMuted()) {
					vol -= 5;
					
					vol = (vol < 0 ? 0 : vol);
					player.setVolume(vol);
				}
			});
		}

		export function raiseVolume() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				let vol = player.getVolume();
				if (player.isMuted()) {
					//Treat volume as 0
					vol = 0;
					player.unMute();
				}

				vol += 5;
				vol = (vol > 100 ? 100 : vol);
				player.setVolume(vol);
			});
		}

		export function togglePlay() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				const state = player.getPlayerState();
				if (state === 2) {
					//Paused
					player.playVideo();
				} else if (state === 1) {
					//Playing
					player.pauseVideo();
				} else {
					//???
				}
			});
		}

		export function pause() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.pauseVideo();
			});
		}

		export function play() {
			Helpers.hacksecute(Video.videoView, () => {
				const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
				player.playVideo();
			});
			if (Video.videoView.src) {
				showVideo();
			}
		}

		export function magicButton() { }
	}

	export namespace Video {
		export let videoView: WebView = null;

		export function setup() {
			videoView = initView();
			videoView.id = 'youtubeSearchVideoView';

			window.setTimeout(() => {
				videoView.addContentScripts([{
					name: 'js',
					matches: ['*://www.youtube.com/*'],
					js: {
						files: [
							'/genericJs/keypress.js'
						]
					},
					run_at: 'document_end'
				}, {
					name: 'css',
					matches: ['*://www.youtube.com/*'],
					css: {
						files: [
							'/youtube/content/content.css',
							'/youtubeSubs/video/youtubeVideo.css'
						]
					},
					run_at: 'document_start'
				}]);

				videoView.addEventListener('contentload', () => {
					Helpers.hacksecute(videoView, () => {
						const player: YoutubeVideoPlayer = document.querySelector('.html5-video-player') as YoutubeVideoPlayer;
						const playerApi = document.getElementById('player-api');
						const volumeBar = document.createElement('div');
						const volumeBarBar = document.createElement('div');
						const volumeBarNumber = document.createElement('div');
						let volumeBarTimeout: number = null;

						volumeBar.id = 'yt-ca-volumeBar';
						volumeBarBar.id = 'yt-ca-volumeBarBar';
						volumeBarNumber.id = 'yt-ca-volumeBarNumber';

						volumeBar.appendChild(volumeBarNumber);
						volumeBar.appendChild(volumeBarBar);
						document.body.appendChild(volumeBar);

						function prepareVideo() {
							setTimeout(() => {							
								function reloadIfAd() {
									if (player.getAdState() === 1) {
										window.location.reload();
									}

									if (player.getPlayerState() === 3) {
										window.setTimeout(reloadIfAd, 250);
									} else {
										player.setPlaybackQuality('hd1080');
										if (player.getPlaybackQuality() !== 'hd1080') {
											player.setPlaybackQuality('hd720');
										}
										
										if (document.querySelector('.ytp-size-button')
												.getAttribute('title') === 'Theatermodus') {
											player.setSizeStyle(true, true);
										}

										localStorage.setItem('loaded', 'ytmusic');
									}
								}
								reloadIfAd();
							}, 2500);
						}

						prepareVideo();

						document.body.addEventListener('keydown', (e) => {
							if (e.key === 'k') {
								//Hide or show video
								document.body.classList.toggle('showHiddens');
							}
						});

						function updateSizes() {
							playerApi.style.width = window.innerWidth + 'px';
							playerApi.style.height = (window.innerHeight - 15) + 'px';

							player.setSize();
						}

						updateSizes();
						window.addEventListener('resize', updateSizes);

						function setPlayerVolume(volume: number) {
							player.setVolume(volume);

							localStorage.setItem('yt-player-volume', JSON.stringify({
								data: JSON.stringify({
									volume: volume,
									muted: (volume === 0)
								}),
								creation: Date.now(),
								expiration: Date.now() + (30 * 24 * 60 * 60 * 1000) //30 days
							}));
						}

						//Code that has to be executed "inline"
						function increaseVolume() {
							let vol = player.getVolume();
							if (player.isMuted()) {
								//Treat volume as 0
								vol = 0;
								player.unMute();
							}

							vol += 5;
							vol = (vol > 100 ? 100 : vol);
							setPlayerVolume(vol);
						}

						function lowerVolume() {
							let vol = player.getVolume();
							if (!player.isMuted()) {
								vol -= 5;
								
								vol = (vol < 0 ? 0 : vol);
								setPlayerVolume(vol);
							}
						}

						function showVolumeBar() {
							const volume = player.getVolume();
							localStorage.setItem('volume', volume + '');
							volumeBarNumber.innerHTML = volume + '';
							volumeBarBar.style.transform = `scaleX(${volume / 100})`;
							volumeBar.classList.add('visible');
							if (volumeBarTimeout !== null) {
								window.clearTimeout(volumeBarTimeout);
							}
							volumeBarTimeout = window.setTimeout(() => {
								volumeBar.classList.remove('visible');
								volumeBarTimeout = null;
							}, 2000);
						}

						function onScroll(isDown: boolean) {
							if (isDown) {
								lowerVolume();
							} else {
								increaseVolume();
							}
							showVolumeBar();
						}

						function addListeners() {
							window.onwheel = (e) => {
								onScroll(e.deltaY > 0);
							};
						}

						addListeners();
					});
				});
			}, 10);
		}

		export function navTo(url: string) {
			videoView.src = url;
			showVideo();
		}
	}

	namespace SearchResultsPage {
		export let searchResultsView: WebView = null;

		export function setup() {
			searchResultsView = initView();
			searchResultsView.id = 'youtubeSearchResultsView';

			window.setTimeout(() => {
				searchResultsView.addContentScripts([{
					name: 'js',
					matches: ['*://www.youtube.com/*'],
					js: {
						files: [
							'/genericJs/comm.js',
							'/genericJs/keypress.js',
							'/youtubeSearch/results/results.js'
						]
					},
					run_at: 'document_end'
				}, {
					name: 'css',
					matches: ['*://www.youtube.com/*'],
					css: {
						files: ['/youtubeSearch/results/results.css']
					},
					run_at: 'document_start'
				}]);

				searchResultsView.request.onBeforeRequest.addListener((details) => {
					return {
						cancel: details.url.indexOf('watch') > -1
					}
				}, {
					urls: ['*://*/*']
				}, ['blocking']);
			}, 10);
		}

		export function navTo(url: string) {
			searchResultsView.src = url;
		}
	}

	namespace SearchBar {
		export let searchBarView: WebView = null;

		export function setup() {
			searchBarView = initView();
			searchBarView.id = 'youtubeSearchBarView';
			searchBarView.setAttribute('allowtransparency', 'on');

			window.setTimeout(() => {
				searchBarView.addContentScripts([{
					name: 'js',
					matches: ['*://www.youtube.com/*'],
					js: {
						files: [
							'/genericJs/comm.js',
							'/genericJs/keypress.js'
						]
					},
					run_at: 'document_end'
				}, {
					name: 'css',
					matches: ['*://www.youtube.com/*'],
					css: {
						files: ['/youtubeSearch/searchBar/searchBar.css']
					},
					run_at: 'document_start'
				}]);

				searchBarView.addEventListener('loadcommit', (e: Event & {
					url: string;
					isTopLevel: boolean;
				}) => {
					if (e.isTopLevel) {
						searchBarView.canGoBack(false);
						searchBarView.canGoForward(false);
						SearchResultsPage.navTo(e.url);
						if (activePage === 'video') {
							$('#youtubeSearchCont').classList.remove('showVideo');
						}
					} else {
						searchBarView.canGoBack(true);
						searchBarView.canGoForward(true);
					}
				});

				searchBarView.addEventListener('focus', (e) => {
					$('#youtubeSearchCont').classList.remove('shortenSearchBarArea');
				});
				searchBarView.addEventListener('blur', (e) => {
					$('#youtubeSearchCont').classList.add('shortenSearchBarArea');
				});
			}, 10);
		}

		export function toggle() {
			if (activePage === 'video') {
				$('#youtubeSearchCont').classList.toggle('searchHidden');
				return true;
			}
			return false;
		}

		export function show() {
			if (activePage === 'video') {
				$('#youtubeSearchCont').classList.remove('searchHidden');
				return true;
			}
			return false;
		}

		export function hide() {
			if (activePage === 'video') {
				$('#youtubeSearchCont').classList.add('searchHidden');
				return true;
			}
			return false;
		}

		export function focus(key?: string) {
			show();
			searchBarView.focus();
			Helpers.hacksecute(searchBarView, (REPLACE) => {
				const input = document.getElementById('masthead-search-term') as HTMLInputElement;
				input.value = input.value + REPLACE.key;
				input.focus();
			}, {
				key: JSON.stringify(key || '')
			});
		}
	}

	function showVideo() {
		activePage = 'video';
		$('#youtubeSearchCont').classList.add('showVideo');
		SearchBar.hide();
		Video.videoView.focus();
	}

	export function changeVideo(url: string) {
		Video.videoView.src = url;
		showVideo();
	}

	export function setup() {
		SearchBar.setup();
		SearchResultsPage.setup();
		Video.setup();
	}

	export function init() {
		window.setTimeout(() => {
			SearchResultsPage.navTo('https://www.youtube.com/');
			SearchBar.searchBarView.src = 'https://www.youtube.com/';
		}, 15);
	}

	export function onClose() {
		$('#titleBarLeft').style.width = 'calc(50vw)';
		$('#titleBarRight').style.width = 'calc(50vw)';
	}

	export function onFocus() {
		if (activePage === 'video') {
			Video.videoView.focus();
		} else {
			SearchBar.searchBarView.focus();
		}

		$('#titleBarLeft').style.width = 'calc(50vw - 335px)';
		$('#titleBarRight').style.width = 'calc(50vw - 335px)';
	}

	export function getView(): WebView {
		if (activePage === 'video') {
			return Video.videoView;
		} else {
			return SearchResultsPage.searchResultsView;
		}
	}

	export function onKeyPress(event: MappedKeyboardEvent): boolean {
		if (AppWindow.getActiveViewName() !== 'youtubesearch') {
			return false;
		}

		if (event.key === 'h') {
			const subsCont = $('#youtubeSearchCont');
			if (activePage === 'video') {
				subsCont.classList.remove('showVideo');
				activePage = 'results';
				SearchResultsPage.searchResultsView.focus();
			} else {
				subsCont.classList.add('showVideo');
				activePage = 'video';
				Video.videoView.focus();
			}
			return true;
		}
		if (event.key === 's' && SearchBar.toggle()) {
			return true;
		}
		if (event.key === 'd' && activePage === 'video') {
			//Get current video URL and download it
			Helpers.downloadVideo(Video.videoView.src)
			return true;
		}
		if (VALID_INPUT.indexOf(event.key) > -1 && 
			!event.altKey && !event.ctrlKey) {
				SearchBar.focus(event.key);
				return true;
			}
		if (event.key === 'Tab') {
			SearchBar.focus();
		}
		return false;
	}

	export function onSearchBarFocus() {
		if (AppWindow.getActiveViewName() === 'youtubesearch' && SearchBar.searchBarView) {
			SearchBar.searchBarView.focus();
			Helpers.hacksecute(SearchBar.searchBarView, () => {
				document.getElementById('masthead-search-term').focus();
			});
		}
	}

	export function onPaste(data: string) {
		const reg = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})/;
		if (reg.exec(data)) {
			if (AppWindow.getActiveViewName() === 'youtubesearch' && Video.videoView) {
				Video.navTo(data);
			} else {
				//Go to that view and focus the video
				AppWindow.switchToview('youtubesearch');
				const interval = window.setInterval(() => {
					if (AppWindow.loadedViews.indexOf('youtubesearch') > -1 && Video.videoView) {
						//It's loaded
						window.clearInterval(interval);

						Video.navTo(data);
					}
				}, 50);
			}
		}			
	}
}

namespace AppWindow {
	export const app = chrome.app.window.current();
	const titleBar = document.querySelector('#titleBar');
	let activeView: ViewNames = null;
	
	type AppEvent = 'onBoundsChanged'|'onClosed'|'onFullscreened'|
			'onMaximized'|'onMinimized'|'onRestored';
	
	const listeners: Array<{
		event: AppEvent;
		callback: (event: Event) => void;
	}> = [];
	export function listen(event: AppEvent, callback: (event: Event) => void) {
		listeners.push({
			event: event,
			callback: callback
		});
	}

	function fireEvent(event: AppEvent, data: Event) {
		listeners.filter((listener) => {
			return listener.event === event;
		}).forEach((listener) => {
			listener.callback(data);
		});
	}

	type ViewTypes = typeof YoutubeMusic | typeof Netflix | typeof YoutubeSubscriptions | typeof YoutubeSearch;
	export function getViewByName(name: ViewNames): ViewTypes;
	export function getViewByName(name: 'ytmusic'): typeof YoutubeMusic;
	export function getViewByName(name: 'netflix'): typeof Netflix;
	export function getViewByName(name: 'youtubeSubscriptions'): typeof YoutubeSubscriptions;
	export function getViewByName(name: 'youtubesearch'): typeof YoutubeSearch;
	export function getViewByName(name: ViewNames): ViewTypes {
		switch (name) {
			case 'ytmusic':
				return YoutubeMusic;
			case 'netflix':
				return Netflix;
			case 'youtubeSubscriptions':
				return YoutubeSubscriptions;
			case 'youtubesearch':
				return YoutubeSearch;
		}
	}

	namespace Exiting {
		let escapePresses = 0;
		export function handleEscapePress() {
			escapePresses++;
			if (escapePresses >= 3) {
				//Close app
				const app = chrome.app.window.current();
				YoutubeMusic.onClose();
				Netflix.onClose();
				YoutubeSubscriptions.onClose();

				window.setTimeout(() => {
					app.close();
				}, 0);
				return;
			}

			window.setTimeout(() => {
				//Remove it from the array
				escapePresses--; 	
			}, 1000);
		}
	}

	function prepareEventListeners() {
		const events: Array<AppEvent> = ['onBoundsChanged', 'onClosed',
			'onFullscreened', 'onMaximized', 'onMinimized', 'onRestored'];
		events.forEach((eventName) => {
			app[eventName].addListener((event) => {
				fireEvent(eventName, event);
			});
		});
	}

	function updateButtonsState() {
		titleBar.classList[app.isMaximized() ? 'add' : 'remove']('maximized');
		titleBar.classList[app.isFullscreen() ? 'add' : 'remove']('fullscreen');
	}

	function setupListeners() {
		listen('onMaximized', updateButtonsState);
		listen('onFullscreened', updateButtonsState);
		listen('onRestored', updateButtonsState);
		window.addEventListener('focus', () => {
			titleBar.classList.add('focused');
			onFocus();
		});
		window.addEventListener('blur', () => {
			titleBar.classList.remove('focused');
		});

		document.querySelector('#fullscreen').addEventListener('click', (e) => {
			app[app.isFullscreen() ? 'restore' : 'fullscreen']();
			e.stopPropagation();
		});
		document.querySelector('#minimize').addEventListener('click', (e) => {
			app.minimize();
			e.stopPropagation();
		});
		document.querySelector('#maximize').addEventListener('click', (e) => {
			app[app.isMaximized() ? 'restore' : 'maximize']();
			e.stopPropagation();
		});
		document.querySelector('#close').addEventListener('click', (e) => {
			YoutubeMusic.onClose();
			Netflix.onClose();
			YoutubeSubscriptions.onClose();

			window.setInterval(() => {
				app.close();
			}, 0);
			e.stopPropagation();
		});

		titleBar.addEventListener('click', () => {
			if (activeView === 'youtubesearch') {
				YoutubeSearch.onSearchBarFocus();
			}
		});
	}

	function addRuntimeListeners() {
		chrome.runtime.onMessage.addListener(function (message: {
			cmd: string
		}) {
			const activeViewView = getActiveViewClass().Commands;
			switch (message.cmd) {
				case 'lowerVolume':
					activeViewView.lowerVolume();
					break;
				case 'raiseVolume':
					activeViewView.raiseVolume();
					break;
				case 'pausePlay':
					activeViewView.togglePlay();
					break;
				case 'pause':
					activeViewView.pause();
					break;
				case 'play':
					activeViewView.play();
					break;
			}
		});
	}

	function showSpinner() {
		$('#spinner').classList.add('active');
		$('#spinnerCont').classList.remove('hidden');
	}
	
	function hideSpinner() {
		$('#spinnerCont').classList.add('hidden');
		$('#spinner').classList.remove('active');
	}

	function handleKeyboardEvent(event: MappedKeyboardEvent) {
		if (event.key === 'Escape') {
			const youtubeSearchPageView = $('#youtubeSearchPageView');
			if (youtubeSearchPageView) {
				youtubeSearchPageView.remove();
				return;
			}

			Exiting.handleEscapePress();
		} else if (event.key === 'F11') {
			chrome.runtime.sendMessage({
				cmd: 'toggleFullscreen'
			});
		} else if (event.key === 'F1') {
			switchToview('youtubeSubscriptions');
		} else if (event.key === 'F2') {
			switchToview('ytmusic');
		} else if (event.key === 'F3') {
			switchToview('youtubesearch');
		} else if (event.key === 'F4') {
			switchToview('netflix');
		}
	}

	export const loadedViews: Array<ViewNames> = [];
	export function onLoadingComplete(view: ViewNames) {
		loadedViews.push(view);
		if (activeView === view) {
			hideSpinner();
		} else {
			getViewByName(view).Commands.pause();
		}
	}

	export function onMagicButton() {
		if (getActiveViewName() === 'youtubeSubscriptions') {
			YoutubeSubscriptions.Commands.magicButton();
		}
	}

	export function switchToview(view: ViewNames, first: boolean = false) {
		if (view === activeView && !first) {
			return;
		} 

		if (!first) {
			//Pause current view
			getActiveViewClass().Commands.pause();
		}

		if (loadedViews.indexOf(view) === -1) {
			showSpinner();
			getViewByName(view).init();
		} else {
			hideSpinner();
		}

		activeView = view;
		getActiveViewClass().onFocus();
		getActiveViewClass().Commands.play();
		const viewsEl = $('#views');
		viewsEl.classList.remove('ytmusic', 'netflix', 'youtubeSubscriptions', 'youtubesearch');
		viewsEl.classList.add(view);
	}

	export function init(startView: ViewNames) {
		activeView = startView;

		prepareEventListeners();
		setupListeners();
		addRuntimeListeners();
		YoutubeMusic.setup();
		Netflix.setup();
		YoutubeSubscriptions.setup();
		YoutubeSearch.setup();

		switchToview(startView, true);

		window.addEventListener('keydown', (e) => {
			handleKeyboardEvent(e as MappedKeyboardEvent)
		});
	}

	export function getActiveViewName(): ViewNames {
		return activeView;
	}

	export function getActiveViewClass(): ViewTypes {
		return getViewByName(getActiveViewName());
	}

	export function getActiveViewView(): WebView {
		return AppWindow.getActiveViewClass().getView();
	}

	export function onFocus() {
		getActiveViewClass().onFocus();
	}

	export function onKeyPress(event: MappedKeyboardEvent) {
		getActiveViewClass().onKeyPress(event)
	}
}

AppWindow.init(window.baseView || 'ytmusic');
window.Helpers = Helpers;
window.Netflix = Netflix;
window.AppWindow = AppWindow;
window.YoutubeMusic = YoutubeMusic;
window.YoutubeSubscriptions = YoutubeSubscriptions;