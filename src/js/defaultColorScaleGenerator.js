module.exports = function colorScaleGenerator(property, data){
  return d3.scale.linear()
    .domain(d3.extent(data, function(d) { return +d[property]; }))
    .range(['hsl(0, 60%, 50%)', 'hsl(255, 60%, 50%)']) // red to blue
    .interpolate(d3.interpolateHsl);
};