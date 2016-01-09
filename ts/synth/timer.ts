interface TimerCallback {
	(time: number): void;
}

export class Timer {
	running: boolean;
	ac: AudioContext;
	cb: TimerCallback;
	_bpm: number;
	interval: number;
	ahead: number;
	nextNoteTime: number;
	dt: number;

	constructor(ac: AudioContext, bpm = 60, interval = 0.025, ahead = 0.1) {
		this.running = false;
		this.ac = ac;
		this.dt = 0;
		this.nextNoteTime = 0;
		this.bpm = bpm;
		this.interval = interval;
		this.ahead = ahead;
	}

	get bpm() { return this._bpm; }

	set bpm(v) {
		this._bpm = v;
		this.nextNoteTime -= this.dt;
		this.dt = (1/4) * 60 / this._bpm;
		this.nextNoteTime += this.dt;
	}

	start(cb?: TimerCallback): void {
		if (this.running) return;
		this.running = true;
		if (cb) this.cb = cb;
		this.nextNoteTime = this.ac.currentTime;
		this.tick();
	}

	stop(): void {
		this.running = false;
	}

	tick(): void {
		if (!this.running) return;
		setTimeout(this.tick.bind(this), this.interval * 1000);
		while (this.nextNoteTime < this.ac.currentTime + this.ahead) {
			if (this.cb) this.cb(this.nextNoteTime);
			this.nextNoteTime += this.dt;
		}
	}
}