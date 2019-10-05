import {HeatDisplay} from './heat-map-canvas';

export const heatMapCanvasConfiguration = {
  heatSpread: 20,
  brushRadius: 10,
  brushIntensity: 15,
  gridWidth: 90, // calculated from cellSpacing but can be set as permanent
  gridHeight: 90, // calculated from cellSpacing but can be set as permanent
  cellSize: 1,
  cellSpacing: 1,
  isStatic: false,
  displayToggle: HeatDisplay.ELLIPSE,
  width: 1200,
  height: 1200,
  imgUrl: 'https://thumbs.dreamstime.com/b/london-city-london-street-view-uk-april-aerial-office-buildings-roads-transport-people-crossing-junction-64711114.jpg', // set in if img is present
  parentId: 'heatmap-sketch' // id of p5js canvas parent in DOM
};
