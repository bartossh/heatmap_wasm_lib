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
    private static GRID_DIVIDER = 5;
    private static MIL_VALUE = 100;
    private static UPPER_TINT = 225;
    private static LOWER_TINT = 120;
    private static DYNAMIC_MODE_FRAME_RATE = 2;
    private recalculateCanvasCoordinateSystem: boolean = false;
    private width: number = 0;
    private height: number = 0;
    private colorGrid: GridMatrix = new GridMatrix();
    private copyColorGrid: GridMatrix = new GridMatrix();
    private start: Point = {x: 0, y: 0};
    private canApplyHeat = false;
    private heatSpread = 0;
    private brushIntensity = 0;
    private brushRadius = 0;
    private heatMapGrid: any;
    private wasm: any; // it is wasm module and don't have a type
    dupa = true;

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

    enableRecalulatingCoordinateSystemPosition() {
        this.recalculateCanvasCoordinateSystem = true;
    }

    disableRecalulatingCoordinateSystemPosition() {
        this.recalculateCanvasCoordinateSystem = false;
    }

    private createGrid(sketch: p5): void {

        // set this way to not change grid with every update when config.isStatic = true
        // specially useful while operating in dynamic mode
        this.width = this.config.gridWidth;
        this.height = this.config.gridHeight;
        
        this.heatMapGrid = this.wasm.HeatMap.new(
                this.start.x, this.start.y, this.width, this.height,
                this.config.cellSpacing, this.config.brushRadius, this.config.brushIntensity,
                HeatMapCanvas.MAX_RED_SATURATION
            );
        this.heatMapGrid.test_js_call(sketch.round, 1.522);

        this.colorGrid = new GridMatrix();
        this.copyColorGrid = new GridMatrix();

        for (let x = 0; x < this.width; x++) {
            this.colorGrid.grid[x] = [];
            this.copyColorGrid.grid[x] = [];
            for (let y = 0; y < this.height; y++) {
                this.colorGrid.grid[x][y] = this.copyColorGrid.grid[x][y] = 0;
            }
        }
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
            canvasHeat.parent(this.config.parentId);
            sketch.colorMode(sketch.HSB);
            sketch.textAlign(sketch.CENTER);
            sketch.noStroke();
            sketch.strokeWeight(0);
            this.createGrid(sketch);
            if (this.config.isStatic) {
                sketch.noLoop();
                this.canApplyHeat = true;
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
            if (this.config.gridWidth !== this.width || this.config.gridHeight !== this.height) {
                this.createGrid(sketch);
            }
            if (!this.config.isStatic) {
                // this is run by p5 in loop with this.frameRate speed and tor each frame takes all coordinates and updates
                if (this.data.length > 0) {
                    this.canApplyHeat = true;
                    const coordinates = this.data.shift();
                    if (this.data.length === 0) {
                        // to not let GC destroy reference but this method is from stack overflow
                        this.data = [];
                    }
                    this.brushIntensity = this.config.brushIntensity;
                    this.brushRadius = this.config.brushRadius;
                    this.heatSpread = this.config.heatSpread;
                    this.update(sketch, coordinates);
                }
            }
            sketch.background('rgba(255,255,255, 0.25)');
            sketch.tint(HeatMapCanvas.UPPER_TINT, HeatMapCanvas.LOWER_TINT);
            if (!!img) {
                sketch.image(img, 0, 0);
            }
            this.canApplyHeat = false;
            this.update(sketch);
            this.display(sketch); // todo: remove sketch passed as argument as this not needs it in the future
            sketch.fill('rgba(255,255,255, 0.25)');
            sketch.noStroke();
            sketch.strokeWeight(0);
        };

        sketch.windowResized = function () {
            sketch.resizeCanvas(sketch.windowWidth, sketch.windowHeight);
        };
    }

    private update(sketch: p5, coordinates?: HeatMapGradientPoint) {
        this.makeGridCopy();
        let time_start: number = Date.now();
        if (!!coordinates && !!this.heatMapGrid) {
            // this.recalculateDistributionBasedOnCoordinates(coordinates);
            this.heatMapGrid.update(coordinates.x, coordinates.y, coordinates.heat, true);
        } else {
            this.heatMapGrid.update(0, 0, 0, false);
        }
        // if (this.recalculateCanvasCoordinateSystem) {
        //     this.start.x = (sketch.width - ((this.width - 1) * this.config.cellSpacing)) / 2;
        //     this.start.y = (sketch.height - ((this.height - 1) * this.config.cellSpacing)) / 2;
        // }
        // const coord = !!coordinates ? coordinates : {x: 0, y: 0, heat: 0};
        // // wasm is going to enter there
        // for (let x = 0; x < this.width; x++) {
        //     for (let y = 0; y < this.height; y++) {
        //         // this.applyGradientDissipation(sketch, x, y);
        //         this.distributeHeat(sketch, coord, x, y);
        //     }
        //     this.copyGridLayers();
        // }
    }

    private makeGridCopy() {
        this.copyColorGrid.grid = this.colorGrid.grid;
    }

    private recalculateDistributionBasedOnCoordinates(coordinates: HeatMapGradientPoint) {
        this.brushIntensity = Math.floor(this.config.brushIntensity * coordinates.heat);
        this.brushRadius = Math.floor(this.config.brushRadius * coordinates.heat);
        this.heatSpread = Math.floor(this.config.heatSpread * coordinates.heat);
    }

    private distributeHeat(sketch: p5, coordinates: HeatMapGradientPoint, x: number, y: number) {
        if (this.canApplyHeat) {
            const distanceFromCoordinates = sketch.dist(coordinates.x, coordinates.y, x * this.config.cellSpacing + this.start.x,
                y * this.config.cellSpacing + this.start.y);
            if (this.isInHeatDissipationRange(distanceFromCoordinates)) {
                this.copyColorGrid.grid[x][y] += Math.round(sketch.map(distanceFromCoordinates, 0, this.brushRadius * this.config.cellSpacing,
                    this.brushIntensity, 0));
            }
        }
        if (this.copyColorGrid.grid[x][y] > HeatMapCanvas.MAX_RED_SATURATION) {
            this.copyColorGrid.grid[x][y] = HeatMapCanvas.MAX_RED_SATURATION;
        } else if (this.copyColorGrid.grid[x][y] < 0) {
            this.copyColorGrid.grid[x][y] = 0;
        }
    }

    private applyGradientDissipation(sketch: p5, x: number, y: number) {
        this.copyColorGrid.grid[x][y]--;
        // if (this.colorGrid.grid[x][y] > 0) {
        //     const gradientDissipation = new GridMatrix();
        //     this.applyDissipation(gradientDissipation, x, y);
        //     let sum = 0;
        //     for (let i = 0; i < gradientDissipation.grid.length; i++) {
        //         sum += this.colorGrid.grid[gradientDissipation.grid[i][0]][gradientDissipation.grid[i][1]];
        //     }
        //     const averageDissipation = sketch.round(sum / gradientDissipation.grid.length);
        //     while (gradientDissipation.hasLength() && this.copyColorGrid.isAboveAverage(averageDissipation, x, y)) {
        //         this.applyHeatToGradient(sketch, gradientDissipation, x, y);
        //     }
        // }
    }

    private applyDissipation(gradientDissipation: GridMatrix, x: number, y: number) {
        if (this.colorGrid.isSmallerThanNextGradient_X(x, y)) {
            gradientDissipation.grid.push([x + 1, y]);
        }
        if (this.colorGrid.isSmallerThanBeforeGradient_X(x, y)) {
            gradientDissipation.grid.push([x - 1, y]);
        }
        if (this.colorGrid.isSmallerThanNextGradient_Y(x, y)) {
            gradientDissipation.grid.push([x, y + 1]);
        }
        if (this.colorGrid.isSmallerThanBeforeGradient_Y(x, y)) {
            gradientDissipation.grid.push([x, y - 1]);
        }
    }

    private applyHeatToGradient(sketch: p5, gradientDissipation: GridMatrix, x: number, y: number) {
        const index = gradientDissipation.pickRandomIndexToAvoidBias();
        const heatAmount = this.calculateHeatAmountToBeApplied(sketch, gradientDissipation, index, x, y);
        this.copyColorGrid.grid[gradientDissipation.grid[index][0]][gradientDissipation.grid[index][1]] += heatAmount;
        gradientDissipation.grid.splice(index, 1);
        if (this.config.isStatic) {
            this.copyColorGrid.grid[x][y] -= heatAmount;
        }
    }

    private calculateHeatAmountToBeApplied(sketch: p5, gradientDissipation: GridMatrix, index: number, x: number, y: number): number {
        return sketch.ceil((sketch.abs(this.copyColorGrid.grid[x][y] -
            this.copyColorGrid.grid[gradientDissipation.grid[index][0]][gradientDissipation.grid[index][1]]) / HeatMapCanvas.GRID_DIVIDER) *
            (this.heatSpread / HeatMapCanvas.MIL_VALUE));
    }

    private isInHeatDissipationRange(distanceFromCoordinates: number): boolean {
        return distanceFromCoordinates < this.brushRadius * this.config.cellSpacing;
    }

    private copyGridLayers() {
        const tempColorGrid: GridMatrix = this.colorGrid;
        this.colorGrid.grid = this.copyColorGrid.grid;
        this.copyColorGrid = tempColorGrid;
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

    private executeFromWasmArray(wasmArray: any, str: String) {
        if (this.dupa) {
            this.dupa = false;
            console.log(wasmArray, str);
        }
        // this.drawHeat(wasmArray[0], wasmArray[1], wasmArray[2], wasmArray[3]);
    }

    private drawHeat(sketch: p5, x: number, y: number, heat: number) {
        let colorGridValue = heat;
        console.log(sketch);
        // this.setFillHeatColor(sketch, colorGridValue);
        // const coordinates: Point = {x: Math.abs(x), y: Math.abs(y)};
        // switch (this.config.displayToggle) {
        //     case HeatDisplay.SQUARE:
        //         this.drawRectangleSharpEdges(sketch, coordinates, this.start);
        //         break;
        //     case HeatDisplay.ROUNDED:
        //         this.drawRectangleRounded(sketch, coordinates, this.start);
        //         break;
        //     case HeatDisplay.TEXT:
        //         colorGridValue = Math.floor(colorGridValue / HeatMapCanvas.COLOR_DIVIDER);
        //         this.addText(sketch, coordinates, this.start, colorGridValue);
        //         break;
        //     case HeatDisplay.ELLIPSE:
        //         this.drawEllipse(sketch, coordinates, this.start);
        //         break;
        //     case HeatDisplay.CIRCLE:
        //         if (colorGridValue !== 0) {
        //             this.drawCircle(sketch, coordinates, this.start, colorGridValue);
        //         }
        //         break;
        //     default:
        //         break;
        // }
    }

    private display(sketch: p5) {
        this.setSketchFill(sketch);
        this.heatMapGrid.draw(this.executeFromWasmArray.bind(this), sketch);
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
