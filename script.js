// -----------------------
// Game settings
const QUOTA = 100;
const MAX_TICK = (99 * 60 + 59) * 1000 + 999;

// -----------------------
// Utils
const loadData = () => {
		try {
			const s = localStorage.getItem('tesrose_curry');
			if (s) return JSON.parse(s);
		} catch (e) {
			console.log('load error ! ' + e.message);
		}
		return { timeTick: MAX_TICK, volume: 0 };
};
const saveData = data => {
	localStorage.setItem('tesrose_curry', JSON.stringify(data));
};
const updateSaveData = changes => {
	const data = loadData();
	for (const key in changes) {
		data[key] = changes[key];
	}
	saveData(data);
};

const byId = id => document.getElementById(id);

const timers = {};
const lazy = (id, func, msec = 100) => {
	clearTimeout(timers[id]);
	timers[id] = setTimeout(func, msec);
};

// -----------------------
// Graphics
const ctx = byId('canvas').getContext('2d');
let sprite;
const CHR_SIZE = 16;
const HALF_SIZE = CHR_SIZE / 2;
const TABLE_SIZE = 10;
const STG_WIDTH = TABLE_SIZE * CHR_SIZE;
const STG_HEIGHT = 6 * CHR_SIZE;
const TIME_Y = 1 * CHR_SIZE;
const COUNT_Y = 2 * CHR_SIZE;
const MSG_Y = 3 * CHR_SIZE;
const NOTE_Y = 4 * CHR_SIZE;
const ROSET_SRC_X = 4 * CHR_SIZE;
const EAT_X = STG_WIDTH - CHR_SIZE * 2.5;

const drawNumber = (num, x, y) => {
	const s = "" + num;
	for (let i = 0; i < s.length; i ++) {
		const c = s.charAt(i);
		const n = c === '.' ? 10 : c === ':' ? 11 : c === 'x' ? 12 : c|0;
		ctx.drawImage(sprite, 19 * HALF_SIZE, n * HALF_SIZE, HALF_SIZE, HALF_SIZE, x + i * HALF_SIZE, y, HALF_SIZE, HALF_SIZE);
	}
};
const drawTime = (tick, x, y) => {
	const z = Math.floor(tick / 100) % 10;
	const s = Math.floor(tick / 1000) % 60;
	const m = Math.min(99, Math.floor(tick / 60000));
	const mmssz = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + z;
	drawNumber(mmssz, x, y);
};

// -----------------------
// Audio
const audio = {};

// Draw volume image
audio.volumeValueImg = byId('volumeValueImg');
audio.VOLUMES = [0, 0.2, 0.4, 0.8];
audio.drawVolumeBtn = () => {
	let volumeIndex = 0;
	for (let i = audio.VOLUMES.length - 1; 0 <= i; i--) {
		const vol = audio.VOLUMES[i];
		if (vol <= audio.volume) {
			volumeIndex = i;
			break;
		}
	}
	audio.volumeValueImg.style.backgroundPosition = `-${(volumeIndex + 3) * HALF_SIZE}px 0`;
};
audio.firstDraw = () => {
	const data = loadData();
	// This game has not the opening bgm.
	// if (data.volume) {
	// 	audio.volumeValueImg.style.backgroundPosition = `-${CHR_SIZE}px 0`;
	// } else {
	// 	audio.drawVolumeBtn();
	// }
	audio.volume = data.volume;
	audio.drawVolumeBtn();
};
audio.firstDraw();

// Touch to unmute
window.AudioContext = window.AudioContext || window.webkitAudioContext;
audio.ctx = new AudioContext();
audio.isInited = false;
audio.initAudioContext = () => {
	if (audio.isInited) return;
	audio.isInited = false;
	audio.ctx.resume();
	const emptySource = audio.ctx.createBufferSource();
	emptySource.start();
	emptySource.stop();
	audio.setVolume(audio.volume);
};
document.addEventListener('touchstart', audio.initAudioContext, { once: true }); // safari
document.addEventListener('touchend',   audio.initAudioContext, { once: true }); // android
document.addEventListener('mouseup',    audio.initAudioContext, { once: true }); // chrome
document.addEventListener('keydown',    audio.initAudioContext, { once: true });

