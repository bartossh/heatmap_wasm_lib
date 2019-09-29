import {HeatDisplay} from './heat-map-canvas';

export const heatMapCanvasConfiguration = {
  heatSpread: 2,
  brushRadius: 4,
  brushIntensity: 3,
  gridWidth: 90, // calculated from cellSpacing but can be set as permanent
  gridHeight: 90, // calculated from cellSpacing but can be set as permanent
  cellSize: 9,
  cellSpacing: 10,
  isStatic: false,
  displayToggle: HeatDisplay.ELLIPSE,
  width: 900,
  height: 900,
  imgUrl: '', // set in if img is present
  parentId: 'heatmap-sketch' // id of p5js canvas parent in DOM
};
