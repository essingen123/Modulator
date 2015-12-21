import { Node } from './graph';
import { NodeData } from './synthUI';

export interface NoteHandler {
	noteOn(midi: number, gain: number, ratio: number):void;
	noteOff(midi: number, gain: number): void;
	noteEnd(midi: number): void;
}


class OscNoteHandler implements NoteHandler {
	node: Node;
	outTracker: OutputTracker;
	clones: OscillatorNode[] = [];

	constructor(n: Node) {
		this.node = n;
		this.outTracker = new OutputTracker(n.data.anode);
	}

	noteOn(midi: number, gain: number, ratio: number):void {
		// Clone, connect and start
		const osc: OscillatorNode = <OscillatorNode>this.clone();
		//TODO should also listen to value changes on original osc and apply them to clones
		this.clones[midi] = osc;
		osc.frequency.value = osc.frequency.value * ratio;
		osc.start();
	}

	noteOff(midi: number, gain: number): void {
		//TODO if ADSR is present, noteEnd will be generated by ADSR module
		this.noteEnd(midi);
	}

	noteEnd(midi: number): void {
		// Stop and disconnect
		const osc = this.clones[midi];
		if (!osc) return;
		osc.stop();
		this.disconnect(osc);
		this.clones[midi] = null;
	}

	clone(): AudioNode {
		const data: NodeData = this.node.data;
		// Create clone
		const anode = data.anode.context[data.nodeDef.constructor]();
		// Copy parameters
		for (const pname of Object.keys(data.nodeDef.params)) {
			const param = data.anode[pname];
			if (param instanceof AudioParam)
				anode[pname].value = data.anode[pname].value;
			else
				anode[pname] = data.anode[pname];
		}
		// Copy output connections
		for (const out of this.outTracker.outputs)
			anode.connect(out);
		// Copy control input connections
		for (const inNode of this.node.inputs) {
			const inData: NodeData = inNode.data;
			inNode.data.anode.connect(anode[inData.controlParam]);
		}
		//TODO should copy snapshot of list of inputs and outputs
		//...in case user connects or disconnects during playback
		return anode;
	}

	disconnect(anode: AudioNode): void {
		// Disconnect outputs
		for (const out of this.outTracker.outputs)
			anode.disconnect(<any>out);
		// Disconnect control inputs
		for (const inNode of this.node.inputs) {
			const inData: NodeData = inNode.data;
			inNode.data.anode.disconnect(anode[inData.controlParam]);
		}
	}

}

export const NoteHandlers = {
	'osc': OscNoteHandler	
};



class OutputTracker {
	outputs: AudioNode[] = [];

	constructor(anode: AudioNode) {
		this.onBefore(anode, 'connect', this.connect);
		this.onBefore(anode, 'disconnect', this.disconnect);
	}

	connect(anode: AudioNode) {
		if (!(anode instanceof AudioNode)) return;
		this.outputs.push(anode);
	}

	disconnect(anode) {
		if (!(anode instanceof AudioNode)) return;
		removeArrayElement(this.outputs, anode);
	}

	onBefore(obj: any, fname: string, funcToCall: Function) {
		const oldf = obj[fname];
		const self = this;
		obj[fname] = function() {
			funcToCall.apply(self, arguments);
			oldf.apply(obj, arguments);
		}
	}
}


export function removeArrayElement(a: any[], e: any): boolean {
	const pos = a.indexOf(e);
	if (pos < 0) return false;	// not found
	a.splice(pos, 1);
	return true;
}