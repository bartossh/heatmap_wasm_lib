export class GridMatrix {
    grid: number[][];

    constructor() {
    this.grid = [];
    }

    isSmallerThanNextGradient_X(x: number, y: number): boolean {
    return this.grid[x + 1] && this.grid[x + 1][y] < this.grid[x][y];
    }

    isSmallerThanBeforeGradient_X(x: number, y: number): boolean {
    return this.grid[x - 1] && this.grid[x - 1][y] < this.grid[x][y];
    }

    isSmallerThanNextGradient_Y(x: number, y: number): boolean {
    return this.grid[x][y + 1] < this.grid[x][y];
    }
    
    isSmallerThanBeforeGradient_Y(x: number, y: number): boolean {
    return this.grid[x][y - 1] < this.grid[x][y];
    }

    isAboveAverage(average: number, x: number, y: number): boolean {
    return this.grid[x][y] > average
    }

    hasLength(): boolean {
    return this.grid.length > 0;
    }

    pickRandomIndexToAvoidBias(): number {
    return Math.floor(Math.random() * this.grid.length);
    }
}
