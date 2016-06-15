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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvbm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvY3VzdG9tRXZlbnRQb2x5ZmlsbC5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2RlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yLmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQm9ycm93cyBoZWF2aWx5IGZyb20gaHR0cDovL2JsLm9ja3Mub3JnL21ib3N0b2NrLzc1ODYzMzRcbnJlcXVpcmUoJy4vY3VzdG9tRXZlbnRQb2x5ZmlsbCcpO1xuXG5cbnZhciBkZWZhdWx0SW50ZXJwb2xhdG9yID0gcmVxdWlyZSgnLi9pbnRlcnBvbGF0b3InKSxcbiAgZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3IgPSByZXF1aXJlKCcuL2RlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yJyk7XG5cbi8vIHJldHVybnMgdGhlIG51bWVyaWNhbCBleHRlbnRzIG9mIHRoZSBkaW1lbnNpb24gdmFsdWVzIGFjcm9zcyB0aGUgZGF0YSBzZXRcbmZ1bmN0aW9uIGRlZmF1bHREb21haW5HZW5lcmF0b3IoZGltZW5zaW9uLCBkYXRhKXtcbiAgcmV0dXJuIGQzLmV4dGVudChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiArZFtkaW1lbnNpb25dOyB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJhbGxlbENvb3JkaW5hdGVzQ2hhcnQoY29uZmlnKXtcblxuICAvLyBDb25maWd1cmFibGUgdmFyaWFibGVzXG4gIHZhciBtYXJnaW4sXG4gICAgd2lkdGgsXG4gICAgaGVpZ2h0LFxuICAgIHNlbGVjdGVkUHJvcGVydHksXG4gICAgaGlnaGxpZ2h0ZWQsXG4gICAgaGlnaGxpZ2h0RmlsdGVyLFxuICAgIG11dGVGaWx0ZXIsXG4gICAgZmlsdGVycyxcbiAgICBjb2xvckdlbmVyYXRvcixcbiAgICBkb21haW5HZW5lcmF0b3IsXG4gICAgZGltZW5zaW9ucyxcbiAgICBpbnRlcnBvbGF0b3IsXG4gICAgY29udGFpbmVyLFxuICAgIG9uRmlsdGVyc0NoYW5nZSA9IGZ1bmN0aW9uICgpIHt9LFxuICAgIG9uSGlnaGxpZ2h0Q2hhbmdlID0gZnVuY3Rpb24gKCkge307XG5cbiAgLy8gR2VuZXJhdGVkIHZhcmlhYmxlc1xuICB2YXIgaW5uZXJXaWR0aCxcbiAgICBpbm5lckhlaWdodCxcbiAgICB4LFxuICAgIHksXG4gICAgZHJhZ2dpbmcsXG4gICAgZGF0YSxcbiAgICBzdmcsXG4gICAgYm9keSxcbiAgICBkYXRhTGluZXMsXG4gICAgbXV0ZWREYXRhTGluZXMsXG4gICAgaGlnaGxpZ2h0ZWREYXRhTGluZXMsXG4gICAgbGluZTtcblxuICB2YXIgYXhpcyA9IGQzLnN2Zy5heGlzKCkub3JpZW50KCdsZWZ0Jyk7XG5cbiAgZnVuY3Rpb24gaW5pdChjb25maWcpe1xuICAgIGlmKCdtYXJnaW4nIGluIGNvbmZpZykgZHJhdy5tYXJnaW4oY29uZmlnLm1hcmdpbik7XG4gICAgZWxzZSBkcmF3Lm1hcmdpbihbMzAsIDEwLCAxMCwgMTBdKTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ3dpZHRoJyBpbiBjb25maWcpIGRyYXcud2lkdGgoY29uZmlnLndpZHRoKTtcbiAgICBlbHNlIGRyYXcud2lkdGgoMTU2MCk7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdoZWlnaHQnIGluIGNvbmZpZykgZHJhdy5oZWlnaHQoY29uZmlnLmhlaWdodCk7XG4gICAgZWxzZSBkcmF3LmhlaWdodCg1MDApOyAvLyBkZWZhdWx0O1xuXG4gICAgaWYoJ2RvbWFpbicgaW4gY29uZmlnKSBkcmF3LmRvbWFpbihjb25maWcuZG9tYWluKTtcbiAgICBlbHNlIGRyYXcuZG9tYWluKGRlZmF1bHREb21haW5HZW5lcmF0b3IpOyAvLyBkZWZhdWx0XG5cbiAgICBpZignaGlnaGxpZ2h0JyBpbiBjb25maWcpIGRyYXcuaGlnaGxpZ2h0KGNvbmZpZy5oaWdobGlnaHQpO1xuICAgIGVsc2UgZHJhdy5oaWdobGlnaHQoJycpOyAvLyBkZWZhdWx0XG5cbiAgICBpZignZmlsdGVycycgaW4gY29uZmlnKSBkcmF3LmZpbHRlcnMoY29uZmlnLmZpbHRlcnMpO1xuICAgIGVsc2UgZHJhdy5maWx0ZXJzKHt9KTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ2ludGVycG9sYXRvcicgaW4gY29uZmlnKSBkcmF3LmludGVycG9sYXRvcihjb25maWcuaW50ZXJwb2xhdG9yKTtcbiAgICBlbHNlIGRyYXcuaW50ZXJwb2xhdG9yKGRlZmF1bHRJbnRlcnBvbGF0b3IpOyAvLyBkZWZhdWx0XG5cbiAgICBpZignY29sb3InIGluIGNvbmZpZykgZHJhdy5jb2xvcihjb25maWcuY29sb3IpO1xuICAgIGVsc2UgZHJhdy5jb2xvcihkZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcik7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdkaW1lbnNpb25zJyBpbiBjb25maWcpIGRyYXcuZGltZW5zaW9ucyhjb25maWcuZGltZW5zaW9ucyk7XG5cbiAgICBpZignb25GaWx0ZXJzQ2hhbmdlJyBpbiBjb25maWcpIHtcbiAgICAgIGRyYXcub25GaWx0ZXJzQ2hhbmdlKGNvbmZpZy5vbkZpbHRlcnNDaGFuZ2UpO1xuICAgIH1cblxuICAgIGlmKCdvbkhpZ2hsaWdodENoYW5nZScgaW4gY29uZmlnKSB7XG4gICAgICBkcmF3Lm9uSGlnaGxpZ2h0Q2hhbmdlKGNvbmZpZy5vbkhpZ2hsaWdodENoYW5nZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlSGlnaGxpZ2h0KHN2Zyl7XG4gICAgaWYoIXN2ZykgcmV0dXJuO1xuXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpLmNsYXNzZWQoJ3NlbGVjdGVkJywgZnVuY3Rpb24oZCkge1xuICAgICAgcmV0dXJuIGQgPT09IHNlbGVjdGVkUHJvcGVydHk7XG4gICAgfSk7XG5cbiAgICB2YXIgcGF0aHMgPSBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJyk7XG4gICAgaWYoIXNlbGVjdGVkUHJvcGVydHkpIHJldHVybiBwYXRocy5zdHlsZSgnc3Ryb2tlJywgJycpO1xuICAgIGlmKCFwYXRocyB8fCAhcGF0aHMubGVuZ3RoKSByZXR1cm47XG5cbiAgICB2YXIgY29sb3IgPSBjb2xvckdlbmVyYXRvcihzZWxlY3RlZFByb3BlcnR5LCBkYXRhKTtcbiAgICBwYXRocy5zdHlsZSgnc3Ryb2tlJywgZnVuY3Rpb24oZCl7XG4gICAgICByZXR1cm4gY29sb3IoZFtzZWxlY3RlZFByb3BlcnR5XSk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVEcmFnZ2FibGUoKXtcbiAgICByZXR1cm4gZDMuYmVoYXZpb3IuZHJhZygpXG4gICAgICAub24oJ2RyYWdzdGFydCcsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZHJhZ2dpbmdbZF0gPSB0aGlzLl9fb3JpZ2luX18gPSB4KGQpO1xuICAgICAgfSlcbiAgICAgIC5vbignZHJhZycsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZHJhZ2dpbmdbZF0gPSBNYXRoLm1pbihpbm5lcldpZHRoLCBNYXRoLm1heCgwLCB0aGlzLl9fb3JpZ2luX18gKz0gZDMuZXZlbnQuZHgpKTtcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcbiAgICAgICAgZGltZW5zaW9ucy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIHBvc2l0aW9uKGEpIC0gcG9zaXRpb24oYik7IH0pO1xuICAgICAgICB4LmRvbWFpbihkaW1lbnNpb25zKTtcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKS5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyBwb3NpdGlvbihkKSArICcpJzsgfSk7XG4gICAgICB9KVxuICAgICAgLm9uKCdkcmFnZW5kJywgZnVuY3Rpb24oZCkge1xuICAgICAgICBkZWxldGUgdGhpcy5fX29yaWdpbl9fO1xuICAgICAgICBkZWxldGUgZHJhZ2dpbmdbZF07XG4gICAgICAgIGQzLnNlbGVjdCh0aGlzKS5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB4KGQpICsgJyknKTtcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFdoZW4gYnJ1c2hpbmcsIGRvbuKAmXQgdHJpZ2dlciBheGlzIGRyYWdnaW5nLlxuICBmdW5jdGlvbiBicnVzaFN0YXJ0SGFuZGxlcigpIHtcbiAgICBkMy5ldmVudC5zb3VyY2VFdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJydXNoRW5kSGFuZGxlcigpIHtcbiAgICB2YXIgYWN0aXZlcyA9IGRpbWVuc2lvbnMuZmlsdGVyKGZ1bmN0aW9uKHApIHsgcmV0dXJuICF5W3BdLmJydXNoLmVtcHR5KCk7IH0pLFxuICAgICAgICBleHRlbnRzID0gYWN0aXZlcy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4geVtwXS5icnVzaC5leHRlbnQoKTsgfSk7XG5cbiAgICBmdW5jdGlvbiBpc1Zpc2libGUoZCkge1xuICAgICAgcmV0dXJuIGFjdGl2ZXMuZXZlcnkoZnVuY3Rpb24ocCwgaSkge1xuICAgICAgICByZXR1cm4gZXh0ZW50c1tpXVswXSA8PSBkW3BdICYmIGRbcF0gPD0gZXh0ZW50c1tpXVsxXTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHZhciBzZWxlY3RlZCA9IGRhdGEuZmlsdGVyKGlzVmlzaWJsZSk7XG4gICAgcmVkcmF3UGF0aEdyb3VwcygpO1xuXG4gICAgdmFyIGZpbHRlcnMgPSB7fTtcbiAgICBhY3RpdmVzLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uLCBpKXtcbiAgICAgIGZpbHRlcnNbZGltZW5zaW9uXSA9IGV4dGVudHNbaV07XG4gICAgfSk7XG5cbiAgICBvbkZpbHRlcnNDaGFuZ2UoZmlsdGVycywgc2VsZWN0ZWQpO1xuICB9XG5cbiAgLy8gSGFuZGxlcyBhIGJydXNoIGV2ZW50LCB0b2dnbGluZyB0aGUgZGlzcGxheSBvZiBsaW5lcy5cbiAgZnVuY3Rpb24gYnJ1c2goKSB7XG4gIH1cblxuICBmdW5jdGlvbiBwb3NpdGlvbihkKSB7XG4gICAgLy8gaWYgd2UncmUgY3VycmVudGx5IGRyYWdnaW5nIHRoZSBheGlzIHJldHVybiB0aGUgZHJhZyBwb3NpdGlvblxuICAgIC8vIG90aGVyd2lzZSByZXR1cm4gdGhlIG5vcm1hbCB4LWF4aXMgcG9zaXRpb25cbiAgICB2YXIgdiA9IGRyYWdnaW5nW2RdO1xuICAgIHJldHVybiB2ID09IG51bGwgPyB4KGQpIDogdjtcbiAgfVxuXG4gIC8vIFJldHVybnMgdGhlIHBhdGggZm9yIGEgZ2l2ZW4gZGF0YSBwb2ludC5cbiAgZnVuY3Rpb24gcGF0aChkKSB7XG4gICAgcmV0dXJuIGxpbmUoZGltZW5zaW9ucy5tYXAoZnVuY3Rpb24ocCkge1xuICAgICAgcmV0dXJuIFtwb3NpdGlvbihwKSwgeVtwXShkW3BdKV07XG4gICAgfSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVkcmF3UGF0aEdyb3VwcygpIHtcbiAgICB2YXIgYWN0aXZlcyA9IGRpbWVuc2lvbnMuZmlsdGVyKGZ1bmN0aW9uKHApIHsgcmV0dXJuICF5W3BdLmJydXNoLmVtcHR5KCk7IH0pLFxuICAgICAgICBleHRlbnRzID0gYWN0aXZlcy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4geVtwXS5icnVzaC5leHRlbnQoKTsgfSk7XG5cbiAgICBmdW5jdGlvbiBpc1Zpc2libGUoZCkge1xuICAgICAgcmV0dXJuIGFjdGl2ZXMuZXZlcnkoZnVuY3Rpb24ocCwgaSkge1xuICAgICAgICByZXR1cm4gZXh0ZW50c1tpXVswXSA8PSBkW3BdICYmIGRbcF0gPD0gZXh0ZW50c1tpXVsxXTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHZhciBoaWdobGlnaHRlZCA9IFtdLFxuICAgICAgbXV0ZWQgPSBbXSxcbiAgICAgIG5vcm1hbCA9IFtdO1xuXG4gICAgZGF0YS5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgIGlmIChoaWdobGlnaHRGaWx0ZXIgJiYgaGlnaGxpZ2h0RmlsdGVyKGQpKSB7XG4gICAgICAgIGhpZ2hsaWdodGVkLnB1c2goZCk7XG4gICAgICB9IGVsc2UgaWYgKG11dGVGaWx0ZXIgJiYgbXV0ZUZpbHRlcihkKSB8fCAhaXNWaXNpYmxlKGQpKSB7XG4gICAgICAgIG11dGVkLnB1c2goZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBub3JtYWwucHVzaChkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGdldElkKGQpIHtcbiAgICAgIHJldHVybiBkLmlkO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBuZXcgcGF0aHMgYmFzZWQgb2ZmIHRoZSBpZCBwcm9wZXJ0eSBmb3IgZWFjaCBkYXR1bVxuICAgIHZhciBtdXRlZFBhdGhzID0gbXV0ZWREYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJylcbiAgICAgIC5kYXRhKG11dGVkLCBnZXRJZCk7XG4gICAgbXV0ZWRQYXRocy5lbnRlcigpLmFwcGVuZCgncGF0aCcpO1xuICAgIG11dGVkUGF0aHMuZXhpdCgpLnJlbW92ZSgpO1xuXG4gICAgdmFyIG5vcm1hbFBhdGhzID0gZGF0YUxpbmVzLnNlbGVjdEFsbCgncGF0aCcpXG4gICAgICAuZGF0YShub3JtYWwsIGdldElkKTtcbiAgICBub3JtYWxQYXRocy5lbnRlcigpLmFwcGVuZCgncGF0aCcpO1xuICAgIG5vcm1hbFBhdGhzLmV4aXQoKS5yZW1vdmUoKTtcblxuICAgIHZhciBoaWdobGlnaHRlZFBhdGhzID0gaGlnaGxpZ2h0ZWREYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJylcbiAgICAgIC5kYXRhKGhpZ2hsaWdodGVkLCBnZXRJZCk7XG4gICAgaGlnaGxpZ2h0ZWRQYXRocy5lbnRlcigpLmFwcGVuZCgncGF0aCcpO1xuICAgIGhpZ2hsaWdodGVkUGF0aHMuZXhpdCgpLnJlbW92ZSgpO1xuLypcbiAgICBoaWdobGlnaHRlZFBhdGhzLmVudGVyKCkudHJhbnNpdGlvbigpXG4gICAgICAuZHVyYXRpb24oMTAwKVxuICAgICAgLmRlbGF5KGZ1bmN0aW9uIChkLCBpKXsgcmV0dXJuIDEwICogaTt9KS5zZWxlY3RBbGwoJ3BhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4qL1xuXG4gICAgLy8gUmVkcmF3IGVhY2ggcGF0aCBhbmQgYXNzaWduIGEgaGlnaGxpZ2h0ZWQgc3RhdGUgZ2l2ZW4gdGhlIGhpZ2hsaWdodEZpbHRlclxuICAgIC8vIGFuZCBhIG11dGVkIHN0YXRlIGdpdmVuIHRoZSBtdXRlRmlsdGVyXG4gICAgbm9ybWFsUGF0aHMuYXR0cignZCcsIHBhdGgpO1xuICAgIG11dGVkUGF0aHMuYXR0cignZCcsIHBhdGgpO1xuICAgIGhpZ2hsaWdodGVkUGF0aHMuYXR0cignZCcsIHBhdGgpO1xuXG4gICAgdmFyIHBhdGhzID0gc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcbiAgICBpZighcGF0aHMgfHwgIXBhdGhzLmxlbmd0aCkgcmV0dXJuO1xuXG4gICAgaWYoIXNlbGVjdGVkUHJvcGVydHkpIHtcbiAgICAgIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIGRhdGEpO1xuICAgICAgaGlnaGxpZ2h0ZWRQYXRocy5zdHlsZSgnc3Ryb2tlJywgJycpO1xuICAgICAgbm9ybWFsUGF0aHMuc3R5bGUoJ3N0cm9rZScsIGZ1bmN0aW9uKGQpe1xuICAgICAgICByZXR1cm4gY29sb3IoZFtzZWxlY3RlZFByb3BlcnR5XSk7XG4gICAgICB9KTtcbiAgICAgIG11dGVkUGF0aHMuc3R5bGUoJ3N0cm9rZScsIGZ1bmN0aW9uKGQpe1xuICAgICAgICByZXR1cm4gY29sb3IoZFtzZWxlY3RlZFByb3BlcnR5XSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBkcmF3KCl7XG4gICAgc3ZnLmF0dHIoJ3dpZHRoJywgd2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0KTtcblxuICAgIC8vIGJhc2Ugc3ZnXG4gICAgYm9keS5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW5bM10gKyAnLCcgKyBtYXJnaW5bMF0gKyAnKScpO1xuXG4gICAgZHJhZ2dpbmcgPSB7fTtcblxuICAgIC8vIGNyZWF0ZSBhIHNjYWxlIGFuZCBhIGJydXNoIGZvciBlYWNoIGRpbWVuc2lvbiBiZWluZyB2aXN1YWxpemVkXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgIHlbZF0ucmFuZ2UoW2lubmVySGVpZ2h0LCAwXSlcbiAgICAgICAgLmRvbWFpbihkb21haW5HZW5lcmF0b3IoZCwgZGF0YSkpO1xuICAgIH0pO1xuXG4gICAgcmVkcmF3UGF0aEdyb3VwcygpO1xuXG4gICAgLy8gQWRkIGEgZ3JvdXAgZWxlbWVudCBmb3IgZWFjaCBkaW1lbnNpb24uXG4gICAgdmFyIGRpbWVuc2lvbkdyb3VwID0gYm9keVxuICAgICAgLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKVxuICAgICAgLmRhdGEoZGltZW5zaW9ucyk7XG5cblxuICAgIHZhciBuZXdEaW1lbnNpb25zID0gZGltZW5zaW9uR3JvdXAuZW50ZXIoKVxuICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAuY2xhc3NlZCgnZGltZW5zaW9uJywgdHJ1ZSlcbiAgICAgICAgICAuY2FsbChjcmVhdGVEcmFnZ2FibGUoKSk7XG5cbiAgICBkaW1lbnNpb25Hcm91cC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7XG4gICAgICByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJztcbiAgICB9KTtcblxuICAgIC8vIEFkZCBhbiBheGlzIGFuZCB0aXRsZS5cbiAgICBuZXdEaW1lbnNpb25zLmFwcGVuZCgnZycpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcbiAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnbWlkZGxlJylcbiAgICAgICAgLmF0dHIoJ3knLCAtOSlcbiAgICAgICAgLnRleHQoU3RyaW5nKVxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZCl7XG4gICAgICAgICAgaWYgKGQzLmV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjsgLy8gY2xpY2sgc3VwcHJlc3NlZFxuXG4gICAgICAgICAgaWYoZCA9PT0gc2VsZWN0ZWRQcm9wZXJ0eSkgZCA9ICcnO1xuICAgICAgICAgIGVsc2UgZHJhdy5oaWdobGlnaHQoZCk7XG4gICAgICAgIH0pO1xuXG4gICAgZGltZW5zaW9uR3JvdXAuc2VsZWN0QWxsKCdnLmF4aXMnKVxuICAgICAgLmVhY2goZnVuY3Rpb24oZCkgeyBkMy5zZWxlY3QodGhpcykuY2FsbChheGlzLnNjYWxlKHlbZF0pKTsgfSk7XG5cbiAgICAvLyBBZGQgYW5kIHN0b3JlIGEgYnJ1c2ggZm9yIGVhY2ggYXhpcy5cbiAgICBuZXdEaW1lbnNpb25zLmFwcGVuZCgnZycpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdicnVzaCcpO1xuXG4gICAgZGltZW5zaW9uR3JvdXAuc2VsZWN0QWxsKCdnLmJydXNoJylcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmNhbGwoeVtkXS5icnVzaCk7XG4gICAgICB9KVxuICAgICAgLnNlbGVjdEFsbCgncmVjdCcpXG4gICAgICAuYXR0cigneCcsIC04KVxuICAgICAgLmF0dHIoJ3dpZHRoJywgMTYpO1xuXG4gICAgZHJhdy5oaWdobGlnaHQoc2VsZWN0ZWRQcm9wZXJ0eSk7XG4gICAgZHJhdy5maWx0ZXJzKGZpbHRlcnMpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH1cblxuICBkcmF3LndpZHRoID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gd2lkdGg7XG4gICAgd2lkdGggPSBfO1xuICAgIGlubmVyV2lkdGggPSB3aWR0aCAtIG1hcmdpblsxXSAtIG1hcmdpblszXTtcbiAgICB4ID0gZDMuc2NhbGUub3JkaW5hbCgpLnJhbmdlUG9pbnRzKFswLCBpbm5lcldpZHRoXSwgMC44KTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhlaWdodCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhlaWdodDtcbiAgICBoZWlnaHQgPSBfO1xuICAgIGlubmVySGVpZ2h0ID0gaGVpZ2h0IC0gbWFyZ2luWzBdIC0gbWFyZ2luWzJdO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcubWFyZ2luID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gbWFyZ2luO1xuICAgIG1hcmdpbiA9IF87XG4gICAgZHJhdy53aWR0aCh3aWR0aCk7XG4gICAgZHJhdy5oZWlnaHQoaGVpZ2h0KTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmRpbWVuc2lvbnMgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaW1lbnNpb25zO1xuICAgIGRpbWVuc2lvbnMgPSBfO1xuXG4gICAgLy8gSWYgbm8gZGltZW5zaW9ucyBhcmUgZGVmaW5lZCwgdXNlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBmaXJzdCBkYXR1bSBhc1xuICAgIC8vIHRoZSBsaXN0IG9mIGRpbWVuc2lvbnMgdG8gdmlzdWFsaXplLiBUaGlzIGFzc3VtZXMgaG9tb2dlbmVpdHkgaW4gdGhlXG4gICAgLy8gZGltZW5zaW9uYWxpdHkgb2YgdGhlIGRhdGEuXG4gICAgaWYoIWRpbWVuc2lvbnMpIGRpbWVuc2lvbnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcblxuICAgIC8vIFRoZSAneCcgYXhpcyByZXByZXNlbnRzIHRoZSB2YXJpb3VzIGRpbWVuc2lvbnMgd2hpY2ggd2lsbCBiZSB2aXN1YWxpemVkXG4gICAgLy8gd2hlcmUgZWFjaCAndGljaycgaW4gdGhlIHgtYXhpcyBpcyByZWFsbHkgYW5vdGhlciB5LWF4aXMuXG4gICAgeC5kb21haW4oZGltZW5zaW9ucyk7XG5cbiAgICB5ID0ge307XG4gICAgLy8gY3JlYXRlIGEgc2NhbGUgYW5kIGEgYnJ1c2ggZm9yIGVhY2ggZGltZW5zaW9uIGJlaW5nIHZpc3VhbGl6ZWRcbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgeVtkXSA9IGQzLnNjYWxlLmxpbmVhcigpO1xuXG4gICAgICB5W2RdLmJydXNoID0gZDMuc3ZnLmJydXNoKCkueSh5W2RdKVxuICAgICAgICAgIC5vbignYnJ1c2hzdGFydCcsIGJydXNoU3RhcnRIYW5kbGVyKVxuICAgICAgICAgIC5vbignYnJ1c2gnLCBicnVzaClcbiAgICAgICAgICAub24oJ2JydXNoZW5kJywgYnJ1c2hFbmRIYW5kbGVyKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuZG9tYWluID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZG9tYWluR2VuZXJhdG9yO1xuICAgIGRvbWFpbkdlbmVyYXRvciA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5jb2xvciA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbG9yR2VuZXJhdG9yO1xuICAgIGNvbG9yR2VuZXJhdG9yID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmludGVycG9sYXRvciA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGludGVycG9sYXRvcjtcbiAgICBpbnRlcnBvbGF0b3IgPSBfO1xuICAgIGxpbmUgPSBkMy5zdmcubGluZSgpLmludGVycG9sYXRlKGludGVycG9sYXRvcik7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5oaWdobGlnaHRlZCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhpZ2hsaWdodGVkO1xuICAgIGhpZ2hsaWdodGVkID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3Lm9uRmlsdGVyc0NoYW5nZSA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9uRmlsdGVyc0NoYW5nZTtcbiAgICBvbkZpbHRlcnNDaGFuZ2UgPSBfO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcub25IaWdobGlnaHRDaGFuZ2UgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBvbkhpZ2hsaWdodENoYW5nZTtcbiAgICBvbkhpZ2hsaWdodENoYW5nZSA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5oaWdobGlnaHQgPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBzZWxlY3RlZFByb3BlcnR5O1xuXG4gICAgaWYoc2VsZWN0ZWRQcm9wZXJ0eSAhPT0gXyl7XG4gICAgICBzZWxlY3RlZFByb3BlcnR5ID0gXztcblxuICAgICAgb25IaWdobGlnaHRDaGFuZ2Uoc2VsZWN0ZWRQcm9wZXJ0eSk7XG4gICAgfVxuXG4gICAgdXBkYXRlSGlnaGxpZ2h0KHN2Zyk7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5tdXRlRmlsdGVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG11dGVGaWx0ZXI7XG5cbiAgICBtdXRlRmlsdGVyID0gXztcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuaGlnaGxpZ2h0RmlsdGVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhpZ2hsaWdodEZpbHRlcjtcblxuICAgIGhpZ2hsaWdodEZpbHRlciA9IF87XG5cbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmZpbHRlciA9IGZ1bmN0aW9uKGRpbWVuc2lvbiwgZXh0ZW50KXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuO1xuICAgIHZhciBjdXJyZW50ID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xuXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSl7XG4gICAgICBpZihjdXJyZW50WzBdID09PSBjdXJyZW50WzFdKSByZXR1cm47IC8vIHVuZGVmaW5lZCBpZiB1bnNldFxuICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgfVxuXG4gICAgaWYoIWV4dGVudCkgZXh0ZW50ID0gWzAsMF07IC8vIHRoaXMgaGlkZXMgYnJ1c2hcblxuICAgIGlmKGN1cnJlbnRbMF0gPT09IGV4dGVudFswXSAmJiBjdXJyZW50WzFdID09PSBleHRlbnRbMV0pIHJldHVybiBkcmF3O1xuXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmJydXNoJykuZmlsdGVyKGZ1bmN0aW9uKGQpe1xuICAgICAgcmV0dXJuIGQgPT09IGRpbWVuc2lvbjtcbiAgICB9KS5jYWxsKHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoZXh0ZW50KSkuY2FsbChicnVzaCk7XG5cbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmZpbHRlcnMgPSBmdW5jdGlvbihuZXdGaWx0ZXJzKXtcbiAgICBpZiAoIW5ld0ZpbHRlcnMpIG5ld0ZpbHRlcnMgPSB7fTtcbiAgICBmaWx0ZXJzID0gbmV3RmlsdGVycztcbiAgICB2YXIgY3VycmVudCA9IHt9O1xuICAgIHZhciBkaW1lbnNpb25zID0gT2JqZWN0LmtleXMoeSB8fCB7fSk7XG5cbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uKXtcbiAgICAgIC8vIHNraXAgdW5zZXQgZmlsdGVyc1xuICAgICAgaWYoeVtkaW1lbnNpb25dLmJydXNoLmVtcHR5KCkpIHJldHVybjtcblxuICAgICAgY3VycmVudFtkaW1lbnNpb25dID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xuICAgIH0pO1xuXG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBjdXJyZW50O1xuXG4gICAgdmFyIHNhbWUgPSBkaW1lbnNpb25zLmV2ZXJ5KGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICBpZihkaW1lbnNpb24gaW4gbmV3RmlsdGVycyl7XG4gICAgICAgIGlmKCEoZGltZW5zaW9uIGluIGN1cnJlbnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIChjdXJyZW50W2RpbWVuc2lvbl1bMF0gPT09IG5ld0ZpbHRlcnNbZGltZW5zaW9uXVswXSAmJlxuICAgICAgICAgICAgICAgIGN1cnJlbnRbZGltZW5zaW9uXVsxXSA9PT0gbmV3RmlsdGVyc1tkaW1lbnNpb25dWzFdKTtcbiAgICAgIH0gZWxzZSByZXR1cm4gIShkaW1lbnNpb24gaW4gY3VycmVudCk7XG4gICAgfSk7XG5cbiAgICBpZihzYW1lKSByZXR1cm4gZHJhdztcblxuICAgIC8vIFplcm8gb3V0IGFueSBpbXBsaWNpdGx5IGV4Y2x1ZGVkIGRpbWVuc2lvbnNcbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uKXtcbiAgICAgIGlmKGRpbWVuc2lvbiBpbiBuZXdGaWx0ZXJzKXtcbiAgICAgICAgeVtkaW1lbnNpb25dLmJydXNoLmV4dGVudChuZXdGaWx0ZXJzW2RpbWVuc2lvbl0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgeVtkaW1lbnNpb25dLmJydXNoLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBzdmcuc2VsZWN0QWxsKCcuYnJ1c2gnKS5lYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICBkMy5zZWxlY3QodGhpcykuY2FsbCh5W2RpbWVuc2lvbl0uYnJ1c2gpO1xuICAgIH0pO1xuXG4gICAgc3ZnLmNhbGwoYnJ1c2gpO1xuXG4gICAgcmVkcmF3UGF0aEdyb3VwcygpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5jb250YWluZXIgPSBmdW5jdGlvbihfKSB7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY29udGFpbmVyO1xuICAgIGNvbnRhaW5lciA9IF87XG5cbiAgICBzdmcgPSBkMy5zZWxlY3QoY29udGFpbmVyKS5hcHBlbmQoJ3N2ZycpXG4gICAgICAuY2xhc3NlZCgncGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQnLCB0cnVlKTtcblxuICAgIGJvZHkgPSBzdmcuYXBwZW5kKCdnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICdib2R5JylcbiAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKDAsMCknKTtcblxuICAgIG11dGVkRGF0YUxpbmVzID0gYm9keS5hcHBlbmQoJ2cnKS5jbGFzc2VkKCdtdXRlZCBkYXRhbGluZXMnLCB0cnVlKTtcbiAgICBkYXRhTGluZXMgPSBib2R5LmFwcGVuZCgnZycpLmNsYXNzZWQoJ2RhdGFsaW5lcycsIHRydWUpO1xuICAgIGhpZ2hsaWdodGVkRGF0YUxpbmVzID0gYm9keS5hcHBlbmQoJ2cnKS5jbGFzc2VkKCdoaWdobGlnaHRlZCBkYXRhbGluZXMnLCB0cnVlKTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuZGF0YSA9IGZ1bmN0aW9uKF8pIHtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkYXRhO1xuICAgIGRhdGEgPSBfO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcucmVkcmF3ID0gZnVuY3Rpb24oKXtcbiAgICBkcmF3KCk7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5kcmF3ID0gZnVuY3Rpb24oKXtcbiAgICBkcmF3KCk7XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgaW5pdChjb25maWcgfHwge30pO1xuXG4gIHJldHVybiBkcmF3O1xufTtcbiIsIi8vIEZvciBJRTkrXG4oZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBDdXN0b21FdmVudCAoIGV2ZW50LCBwYXJhbXMgKSB7XG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHsgYnViYmxlczogZmFsc2UsIGNhbmNlbGFibGU6IGZhbHNlLCBkZXRhaWw6IHVuZGVmaW5lZCB9O1xuICAgIHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuICAgIGV2dC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50LCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwgKTtcbiAgICByZXR1cm4gZXZ0O1xuICAgfVxuXG4gIEN1c3RvbUV2ZW50LnByb3RvdHlwZSA9IHdpbmRvdy5FdmVudC5wcm90b3R5cGU7XG5cbiAgd2luZG93LkN1c3RvbUV2ZW50ID0gQ3VzdG9tRXZlbnQ7XG59KSgpOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29sb3JTY2FsZUdlbmVyYXRvcihwcm9wZXJ0eSwgZGF0YSl7XG4gIHJldHVybiBkMy5zY2FsZS5saW5lYXIoKVxuICAgIC5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICtkW3Byb3BlcnR5XTsgfSkpXG4gICAgLnJhbmdlKFsnaHNsKDEyMCwgNDAlLCA1MCUpJywgJ2hzbCgwLCA2MCUsIDUwJSknXSkgLy8gcmVkIHRvIGdyZWVuXG4gICAgLmludGVycG9sYXRlKGQzLmludGVycG9sYXRlSHNsKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGludGVycG9sYXRvcihwb2ludHMpe1xuICB2YXIgcG9pbnQsIFxuICAgIGFjdGlvbiA9ICcnLCBcbiAgICBsaW5lQnVpbGRlciA9IFtdO1xuXG4gIGZvcih2YXIgaSA9IDA7IGkgPCBwb2ludHMubGVuZ3RoIC0gMTsgaSsrKXtcbiAgICBwb2ludCA9IHBvaW50c1tpXTtcblxuICAgIGlmKGlzTmFOKHBvaW50WzFdKSl7XG4gICAgICBpZihhY3Rpb24gIT09ICcnKSBhY3Rpb24gPSAnTSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpbmVCdWlsZGVyLnB1c2goYWN0aW9uLCBwb2ludCk7XG4gICAgICBhY3Rpb24gPSAnTCc7XG4gICAgfVxuICB9XG4gIFxuICBwb2ludCA9IHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV07XG4gIGlmKCFpc05hTihwb2ludFsxXSkpe1xuICAgIGxpbmVCdWlsZGVyLnB1c2goYWN0aW9uLCBwb2ludCk7XG4gIH1cblxuICByZXR1cm4gbGluZUJ1aWxkZXIuam9pbignJyk7XG59OyJdfQ==
(1)
});
