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
** - The bottle neck is still drawing function call, so better performance can be achieved
** with moving drawing logic in to web worker (wasm).
** - Add 'static no historical' mode (order of applying heat point has no impact over heat distribution)
*/

import {GridMatrix} from './grid-matrix';
import * as p5 from 'p5';

export class HeatMapCanvas {
    private static MAX_RED_SATURATION = 240;
    private static MAX_COLOUR_SATURATION = 255;
    private static NO_OPACITY = 0.0;
    private static MIN_OPACITY = 0.5;
    private static COLOR_DIVIDER = 24;
    private static SQUARE_EDGE = 2;
    private static UPPER_STROKE_WEIGHT = 2;
    private static LOWER_STROKE_WEIGHT = 1;
    private static UPPER_TINT = 225;
    private static LOWER_TINT = 120;
    private static DYNAMIC_MODE_FRAME_RATE = 60;
    private start: Point = {x: 0, y: 0}; // TODO: allow setting dynamically
    private heatMapGrid: any;
    private wasm: any; // it is wasm module and don't have a type

    constructor(private config: HeatMapCanvasConfig, private data: HeatMapGradientPoint[]) {
        // async load all chunks of wasm
        import("../../pkg/heatmap_wasm_lib").then(wasm => {
            this.wasm = wasm;
            if (HeatMapCanvas.isConfigOk(config)) {
                const pFive = new p5(this.loader.bind(this));
            } else {
                throw Error('Wrongly set configuration or configuration not available.');
            }
        });
    }