// Buffers
audio.buffers = {};
audio.loadBuffer = async mp3 => {
	let buffer = audio.buffers[mp3];
	if (!buffer) {
		const res = await fetch(mp3);
		const audioData = await res.arrayBuffer();
		buffer = await audio.ctx.decodeAudioData(audioData);
		audio.buffers[mp3] = buffer;
	}
	return buffer;
};

// Volume Control
audio.gainNode = audio.ctx.createGain();
audio.gainNode.connect(audio.ctx.destination);
audio.gainNode.gain.value = 0;
audio.saveVolume = () => {
	updateSaveData({volume: audio.volume});
};
audio.setVolume = v => {
	v = Math.min(v, 1);
	audio.volume = v;
	audio.gainNode.gain.value = v;
	audio.drawVolumeBtn();
	lazy('saveVolume', audio.saveVolume);
};
audio.clickVolumeBtn = e => {
	e.preventDefault();
	e.stopPropagation();
	// This game has not the opening bgm.
	// if (!audio.isInited) {
	// 	audio.initAudioContext();
	// 	return false;
	// }
	audio.initAudioContext();
	const newVol = audio.VOLUMES[(audio.VOLUMES.indexOf(audio.volume) + 1) % audio.VOLUMES.length];
	audio.setVolume(newVol);
	return false;
};
byId('volumeBtn').addEventListener('ontouchstart' in window ? 'touchstart' : 'mousedown', audio.clickVolumeBtn);
byId('volumeBtn').addEventListener('ontouchend' in window ? 'touchend' : 'mouseup', e => {
	e.preventDefault();
	e.stopPropagation();
} );

// BGM
audio.bgmSrc = null;
audio.setBgm = async (mp3, opt = {}) => {
	if (audio.bgmSrc) audio.bgmSrc.stop();
	audio.bgmSrc = null;
	if (!mp3) return;
	audio.bgmSrc = audio.ctx.createBufferSource();
	audio.bgmSrc.buffer = await audio.loadBuffer(mp3);
	audio.bgmSrc.loop = !opt.once;
	audio.bgmSrc.connect(audio.gainNode);
	audio.bgmSrc.start();
};
// SE
for (const mp3 of [
	'se_eat.wav',
	'se_miss.wav',
	'se_hot.wav',
	'se_tesro.wav',
	'se_water.wav',
	'se_start.wav',
	'se_count.wav',
	'se_end.wav',
]) {
	audio.loadBuffer(mp3); // cache SEs.
}
audio.sePan = audio.ctx.createStereoPanner();
audio.sePan.connect(audio.gainNode);
audio.se = async (mp3, opt = { pan: 0 }) => {
	if (!audio.volume) return;
	audio.sePan.pan.value = opt.pan || 0;
	const src = audio.ctx.createBufferSource();
	src.buffer = await audio.loadBuffer(mp3);
	src.connect(audio.sePan);
	src.start();
};

// -----------------------
// Frame control
let tick = 0;
let fase = null;
let lastFase = null;
const MSPF = 15;
const mainLoop = () => {
	tick = new Date().getTime();
	if (lastFase !== fase) {
		lastFase = fase;
		fase.startTick = tick;
		fase.init();
	}
	fase.main();
	drawCommons();
	fase.draw();
	const w = Math.max(5, MSPF - (new Date().getTime() - tick));
	setTimeout(mainLoop, w);
};
const onTouch = e => {
	if (e.key === 'F5') return;
	fase.onTouch();
	e.preventDefault();
};
const onTouchEnd = e => {
	if (e.key === 'F5') return;
	fase.onTouchEnd();
	e.preventDefault();
};
document.addEventListener('ontouchstart' in window ? 'touchstart' : 'mousedown', onTouch);
document.addEventListener('keydown', onTouch);
document.addEventListener('ontouchend' in window ? 'touchend' : 'mouseup', onTouchEnd);
document.addEventListener('keyup', onTouchEnd);

// -----------------------
// Animation
let animeIndex = 0;
let fCount = 0;
setInterval(() => {
	animeIndex = (animeIndex + 1) % 4;
	if (fCount) {
		fCount --;
	}
}, 500);
const rosetAnime = {
	index: 0,
	timer: null,
	nowDrinking: false,
	inc: () => {
		rosetAnime.index --;
		if (rosetAnime.index === 0) {
			rosetAnime.nowDrinking = false;
			clearInterval(rosetAnime.timer);
		}
	},
	start: () => {
		rosetAnime.index = 3;
		clearInterval(rosetAnime.timer);
		rosetAnime.timer = setInterval(rosetAnime.inc, 100);
	}
};

