const { Resvg } = require('@resvg/resvg-js');
const { join } = require('node:path');

function socialPng(svg) {
  return new Resvg(svg,{ font:{ loadSystemFonts:false,fontFiles:[join(__dirname,'../../assets/fonts/SpaceMono-Regular.ttf')],defaultFontFamily:'Space Mono',sansSerifFamily:'Space Mono' },fitTo:{mode:'width',value:1200} }).render().asPng();
}
module.exports={socialPng};