    private static isConfigOk(configuration: HeatMapCanvasConfig) {
        if (configuration['displayToggle'] === null) {
            return false;
        }
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

    private createGrid(): void {
        this.heatMapGrid = this.wasm.HeatMap.new(
            this.start.x, this.start.y, this.config.width, this.config.height,
            this.config.cellSpacing, this.config.brushRadius, this.config.brushIntensity,
            HeatMapCanvas.MAX_RED_SATURATION
        );
    }

    private sketchSetup(sketch: p5) {
        sketch.setup = () => {
            sketch.frameRate(HeatMapCanvas.DYNAMIC_MODE_FRAME_RATE);
            let canvasHeat;
            if (!!this.config.imgUrl) {
                canvasHeat = sketch.createCanvas(this.config.width, this.config.height);
            } else {
                canvasHeat = sketch.createCanvas(this.config.width, this.config.height, sketch.WEBGL);
            }
            console.log(sketch.width, sketch.height)
            canvasHeat.parent(this.config.parentId);
            sketch.colorMode(sketch.HSB);
            sketch.textAlign(sketch.CENTER);
            sketch.noStroke();
            sketch.strokeWeight(0);
            this.createGrid();
            if (this.config.isStatic) {
                sketch.noLoop();
                if (this.data.length > 0) {
                    this.data.forEach(coordDataPoint => {
                        this.update(sketch, coordDataPoint);
                    });
                }
                sketch.redraw();
            }
        };
    }

    private loader(sketch: p5) {
        let imgUrl: string;
        let img: any;
        if (!!this.config.imgUrl) {
            imgUrl = this.config.imgUrl;
            sketch.preload = function () {
                img = sketch.loadImage(imgUrl);
            };
        }
        this.sketchSetup(sketch);
        sketch.draw = () => {
            if (!this.config.isStatic) {
                // this is run by p5 in loop with this.frameRate speed and tor each frame takes all coordinates and updates
                if (this.data.length > 0) {
                    const coordinates = this.data.shift();
                    if (this.data.length === 0) {
                        // to not let GC destroy reference but this method is from stack overflow
                        this.data = [];
                    }
                    this.update(sketch, coordinates);
                }
            }
            sketch.background('rgba(255,255,255, 0.25)');
            sketch.tint(HeatMapCanvas.UPPER_TINT, HeatMapCanvas.LOWER_TINT);
            if (!!img) {
                sketch.image(img, 0, 0);
            }
            this.update(sketch);
            sketch.fill('rgba(255,255,255, 0.25)');
            sketch.noStroke();
            sketch.strokeWeight(0);
        };

        sketch.windowResized = function () {
            sketch.resizeCanvas(sketch.windowWidth, sketch.windowHeight);
        };
    }

    private update(sketch: p5, coordinates?: HeatMapGradientPoint) {
        if (!this.heatMapGrid) {
            return;
        } else if (!!coordinates) {
            this.heatMapGrid.update(coordinates.x, coordinates.y, coordinates.heat, true);
        } else {
            this.heatMapGrid.update(0, 0, 0, false);
        }
        this.setSketchFill(sketch);
        this.heatMapGrid.draw(this.executeFromWasmCallback.bind(this), sketch);
    }

    private setSketchFill(sketch: p5) {
        if (this.config.displayToggle) {
            sketch.noFill();
            sketch.strokeWeight(HeatMapCanvas.UPPER_STROKE_WEIGHT);
        } else {
            sketch.strokeWeight(HeatMapCanvas.LOWER_STROKE_WEIGHT);
        }
    }

    private drawEllipse(sketch: p5, coordinates: Point, startingCoordinates: Point) {
        sketch.noStroke();
        sketch.ellipse(coordinates.x * this.config.cellSpacing + startingCoordinates.x, coordinates.y *
            this.config.cellSpacing + startingCoordinates.y, this.config.cellSize, this.config.cellSize);
    }

    private drawCircle(sketch: p5, coordinates: Point, startingCoordinates: Point, colorGridValue: number) {
        sketch.stroke(HeatMapCanvas.MAX_RED_SATURATION - colorGridValue, HeatMapCanvas.MAX_COLOUR_SATURATION, HeatMapCanvas.MAX_COLOUR_SATURATION, HeatMapCanvas.MIN_OPACITY);
        sketch.circle(coordinates.x * this.config.cellSpacing + startingCoordinates.x, coordinates.y *
            this.config.cellSpacing + startingCoordinates.y, this.config.cellSize / 2);
    }

    private drawRectangleSharpEdges(sketch: p5, coordinates: Point, startingCoordinates: Point) {
        sketch.rect(coordinates.x * this.config.cellSpacing + startingCoordinates.y,
            coordinates.y * this.config.cellSpacing + startingCoordinates.y,
            this.config.cellSize, this.config.cellSize);
    }

    private drawRectangleRounded(sketch: p5, coordinates: Point, startingCoordinates: Point) {
        sketch.rect(coordinates.x * this.config.cellSpacing + startingCoordinates.x,
            coordinates.y * this.config.cellSpacing + startingCoordinates.y,
            this.config.cellSize, this.config.cellSize, HeatMapCanvas.SQUARE_EDGE);
    }

    private addText(sketch: p5, coordinates: Point, startingCoordinates: Point, colorGridValue: number) {
        colorGridValue = Math.floor(colorGridValue / HeatMapCanvas.COLOR_DIVIDER);
        sketch.text(colorGridValue, coordinates.x * this.config.cellSpacing + startingCoordinates.x,
            coordinates.y * this.config.cellSpacing + startingCoordinates.y, this.config.cellSize);
    }

    private setFillHeatColor(sketch: p5, colorGridValue: number) {
        if (colorGridValue !== 0 && this.config.displayToggle !== HeatDisplay.CIRCLE) {
            sketch.fill(
                HeatMapCanvas.MAX_RED_SATURATION - colorGridValue,
                HeatMapCanvas.MAX_COLOUR_SATURATION,
                HeatMapCanvas.MAX_COLOUR_SATURATION, HeatMapCanvas.MIN_OPACITY
            ); // HSB
        } else {
            sketch.stroke(
                HeatMapCanvas.MAX_RED_SATURATION, HeatMapCanvas.MAX_COLOUR_SATURATION,
                HeatMapCanvas.MAX_COLOUR_SATURATION, HeatMapCanvas.NO_OPACITY
            ); // HSB
            sketch.fill(
                HeatMapCanvas.MAX_RED_SATURATION, HeatMapCanvas.MAX_COLOUR_SATURATION,
                HeatMapCanvas.MAX_COLOUR_SATURATION, HeatMapCanvas.NO_OPACITY
            ); // HSB
        }
    }

    private executeFromWasmCallback(sketch: p5, wasmJsonString: string) {
        this.drawHeat(sketch ,JSON.parse(wasmJsonString));
    }

    private drawHeat(sketch: p5, heatPoint: HeatMapGradientPoint) {
        let colorGridValue = heatPoint.heat;
        this.setFillHeatColor(sketch, colorGridValue);
        const coordinates: Point = {x: heatPoint.x, y: heatPoint.y};
        switch (this.config.displayToggle) {
            case HeatDisplay.SQUARE:
                this.drawRectangleSharpEdges(sketch, coordinates, this.start);
                break;
            case HeatDisplay.ROUNDED:
                this.drawRectangleRounded(sketch, coordinates, this.start);
                break;
            case HeatDisplay.TEXT:
                colorGridValue = Math.floor(colorGridValue / HeatMapCanvas.COLOR_DIVIDER);
                this.addText(sketch, coordinates, this.start, colorGridValue);
                break;
            case HeatDisplay.ELLIPSE:
                this.drawEllipse(sketch, coordinates, this.start);
                break;
            case HeatDisplay.CIRCLE:
                if (colorGridValue !== 0) {
                    this.drawCircle(sketch, coordinates, this.start, colorGridValue);
                }
                break;
            default:
                break;
        }
    }

    private display(sketch: p5) {
        this.setSketchFill(sketch);
        if (!!this.heatMapGrid) {
            this.heatMapGrid.draw(this.executeFromWasmCallback.bind(this), sketch);
        }
    }
}

export enum HeatDisplay {
    ELLIPSE,
    ROUNDED,
    SQUARE,
    TEXT,
    CIRCLE
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
    displayToggle: HeatDisplay;
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
