let heatDissipation, heatSpread, brushRadius, brushIntensity, gridWidth, gridHeight, cellSize, cellSpacing;
let ellipseButton, numberButton, displayToggle;
let heatMap;
let coordinates = {
  x: 0,
  y: 0
};
let counter = 0;
let canApplyHeat = false;
let maxCounted = 25;

function setup() {
  // scene setup
  frameRate(60);
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB);
  textAlign(CENTER);
  canApplyHeat = true;

  heatDissipation = 5;
  heatSpread = 20;
  brushRadius = 3;
  brushIntensity = 20;
  gridWidth = 72;
  gridHeight = 48;
  cellSize = 15;
  cellSpacing = 30;

  displayToggle = false;

  heatMap = new HeatMap(gridWidth, gridHeight);
}

function draw() {
  if(gridWidth != heatMap.width || gridHeight != heatMap.height)
    heatMap = new HeatMap(gridWidth, gridHeight);

  if (counter === maxCounted) {
    coordinates = {
      x: Math.floor(random(this.width)),
      y: Math.floor(random(this.height))
    };
    counter = 0;
    maxCounted = Math.floor(random(100));
  }
  counter++;

  background(255);

  heatMap.update();
  heatMap.display();

  fill(255);
  noStroke();
  strokeWeight(0);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

var HeatMap = function(mapWidth, mapHeight) {
  this.width = mapWidth;
  this.height = mapHeight;
  this.temps = [];
  this.newTemps = [];

  for(var x = 0; x < this.width; x++) {
    this.temps[x] = [];
    this.newTemps[x] = [];
    for(var y = 0; y < this.height; y++)
      this.temps[x][y] = this.newTemps[x][y] = 0;
  }
}

HeatMap.prototype.update = function() {
  for(var x = 0; x < this.width; x++)
    for(var y = 0; y < this.height; y++)
      this.newTemps[x][y] = this.temps[x][y];

  this.startX = (width - ((this.width - 1) * cellSpacing)) / 2;
  this.startY = (height - ((this.height - 1) * cellSpacing)) / 2;

  for(var x = 0; x < this.width; x++) {
    for(var y = 0; y < this.height; y++) {
        this.newTemps[x][y]--;

      // works out how to spread the heat in a cell to adjacent cells
      if(this.temps[x][y] > 0) {
        // keeps track of the cells that heat can be dissipated to
        var dissipation = [];

        // checks all four adjacent cells to see if they are lower in temperature
        if(this.temps[x + 1] && this.temps[x + 1][y] < this.temps[x][y])
          dissipation.push([x + 1, y]);
        if(this.temps[x - 1] && this.temps[x - 1][y] < this.temps[x][y])
          dissipation.push([x - 1, y]);
        if(this.temps[x][y + 1] < this.temps[x][y])
          dissipation.push([x, y + 1]);
        if(this.temps[x][y - 1] < this.temps[x][y])
          dissipation.push([x, y - 1]);

        // calculates the average temperature of the cells around the current cell
        var sum = 0;
        for(var i = 0; i < dissipation.length; i++)
          sum += this.temps[dissipation[i][0]][dissipation[i][1]];
        var average = round(sum / dissipation.length);

        // dissipates the heat into available cells until it either runs out of cells or the current cell has dropped below the average temp
        while(dissipation.length > 0 && this.newTemps[x][y] > average) {
          // picks a random cell (so there's no bias if not all cells end up getting heat)
          var index = Math.floor(Math.random() * dissipation.length);
          // calculates the amount of heat to dissipate to the adjacent cell depending on the temperature difference between them
          var amount = ceil((abs(this.newTemps[x][y] - this.newTemps[dissipation[index][0]][dissipation[index][1]]) / 5) * (heatSpread / 100));
          // updates cell temperatures and removes adjacent cell from the array
          this.newTemps[dissipation[index][0]][dissipation[index][1]] += amount;
          dissipation.splice(index, 1);
          this.newTemps[x][y] -= amount;
        }
      }

      if(canApplyHeat) {
        var distance = dist(coordinates.x, coordinates.y, x * cellSpacing + this.startX, y * cellSpacing + this.startY);
        if(distance < brushRadius * cellSpacing)
          this.newTemps[x][y] += Math.round(map(distance, 0, brushRadius * cellSpacing, brushIntensity, 0));
      }

      // cap the temp to between 0 and 240
      if(this.newTemps[x][y] > 240)
        this.newTemps[x][y] = 240;
      else if(this.newTemps[x][y] < 0)
        this.newTemps[x][y] = 0;
    }
  }

  // make the new temps the current ones and keep the old temps for use next frame
  var temp = this.temps;
  this.temps = this.newTemps;
  this.newTemps = temp;
}

HeatMap.prototype.display = function() {
  if(displayToggle) {
    noFill();
    strokeWeight(2);
  }
  else
    strokeWeight(1);
  for(var x = 0; x < this.width; x++) {
    for(var y = 0; y < this.height; y++) {
      let _value = this.temps[x][y];
      if (_value != 0) {
        _value = Math.floor(_value / 24);
        fill(240 - this.temps[x][y], 255, 255); // HSB
      } else {
        fill(240); // HSB
      }
      if(displayToggle) {
        rect(x * cellSpacing + this.startX, y * cellSpacing + this.startY, cellSize, cellSize);
      }
      else {
        text(_value, x * cellSpacing + this.startX, y * cellSpacing + this.startY, cellSize);
      }
    }
  }
}
