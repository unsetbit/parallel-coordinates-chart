var colorbrewer = require('./colorbrewer');

module.exports = function colorGenerator(property, data){
  var range = colorbrewer.RdYlGn[10].slice(0);
  
  return d3.scale.quantile()
    .range(range)
    .domain(d3.extent(data, function(d) { return +d[property]; }));
};