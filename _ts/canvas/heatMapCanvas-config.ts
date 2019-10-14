export const heatMapCanvasConfiguration = {
  heatSpread: 12,
  brushRadius: 18,
  brushIntensity: 10,
  gridWidth: 90, // calculated from cellSpacing but can be set as permanent
  gridHeight: 90, // calculated from cellSpacing but can be set as permanent
  cellSize: 2,
  cellSpacing: 2,
  isStatic: false,
  width: 900,
  height: 900,
  imgUrl: 'https://thumbs.dreamstime.com/b/london-city-london-street-view-uk-april-aerial-office-buildings-roads-transport-people-crossing-junction-64711114.jpg', // set in if img is present
  parentId: 'heatmap-sketch' // id of p5js canvas parent in DOM
};
