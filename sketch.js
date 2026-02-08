// ============================================
// Simple Color Columns
// 9 columns of solid colors
// ============================================

const COLS = 9;
const ROWS = 1;
const CELL_SIZE = 80;
const PADDING = 8;

// Define the 9 colors
const COLORS = [
  { name: 'Red', hue: 0, lightness: 50 },
  { name: 'Orange', hue: 30, lightness: 50 },
  { name: 'Yellow', hue: 60, lightness: 50 },
  { name: 'Green', hue: 120, lightness: 50 },
  { name: 'Dark Green', hue: 120, lightness: 30 },
  { name: 'Cyan', hue: 180, lightness: 50 },
  { name: 'Blue', hue: 240, lightness: 50 },
  { name: 'Violet', hue: 270, lightness: 50 },
  { name: 'Magenta', hue: 300, lightness: 50 }
];

let colorGrid = [];
let selectedCell = null;
let hoverCell = null;
let canvasWidth, canvasHeight;

function setup() {
  canvasWidth = COLS * (CELL_SIZE + PADDING) + PADDING;
  canvasHeight = ROWS * (CELL_SIZE + PADDING) + PADDING;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent('canvas-container');

  colorMode(HSL, 360, 100, 100);
  noStroke();

  generateColorColumns();
}

function generateColorColumns() {
  colorGrid = [];

  for (let row = 0; row < ROWS; row++) {
    colorGrid[row] = [];

    for (let col = 0; col < COLS; col++) {
      const hue = COLORS[col].hue;
      const saturation = 100;
      const lightness = COLORS[col].lightness;

      const hexColor = hslToHex(hue, saturation, lightness);

      colorGrid[row][col] = {
        hue,
        saturation,
        lightness,
        hex: hexColor,
        name: COLORS[col].name,
        col: col + 1,
        row: String.fromCharCode(65 + row),
      };
    }
  }
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function draw() {
  background(10);
  
  // Draw grid
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellData = colorGrid[row][col];
      const x = col * (CELL_SIZE + PADDING) + PADDING;
      const y = row * (CELL_SIZE + PADDING) + PADDING;
      
      // Check if this cell is hovered or selected
      const isHovered = hoverCell && hoverCell.row === row && hoverCell.col === col;
      const isSelected = selectedCell && selectedCell.row === row && selectedCell.col === col;
      
      // Draw cell
      fill(cellData.hue, cellData.saturation, cellData.lightness);
      
      if (isSelected) {
        // Selected: white border
        stroke(0, 0, 100);
        strokeWeight(3);
        rect(x - 1, y - 1, CELL_SIZE + 2, CELL_SIZE + 2, 4);
        noStroke();
      } else if (isHovered) {
        // Hovered: subtle highlight
        stroke(0, 0, 100, 0.5);
        strokeWeight(2);
        rect(x, y, CELL_SIZE, CELL_SIZE, 3);
        noStroke();
      } else {
        rect(x, y, CELL_SIZE, CELL_SIZE, 2);
      }
    }
  }
  
  // Draw row labels (A-P) on the left
  fill(0, 0, 60);
  textSize(10);
  textAlign(RIGHT, CENTER);
  for (let row = 0; row < ROWS; row++) {
    const y = row * (CELL_SIZE + PADDING) + PADDING + CELL_SIZE / 2;
    // Labels would go outside canvas - skip for now
  }
  
  // Draw column labels (1-30) on top
  textAlign(CENTER, BOTTOM);
  for (let col = 0; col < COLS; col++) {
    const x = col * (CELL_SIZE + PADDING) + PADDING + CELL_SIZE / 2;
    // Labels would go outside canvas - skip for now
  }
}

function mouseMoved() {
  updateHoverCell();
}

function updateHoverCell() {
  const col = Math.floor((mouseX - PADDING) / (CELL_SIZE + PADDING));
  const row = Math.floor((mouseY - PADDING) / (CELL_SIZE + PADDING));
  
  if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
    hoverCell = { row, col };
    cursor(HAND);
  } else {
    hoverCell = null;
    cursor(ARROW);
  }
}

function mousePressed() {
  if (!hoverCell) return;
  
  const { row, col } = hoverCell;
  const cellData = colorGrid[row][col];
  
  selectedCell = { row, col };
  
  // Notify the app
  if (typeof onColorSelected === 'function') {
    onColorSelected(cellData.hex, {
      col: cellData.col,
      row: cellData.row,
    });
  }
}

// Handle window resize
function windowResized() {
  // Canvas size is fixed based on grid dimensions
  // No resize needed
}
