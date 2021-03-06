import { Graph, Node, GraphHandler } from './graph'
import { Synth, NodeData } from '../synth/synth'
import { ModernAudioNode, focusable } from '../utils/modern'
import * as popups from '../utils/popups'

/**
 * Customizes the generic graph editor in order to manipulate and control
 * a graph of AudioNodes
 */
export class SynthUI {
	gr: Graph
	synth: Synth
	nw: number
	nh: number
	outNode: ModernAudioNode

	constructor(ac: AudioContext, graphCanvas: HTMLCanvasElement, jqParams: JQuery, jqFFT: JQuery, jqOsc: JQuery) {
		this.gr = new Graph(graphCanvas)
		this.gr.handler = new SynthGraphHandler(this, jqParams, jqFFT, jqOsc)
		this.synth = new Synth(ac)
		this.registerPaletteHandler()
		this.addOutputNode()
	}

	addOutputNode() {
		// TODO avoid using hardcoded position
		const out = new Node(500, 210, 'Out')
		out.data = new GraphNodeData(out)
		this.synth.initOutputNodeData(out.data, this.synth.ac.destination)
		this.outNode = out.data.anode
		this.gr.addNode(out, 'node-out')
		this.initNodeDimensions(out)
	}

	registerPaletteHandler() {
		let self = this	// JQuery sets 'this' in event handlers
		$('.palette .node').click(function(evt) {
			let elem = $(this)
			let classAttr = elem.attr('class') || ''
			let classes = classAttr.split(/\s+/).filter(c => c != 'node')
			let type = elem.attr('data-type')
			if (!type) return
			self.addNode(type,
				elem.find('.node-text').html(), classes.join(' '))
		})
	}

	addNode(type: string, text: string, classes: string): void {
		let { x, y } = this.findFreeSpot()
		const n = new Node(x, y, text)
		this.createNodeData(n, type)
		this.gr.addNode(n, classes)
		this.gr.selectNode(n)
	}

	removeNode(n: Node): void {
		this.gr.removeNode(n)
	}

	removeNodeData(data: NodeData): void {
		this.synth.removeNodeData(data)
	}

	createNodeData(n: Node, type: string): void {
		n.data = new GraphNodeData(n)
		if (type == 'out') {
			this.synth.initOutputNodeData(n.data, this.synth.ac.destination)
			this.outNode = n.data.anode
		}
		else
			this.synth.initNodeData(n.data, type)
	}

	// ----- Rest of methods are used to find a free spot in the canvas -----

	findFreeSpot() {
		let maxDist = 0
		const canvasW = this.gr.canvas.width
		const canvasH = this.gr.canvas.height
		let x = canvasW / 2
		let y = canvasH / 2
		for (let xx = 10; xx < canvasW - this.nw; xx += 10) {
			for (let yy = 10; yy < canvasH - this.nh; yy += 10) {
				const dist = this.dist2nearestNode(xx, yy)
				if (dist > maxDist && dist < this.nw * 3) {
					x = xx
					y = yy
					maxDist = dist
				}
			}
		}
		return { x, y }
	}

	dist2nearestNode(x: number, y: number) {
		let minDist = Number.MAX_VALUE
		for (const n of this.gr.nodes) {
			const dx = x - n.x
			const dy = y - n.y
			const dist = Math.sqrt(dx * dx + dy * dy)
			if (dist < minDist) minDist = dist
		}
		return minDist
	}

	initNodeDimensions(n: Node) {
		this.nw = n.element.outerWidth() || 0
		this.nh = n.element.outerHeight() || 0
	}

}


// -------------------- Privates --------------------

import { NodeDef } from '../synth/palette'
import { renderParams } from './paramsUI'
import { AudioAnalyzer } from './analyzer'


class GraphNodeData extends NodeData {
	node: Node
	constructor(node: Node) {
		super()
		this.node = node
	}
	getInputs(): NodeData[] {
		const result: NodeData[] = []
		for (const nin of this.node.inputs)
			result.push(nin.data)
		return result
	}
}

class SynthGraphHandler implements GraphHandler {

	synthUI: SynthUI
	jqParams: JQuery
	arrowColor: string
	ctrlArrowColor: string
	analyzer: AudioAnalyzer

	constructor(synthUI: SynthUI, jqParams: JQuery, jqFFT: JQuery, jqOsc: JQuery) {
		this.synthUI = synthUI
		this.jqParams = jqParams
		this.arrowColor = getCssFromClass('arrow', 'color')
		this.ctrlArrowColor = getCssFromClass('arrow-ctrl', 'color')
		this.registerNodeDelete(jqParams.parent()[0])
		this.analyzer = new AudioAnalyzer(jqFFT, jqOsc)
	}

	registerNodeDelete(elem: HTMLElement) {
		$(focusable(elem)).keydown((evt: any) => {
			if (!(evt.keyCode == 46 || (evt.keyCode == 8 && evt.metaKey))) return
			if (popups.isOpen) return
			const selectedNode = this.getSelectedNode()
			if (!selectedNode) return
			if (selectedNode.data.isOut) return
			popups.confirm('Delete node?',
				'Please confirm node deletion', confirmed => {
				if (!confirmed) return
				this.synthUI.removeNode(selectedNode)
				this.jqParams.empty()
			})
		})
	}

	getSelectedNode(): Node | null {
		for (const node of this.synthUI.gr.nodes)
			if (node.element.hasClass('selected')) return node
		return null
	}

	hasAudioParams(ndata: NodeData) {
		const aparams = Object.keys(ndata.nodeDef.params)
			.filter(pname => (<any>ndata).anode[pname] instanceof AudioParam)
		return aparams.length > 0
	}

	// --------------- Implementation of the GraphHandler interface ---------------
	canBeSource(n: Node): boolean {
		const data: NodeData = n.data
		return data.anode != this.synthUI.outNode
	}

	canConnect(src: Node, dst: Node): boolean {
		const srcData: NodeData = src.data
		const dstData: NodeData = dst.data
		if (srcData.nodeDef.control)
			return this.hasAudioParams(dstData)
		return dstData.anode.numberOfInputs > 0
	}

	connected(src: Node, dst: Node): void {
		this.synthUI.synth.connectNodes(src.data, dst.data)
		// TODO update paramsUI in case selected node is src
	}

	disconnected(src: Node, dst: Node): void {
		this.synthUI.synth.disconnectNodes(src.data, dst.data)
	}

	nodeSelected(n: Node): void {
		const data: NodeData = n.data
		renderParams(data, this.jqParams)
	}

	nodeRemoved(n: Node) {
		this.synthUI.removeNodeData(n.data)
	}

	getArrowColor(src: Node, dst: Node): string {
		const srcData: NodeData = src.data
		return srcData.nodeDef.control ? this.ctrlArrowColor : this.arrowColor
	}

	data2json(n: Node): any {
		return this.synthUI.synth.nodeData2json(n.data)
	}

	json2data(n: Node, json: any): void {
		this.synthUI.createNodeData(n, json.type)
		this.synthUI.synth.json2NodeData(json, n.data)
	}

	graphLoaded() {
		this.analyzer.analyze(this.synthUI.outNode)
	}

	graphSaved() {}
}


function getCssFromClass(className: string, propName: string) {
	const tmp = $('<div>').addClass(className)
	$('body').append(tmp)
	const propValue = tmp.css(propName)
	tmp.remove()
	return propValue
}
