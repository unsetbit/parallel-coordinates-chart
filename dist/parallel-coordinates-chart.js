!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.parallelCoordinatesChart=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Borrows heavily from http://bl.ocks.org/mbostock/7586334
_dereq_('./customEventPolyfill');


var defaultInterpolator = _dereq_('./interpolator'),
  defaultColorScaleGenerator = _dereq_('./defaultColorScaleGenerator');

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvbm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvY3VzdG9tRXZlbnRQb2x5ZmlsbC5qcyIsIi9Vc2Vycy9vemFuL2NvZGUvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2RlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yLmpzIiwiL1VzZXJzL296YW4vY29kZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIEJvcnJvd3MgaGVhdmlseSBmcm9tIGh0dHA6Ly9ibC5vY2tzLm9yZy9tYm9zdG9jay83NTg2MzM0XG5yZXF1aXJlKCcuL2N1c3RvbUV2ZW50UG9seWZpbGwnKTtcblxuXG52YXIgZGVmYXVsdEludGVycG9sYXRvciA9IHJlcXVpcmUoJy4vaW50ZXJwb2xhdG9yJyksXG4gIGRlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9kZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcicpO1xuXG5mdW5jdGlvbiBkZWZhdWx0RG9tYWluR2VuZXJhdG9yKGRpbWVuc2lvbiwgZGF0YSl7XG4gIHJldHVybiBkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gK2RbZGltZW5zaW9uXTsgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyYWxsZWxDb29yZGluYXRlc0NoYXJ0KGNvbmZpZyl7XG5cbiAgLy8gQ29uZmlndXJhYmxlIHZhcmlhYmxlc1xuICB2YXIgbWFyZ2luLFxuICAgIHdpZHRoLFxuICAgIGhlaWdodCxcbiAgICBzZWxlY3RlZFByb3BlcnR5LFxuICAgIGhpZ2hsaWdodGVkLFxuICAgIGhpZ2hsaWdodEZpbHRlcixcbiAgICBmaWx0ZXJzLFxuICAgIGNvbG9yR2VuZXJhdG9yLFxuICAgIGRvbWFpbkdlbmVyYXRvcixcbiAgICBkaW1lbnNpb25zLFxuICAgIGludGVycG9sYXRvcixcbiAgICBjb250YWluZXIsXG4gICAgb25GaWx0ZXJzQ2hhbmdlID0gZnVuY3Rpb24gKCkge30sXG4gICAgb25IaWdobGlnaHRDaGFuZ2UgPSBmdW5jdGlvbiAoKSB7fTtcblxuICAvLyBHZW5lcmF0ZWQgdmFyaWFibGVzXG4gIHZhciBpbm5lcldpZHRoLFxuICAgIGlubmVySGVpZ2h0LFxuICAgIHgsXG4gICAgeSxcbiAgICBkcmFnZ2luZyxcbiAgICBkYXRhLFxuICAgIHN2ZyxcbiAgICBib2R5LFxuICAgIGRhdGFMaW5lcyxcbiAgICBsaW5lO1xuXG4gIHZhciBheGlzID0gZDMuc3ZnLmF4aXMoKS5vcmllbnQoJ2xlZnQnKTtcblxuICBmdW5jdGlvbiBpbml0KGNvbmZpZyl7XG4gICAgaWYoJ21hcmdpbicgaW4gY29uZmlnKSBkcmF3Lm1hcmdpbihjb25maWcubWFyZ2luKTtcbiAgICBlbHNlIGRyYXcubWFyZ2luKFszMCwgMTAsIDEwLCAxMF0pOyAvLyBkZWZhdWx0XG5cbiAgICBpZignd2lkdGgnIGluIGNvbmZpZykgZHJhdy53aWR0aChjb25maWcud2lkdGgpO1xuICAgIGVsc2UgZHJhdy53aWR0aCgxNTYwKTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ2hlaWdodCcgaW4gY29uZmlnKSBkcmF3LmhlaWdodChjb25maWcuaGVpZ2h0KTtcbiAgICBlbHNlIGRyYXcuaGVpZ2h0KDUwMCk7IC8vIGRlZmF1bHQ7XG5cbiAgICBpZignZG9tYWluJyBpbiBjb25maWcpIGRyYXcuZG9tYWluKGNvbmZpZy5kb21haW4pO1xuICAgIGVsc2UgZHJhdy5kb21haW4oZGVmYXVsdERvbWFpbkdlbmVyYXRvcik7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdoaWdobGlnaHQnIGluIGNvbmZpZykgZHJhdy5oaWdobGlnaHQoY29uZmlnLmhpZ2hsaWdodCk7XG4gICAgZWxzZSBkcmF3LmhpZ2hsaWdodCgnJyk7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdmaWx0ZXJzJyBpbiBjb25maWcpIGRyYXcuZmlsdGVycyhjb25maWcuZmlsdGVycyk7XG4gICAgZWxzZSBkcmF3LmZpbHRlcnMoe30pOyAvLyBkZWZhdWx0XG5cbiAgICBpZignaW50ZXJwb2xhdG9yJyBpbiBjb25maWcpIGRyYXcuaW50ZXJwb2xhdG9yKGNvbmZpZy5pbnRlcnBvbGF0b3IpO1xuICAgIGVsc2UgZHJhdy5pbnRlcnBvbGF0b3IoZGVmYXVsdEludGVycG9sYXRvcik7IC8vIGRlZmF1bHRcblxuICAgIGlmKCdjb2xvcicgaW4gY29uZmlnKSBkcmF3LmNvbG9yKGNvbmZpZy5jb2xvcik7XG4gICAgZWxzZSBkcmF3LmNvbG9yKGRlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yKTsgLy8gZGVmYXVsdFxuXG4gICAgaWYoJ3NlbGVjdCcgaW4gY29uZmlnKSBkcmF3LnNlbGVjdChjb25maWcuc2VsZWN0KTtcblxuICAgIGlmKCdvbkZpbHRlcnNDaGFuZ2UnIGluIGNvbmZpZykge1xuICAgICAgZHJhdy5vbkZpbHRlcnNDaGFuZ2UoY29uZmlnLm9uRmlsdGVyc0NoYW5nZSk7XG4gICAgfVxuXG4gICAgaWYoJ29uSGlnaGxpZ2h0Q2hhbmdlJyBpbiBjb25maWcpIHtcbiAgICAgIGRyYXcub25IaWdobGlnaHRDaGFuZ2UoY29uZmlnLm9uSGlnaGxpZ2h0Q2hhbmdlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVIaWdobGlnaHQoc3ZnKXtcbiAgICBpZighc3ZnKSByZXR1cm47XG5cbiAgICBzdmcuc2VsZWN0QWxsKCcuZGltZW5zaW9uJykuY2xhc3NlZCgnc2VsZWN0ZWQnLCBmdW5jdGlvbihkKSB7XG4gICAgICByZXR1cm4gZCA9PT0gc2VsZWN0ZWRQcm9wZXJ0eTtcbiAgICB9KTtcblxuICAgIHZhciBwYXRocyA9IHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKTtcbiAgICBpZighc2VsZWN0ZWRQcm9wZXJ0eSkgcmV0dXJuIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XG4gICAgaWYoIXBhdGhzIHx8ICFwYXRocy5sZW5ndGgpIHJldHVybjtcblxuICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIGRhdGEpO1xuICAgIHBhdGhzLnN0eWxlKCdzdHJva2UnLCBmdW5jdGlvbihkKXtcbiAgICAgIHJldHVybiBjb2xvcihkW3NlbGVjdGVkUHJvcGVydHldKTtcbiAgICB9KTtcbiAgfVxuXG5cbiAgZnVuY3Rpb24gY3JlYXRlRHJhZ2dhYmxlKCl7XG4gICAgcmV0dXJuIGQzLmJlaGF2aW9yLmRyYWcoKVxuICAgICAgLm9uKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihkKSB7XG4gICAgICAgIGRyYWdnaW5nW2RdID0gdGhpcy5fX29yaWdpbl9fID0geChkKTtcbiAgICAgIH0pXG4gICAgICAub24oJ2RyYWcnLCBmdW5jdGlvbihkKSB7XG4gICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4gICAgICAgIGRpbWVuc2lvbnMuc29ydChmdW5jdGlvbihhLCBiKSB7IHJldHVybiBwb3NpdGlvbihhKSAtIHBvc2l0aW9uKGIpOyB9KTtcbiAgICAgICAgeC5kb21haW4oZGltZW5zaW9ucyk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGltZW5zaW9uJykuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgcG9zaXRpb24oZCkgKyAnKSc7IH0pO1xuICAgICAgfSlcbiAgICAgIC5vbignZHJhZ2VuZCcsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX19vcmlnaW5fXztcbiAgICAgICAgZGVsZXRlIGRyYWdnaW5nW2RdO1xuICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJyk7XG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJ2cuZGF0YWxpbmVzIHBhdGgnKS5hdHRyKCdkJywgcGF0aCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBXaGVuIGJydXNoaW5nLCBkb27igJl0IHRyaWdnZXIgYXhpcyBkcmFnZ2luZy5cbiAgZnVuY3Rpb24gYnJ1c2hTdGFydEhhbmRsZXIoKSB7XG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cblxuICAvLyBIYW5kbGVzIGEgYnJ1c2ggZXZlbnQsIHRvZ2dsaW5nIHRoZSBkaXNwbGF5IG9mIGxpbmVzLlxuICBmdW5jdGlvbiBicnVzaCgpIHtcbiAgICB2YXIgYWN0aXZlcyA9IGRpbWVuc2lvbnMuZmlsdGVyKGZ1bmN0aW9uKHApIHsgcmV0dXJuICF5W3BdLmJydXNoLmVtcHR5KCk7IH0pLFxuICAgICAgICBleHRlbnRzID0gYWN0aXZlcy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4geVtwXS5icnVzaC5leHRlbnQoKTsgfSk7XG5cbiAgICB2YXIgc2VsZWN0ZWQgPSBbXTtcbiAgICBkYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJykuY2xhc3NlZCgnYWN0aXZlJywgZnVuY3Rpb24oZCkge1xuICAgICAgdmFyIHZpc2libGUgPSBhY3RpdmVzLmV2ZXJ5KGZ1bmN0aW9uKHAsIGkpIHtcbiAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XG4gICAgICB9KTtcblxuICAgICAgaWYgKHZpc2libGUpIHNlbGVjdGVkLnB1c2goZCk7XG4gICAgICByZXR1cm4gdmlzaWJsZTtcbiAgICB9KTtcbiAgICBkYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJykuY2xhc3NlZCgnZmlsdGVyZWQnLCBmdW5jdGlvbihkKSB7XG4gICAgICB2YXIgdmlzaWJsZSA9IGFjdGl2ZXMuZXZlcnkoZnVuY3Rpb24ocCwgaSkge1xuICAgICAgICByZXR1cm4gZXh0ZW50c1tpXVswXSA8PSBkW3BdICYmIGRbcF0gPD0gZXh0ZW50c1tpXVsxXTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuICF2aXNpYmxlO1xuICAgIH0pO1xuXG4gICAgdmFyIGZpbHRlcnMgPSB7fTtcbiAgICBhY3RpdmVzLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uLCBpKXtcbiAgICAgIGZpbHRlcnNbZGltZW5zaW9uXSA9IGV4dGVudHNbaV07XG4gICAgfSk7XG5cbiAgICBvbkZpbHRlcnNDaGFuZ2UoZmlsdGVycywgc2VsZWN0ZWQpO1xuICB9XG5cbiAgZnVuY3Rpb24gcG9zaXRpb24oZCkge1xuICAgIC8vIGlmIHdlJ3JlIGN1cnJlbnRseSBkcmFnZ2luZyB0aGUgYXhpcyByZXR1cm4gdGhlIGRyYWcgcG9zaXRpb25cbiAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBub3JtYWwgeC1heGlzIHBvc2l0aW9uXG4gICAgdmFyIHYgPSBkcmFnZ2luZ1tkXTtcbiAgICByZXR1cm4gdiA9PSBudWxsID8geChkKSA6IHY7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRoZSBwYXRoIGZvciBhIGdpdmVuIGRhdGEgcG9pbnQuXG4gIGZ1bmN0aW9uIHBhdGgoZCkge1xuICAgIHJldHVybiBsaW5lKGRpbWVuc2lvbnMubWFwKGZ1bmN0aW9uKHApIHtcbiAgICAgIHJldHVybiBbcG9zaXRpb24ocCksIHlbcF0oZFtwXSldO1xuICAgIH0pKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXcoKXtcbiAgICBkcmFnZ2luZyA9IHt9O1xuXG4gICAgLy8gRXh0cmFjdCB0aGUgbGlzdCBvZiBkaW1lbnNpb25zIGFuZCBjcmVhdGUgYSBzY2FsZSBmb3IgZWFjaC5cbiAgICBpZighZGltZW5zaW9ucykgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xuXG4gICAgeC5kb21haW4oZGltZW5zaW9ucyk7XG5cbiAgICB5ID0ge307XG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgIHlbZF0gPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAucmFuZ2UoW2lubmVySGVpZ2h0LCAwXSlcbiAgICAgICAgLmRvbWFpbihkb21haW5HZW5lcmF0b3IoZCwgZGF0YSkpO1xuXG4gICAgICB5W2RdLmJydXNoID0gZDMuc3ZnLmJydXNoKCkueSh5W2RdKVxuICAgICAgICAgIC5vbignYnJ1c2hzdGFydCcsIGJydXNoU3RhcnRIYW5kbGVyKVxuICAgICAgICAgIC5vbignYnJ1c2gnLCBicnVzaCk7XG4gICAgfSk7XG5cbiAgICBzdmcuYXR0cignd2lkdGgnLCB3aWR0aClcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCBoZWlnaHQpO1xuXG4gICAgLy8gYmFzZSBzdmdcbiAgICBib2R5LmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIG1hcmdpblszXSArICcsJyArIG1hcmdpblswXSArICcpJyk7XG5cbiAgICAvLyBjcmVhdGUgcGF0aHNcbiAgICBkYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJylcbiAgICAgIC5kYXRhKGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQuaWQ7IH0pXG4gICAgICAuZW50ZXIoKVxuICAgICAgICAuYXBwZW5kKCdwYXRoJyk7XG5cbiAgICBkYXRhTGluZXMuc2VsZWN0QWxsKCdwYXRoJylcbiAgICAgIC5hdHRyKCdkJywgcGF0aClcbiAgICAgIC5jbGFzc2VkKCdoaWdobGlnaHRlZCcsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgaWYgKGhpZ2hsaWdodGVkICYmIGhpZ2hsaWdodGVkLmlkID09PSBkLmlkKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaGlnaGxpZ2h0RmlsdGVyKSB7XG4gICAgICAgICAgcmV0dXJuIGhpZ2hsaWdodEZpbHRlcihkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0pO1xuXG4gICAgLy8gQWRkIGEgZ3JvdXAgZWxlbWVudCBmb3IgZWFjaCBkaW1lbnNpb24uXG4gICAgdmFyIGRpbWVuc2lvbkdyb3VwID0gYm9keVxuICAgICAgLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKVxuICAgICAgLmRhdGEoZGltZW5zaW9ucyk7XG5cblxuICAgIHZhciBuZXdEaW1lbnNpb25zID0gZGltZW5zaW9uR3JvdXAuZW50ZXIoKVxuICAgICAgICAuYXBwZW5kKCdnJylcbiAgICAgICAgICAuY2xhc3NlZCgnZGltZW5zaW9uJywgdHJ1ZSlcbiAgICAgICAgICAuY2FsbChjcmVhdGVEcmFnZ2FibGUoKSk7XG5cbiAgICBkaW1lbnNpb25Hcm91cC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7XG4gICAgICByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJztcbiAgICB9KTtcblxuICAgIC8vIEFkZCBhbiBheGlzIGFuZCB0aXRsZS5cbiAgICBuZXdEaW1lbnNpb25zLmFwcGVuZCgnZycpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcbiAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnbWlkZGxlJylcbiAgICAgICAgLmF0dHIoJ3knLCAtOSlcbiAgICAgICAgLnRleHQoU3RyaW5nKVxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZCl7XG4gICAgICAgICAgaWYgKGQzLmV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjsgLy8gY2xpY2sgc3VwcHJlc3NlZFxuXG4gICAgICAgICAgaWYoZCA9PT0gc2VsZWN0ZWRQcm9wZXJ0eSkgZCA9ICcnO1xuICAgICAgICAgIGVsc2UgZHJhdy5oaWdobGlnaHQoZCk7XG4gICAgICAgIH0pO1xuXG4gICAgZGltZW5zaW9uR3JvdXAuc2VsZWN0QWxsKCdnLmF4aXMnKVxuICAgICAgLmVhY2goZnVuY3Rpb24oZCkgeyBkMy5zZWxlY3QodGhpcykuY2FsbChheGlzLnNjYWxlKHlbZF0pKTsgfSk7XG5cbiAgICAvLyBBZGQgYW5kIHN0b3JlIGEgYnJ1c2ggZm9yIGVhY2ggYXhpcy5cbiAgICBuZXdEaW1lbnNpb25zLmFwcGVuZCgnZycpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdicnVzaCcpO1xuXG4gICAgZGltZW5zaW9uR3JvdXAuc2VsZWN0QWxsKCdnLmJydXNoJylcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmNhbGwoeVtkXS5icnVzaCk7XG4gICAgICB9KVxuICAgICAgLnNlbGVjdEFsbCgncmVjdCcpXG4gICAgICAuYXR0cigneCcsIC04KVxuICAgICAgLmF0dHIoJ3dpZHRoJywgMTYpO1xuXG4gICAgZHJhdy5oaWdobGlnaHQoc2VsZWN0ZWRQcm9wZXJ0eSk7XG4gICAgZHJhdy5maWx0ZXJzKGZpbHRlcnMpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH1cblxuICBkcmF3LndpZHRoID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gd2lkdGg7XG4gICAgd2lkdGggPSBfO1xuICAgIGlubmVyV2lkdGggPSB3aWR0aCAtIG1hcmdpblsxXSAtIG1hcmdpblszXTtcbiAgICB4ID0gZDMuc2NhbGUub3JkaW5hbCgpLnJhbmdlUG9pbnRzKFswLCBpbm5lcldpZHRoXSwgMC44KTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhlaWdodCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhlaWdodDtcbiAgICBoZWlnaHQgPSBfO1xuICAgIGlubmVySGVpZ2h0ID0gaGVpZ2h0IC0gbWFyZ2luWzBdIC0gbWFyZ2luWzJdO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcubWFyZ2luID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gbWFyZ2luO1xuICAgIG1hcmdpbiA9IF87XG4gICAgZHJhdy53aWR0aCh3aWR0aCk7XG4gICAgZHJhdy5oZWlnaHQoaGVpZ2h0KTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LnNlbGVjdCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpbWVuc2lvbnM7XG4gICAgZGltZW5zaW9ucyA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5kb21haW4gPSBmdW5jdGlvbihfKXtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkb21haW5HZW5lcmF0b3I7XG4gICAgZG9tYWluR2VuZXJhdG9yID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmNvbG9yID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY29sb3JHZW5lcmF0b3I7XG4gICAgY29sb3JHZW5lcmF0b3IgPSBfO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuaW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaW50ZXJwb2xhdG9yO1xuICAgIGludGVycG9sYXRvciA9IF87XG4gICAgbGluZSA9IGQzLnN2Zy5saW5lKCkuaW50ZXJwb2xhdGUoaW50ZXJwb2xhdG9yKTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhpZ2hsaWdodGVkID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaGlnaGxpZ2h0ZWQ7XG4gICAgaGlnaGxpZ2h0ZWQgPSBfO1xuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcub25GaWx0ZXJzQ2hhbmdlID0gZnVuY3Rpb24oXyl7XG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gb25GaWx0ZXJzQ2hhbmdlO1xuICAgIG9uRmlsdGVyc0NoYW5nZSA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5vbkhpZ2hsaWdodENoYW5nZSA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG9uSGlnaGxpZ2h0Q2hhbmdlO1xuICAgIG9uSGlnaGxpZ2h0Q2hhbmdlID0gXztcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhpZ2hsaWdodCA9IGZ1bmN0aW9uKF8pe1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHNlbGVjdGVkUHJvcGVydHk7XG5cbiAgICBpZihzZWxlY3RlZFByb3BlcnR5ICE9PSBfKXtcbiAgICAgIHNlbGVjdGVkUHJvcGVydHkgPSBfO1xuXG4gICAgICBvbkhpZ2hsaWdodENoYW5nZShzZWxlY3RlZFByb3BlcnR5KTtcbiAgICB9XG5cbiAgICB1cGRhdGVIaWdobGlnaHQoc3ZnKTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmhpZ2hsaWdodEZpbHRlciA9IGZ1bmN0aW9uKF8pIHtcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBoaWdobGlnaHRGaWx0ZXI7XG5cbiAgICBpZiAoaGlnaGxpZ2h0RmlsdGVyICE9PSBfKSB7XG4gICAgICBoaWdobGlnaHRGaWx0ZXIgPSBfO1xuICAgIH1cblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuZmlsdGVyID0gZnVuY3Rpb24oZGltZW5zaW9uLCBleHRlbnQpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICB2YXIgY3VycmVudCA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcblxuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpe1xuICAgICAgaWYoY3VycmVudFswXSA9PT0gY3VycmVudFsxXSkgcmV0dXJuOyAvLyB1bmRlZmluZWQgaWYgdW5zZXRcbiAgICAgIHJldHVybiBjdXJyZW50O1xuICAgIH1cblxuICAgIGlmKCFleHRlbnQpIGV4dGVudCA9IFswLDBdOyAvLyB0aGlzIGhpZGVzIGJydXNoXG5cbiAgICBpZihjdXJyZW50WzBdID09PSBleHRlbnRbMF0gJiYgY3VycmVudFsxXSA9PT0gZXh0ZW50WzFdKSByZXR1cm4gZHJhdztcblxuICAgIHN2Zy5zZWxlY3RBbGwoJy5icnVzaCcpLmZpbHRlcihmdW5jdGlvbihkKXtcbiAgICAgIHJldHVybiBkID09PSBkaW1lbnNpb247XG4gICAgfSkuY2FsbCh5W2RpbWVuc2lvbl0uYnJ1c2guZXh0ZW50KGV4dGVudCkpLmNhbGwoYnJ1c2gpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5maWx0ZXJzID0gZnVuY3Rpb24obmV3RmlsdGVycyl7XG4gICAgaWYgKCFuZXdGaWx0ZXJzKSBuZXdGaWx0ZXJzID0ge307XG4gICAgZmlsdGVycyA9IG5ld0ZpbHRlcnM7XG4gICAgdmFyIGN1cnJlbnQgPSB7fTtcbiAgICB2YXIgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKHkgfHwge30pO1xuXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICAvLyBza2lwIHVuc2V0IGZpbHRlcnNcbiAgICAgIGlmKHlbZGltZW5zaW9uXS5icnVzaC5lbXB0eSgpKSByZXR1cm47XG5cbiAgICAgIGN1cnJlbnRbZGltZW5zaW9uXSA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcbiAgICB9KTtcblxuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcblxuICAgIHZhciBzYW1lID0gZGltZW5zaW9ucy5ldmVyeShmdW5jdGlvbihkaW1lbnNpb24pe1xuICAgICAgaWYoZGltZW5zaW9uIGluIG5ld0ZpbHRlcnMpe1xuICAgICAgICBpZighKGRpbWVuc2lvbiBpbiBjdXJyZW50KSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgIHJldHVybiAoY3VycmVudFtkaW1lbnNpb25dWzBdID09PSBuZXdGaWx0ZXJzW2RpbWVuc2lvbl1bMF0gJiZcbiAgICAgICAgICAgICAgICBjdXJyZW50W2RpbWVuc2lvbl1bMV0gPT09IG5ld0ZpbHRlcnNbZGltZW5zaW9uXVsxXSk7XG4gICAgICB9IGVsc2UgcmV0dXJuICEoZGltZW5zaW9uIGluIGN1cnJlbnQpO1xuICAgIH0pO1xuXG4gICAgaWYoc2FtZSkgcmV0dXJuIGRyYXc7XG5cbiAgICAvLyBaZXJvIG91dCBhbnkgaW1wbGljaXRseSBleGNsdWRlZCBkaW1lbnNpb25zXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XG4gICAgICBpZihkaW1lbnNpb24gaW4gbmV3RmlsdGVycyl7XG4gICAgICAgIHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQobmV3RmlsdGVyc1tkaW1lbnNpb25dKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHlbZGltZW5zaW9uXS5icnVzaC5jbGVhcigpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmJydXNoJykuZWFjaChmdW5jdGlvbihkaW1lbnNpb24pe1xuICAgICAgZDMuc2VsZWN0KHRoaXMpLmNhbGwoeVtkaW1lbnNpb25dLmJydXNoKTtcbiAgICB9KTtcblxuICAgIHN2Zy5jYWxsKGJydXNoKTtcblxuICAgIHJldHVybiBkcmF3O1xuICB9O1xuXG4gIGRyYXcuY29udGFpbmVyID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICBjb250YWluZXIgPSBfO1xuXG4gICAgc3ZnID0gZDMuc2VsZWN0KGNvbnRhaW5lcikuYXBwZW5kKCdzdmcnKVxuICAgICAgLmNsYXNzZWQoJ3BhcmFsbGVsLWNvb3JkaW5hdGVzLWNoYXJ0JywgdHJ1ZSk7XG5cbiAgICBib2R5ID0gc3ZnLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnYm9keScpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgwLDApJyk7XG5cbiAgICBkYXRhTGluZXMgPSBib2R5LmFwcGVuZCgnZycpLmNsYXNzZWQoJ2RhdGFsaW5lcycsIHRydWUpO1xuXG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5kYXRhID0gZnVuY3Rpb24oXykge1xuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRhdGE7XG4gICAgZGF0YSA9IF87XG4gICAgcmV0dXJuIGRyYXc7XG4gIH07XG5cbiAgZHJhdy5yZWRyYXcgPSBmdW5jdGlvbigpe1xuICAgIGRyYXcoKTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBkcmF3LmRyYXcgPSBmdW5jdGlvbigpe1xuICAgIGRyYXcoKTtcbiAgICByZXR1cm4gZHJhdztcbiAgfTtcblxuICBpbml0KGNvbmZpZyB8fCB7fSk7XG5cbiAgcmV0dXJuIGRyYXc7XG59O1xuIiwiLy8gRm9yIElFOStcbihmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICggZXZlbnQsIHBhcmFtcyApIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UsIGRldGFpbDogdW5kZWZpbmVkIH07XG4gICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG4gICAgZXZ0LmluaXRDdXN0b21FdmVudCggZXZlbnQsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCApO1xuICAgIHJldHVybiBldnQ7XG4gICB9XG5cbiAgQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcblxuICB3aW5kb3cuQ3VzdG9tRXZlbnQgPSBDdXN0b21FdmVudDtcbn0pKCk7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb2xvclNjYWxlR2VuZXJhdG9yKHByb3BlcnR5LCBkYXRhKXtcbiAgcmV0dXJuIGQzLnNjYWxlLmxpbmVhcigpXG4gICAgLmRvbWFpbihkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gK2RbcHJvcGVydHldOyB9KSlcbiAgICAucmFuZ2UoWydoc2woMTIwLCA0MCUsIDUwJSknLCAnaHNsKDAsIDYwJSwgNTAlKSddKSAvLyByZWQgdG8gZ3JlZW5cbiAgICAuaW50ZXJwb2xhdGUoZDMuaW50ZXJwb2xhdGVIc2wpO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW50ZXJwb2xhdG9yKHBvaW50cyl7XG4gIHZhciBwb2ludCwgXG4gICAgYWN0aW9uID0gJycsIFxuICAgIGxpbmVCdWlsZGVyID0gW107XG5cbiAgZm9yKHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKyspe1xuICAgIHBvaW50ID0gcG9pbnRzW2ldO1xuXG4gICAgaWYoaXNOYU4ocG9pbnRbMV0pKXtcbiAgICAgIGlmKGFjdGlvbiAhPT0gJycpIGFjdGlvbiA9ICdNJztcbiAgICB9IGVsc2Uge1xuICAgICAgbGluZUJ1aWxkZXIucHVzaChhY3Rpb24sIHBvaW50KTtcbiAgICAgIGFjdGlvbiA9ICdMJztcbiAgICB9XG4gIH1cbiAgXG4gIHBvaW50ID0gcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXTtcbiAgaWYoIWlzTmFOKHBvaW50WzFdKSl7XG4gICAgbGluZUJ1aWxkZXIucHVzaChhY3Rpb24sIHBvaW50KTtcbiAgfVxuXG4gIHJldHVybiBsaW5lQnVpbGRlci5qb2luKCcnKTtcbn07Il19
(1)
});