// -----------------------
// Game Parameters
const Type = {
	EMPTY: -1,
	AIR: 0,
	CURRY: 1,
	VERY_HOT: 2,
	TESRO: 3,
	WATER: 4,
};
const allNotes = [
	1, 0, 1, 4, 1, 1, 3, 1,
	3, 1, 1, 0, 1, 3, 1, 2,
	0, 0, 0, 1, 1, 1, 3, 1,
	1, 1, 1, 3, 1, 1, 4, 3,
	1, 1, 1, 3, 1, 1, 4, 2,
	3, 1, 3, 1, 0, 1, 1, 4,
];
let notesIndex = 0;
let notes = [];
let hotGage = 0;
let hotLevel = 0;
let curryCount = 0;
let timeTick = 0;
let coolTime = 0;

// -----------------------
// Common logics
const newNote = type => {
	return {
		x: - CHR_SIZE,
		type: type,
	};
};
const resetNotes = () => {
	notesIndex = 0;
	notes = [];
	for (let i = 0; i < TABLE_SIZE / 2; i ++) {
		const n = newNote(0);
		n.x = i * CHR_SIZE * 2;
		notes.unshift(n);
	}
};
const roleNotes = () => {
	let newCount = 0;
	for (const n of notes) {
		n.x += 1 + hotLevel / 2;
		if (n.x >= STG_WIDTH) {
			newCount ++;
			notesIndex = (notesIndex + 1) % allNotes.length;
			notes.push(newNote(allNotes[notesIndex]));
			if (hotGage) {
				hotGage --;
				if (!hotGage) {
					hotLevel = 0;
				}
			}
		}
	}
	for (newCount; 0 < newCount; newCount --) {
		notes.shift();
	}
};
const drawCommons = () => {
	// Background;
	ctx.fillStyle = `rgb(${hotLevel * 30}, 0, 0)`;
	ctx.fillRect(0, 0, STG_WIDTH, STG_HEIGHT);
	ctx.drawImage(sprite, 0, 8 * CHR_SIZE, STG_WIDTH, CHR_SIZE, 0, NOTE_Y + CHR_SIZE, STG_WIDTH, CHR_SIZE);
	// Roset
	if (coolTime && rosetAnime.index <= 1) {
		ctx.drawImage(sprite, ROSET_SRC_X, 5 * CHR_SIZE, CHR_SIZE, CHR_SIZE, STG_WIDTH - CHR_SIZE, NOTE_Y, CHR_SIZE, CHR_SIZE);
	} else {
		const y = rosetAnime.nowDrinking ? 5 : hotLevel;
		ctx.drawImage(sprite, ROSET_SRC_X + rosetAnime.index * CHR_SIZE, y * CHR_SIZE, CHR_SIZE, CHR_SIZE, STG_WIDTH - CHR_SIZE, NOTE_Y, CHR_SIZE, CHR_SIZE);
	}
	// Curry
	for (const n of notes) {
		const x = animeIndex * CHR_SIZE;
		const y = (n.type + 3) * CHR_SIZE;
		ctx.drawImage(sprite, x, y, CHR_SIZE, CHR_SIZE, n.x, NOTE_Y, CHR_SIZE, CHR_SIZE);
	}
};

// -----------------------
// Fase
const NOP = () => {};
const newFase = id => {
	return { id: id, init: NOP, main: NOP, draw: NOP, onTouch: NOP, onTouchEnd: NOP };
};
const Fase = {
	TITLE: newFase(0),
	START: newFase(1),
	PLAY: newFase(2),
	END: newFase(3),
	HOT: newFase(4),
	INIT: newFase(99),
};

// -----------------------
// fase INIT
Fase.INIT.init = () => {
	sprite = byId('sprite');
	fase = Fase.TITLE;
	mainLoop();
};

