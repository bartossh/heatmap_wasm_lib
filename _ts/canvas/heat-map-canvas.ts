/* This library depends on wasm (web assembly) worker to calculate heat map grid
** and apply drawing function on each heat map matrix point to update canvas (draw heat distribution).
** Wasm worker greatly speeds up mapping given heat over heat map grid (2D matrix). What allows
** drawing on the canvas on the go, and setting large canvas size than in version without wasm worker.
**
** IMPORTANT NOTE: Heat is applied to the grid in historical order.
**                 Having two modes each need separate explanation.
**                 * Dynamic mode: Simply with each loop (HeatMApCanvas.DYNAMIC_MODE_FRAME_RATE)
**                 each heat point is cooled down, then if heat point is present it is brushed over the grid.
**                 Then canvas is updated (heat is being drawn).
**                 * Static mode: Having an array (list) of heat points (coordinate with heat occurrence 
**                 and heat values), we are passing it (HeatMapGradientPoint[]) to the HeatMapCanvas when
**                 instantiating. Heat is mapped over heat map grid in a way, that each next heat point has
**                 more significant impact over heat distribution. In each step (step equals next heat point applied to the grid)
**                 heat map cools down each grid point. Older heat points are getting more forgotten in favor of every newly applied one.
**
** TODO:
** - Add 'static no historical' mode (order of applying heat point has no impact over heat distribution)
*/

export class HeatMapCanvas {
    private static MAX_RED_SATURATION = 255;
    // private static MAX_COLOUR_SATURATION = 255;
    private static SLEEP_MS = 50;
    private start: Point = {x: 0, y: 0}; // TODO: allow setting dynamically
    private heatMapGrid: any;
    private wasm: any; // it is wasm module and don't have a type

    constructor(private config: HeatMapCanvasConfig, private data: HeatMapGradientPoint[], private canvasId: string) {
        // async load all chunks of wasm
        import("../../pkg/heatmap_wasm_lib").then(wasm => {
            this.wasm = wasm;
            if (HeatMapCanvas.isConfigOk(config)) {
                // const pFive = new p5(this.loader.bind(this));
                this.createWasmCanvas();
                this.loop();
            } else {
                throw Error('Wrongly set configuration or configuration not available.');
            }
        });
    }

    private static isConfigOk(configuration: HeatMapCanvasConfig) {
        if (!configuration.heatSpread || !configuration.brushIntensity || !configuration.brushRadius || !configuration.gridWidth ||
            !configuration.gridHeight || !configuration.cellSize || !configuration.cellSpacing) {
            return false;
        }
        return !(!configuration.isStatic && !configuration.width && !configuration.height);
    }


    pushCoordinates(coordinates: HeatMapGradientPoint) {
        // this is for pushing coordinates while operating on dynamic heat map
        // heat map will apply heat automatically
        if (!this.config.isStatic) {
            this.data.push(coordinates);
        }
    }

    updateCoordinates(coordinates: HeatMapGradientPoint) {
        this.data.push(coordinates);
    }

    private createWasmCanvas(): void {
        this.heatMapGrid = this.wasm.HeatMap.new(
            this.start.x, this.start.y, this.config.width, this.config.height,
            this.config.cellSpacing, this.config.brushRadius, this.config.brushIntensity,
            HeatMapCanvas.MAX_RED_SATURATION, this.canvasId
        );
    }

    private async loop() {
        async function sleep(ms: number): Promise<any> {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        while (true) {
            await sleep(HeatMapCanvas.SLEEP_MS);
            let coordinates = this.data.pop();
            if(!coordinates) {
                coordinates = {x: 0, y: 0, heat: 0};
            }
            this.heatMapGrid.update(coordinates.x, coordinates.y, coordinates.heat, true);
            this.heatMapGrid.draw();
        }
    }
}

export interface HeatMapCanvasConfig {
    heatSpread: number;
    brushRadius: number;
    brushIntensity: number;
    gridWidth: number;
    gridHeight: number;
    cellSize: number;
    cellSpacing: number;
    isStatic: boolean;
    width: number;
    height: number;
    imgUrl: string;
    parentId: string;
}

export interface Point {
    x: number;
    y: number;
}

export interface HeatMapGradientPoint extends Point {
    heat: number;
}
