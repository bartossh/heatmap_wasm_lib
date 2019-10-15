import {heatMapCanvasConfiguration} from './canvas/heatMapCanvas-config';
import {HeatMapCanvasConfig, HeatMapCanvas, HeatMapGradientPoint, Point} from './canvas/heat-map-canvas';
// export {heatMapCanvasConfiguration, HeatMapGradientPoint, Point, HeatMapCanvasConfig, HeatMapCanvas, HeatDisplay};


// This class is in purpose of testing Heat Map Lib canvas.
class App {

	private gradinetPoints: HeatMapGradientPoint[] = [];
	private appElement: HTMLElement;
	private canvasDivElement: HTMLElement;
	private heatmap: HeatMapCanvas;
	private counter: number = 0;

	constructor() {
		this.initialize();
		this.handleMouseEvent();
	}

	private initialize() {
		// lets crate canvas and set the id
		this.appElement = document.getElementById('app');
		this.canvasDivElement = document.createElement('canvas');
		this.canvasDivElement.id = 'heatmap-sketch';
		this.appElement.appendChild(this.canvasDivElement);
		// lets create heatmap instance
		this.heatmap = new HeatMapCanvas(heatMapCanvasConfiguration, this.gradinetPoints, 'heatmap-sketch');
	}


	private handleMouseEvent() {
		const canvasElement = document.getElementById('heatmap-sketch');
		canvasElement.addEventListener('mousemove', (ev: MouseEvent): void => {
			const heatPoint: HeatMapGradientPoint = {
				x: Math.floor(ev.clientX),
				y: Math.floor(ev.clientY),
				heat: 1
			};
			this.heatmap.updateCoordinates(heatPoint);
		});
	}
}

const app = new App();
