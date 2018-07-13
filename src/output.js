const fs = require('fs');
const svg2png = require('svg2png');

module.exports = function (outputName, d3n) {

  if (d3n.options.canvas) {
    const canvas = d3n.options.canvas;
    console.log('canvas output...', canvas);
    canvas.pngStream().pipe(fs.createWriteStream('src/'+outputName+'.png'));
    return;
  }

  fs.writeFile('src/'+outputName+'.html', d3n.html(), function () {
    console.log('>> Done. Open "src/'+outputName+'.html" in a web browser');
  });

  var svgBuffer = new Buffer(d3n.svgString(), 'utf-8');
  svg2png(svgBuffer)
    .then(buffer => {
      console.log(buffer);
      return fs.writeFile('src/'+outputName+'.png', buffer)
    })
    .catch(e => console.error('ERR:', e))
    .then(err => console.log('>> Exported: "src/'+outputName+'.png"'));
};