import { Instrument } from '../synth/instrument'


export class LCInstrument extends Instrument {
	name: string
	duration: number

	param(pname: string, value?: number, rampTime?: number, exponential = true) {
		let names = pname.split('/')
		if (names.length < 2) throw new Error(
			`Instrument parameters require "node/param" format`)
		let node = names[0]
		let name = names[1]
		if (value === undefined) {
			let prm = this.voices[0].getParameterNode(node, name)
			return prm.value
		}
		for (let v of this.voices) {
			let prm: any = v.getParameterNode(node, name)
			this.updateValue(prm, value, rampTime, exponential)
		}
		return this
	}

	paramNames() {
		let pnames = []
		let v = this.voices[0]
		for (let nname of Object.getOwnPropertyNames(v.nodes))
			for (let pname in v.nodes[nname])
				if ((<any>v.nodes[nname])[pname] instanceof AudioParam)
					pnames.push(nname + '/' + pname)
		return pnames
	}

	private updateValue(prm: AudioParam, value: number, rampTime?: number, exponential = true) {
		if (rampTime === undefined) {
			(<any>prm)._value = value
			prm.value = value
			}
		else {
			let ctx = this.voices[0].synth.ac
			if (exponential) {
				prm.exponentialRampToValueAtTime(value, ctx.currentTime + rampTime)
			}
			else {
				prm.linearRampToValueAtTime(value, ctx.currentTime + rampTime)
			}
		}
	}
}

