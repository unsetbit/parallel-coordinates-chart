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
    highlighted,
    highlightFilter,
    filters,
    colorGenerator,
    domainGenerator,
    dimensions,
    interpolator,
    container,
    onFiltersChange = function () {},
    onHighlightChange = function () {};

  // Generated variables
  var innerWidth,
    innerHeight,
    x,
    y,
    dragging,
    data,
    svg,
    body,
    dataLines,
    line;

  var axis = d3.svg.axis().orient('left');

  function init(config){
    if('margin' in config) draw.margin(config.margin);
    else draw.margin([30, 10, 10, 10]); // default

    if('width' in config) draw.width(config.width);
    else draw.width(1560); // default

    if('height' in config) draw.height(config.height);
    else draw.height(500); // default;

    if('domain' in config) draw.domain(config.domain);
    else draw.domain(defaultDomainGenerator); // default

    if('highlight' in config) draw.highlight(config.highlight);
    else draw.highlight(''); // default

    if('filters' in config) draw.filters(config.filters);
    else draw.filters({}); // default

    if('interpolator' in config) draw.interpolator(config.interpolator);
    else draw.interpolator(defaultInterpolator); // default

    if('color' in config) draw.color(config.color);
    else draw.color(defaultColorScaleGenerator); // default

    if('select' in config) draw.select(config.select);

    if('onFiltersChange' in config) {
      draw.onFiltersChange(config.onFiltersChange);
    }

    if('onHighlightChange' in config) {
      draw.onHighlightChange(config.onHighlightChange);
    }
  }

  function updateHighlight(svg){
    if(!svg) return;

    svg.selectAll('.dimension').classed('selected', function(d) {
      return d === selectedProperty;
    });

    var paths = svg.selectAll('g.datalines path');
    if(!selectedProperty) return paths.style('stroke', '');
    if(!paths || !paths.length) return;

    var color = colorGenerator(selectedProperty, data);
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

  // Handles a brush event, toggling the display of lines.
  function brush() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });

    var selected = [];
    dataLines.selectAll('path').classed('active', function(d) {
      var visible = actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      });

      if (visible) selected.push(d);
      return visible;
    });
    dataLines.selectAll('path').classed('filtered', function(d) {
      var visible = actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      });
      return !visible;
    });

    var filters = {};
    actives.forEach(function(dimension, i){
      filters[dimension] = extents[i];
    });

    onFiltersChange(filters, selected);
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

  function draw(){
    dragging = {};

    // Extract the list of dimensions and create a scale for each.
    if(!dimensions) dimensions = Object.keys(data[0]);

    x.domain(dimensions);

    y = {};
    dimensions.forEach(function(d) {
      y[d] = d3.scale.linear()
        .range([innerHeight, 0])
        .domain(domainGenerator(d, data));

      y[d].brush = d3.svg.brush().y(y[d])
          .on('brushstart', brushStartHandler)
          .on('brush', brush);
    });

    svg.attr('width', width)
      .attr('height', height);

    // base svg
    body.attr('transform', 'translate(' + margin[3] + ',' + margin[0] + ')');

    // create paths
    dataLines.selectAll('path')
      .data(data, function(d) { return d.id; })
      .enter()
        .append('path');

    dataLines.selectAll('path')
      .attr('d', path)
      .classed('highlighted', function(d) {
        if (highlighted && highlighted.id === d.id) {
          return true;
        }

        if (highlightFilter) {
          return highlightFilter(d);
        }

        return false;
      });

    // Add a group element for each dimension.
    var dimensionGroup = body
      .selectAll('g.dimension')
      .data(dimensions);


    var newDimensions = dimensionGroup.enter()
        .append('g')
          .classed('dimension', true)
          .call(createDraggable());

    dimensionGroup.attr('transform', function(d) {
      return 'translate(' + x(d) + ')';
    });

    // Add an axis and title.
    newDimensions.append('g')
        .attr('class', 'axis')
      .append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -9)
        .text(String)
        .on('click', function(d){
          if (d3.event.defaultPrevented) return; // click suppressed

          if(d === selectedProperty) d = '';
          else draw.highlight(d);
        });

    dimensionGroup.selectAll('g.axis')
      .each(function(d) { d3.select(this).call(axis.scale(y[d])); });

    // Add and store a brush for each axis.
    newDimensions.append('g')
        .attr('class', 'brush');

    dimensionGroup.selectAll('g.brush')
      .each(function(d) {
        d3.select(this).call(y[d].brush);
      })
      .selectAll('rect')
      .attr('x', -8)
      .attr('width', 16);

    draw.highlight(selectedProperty);
    draw.filters(filters);

    return draw;
  }

  draw.width = function(_){
    if (!arguments.length) return width;
    width = _;
    innerWidth = width - margin[1] - margin[3];
    x = d3.scale.ordinal().rangePoints([0, innerWidth], 0.8);
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

  draw.highlighted = function(_){
    if (!arguments.length) return highlighted;
    highlighted = _;
    return draw;
  };

  draw.onFiltersChange = function(_){
    if (!arguments.length) return onFiltersChange;
    onFiltersChange = _;
    return draw;
  };

  draw.onHighlightChange = function(_){
    if (!arguments.length) return onHighlightChange;
    onHighlightChange = _;
    return draw;
  };

  draw.highlight = function(_){
    if (!arguments.length) return selectedProperty;

    if(selectedProperty !== _){
      selectedProperty = _;

      onHighlightChange(selectedProperty);
    }

    updateHighlight(svg);
    return draw;
  };

  draw.highlightFilter = function(_) {
    if (!arguments.length) return highlightFilter;

    if (highlightFilter !== _) {
      highlightFilter = _;
    }

    return draw;
  };

  draw.filter = function(dimension, extent){
    if(arguments.length === 0) return;
    var current = y[dimension].brush.extent();

    if(arguments.length === 1){
      if(current[0] === current[1]) return; // undefined if unset
      return current;
    }

    if(!extent) extent = [0,0]; // this hides brush

    if(current[0] === extent[0] && current[1] === extent[1]) return draw;

    svg.selectAll('.brush').filter(function(d){
      return d === dimension;
    }).call(y[dimension].brush.extent(extent)).call(brush);

    return draw;
  };

  draw.filters = function(newFilters){
    if (!newFilters) newFilters = {};
    filters = newFilters;
    var current = {};
    var dimensions = Object.keys(y || {});

    dimensions.forEach(function(dimension){
      // skip unset filters
      if(y[dimension].brush.empty()) return;

      current[dimension] = y[dimension].brush.extent();
    });

    if(!arguments.length) return current;

    var same = dimensions.every(function(dimension){
      if(dimension in newFilters){
        if(!(dimension in current)) return false;

        return (current[dimension][0] === newFilters[dimension][0] &&
                current[dimension][1] === newFilters[dimension][1]);
      } else return !(dimension in current);
    });

    if(same) return draw;

    // Zero out any implicitly excluded dimensions
    dimensions.forEach(function(dimension){
      if(dimension in newFilters){
        y[dimension].brush.extent(newFilters[dimension]);
      } else {
        y[dimension].brush.clear();
      }
    });

    svg.selectAll('.brush').each(function(dimension){
      d3.select(this).call(y[dimension].brush);
    });

    svg.call(brush);

    return draw;
  };

  draw.container = function(_) {
    if (!arguments.length) return container;
    container = _;

    svg = d3.select(container).append('svg')
      .classed('parallel-coordinates-chart', true);

    body = svg.append('g')
      .attr('class', 'body')
      .attr('transform', 'translate(0,0)');

    dataLines = body.append('g').classed('datalines', true);

    return draw;
  };

  draw.data = function(_) {
    if (!arguments.length) return data;
    data = _;
    return draw;
  };

  draw.redraw = function(){
    draw();
    return draw;
  };

  draw.draw = function(){
    draw();
    return draw;
  };

  init(config || {});

  return draw;
};
