!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.parallelCoordinatesChart=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Borrows heavily from http://bl.ocks.org/mbostock/7586334
_dereq_('./customEventPolyfill');


var defaultInterpolator = _dereq_('./interpolator'),
  defaultColorScaleGenerator = _dereq_('./defaultColorScaleGenerator');

// returns the numerical extents of the dimension values across the data set
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
    muteFilter,
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
    mutedDataLines,
    highlightedDataLines,
    dimensionDragging,
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

    if('dimensions' in config) draw.dimensions(config.dimensions);

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
    if (!dimensionDragging) {
      return function() {}; // noop
    }

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

  function brushEndHandler() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });

    function isVisible(d) {
      return actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      });
    }

    var selected = data.filter(isVisible);
    redrawPathGroups();

    var filters = {};
    actives.forEach(function(dimension, i){
      filters[dimension] = extents[i];
    });

    onFiltersChange(filters, selected);
  }

  // Handles a brush event, toggling the display of lines.
  function brush() {
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

  function redrawPathGroups() {
    var actives = dimensions.filter(function(p) { return !y[p].brush.empty(); }),
        extents = actives.map(function(p) { return y[p].brush.extent(); });

    function isVisible(d) {
      return actives.every(function(p, i) {
        return extents[i][0] <= d[p] && d[p] <= extents[i][1];
      });
    }

    var highlighted = [],
      muted = [],
      normal = [];

    data.forEach(function(d) {
      if (highlightFilter && highlightFilter(d)) {
        highlighted.push(d);
      } else if (muteFilter && muteFilter(d) || !isVisible(d)) {
        muted.push(d);
      } else {
        normal.push(d);
      }
    });

    function getId(d) {
      return d.id;
    }

    // create new paths based off the id property for each datum
    var mutedPaths = mutedDataLines.selectAll('path')
      .data(muted, getId);
    mutedPaths.enter().append('path');
    mutedPaths.exit().remove();

    var normalPaths = dataLines.selectAll('path')
      .data(normal, getId);
    normalPaths.enter().append('path');
    normalPaths.exit().remove();

    var highlightedPaths = highlightedDataLines.selectAll('path')
      .data(highlighted, getId);
    highlightedPaths.enter().append('path');
    highlightedPaths.exit().remove();
/*
    highlightedPaths.enter().transition()
      .duration(100)
      .delay(function (d, i){ return 10 * i;}).selectAll('path').attr('d', path);
*/

    // Redraw each path and assign a highlighted state given the highlightFilter
    // and a muted state given the muteFilter
    normalPaths.attr('d', path);
    mutedPaths.attr('d', path);
    highlightedPaths.attr('d', path);

    var paths = svg.selectAll('g.datalines path').attr('d', path);
    if(!paths || !paths.length) return;

    if(!selectedProperty) {
      paths.style('stroke', '');
    } else {
      var color = colorGenerator(selectedProperty, data);
      highlightedPaths.style('stroke', '');
      normalPaths.style('stroke', function(d){
        return color(d[selectedProperty]);
      });
      mutedPaths.style('stroke', function(d){
        return color(d[selectedProperty]);
      });
    }
  }

  function draw(){
    svg.attr('width', width)
      .attr('height', height);

    // base svg
    body.attr('transform', 'translate(' + margin[3] + ',' + margin[0] + ')');

    dragging = {};

    // create a scale and a brush for each dimension being visualized
    dimensions.forEach(function(d) {
      y[d].range([innerHeight, 0])
        .domain(domainGenerator(d, data));
    });

    redrawPathGroups();

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

    if (dimensions) x.domain(dimensions);

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

  draw.dimensions = function(_){
    if (!arguments.length) return dimensions;
    dimensions = _;

    // If no dimensions are defined, use the properties of the first datum as
    // the list of dimensions to visualize. This assumes homogeneity in the
    // dimensionality of the data.
    if(!dimensions) dimensions = Object.keys(data[0]);

    // The 'x' axis represents the various dimensions which will be visualized
    // where each 'tick' in the x-axis is really another y-axis.
    x.domain(dimensions);

    y = {};
    // create a scale and a brush for each dimension being visualized
    dimensions.forEach(function(d) {
      y[d] = d3.scale.linear();

      y[d].brush = d3.svg.brush().y(y[d])
          .on('brushstart', brushStartHandler)
          .on('brush', brush)
          .on('brushend', brushEndHandler);
    });

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

  draw.muteFilter = function(_) {
    if (!arguments.length) return muteFilter;

    muteFilter = _;

    return draw;
  };

  draw.highlightFilter = function(_) {
    if (!arguments.length) return highlightFilter;

    highlightFilter = _;

    return draw;
  };

  draw.dimensionDragging = function(_) {
    if (!arguments.length) return dimensionDragging;

    dimensionDragging = _;

    return draw;
  };

  draw.filter = function(dimension, extent){
    if(!arguments.length) return;
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

    redrawPathGroups();

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

    mutedDataLines = body.append('g').classed('muted datalines', true);
    dataLines = body.append('g').classed('datalines', true);
    highlightedDataLines = body.append('g').classed('highlighted datalines', true);

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

},{"./customEventPolyfill":2,"./defaultColorScaleGenerator":3,"./interpolator":4}],2:[function(_dereq_,module,exports){
// For IE9+
(function () {
  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();
},{}],3:[function(_dereq_,module,exports){
module.exports = function colorScaleGenerator(property, data){
  return d3.scale.linear()
    .domain(d3.extent(data, function(d) { return +d[property]; }))
    .range(['hsl(120, 40%, 50%)', 'hsl(0, 60%, 50%)']) // red to green
    .interpolate(d3.interpolateHsl);
};

},{}],4:[function(_dereq_,module,exports){
module.exports = function interpolator(points){
  var point, 
    action = '', 
    lineBuilder = [];

  for(var i = 0; i < points.length - 1; i++){
    point = points[i];

    if(isNaN(point[1])){
      if(action !== '') action = 'M';
    } else {
      lineBuilder.push(action, point);
      action = 'L';
    }
  }
  
  point = points[points.length - 1];
  if(!isNaN(point[1])){
    lineBuilder.push(action, point);
  }

  return lineBuilder.join('');
};
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvbm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvY3VzdG9tRXZlbnRQb2x5ZmlsbC5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2RlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yLmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBCb3Jyb3dzIGhlYXZpbHkgZnJvbSBodHRwOi8vYmwub2Nrcy5vcmcvbWJvc3RvY2svNzU4NjMzNFxucmVxdWlyZSgnLi9jdXN0b21FdmVudFBvbHlmaWxsJyk7XG5cblxudmFyIGRlZmF1bHRJbnRlcnBvbGF0b3IgPSByZXF1aXJlKCcuL2ludGVycG9sYXRvcicpLFxuICBkZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvciA9IHJlcXVpcmUoJy4vZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3InKTtcblxuLy8gcmV0dXJucyB0aGUgbnVtZXJpY2FsIGV4dGVudHMgb2YgdGhlIGRpbWVuc2lvbiB2YWx1ZXMgYWNyb3NzIHRoZSBkYXRhIHNldFxuZnVuY3Rpb24gZGVmYXVsdERvbWFpbkdlbmVyYXRvcihkaW1lbnNpb24sIGRhdGEpe1xuICByZXR1cm4gZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICtkW2RpbWVuc2lvbl07IH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHBhcmFsbGVsQ29vcmRpbmF0ZXNDaGFydChjb25maWcpe1xuXG4gIC8vIENvbmZpZ3VyYWJsZSB2YXJpYWJsZXNcbiAgdmFyIG1hcmdpbixcbiAgICB3aWR0aCxcbiAgICBoZWlnaHQsXG4gICAgc2VsZWN0ZWRQcm9wZXJ0eSxcbiAgICBoaWdobGlnaHRlZCxcbiAgICBoaWdobGlnaHRGaWx0ZXIsXG4gICAgbXV0ZUZpbHRlcixcbiAgICBmaWx0ZXJzLFxuICAgIGNvbG9yR2VuZXJhdG9yLFxuICAgIGRvbWFpbkdlbmVyYXRvcixcbiAgICBkaW1lbnNpb25zLFxuICAgIGludGVycG9sYXRvcixcbiAgICBjb250YWluZXIsXG4gICAgb25GaWx0ZXJzQ2hhbmdlID0gZnVuY3Rpb24gKCkge30sXG4gICAgb25IaWdobGlnaHRDaGFuZ2UgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAvLyBHZW5lcmF0ZWQgdmFyaWFibGVzXG4gIHZhciBpbm5lcldpZHRoLFxuICAgIGlubmVySGVpZ2h0LFxuICAgIHgsXG4gICAgeSxcbiAgICBkcmFnZ2luZyxcbiAgICBkYXRhLFxuICAgIHN2ZyxcbiAgICBib2R5LFxuICAgIGRhdGFMaW5lcyxcbiAgICBtdXRlZERhdGFMaW5lcyxcbiAgICBoaWdobGlnaHRlZERhdGFMaW5lcyxcbiAgICBkaW1lbnNpb25EcmFnZ2luZyxcbiAgICBsaW5lO1xuXG4gIHZhciBheGlzID0gZDMuc3ZnLmF4aXMoKS5vcmllbnQoJ2xlZnQnKTtcblxuICBmdW5jdGlvbiBpbml0KGNvbmZpZyl7XG4gICAgaWYoJ21hcmdpbicgaW4gY29uZmlnKSBkcmF3Lm1hcmdpbihjb25maWcubWFyZ2luKTtcbiAgICBlbHNlIGRyYXcubWFyZ2luKFszMCwgMTAsIDEwLCAxMF0pOyAvLyBkZWZhdWx0XG5cbiAgICBpZignd2lkdGgnIGluIGNvbmZpZykgZHJhdy53aWR0aChjb25maWcud2lkdGgpO1xuICAgIGVsc2UgZHJhdy53aWR0aCgxNTYwKTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ2hlaWdodCcgaW4gY29uZmlnKSBkcmF3LmhlaWdodChjb25maWcuaGVpZ2h0KTtcbiAgICBlbHNlIGRyYXcuaGVpZ2h0KDUwMCk7IC8vIGRlZmF1bHQ7XG5cbiAgICBpZignZG9tYWluJyBpbiBjb25maWcpIGRyYXcuZG9tYWluKGNvbmZpZy5kb21haW4pO1xuICAgIGVsc2UgZHJhdy5kb21haW4oZGVmYXVsdERvbWFpbkdlbmVyYXRvcik7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdoaWdobGlnaHQnIGluIGNvbmZpZykgZHJhdy5oaWdobGlnaHQoY29uZmlnLmhpZ2hsaWdodCk7XG4gICAgZWxzZSBkcmF3LmhpZ2hsaWdodCgnJyk7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdmaWx0ZXJzJyBpbiBjb25maWcpIGRyYXcuZmlsdGVycyhjb25maWcuZmlsdGVycyk7XG4gICAgZWxzZSBkcmF3LmZpbHRlcnMoe30pOyAvLyBkZWZhdWx0XG5cbiAgICBpZignaW50ZXJwb2xhdG9yJyBpbiBjb25maWcpIGRyYXcuaW50ZXJwb2xhdG9yKGNvbmZpZy5pbnRlcnBvbGF0b3IpO1xuICAgIGVsc2UgZHJhdy5pbnRlcnBvbGF0b3IoZGVmYXVsdEludGVycG9sYXRvcik7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdjb2xvcicgaW4gY29uZmlnKSBkcmF3LmNvbG9yKGNvbmZpZy5jb2xvcik7XG4gICAgZWxzZSBkcmF3LmNvbG9yKGRlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yKTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ2RpbWVuc2lvbnMnIGluIGNvbmZpZykgZHJhdy5kaW1lbnNpb25zKGNvbmZpZy5kaW1lbnNpb25zKTtcblxuICAgIGlmKCdvbkZpbHRlcnNDaGFuZ2UnIGluIGNvbmZpZykge1xuICAgICAgZHJhdy5vbkZpbHRlcnNDaGFuZ2UoY29uZmlnLm9uRmlsdGVyc0NoYW5nZSk7XG4gICAgfVxuXG4gICAgaWYoJ29uSGlnaGxpZ2h0Q2hhbmdlJyBpbiBjb25maWcpIHtcbiAgICAgIGRyYXcub25IaWdobGlnaHRDaGFuZ2UoY29uZmlnLm9uSGlnaGxpZ2h0Q2hhbmdlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVIaWdobGlnaHQoc3ZnKXtcbiAgICBpZighc3ZnKSByZXR1cm47XG5cbiAgICBzdmcuc2VsZWN0QWxsKCcuZGltZW5zaW9uJykuY2xhc3NlZCgnc2VsZWN0ZWQnLCBmdW5jdGlvbihkKSB7XG4gICAgICByZXR1cm4gZCA9PT0gc2VsZWN0ZWRQcm9wZXJ0eTtcbiAgICB9KTtcblxuICAgIHZhciBwYXRocyA9IHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKTtcbiAgICBpZighc2VsZWN0ZWRQcm9wZXJ0eSkgcmV0dXJuIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XG4gICAgaWYoIXBhdGhzIHx8ICFwYXRocy5sZW5ndGgpIHJldHVybjtcblxuICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIGRhdGEpO1xuICAgIHBhdGhzLnN0eWxlKCdzdHJva2UnLCBmdW5jdGlvbihkKXtcbiAgICAgIHJldHVybiBjb2xvcihkW3NlbGVjdGVkUHJvcGVydHldKTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZURyYWdnYWJsZSgpe1xuICAgIGlmICghZGltZW5zaW9uRHJhZ2dpbmcpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHt9OyAvLyBub29wXG4gICAgfVxuXG4gICAgcmV0dXJuIGQzLmJlaGF2aW9yLmRyYWcoKVxuICAgICAgLm9uKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihkKSB7XG4gICAgICAgIGRyYWdnaW5nW2RdID0gdGhpcy5fX29yaWdpbl9fID0geChkKTtcbiAgICAgIH0pXG4gICAgICAub24oJ2RyYWcnLCBmdW5jdGlvbihkKSB7XG4gICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4gICAgICAgIGRpbWVuc2lvbnMuc29ydChmdW5jdGlvbihhLCBiKSB7IHJldHVybiBwb3NpdGlvbihhKSAtIHBvc2l0aW9uKGIpOyB9KTtcbiAgICAgICAgeC5kb21haW4oZGltZW5zaW9ucyk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGltZW5zaW9uJykuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgcG9zaXRpb24oZCkgKyAnKSc7IH0pO1xuICAgICAgfSlcbiAgICAgIC5vbignZHJhZ2VuZCcsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19vcmlnaW5fXztcbiAgICAgICAgZGVsZXRlIGRyYWdnaW5nW2RdO1xuICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJyk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBXaGVuIGJydXNoaW5nLCBkb27igJl0IHRyaWdnZXIgYXhpcyBkcmFnZ2luZy5cbiAgZnVuY3Rpb24gYnJ1c2hTdGFydEhhbmRsZXIoKSB7XG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cblxuICBmdW5jdGlvbiBicnVzaEVuZEhhbmRsZXIoKSB7XG4gICAgdmFyIGFjdGl2ZXMgPSBkaW1lbnNpb25zLmZpbHRlcihmdW5jdGlvbihwKSB7IHJldHVybiAheVtwXS5icnVzaC5lbXB0eSgpOyB9KSxcbiAgICAgICAgZXh0ZW50cyA9IGFjdGl2ZXMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHlbcF0uYnJ1c2guZXh0ZW50KCk7IH0pO1xuXG4gICAgZnVuY3Rpb24gaXNWaXNpYmxlKGQpIHtcbiAgICAgIHJldHVybiBhY3RpdmVzLmV2ZXJ5KGZ1bmN0aW9uKHAsIGkpIHtcbiAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgc2VsZWN0ZWQgPSBkYXRhLmZpbHRlcihpc1Zpc2libGUpO1xuICAgIHJlZHJhd1BhdGhHcm91cHMoKTtcblxuICAgIHZhciBmaWx0ZXJzID0ge307XG4gICAgYWN0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbiwgaSl7XG4gICAgICBmaWx0ZXJzW2RpbWVuc2lvbl0gPSBleHRlbnRzW2ldO1xuICAgIH0pO1xuXG4gICAgb25GaWx0ZXJzQ2hhbmdlKGZpbHRlcnMsIHNlbGVjdGVkKTtcbiAgfVxuXG4gIC8vIEhhbmRsZXMgYSBicnVzaCBldmVudCwgdG9nZ2xpbmcgdGhlIGRpc3BsYXkgb2YgbGluZXMuXG4gIGZ1bmN0aW9uIGJydXNoKCkge1xuICB9XG5cbiAgZnVuY3Rpb24gcG9zaXRpb24oZCkge1xuICAgIC8vIGlmIHdlJ3JlIGN1cnJlbnRseSBkcmFnZ2luZyB0aGUgYXhpcyByZXR1cm4gdGhlIGRyYWcgcG9zaXRpb25cbiAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBub3JtYWwgeC1heGlzIHBvc2l0aW9uXG4gICAgdmFyIHYgPSBkcmFnZ2luZ1tkXTtcbiAgICByZXR1cm4gdiA9PSBudWxsID8geChkKSA6IHY7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRoZSBwYXRoIGZvciBhIGdpdmVuIGRhdGEgcG9pbnQuXG4gIGZ1bmN0aW9uIHBhdGgoZCkge1xuICAgIHJldHVybiBsaW5lKGRpbWVuc2lvbnMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgIHJldHVybiBbcG9zaXRpb24ocCksIHlbcF0oZFtwXSldO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlZHJhd1BhdGhHcm91cHMoKSB7XG4gICAgdmFyIGFjdGl2ZXMgPSBkaW1lbnNpb25zLmZpbHRlcihmdW5jdGlvbihwKSB7IHJldHVybiAheVtwXS5icnVzaC5lbXB0eSgpOyB9KSxcbiAgICAgICAgZXh0ZW50cyA9IGFjdGl2ZXMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHlbcF0uYnJ1c2guZXh0ZW50KCk7IH0pO1xuXG4gICAgZnVuY3Rpb24gaXNWaXNpYmxlKGQpIHtcbiAgICAgIHJldHVybiBhY3RpdmVzLmV2ZXJ5KGZ1bmN0aW9uKHAsIGkpIHtcbiAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgaGlnaGxpZ2h0ZWQgPSBbXSxcbiAgICAgIG11dGVkID0gW10sXG4gICAgICBub3JtYWwgPSBbXTtcblxuICAgIGRhdGEuZm9yRWFjaChmdW5jdGlvbihkKSB7XG4gICAgICBpZiAoaGlnaGxpZ2h0RmlsdGVyICYmIGhpZ2hsaWdodEZpbHRlcihkKSkge1xuICAgICAgICBoaWdobGlnaHRlZC5wdXNoKGQpO1xuICAgICAgfSBlbHNlIGlmIChtdXRlRmlsdGVyICYmIG11dGVGaWx0ZXIoZCkgfHwgIWlzVmlzaWJsZShkKSkge1xuICAgICAgICBtdXRlZC5wdXNoKGQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbm9ybWFsLnB1c2goZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBnZXRJZChkKSB7XG4gICAgICByZXR1cm4gZC5pZDtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgbmV3IHBhdGhzIGJhc2VkIG9mZiB0aGUgaWQgcHJvcGVydHkgZm9yIGVhY2ggZGF0dW1cbiAgICB2YXIgbXV0ZWRQYXRocyA9IG11dGVkRGF0YUxpbmVzLnNlbGVjdEFsbCgncGF0aCcpXG4gICAgICAuZGF0YShtdXRlZCwgZ2V0SWQpO1xuICAgIG11dGVkUGF0aHMuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKTtcbiAgICBtdXRlZFBhdGhzLmV4aXQoKS5yZW1vdmUoKTtcblxuICAgIHZhciBub3JtYWxQYXRocyA9IGRhdGFMaW5lcy5zZWxlY3RBbGwoJ3BhdGgnKVxuICAgICAgLmRhdGEobm9ybWFsLCBnZXRJZCk7XG4gICAgbm9ybWFsUGF0aHMuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKTtcbiAgICBub3JtYWxQYXRocy5leGl0KCkucmVtb3ZlKCk7XG5cbiAgICB2YXIgaGlnaGxpZ2h0ZWRQYXRocyA9IGhpZ2hsaWdodGVkRGF0YUxpbmVzLnNlbGVjdEFsbCgncGF0aCcpXG4gICAgICAuZGF0YShoaWdobGlnaHRlZCwgZ2V0SWQpO1xuICAgIGhpZ2hsaWdodGVkUGF0aHMuZW50ZXIoKS5hcHBlbmQoJ3BhdGgnKTtcbiAgICBoaWdobGlnaHRlZFBhdGhzLmV4aXQoKS5yZW1vdmUoKTtcbi8qXG4gICAgaGlnaGxpZ2h0ZWRQYXRocy5lbnRlcigpLnRyYW5zaXRpb24oKVxuICAgICAgLmR1cmF0aW9uKDEwMClcbiAgICAgIC5kZWxheShmdW5jdGlvbiAoZCwgaSl7IHJldHVybiAxMCAqIGk7fSkuc2VsZWN0QWxsKCdwYXRoJykuYXR0cignZCcsIHBhdGgpO1xuKi9cblxuICAgIC8vIFJlZHJhdyBlYWNoIHBhdGggYW5kIGFzc2lnbiBhIGhpZ2hsaWdodGVkIHN0YXRlIGdpdmVuIHRoZSBoaWdobGlnaHRGaWx0ZXJcbiAgICAvLyBhbmQgYSBtdXRlZCBzdGF0ZSBnaXZlbiB0aGUgbXV0ZUZpbHRlclxuICAgIG5vcm1hbFBhdGhzLmF0dHIoJ2QnLCBwYXRoKTtcbiAgICBtdXRlZFBhdGhzLmF0dHIoJ2QnLCBwYXRoKTtcbiAgICBoaWdobGlnaHRlZFBhdGhzLmF0dHIoJ2QnLCBwYXRoKTtcblxuICAgIHZhciBwYXRocyA9IHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4gICAgaWYoIXBhdGhzIHx8ICFwYXRocy5sZW5ndGgpIHJldHVybjtcblxuICAgIGlmKCFzZWxlY3RlZFByb3BlcnR5KSB7XG4gICAgICBwYXRocy5zdHlsZSgnc3Ryb2tlJywgJycpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgY29sb3IgPSBjb2xvckdlbmVyYXRvcihzZWxlY3RlZFByb3BlcnR5LCBkYXRhKTtcbiAgICAgIGhpZ2hsaWdodGVkUGF0aHMuc3R5bGUoJ3N0cm9rZScsICcnKTtcbiAgICAgIG5vcm1hbFBhdGhzLnN0eWxlKCdzdHJva2UnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgcmV0dXJuIGNvbG9yKGRbc2VsZWN0ZWRQcm9wZXJ0eV0pO1xuICAgICAgfSk7XG4gICAgICBtdXRlZFBhdGhzLnN0eWxlKCdzdHJva2UnLCBmdW5jdGlvbihkKXtcbiAgICAgICAgcmV0dXJuIGNvbG9yKGRbc2VsZWN0ZWRQcm9wZXJ0eV0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZHJhdygpe1xuICAgIHN2Zy5hdHRyKCd3aWR0aCcsIHdpZHRoKVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCk7XG5cbiAgICAvLyBiYXNlIHN2Z1xuICAgIGJvZHkuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgbWFyZ2luWzNdICsgJywnICsgbWFyZ2luWzBdICsgJyknKTtcblxuICAgIGRyYWdnaW5nID0ge307XG5cbiAgICAvLyBjcmVhdGUgYSBzY2FsZSBhbmQgYSBicnVzaCBmb3IgZWFjaCBkaW1lbnNpb24gYmVpbmcgdmlzdWFsaXplZFxuICAgIGRpbWVuc2lvbnMuZm9yRWFjaChmdW5jdGlvbihkKSB7XG4gICAgICB5W2RdLnJhbmdlKFtpbm5lckhlaWdodCwgMF0pXG4gICAgICAgIC5kb21haW4oZG9tYWluR2VuZXJhdG9yKGQsIGRhdGEpKTtcbiAgICB9KTtcblxuICAgIHJlZHJhd1BhdGhHcm91cHMoKTtcblxuICAgIC8vIEFkZCBhIGdyb3VwIGVsZW1lbnQgZm9yIGVhY2ggZGltZW5zaW9uLlxuICAgIHZhciBkaW1lbnNpb25Hcm91cCA9IGJvZHlcbiAgICAgIC5zZWxlY3RBbGwoJ2cuZGltZW5zaW9uJylcbiAgICAgIC5kYXRhKGRpbWVuc2lvbnMpO1xuXG5cbiAgICB2YXIgbmV3RGltZW5zaW9ucyA9IGRpbWVuc2lvbkdyb3VwLmVudGVyKClcbiAgICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAgICAgLmNsYXNzZWQoJ2RpbWVuc2lvbicsIHRydWUpXG4gICAgICAgICAgLmNhbGwoY3JlYXRlRHJhZ2dhYmxlKCkpO1xuXG4gICAgZGltZW5zaW9uR3JvdXAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkge1xuICAgICAgcmV0dXJuICd0cmFuc2xhdGUoJyArIHgoZCkgKyAnKSc7XG4gICAgfSk7XG5cbiAgICAvLyBBZGQgYW4gYXhpcyBhbmQgdGl0bGUuXG4gICAgbmV3RGltZW5zaW9ucy5hcHBlbmQoJ2cnKVxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcycpXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgLmF0dHIoJ3RleHQtYW5jaG9yJywgJ21pZGRsZScpXG4gICAgICAgIC5hdHRyKCd5JywgLTkpXG4gICAgICAgIC50ZXh0KFN0cmluZylcbiAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKGQpe1xuICAgICAgICAgIGlmIChkMy5ldmVudC5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47IC8vIGNsaWNrIHN1cHByZXNzZWRcblxuICAgICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpIGQgPSAnJztcbiAgICAgICAgICBlbHNlIGRyYXcuaGlnaGxpZ2h0KGQpO1xuICAgICAgICB9KTtcblxuICAgIGRpbWVuc2lvbkdyb3VwLnNlbGVjdEFsbCgnZy5heGlzJylcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHsgZDMuc2VsZWN0KHRoaXMpLmNhbGwoYXhpcy5zY2FsZSh5W2RdKSk7IH0pO1xuXG4gICAgLy8gQWRkIGFuZCBzdG9yZSBhIGJydXNoIGZvciBlYWNoIGF4aXMuXG4gICAgbmV3RGltZW5zaW9ucy5hcHBlbmQoJ2cnKVxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYnJ1c2gnKTtcblxuICAgIGRpbWVuc2lvbkdyb3VwLnNlbGVjdEFsbCgnZy5icnVzaCcpXG4gICAgICAuZWFjaChmdW5jdGlvbihkKSB7XG4gICAgICAgIGQzLnNlbGVjdCh0aGlzKS5jYWxsKHlbZF0uYnJ1c2gpO1xuICAgICAgfSlcbiAgICAgIC5zZWxlY3RBbGwoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCAtOClcbiAgICAgIC5hdHRyKCd3aWR0aCcsIDE2KTtcblxuICAgIGRyYXcuaGlnaGxpZ2h0KHNlbGVjdGVkUHJvcGVydHkpO1xuICAgIGRyYXcuZmlsdGVycyhmaWx0ZXJzKTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9XG5cbiAgZHJhdy53aWR0aCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHdpZHRoO1xuICAgIHdpZHRoID0gXztcbiAgICBpbm5lcldpZHRoID0gd2lkdGggLSBtYXJnaW5bMV0gLSBtYXJnaW5bM107XG4gICAgeCA9IGQzLnNjYWxlLm9yZGluYWwoKS5yYW5nZVBvaW50cyhbMCwgaW5uZXJXaWR0aF0sIDAuOCk7XG5cbiAgICBpZiAoZGltZW5zaW9ucykgeC5kb21haW4oZGltZW5zaW9ucyk7XG5cbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhlaWdodCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhlaWdodDtcbiAgICBoZWlnaHQgPSBfO1xuICAgIGlubmVySGVpZ2h0ID0gaGVpZ2h0IC0gbWFyZ2luWzBdIC0gbWFyZ2luWzJdO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcubWFyZ2luID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gbWFyZ2luO1xuICAgIG1hcmdpbiA9IF87XG4gICAgZHJhdy53aWR0aCh3aWR0aCk7XG4gICAgZHJhdy5oZWlnaHQoaGVpZ2h0KTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmRpbWVuc2lvbnMgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaW1lbnNpb25zO1xuICAgIGRpbWVuc2lvbnMgPSBfO1xuXG4gICAgLy8gSWYgbm8gZGltZW5zaW9ucyBhcmUgZGVmaW5lZCwgdXNlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBmaXJzdCBkYXR1bSBhc1xuICAgIC8vIHRoZSBsaXN0IG9mIGRpbWVuc2lvbnMgdG8gdmlzdWFsaXplLiBUaGlzIGFzc3VtZXMgaG9tb2dlbmVpdHkgaW4gdGhlXG4gICAgLy8gZGltZW5zaW9uYWxpdHkgb2YgdGhlIGRhdGEuXG4gICAgaWYoIWRpbWVuc2lvbnMpIGRpbWVuc2lvbnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcblxuICAgIC8vIFRoZSAneCcgYXhpcyByZXByZXNlbnRzIHRoZSB2YXJpb3VzIGRpbWVuc2lvbnMgd2hpY2ggd2lsbCBiZSB2aXN1YWxpemVkXG4gICAgLy8gd2hlcmUgZWFjaCAndGljaycgaW4gdGhlIHgtYXhpcyBpcyByZWFsbHkgYW5vdGhlciB5LWF4aXMuXG4gICAgeC5kb21haW4oZGltZW5zaW9ucyk7XG5cbiAgICB5ID0ge307XG4gICAgLy8gY3JlYXRlIGEgc2NhbGUgYW5kIGEgYnJ1c2ggZm9yIGVhY2ggZGltZW5zaW9uIGJlaW5nIHZpc3VhbGl6ZWRcbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgeVtkXSA9IGQzLnNjYWxlLmxpbmVhcigpO1xuXG4gICAgICB5W2RdLmJydXNoID0gZDMuc3ZnLmJydXNoKCkueSh5W2RdKVxuICAgICAgICAgIC5vbignYnJ1c2hzdGFydCcsIGJydXNoU3RhcnRIYW5kbGVyKVxuICAgICAgICAgIC5vbignYnJ1c2gnLCBicnVzaClcbiAgICAgICAgICAub24oJ2JydXNoZW5kJywgYnJ1c2hFbmRIYW5kbGVyKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuZG9tYWluID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZG9tYWluR2VuZXJhdG9yO1xuICAgIGRvbWFpbkdlbmVyYXRvciA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5jb2xvciA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbG9yR2VuZXJhdG9yO1xuICAgIGNvbG9yR2VuZXJhdG9yID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmludGVycG9sYXRvciA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGludGVycG9sYXRvcjtcbiAgICBpbnRlcnBvbGF0b3IgPSBfO1xuICAgIGxpbmUgPSBkMy5zdmcubGluZSgpLmludGVycG9sYXRlKGludGVycG9sYXRvcik7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5oaWdobGlnaHRlZCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhpZ2hsaWdodGVkO1xuICAgIGhpZ2hsaWdodGVkID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3Lm9uRmlsdGVyc0NoYW5nZSA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9uRmlsdGVyc0NoYW5nZTtcbiAgICBvbkZpbHRlcnNDaGFuZ2UgPSBfO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcub25IaWdobGlnaHRDaGFuZ2UgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvbkhpZ2hsaWdodENoYW5nZTtcbiAgICBvbkhpZ2hsaWdodENoYW5nZSA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5oaWdobGlnaHQgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBzZWxlY3RlZFByb3BlcnR5O1xuXG4gICAgaWYoc2VsZWN0ZWRQcm9wZXJ0eSAhPT0gXyl7XG4gICAgICBzZWxlY3RlZFByb3BlcnR5ID0gXztcblxuICAgICAgb25IaWdobGlnaHRDaGFuZ2Uoc2VsZWN0ZWRQcm9wZXJ0eSk7XG4gICAgfVxuXG4gICAgdXBkYXRlSGlnaGxpZ2h0KHN2Zyk7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5tdXRlRmlsdGVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG11dGVGaWx0ZXI7XG5cbiAgICBtdXRlRmlsdGVyID0gXztcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuaGlnaGxpZ2h0RmlsdGVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhpZ2hsaWdodEZpbHRlcjtcblxuICAgIGhpZ2hsaWdodEZpbHRlciA9IF87XG5cbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmRpbWVuc2lvbkRyYWdnaW5nID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpbWVuc2lvbkRyYWdnaW5nO1xuXG4gICAgZGltZW5zaW9uRHJhZ2dpbmcgPSBfO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5maWx0ZXIgPSBmdW5jdGlvbihkaW1lbnNpb24sIGV4dGVudCl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybjtcbiAgICB2YXIgY3VycmVudCA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcblxuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpe1xuICAgICAgaWYoY3VycmVudFswXSA9PT0gY3VycmVudFsxXSkgcmV0dXJuOyAvLyB1bmRlZmluZWQgaWYgdW5zZXRcbiAgICAgIHJldHVybiBjdXJyZW50O1xuICAgIH1cblxuICAgIGlmKCFleHRlbnQpIGV4dGVudCA9IFswLDBdOyAvLyB0aGlzIGhpZGVzIGJydXNoXG5cbiAgICBpZihjdXJyZW50WzBdID09PSBleHRlbnRbMF0gJiYgY3VycmVudFsxXSA9PT0gZXh0ZW50WzFdKSByZXR1cm4gZHJhdztcblxuICAgIHN2Zy5zZWxlY3RBbGwoJy5icnVzaCcpLmZpbHRlcihmdW5jdGlvbihkKXtcbiAgICAgIHJldHVybiBkID09PSBkaW1lbnNpb247XG4gICAgfSkuY2FsbCh5W2RpbWVuc2lvbl0uYnJ1c2guZXh0ZW50KGV4dGVudCkpLmNhbGwoYnJ1c2gpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5maWx0ZXJzID0gZnVuY3Rpb24obmV3RmlsdGVycyl7XG4gICAgaWYgKCFuZXdGaWx0ZXJzKSBuZXdGaWx0ZXJzID0ge307XG4gICAgZmlsdGVycyA9IG5ld0ZpbHRlcnM7XG4gICAgdmFyIGN1cnJlbnQgPSB7fTtcbiAgICB2YXIgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKHkgfHwge30pO1xuXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICAvLyBza2lwIHVuc2V0IGZpbHRlcnNcbiAgICAgIGlmKHlbZGltZW5zaW9uXS5icnVzaC5lbXB0eSgpKSByZXR1cm47XG5cbiAgICAgIGN1cnJlbnRbZGltZW5zaW9uXSA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcbiAgICB9KTtcblxuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcblxuICAgIHZhciBzYW1lID0gZGltZW5zaW9ucy5ldmVyeShmdW5jdGlvbihkaW1lbnNpb24pe1xuICAgICAgaWYoZGltZW5zaW9uIGluIG5ld0ZpbHRlcnMpe1xuICAgICAgICBpZighKGRpbWVuc2lvbiBpbiBjdXJyZW50KSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHJldHVybiAoY3VycmVudFtkaW1lbnNpb25dWzBdID09PSBuZXdGaWx0ZXJzW2RpbWVuc2lvbl1bMF0gJiZcbiAgICAgICAgICAgICAgICBjdXJyZW50W2RpbWVuc2lvbl1bMV0gPT09IG5ld0ZpbHRlcnNbZGltZW5zaW9uXVsxXSk7XG4gICAgICB9IGVsc2UgcmV0dXJuICEoZGltZW5zaW9uIGluIGN1cnJlbnQpO1xuICAgIH0pO1xuXG4gICAgaWYoc2FtZSkgcmV0dXJuIGRyYXc7XG5cbiAgICAvLyBaZXJvIG91dCBhbnkgaW1wbGljaXRseSBleGNsdWRlZCBkaW1lbnNpb25zXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICBpZihkaW1lbnNpb24gaW4gbmV3RmlsdGVycyl7XG4gICAgICAgIHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQobmV3RmlsdGVyc1tkaW1lbnNpb25dKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHlbZGltZW5zaW9uXS5icnVzaC5jbGVhcigpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmJydXNoJykuZWFjaChmdW5jdGlvbihkaW1lbnNpb24pe1xuICAgICAgZDMuc2VsZWN0KHRoaXMpLmNhbGwoeVtkaW1lbnNpb25dLmJydXNoKTtcbiAgICB9KTtcblxuICAgIHN2Zy5jYWxsKGJydXNoKTtcblxuICAgIHJlZHJhd1BhdGhHcm91cHMoKTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuY29udGFpbmVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICBjb250YWluZXIgPSBfO1xuXG4gICAgc3ZnID0gZDMuc2VsZWN0KGNvbnRhaW5lcikuYXBwZW5kKCdzdmcnKVxuICAgICAgLmNsYXNzZWQoJ3BhcmFsbGVsLWNvb3JkaW5hdGVzLWNoYXJ0JywgdHJ1ZSk7XG5cbiAgICBib2R5ID0gc3ZnLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnYm9keScpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLDApJyk7XG5cbiAgICBtdXRlZERhdGFMaW5lcyA9IGJvZHkuYXBwZW5kKCdnJykuY2xhc3NlZCgnbXV0ZWQgZGF0YWxpbmVzJywgdHJ1ZSk7XG4gICAgZGF0YUxpbmVzID0gYm9keS5hcHBlbmQoJ2cnKS5jbGFzc2VkKCdkYXRhbGluZXMnLCB0cnVlKTtcbiAgICBoaWdobGlnaHRlZERhdGFMaW5lcyA9IGJvZHkuYXBwZW5kKCdnJykuY2xhc3NlZCgnaGlnaGxpZ2h0ZWQgZGF0YWxpbmVzJywgdHJ1ZSk7XG5cbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmRhdGEgPSBmdW5jdGlvbihfKSB7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZGF0YTtcbiAgICBkYXRhID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LnJlZHJhdyA9IGZ1bmN0aW9uKCl7XG4gICAgZHJhdygpO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuZHJhdyA9IGZ1bmN0aW9uKCl7XG4gICAgZHJhdygpO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGluaXQoY29uZmlnIHx8IHt9KTtcblxuICByZXR1cm4gZHJhdztcbn07XG4iLCIvLyBGb3IgSUU5K1xuKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKCBldmVudCwgcGFyYW1zICkge1xuICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7IGJ1YmJsZXM6IGZhbHNlLCBjYW5jZWxhYmxlOiBmYWxzZSwgZGV0YWlsOiB1bmRlZmluZWQgfTtcbiAgICB2YXIgZXZ0ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcbiAgICBldnQuaW5pdEN1c3RvbUV2ZW50KCBldmVudCwgcGFyYW1zLmJ1YmJsZXMsIHBhcmFtcy5jYW5jZWxhYmxlLCBwYXJhbXMuZGV0YWlsICk7XG4gICAgcmV0dXJuIGV2dDtcbiAgIH1cblxuICBDdXN0b21FdmVudC5wcm90b3R5cGUgPSB3aW5kb3cuRXZlbnQucHJvdG90eXBlO1xuXG4gIHdpbmRvdy5DdXN0b21FdmVudCA9IEN1c3RvbUV2ZW50O1xufSkoKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbG9yU2NhbGVHZW5lcmF0b3IocHJvcGVydHksIGRhdGEpe1xuICByZXR1cm4gZDMuc2NhbGUubGluZWFyKClcbiAgICAuZG9tYWluKGQzLmV4dGVudChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiArZFtwcm9wZXJ0eV07IH0pKVxuICAgIC5yYW5nZShbJ2hzbCgxMjAsIDQwJSwgNTAlKScsICdoc2woMCwgNjAlLCA1MCUpJ10pIC8vIHJlZCB0byBncmVlblxuICAgIC5pbnRlcnBvbGF0ZShkMy5pbnRlcnBvbGF0ZUhzbCk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnRlcnBvbGF0b3IocG9pbnRzKXtcbiAgdmFyIHBvaW50LCBcbiAgICBhY3Rpb24gPSAnJywgXG4gICAgbGluZUJ1aWxkZXIgPSBbXTtcblxuICBmb3IodmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKyl7XG4gICAgcG9pbnQgPSBwb2ludHNbaV07XG5cbiAgICBpZihpc05hTihwb2ludFsxXSkpe1xuICAgICAgaWYoYWN0aW9uICE9PSAnJykgYWN0aW9uID0gJ00nO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xuICAgICAgYWN0aW9uID0gJ0wnO1xuICAgIH1cbiAgfVxuICBcbiAgcG9pbnQgPSBwb2ludHNbcG9pbnRzLmxlbmd0aCAtIDFdO1xuICBpZighaXNOYU4ocG9pbnRbMV0pKXtcbiAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xuICB9XG5cbiAgcmV0dXJuIGxpbmVCdWlsZGVyLmpvaW4oJycpO1xufTsiXX0=
(1)
});
