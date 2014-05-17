// Borrows heavily from http://bl.ocks.org/mbostock/7586334
require('./customEventPolyfill');


var defaultInterpolator = require('./interpolator'),
  defaultColorScaleGenerator = require('./defaultColorScaleGenerator');

function defaultDomainGenerator(dimension, data){
  return d3.extent(data, function(d) { return +d[dimension]; });
}

module.exports = function parallelCoordinatesChart(config){

  // Configurable variables
  var margin, 
    width, 
    height, 
    selectedProperty,
    colorGenerator,
    domainGenerator,
    dimensions,
    interpolator;

  // Generated variables
  var innerWidth,
    innerHeight,
    x,
    y, 
    dragging, 
    element, 
    data, 
    svg,
    line;

  var axis = d3.svg.axis().orient('left');

  function init(config){
    if('margin' in config) draw.margin(config.margin);
    else draw.margin([30, 10, 10, 10]); // default

    if('width' in config) draw.width(config.width);
    else draw.width(1560); // default

    if('height' in config) draw.height(config.height);
    else draw.width(500); // default;

    if('domain' in config) draw.domain(config.domain);
    else draw.domain(defaultDomainGenerator); // default

    if('highlight' in config) draw.highlight(config.highlight);
    else draw.highlight(''); // default

    if('interpolator' in config) draw.interpolator(config.interpolator);
    else draw.interpolator(defaultInterpolator); // default

    if('color' in config) draw.color(config.color);
    else draw.color(defaultColorScaleGenerator); // default

    if('select' in config) draw.select(config.select);
  }

  function updateHighlight(svg){
    if(!svg) return;

    svg.selectAll('.dimension.selected').classed('selected', false);
    svg.selectAll('.dimension')
      .each(function(d){
        if(d === selectedProperty){
          d3.select(this).classed('selected', true);
        }
      });

    var paths = svg.selectAll('g.datalines path');
    if(!selectedProperty) return paths.style('stroke', '');
    if(!paths || !paths.length) return;

    var color = colorGenerator(selectedProperty, svg.data()[0]);
    paths.style('stroke', function(d){ 
      return color(d[selectedProperty]);   
    });
  }


  function createDraggable(){
    return d3.behavior.drag()
      .on('dragstart', function(d) {
        dragging[d] = this.__origin__ = x(d);
      })
      .on('drag', function(d) {
        dragging[d] = Math.min(innerWidth, Math.max(0, this.__origin__ += d3.event.dx));
        svg.selectAll('g.datalines path').attr('d', path);
        dimensions.sort(function(a, b) { return position(a) - position(b); });
        x.domain(dimensions);
        svg.selectAll('g.dimension').attr('transform', function(d) { return 'translate(' + position(d) + ')'; });
      })
      .on('dragend', function(d) {
        delete this.__origin__;
        delete dragging[d];
        d3.select(this).attr('transform', 'translate(' + x(d) + ')');
        svg.selectAll('g.datalines path').attr('d', path);
    });
  }

  // When brushing, don’t trigger axis dragging.
  function brushStartHandler() { 
    d3.event.sourceEvent.stopPropagation(); 
  }

  // Handles a brush event, toggling the display of foreground lines.
  function brush() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });

    var selected = [];
    svg.selectAll('g.datalines path').attr('class', function(d) {
      var visible = actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      });

      if(visible){
        selected.push(d);
        return 'active';
      } else {
        return 'filtered';
      }
    });

    var filters = {};
    actives.forEach(function(dimension, i){
      filters[dimension] = extents[i];
    });

    var eventDetails = {
      element: element,
      selected: selected,
      filters: filters
    };

    var event = new CustomEvent('changefilter', {detail: eventDetails});
    element.dispatchEvent(event);
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

  function draw(container){
    dragging = {};

    element = container.node();
    data = container.datum();

    // Extract the list of dimensions and create a scale for each.
    if(!dimensions) dimensions = Object.keys(data[0]);

    x.domain(dimensions);
    
    y = {};
    dimensions.forEach(function(d) {
      y[d] = d3.scale.linear()
        .range([innerHeight, 0])
        .domain(domainGenerator(d, data));
    });

    // base svg
    svg = container
      .selectAll('svg')
        .data([data])
      .enter()
        .append('svg')
          .classed('parallel-coordinates-chart', true)
          .attr('width', width)
          .attr('height', height);
    
    var body = svg          
      .append('g')
        .attr('transform', 'translate(' + margin[3] + ',' + margin[0] + ')');

    // create paths
    body.append('g')
      .classed('datalines', true)
      .selectAll('path')
      .data(data)
      .enter()
        .append('path')
        .attr('d', path);

    // Add a group element for each dimension.
    var dimensionGroup = body
      .selectAll('.dimension')
        .data(dimensions)
        .enter()
          .append('g')
            .classed('dimension', true)
            .attr('transform', function(d) { return 'translate(' + x(d) + ')'; })
            .call(createDraggable());
    
    // Add an axis and title.
    dimensionGroup.append('g')
        .attr('class', 'axis')
        .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
      .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -9)
        .text(String)
        .on('click', function(d){
          if (d3.event.defaultPrevented) return; // click suppressed
          if(d === selectedProperty) draw.highlight('');
          else draw.highlight(d);
        });

    // Add and store a brush for each axis.
    dimensionGroup.append('g')
        .attr('class', 'brush')
        .each(function(d) { 
          d3.select(this).call(
            y[d].brush = d3.svg.brush().y(y[d])
              .on('brushstart', brushStartHandler)
              .on('brush', brush)
          ); 
        })
      .selectAll('rect')
        .attr('x', -8)
        .attr('width', 16);

    draw.highlight(selectedProperty);

    return draw;
  }

  draw.width = function(_){
    if (!arguments.length) return width;
    width = _;
    innerWidth = width - margin[1] - margin[3];
    x = d3.scale.ordinal().rangePoints([0, innerWidth], 1);
    return draw;
  };

  draw.height = function(_){
    if (!arguments.length) return height;
    height = _;
    innerHeight = height - margin[0] - margin[2];
    return draw;
  };

  draw.margin = function(_){
    if (!arguments.length) return margin;
    margin = _;
    draw.width(width);
    draw.height(height);
    return draw;
  };

  draw.select = function(_){
    if (!arguments.length) return dimensions;
    dimensions = _;
    return draw;
  };

  draw.domain = function(_){
    if (!arguments.length) return domainGenerator;
    domainGenerator = _;
    return draw;
  };
  
  draw.color = function(_){
    if (!arguments.length) return colorGenerator;
    colorGenerator = _;
    return draw;
  };

  draw.interpolator = function(_){
    if (!arguments.length) return interpolator;
    interpolator = _;
    line = d3.svg.line().interpolate(interpolator);
    return draw;
  };

  draw.highlight = function(_){
    if (!arguments.length) return selectedProperty;
    selectedProperty = _;
    updateHighlight(svg);
    return draw;
  };

  draw.filter = function(dimension, extent){
    if(arguments.length === 0){
      var brushes = {};
      Object.keys(y).forEach(function(dimension){
        var extent = y[dimension].brush.extent();
        
        // skip unset filters
        if(extent[0] === extent[1]) return;
        
        brushes[dimension] = y[dimension].brush.extent();
      });

      return brushes;
    }

    if(arguments.length === 1){
      extent = y[dimension].brush.extent();
      if(extent[0] === extent[1]) return; // undefined if unset
      return extent;
    }

    if(!extent) extent = [0,0]; // this hides brush

    svg.selectAll(' .brush').filter(function(d){
      return d === dimension;
    }).call(y[dimension].brush.extent(extent)).call(brush);    
  };

  draw.redraw = function(container){
    if(svg) svg.remove();
    draw(container);
    return draw;
  };

  draw.draw = function(container){
    draw(container);
    return draw;
  };

  init(config || {});

  return draw;
};
