// ============================================
// Hues and Cues Style Color Grid
// 30 columns × 16 rows = 480 colors
// ============================================

const COLS = 30;
const ROWS = 16;
const CELL_SIZE = 28;
const PADDING = 2;

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
  
  generateHuesAndCuesGrid();
}

function generateHuesAndCuesGrid() {
  
  colorGrid = [];
  
  for (let row = 0; row < ROWS; row++) {
    colorGrid[row] = [];
    
    for (let col = 0; col < COLS; col++) {
      // Hue: spans full spectrum across columns
      // Starting from red (0°), going through the rainbow
      const hue = map(col, 0, COLS, 0, 360);
      
      // Create variation pattern similar to Hues and Cues
      // The board has bands of different saturation/lightness
      let saturation, lightness;
      
      // Divide rows into bands with different characteristics
      const rowNormalized = row / (ROWS - 1); // 0 to 1
      
      if (row < 3) {
        // Top rows: lighter, lower saturation (pastels)
        saturation = map(row, 0, 2, 40, 60);
        lightness = map(row, 0, 2, 85, 75);
      } else if (row < 6) {
        // Upper-middle: medium-light, medium-high saturation
        saturation = map(row, 3, 5, 65, 80);
        lightness = map(row, 3, 5, 70, 60);
      } else if (row < 10) {
        // Middle: high saturation, medium lightness (vivid colors)
        saturation = map(row, 6, 9, 85, 95);
        lightness = map(row, 6, 9, 55, 45);
      } else if (row < 13) {
        // Lower-middle: high saturation, darker
        saturation = map(row, 10, 12, 90, 75);
        lightness = map(row, 10, 12, 40, 30);
      } else {
        // Bottom rows: lower saturation, dark (muted darks)
        saturation = map(row, 13, 15, 60, 35);
        lightness = map(row, 13, 15, 25, 15);
      }
      
      // Add slight variation based on hue for more natural look
      // Some hues (yellow) appear brighter, so adjust
      let lightnessAdjust = 0;
      if (hue > 40 && hue < 70) {
        // Yellow range appears brighter
        lightnessAdjust = -5;
      } else if (hue > 200 && hue < 260) {
        // Blue range can be darker
        lightnessAdjust = 3;
      }
      
      lightness = constrain(lightness + lightnessAdjust, 10, 95);
      
      const hexColor = hslToHex(hue, saturation, lightness);
      
      colorGrid[row][col] = {
        hue,
        saturation,
        lightness,
        hex: hexColor,
        col: col + 1, // 1-indexed for display
        row: String.fromCharCode(65 + row), // A-P
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
