const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [16, 48, 128];
const dir = './icons';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#a78bfa');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    
    // Text "AF" (AutoFlow)
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AF', size / 2, size / 2);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`${dir}/icon${size}.png`, buffer);
    console.log(`Generated icon${size}.png`);
});
