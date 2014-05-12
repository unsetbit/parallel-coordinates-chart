// Borrows heavily from http://bl.ocks.org/mbostock/7586334

var interpolator = require('./interpolator'),
  defaultColorGenerator = require('./colorGenerator');

function defaultDomainGenerator(dimension, data){
  return d3.extent(data, function(d) { return +d[dimension]; });
}

module.exports = function parallelCoordinatesChart(config){
  config || (config = {});

  var margin = [30, 10, 10, 10];
  var width = 1560;
  var height = 500;
  var innerWidth = width - margin[1] - margin[3];
  var innerHeight = height - margin[0] - margin[2];
  var x = d3.scale.ordinal().rangePoints([0, innerWidth], 1);
  var selectedProperty = '';
  var dimensions;
  var colorGenerator = defaultColorGenerator;
  var domainGenerator = defaultDomainGenerator;

  var line = d3.svg.line().interpolate(interpolator);
  var axis = d3.svg.axis().orient('left');

  // When brushing, don’t trigger axis dragging.
  function brushStartHandler() {
    d3.event.sourceEvent.stopPropagation();
  }

  function chart(selection){
    // Just in case we're drawing it in multiple places
    selection.each(function(data){
      if(!data) return;
      var y = {},
        dragging = {};

      var svg = d3.select(this)
        .selectAll('svg')
          .data([data])
        .enter()
          .append('svg')
            .attr('class', 'parallel-coordinates-chart')
            .attr('width', innerWidth + margin[1] + margin[3])
            .attr('height', innerHeight + margin[0] + margin[2])
            .append('g')
              .attr('transform', 'translate(' + margin[3] + ',' + margin[0] + ')');

      // Extract the list of dimensions and create a scale for each.
      if(!dimensions) dimensions = Object.keys(data[0]);
      x.domain(dimensions);
      dimensions.forEach(function(d) {
        y[d] = d3.scale.linear()
                .range([innerHeight, 0])
                .domain(domainGenerator(d, data));
      });

      // Add grey background lines for context.
      var background = svg.append('g')
          .attr('class', 'background')
        .selectAll('path')
          .data(data)
        .enter().append('path')
          .attr('d', path);

      // Add blue foreground lines for focus.
      var foreground = svg.append('g')
          .attr('class', 'foreground')
        .selectAll('path')
          .data(data)
        .enter().append('path')
          .attr('d', path);

      // Add a group element for each dimension.
      var g = svg.selectAll('.dimension')
          .data(dimensions)
        .enter().append('g')
          .attr('class', 'dimension')
          .attr('transform', function(d) { return 'translate(' + x(d) + ')'; })
          .on('click', function(d){
            if (d3.event.defaultPrevented) return; // click suppressed
            if(d === selectedProperty) setProperty('');
            else setProperty(d);
          })
          .call(d3.behavior.drag()
            .on('dragstart', function(d) {
              dragging[d] = this.__origin__ = x(d);
              background.attr('visibility', 'hidden');
            })
            .on('drag', function(d) {
              dragging[d] = Math.min(innerWidth, Math.max(0, this.__origin__ += d3.event.dx));
              foreground.attr('d', path);
              dimensions.sort(function(a, b) { return position(a) - position(b); });
              x.domain(dimensions);
              g.attr('transform', function(d) { return 'translate(' + position(d) + ')'; });
            })
            .on('dragend', function(d) {
              delete this.__origin__;
              delete dragging[d];
              d3.select(this).attr('transform', 'translate(' + x(d) + ')');
              foreground.attr('d', path);
              background.attr('d', path)
                  .attr('visibility', null);
            }));

      // Add an axis and title.
      g.append('g')
          .attr('class', 'axis')
          .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
        .append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -9)
          .text(String);

      // Add and store a brush for each axis.
      g.append('g')
          .attr('class', 'brush')
          .each(function(d) { 
            d3.select(this).call(y[d].brush = d3.svg.brush().y(y[d]).on('brushstart', brushStartHandler).on('brush', brush)); 
          })
        .selectAll('rect')
          .attr('x', -8)
          .attr('width', 16);

      setProperty(selectedProperty);

      function setProperty(p){
        selectedProperty = p;
        
        svg.selectAll('.dimension.selected').attr('class', 'dimension');
        svg.selectAll('.dimension')
          .each(function(d){
            if(d === selectedProperty){
              d3.select(this).attr('class', 'dimension selected');      
            }
          });
        if(!p) return foreground.style('stroke', '');

        var color = colorGenerator(p, data);
        foreground.style('stroke', function(d){ 
            if(!d[p]) return 'gray';
            return color(d[p]);   
          });
      }
      

      // Handles a brush event, toggling the display of foreground lines.
      function brush() {
        var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
            extents = actives.map(function(p) { return y[p].brush.extent(); });
        
        foreground.attr('class', function(d) {
          var visible = actives.every(function(p, i) {
            return extents[i][0] <= d[p] && d[p] <= extents[i][1];
          });
          return visible ? 'active' : 'filtered';
        });
      }
      function position(d) {
        // if we're currently dragging the axis return the drag position
        // otherwise return the normal x-axis position
        var v = dragging[d];
        return v == null ? x(d) : v;
      }

      // Returns the path for a given data point.
      function path(d) {
        return line(dimensions.map(function(p) { 
          return [position(p), y[p](d[p])]; 
        }));
      }
    });
  }

  chart.width = function(_){
    if (!arguments.length) return width;
    width = _;
    innerWidth = width - margin[1] - margin[3];
    x = d3.scale.ordinal().rangePoints([0, innerWidth], 1);
    return chart;
  };

  chart.height = function(_){
    if (!arguments.length) return height;
    height = _;
    innerHeight = height - margin[0] - margin[2];
    return chart;
  };

  chart.margin = function(_){
    if (!arguments.length) return margin;
    margin = _;
    chart.width(width);
    chart.height(height);
    return chart;
  };

  chart.select = function(_){
    if (!arguments.length) return dimensions;
    dimensions = _;
    return chart;
  };

  chart.domain = function(_){
    if (!arguments.length) return domainGenerator;
    domainGenerator = _;
    return chart;
  };
  
  chart.color = function(_){
    if (!arguments.length) return colorGenerator;
    colorGenerator = _;
    return chart;
  };

  chart.highlight = function(_){
    if (!arguments.length) return selectedProperty;
    selectedProperty = _;
    return chart;
  };

  chart.redraw = function(selection){
    selection.selectAll('svg').remove();
    chart(selection);
    return chart;
  };

  chart.draw = function(selection){
    chart(selection);
    return chart;
  };

  if('width' in config) chart.width(config.width);
  if('height' in config) chart.height(config.height);
  if('margin' in config) chart.margin(config.margin);
  if('select' in config) chart.select(config.select);
  if('domain' in config) chart.domain(config.domain);
  if('highlight' in config) chart.highlight(config.highlight);
  if('color' in config) chart.color(config.color);

  return chart;
};