// -----------------------
// fase TITLE
Fase.TITLE.YODARE_DELAY = 20;
Fase.TITLE.init = () => {
	resetNotes();
	hotLevel = 0;
	coolTime = 0;
	Fase.TITLE.fastestTime = loadData().timeTick;
	fCount = Fase.TITLE.YODARE_DELAY;
};
Fase.TITLE.main = () => {
	roleNotes();
};
Fase.TITLE.onTouchEnd = () => {
	fase = Fase.START;
};
Fase.TITLE.draw = () => {
	// Record
	drawTime(Fase.TITLE.fastestTime, 6.5 * HALF_SIZE, HALF_SIZE);
	// Touch to start
	if (animeIndex % 2) {
		ctx.drawImage(sprite, 0, 19 * HALF_SIZE, 14 * HALF_SIZE, HALF_SIZE, 3 * HALF_SIZE, MSG_Y, 14 * HALF_SIZE, HALF_SIZE);
	}
	// YODARE
	if (fCount <= 3) {
		ctx.drawImage(sprite, 16 * HALF_SIZE, fCount * HALF_SIZE, HALF_SIZE, HALF_SIZE, STG_WIDTH - CHR_SIZE, NOTE_Y + HALF_SIZE, HALF_SIZE, HALF_SIZE);
	}
	if (!fCount) {
		fCount = Fase.TITLE.YODARE_DELAY;
	}
};

// -----------------------
// fase START
Fase.START.init = () => {
	resetNotes();
	curryCount = QUOTA;
	Fase.START.lastCount = 0;
};
Fase.START.main = () => {
	Fase.START.count = Math.max(0, 3 - Math.floor((tick - Fase.START.startTick) / 1000));
	if (Fase.START.count <= 0) {
		fase = Fase.PLAY;
		audio.se('se_start.wav');
		return;
	}
	if (Fase.START.lastCount !== Fase.START.count) {
		Fase.START.lastCount = Fase.START.count;
		audio.se('se_count.wav');
	}
};
Fase.START.draw = () => {
	drawNumber(Fase.START.count, (STG_WIDTH - HALF_SIZE) / 2, MSG_Y);
};

// -----------------------
// fase PLAY
Fase.PLAY.main = () => {
	timeTick = Math.min(tick - Fase.PLAY.startTick, MAX_TICK);
	if (coolTime < tick) coolTime = 0;
	roleNotes();
};
Fase.PLAY.onTouch = () => {
	let note = null;
	for (const n of notes) {
		if (EAT_X < n.x) {
			note = n;
			break;
		}
	}
	if (note && note.type === Type.WATER) {
		coolTime = 0;
		hotGage = 0;
		hotLevel = 0;
		note.type = Type.AIR;
		rosetAnime.nowDrinking = true;
		rosetAnime.start();
		audio.se('se_water.wav');
		return;
	}
	if (coolTime) return;
	rosetAnime.nowDrinking = false;
	rosetAnime.start();
	if (!note || note.type === Type.AIR) {
		coolTime = tick + 1000;
		audio.se('se_miss.wav');
		return;
	}
	switch (note.type) {
	case Type.TESRO:
		coolTime = tick + 2000;
		audio.se('se_tesro.wav');
		return;
	case Type.CURRY:
	case Type.VERY_HOT:
		if (note.type === Type.VERY_HOT) {
			hotGage = allNotes.length + 1;
			hotLevel = Math.min(4, hotLevel + 1);
			audio.se('se_hot.wav');
		} else {
			audio.se('se_eat.wav');
		}
		coolTime = 0;
		note.type = Type.EMPTY;
		curryCount --;
		if (curryCount === 0) {
			fase = Fase.END;
		}
	}
};
Fase.PLAY.draw = hideTime => {
	// Curry x 100
	ctx.drawImage(sprite, 0, 4 * CHR_SIZE, CHR_SIZE, CHR_SIZE, 7 * HALF_SIZE, COUNT_Y, CHR_SIZE, CHR_SIZE);
	// count
	drawNumber('x' + curryCount, 9 * HALF_SIZE, COUNT_Y + HALF_SIZE);
	// time
	if (!hideTime) drawTime(timeTick, 6.5 * HALF_SIZE, TIME_Y);
};

// -----------------------
// fase END
Fase.END.init = () => {
	const data = loadData();
	if (!data.timeTick || timeTick && timeTick < data.timeTick) {
		updateSaveData({ timeTick: timeTick });
	}
	for (const n of notes) {
		n.x = Math.ceil(n.x); // cancel motion blur
	}
	fCount = 7;
	audio.se('se_end.wav');
};
Fase.END.onTouchEnd = () => {
	if (fCount) return;
	fase = Fase.TITLE;
};
Fase.END.draw = () => {
	Fase.PLAY.draw(fCount % 2 === 1);
};

