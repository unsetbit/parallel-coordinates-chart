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
    .range(['hsl(0, 60%, 50%)', 'hsl(255, 60%, 50%)']) // red to blue
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG96YW5cXHdvcmtzcGFjZVxccGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnRcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2N1c3RvbUV2ZW50UG9seWZpbGwuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3IuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQm9ycm93cyBoZWF2aWx5IGZyb20gaHR0cDovL2JsLm9ja3Mub3JnL21ib3N0b2NrLzc1ODYzMzRcclxucmVxdWlyZSgnLi9jdXN0b21FdmVudFBvbHlmaWxsJyk7XHJcblxyXG5cclxudmFyIGRlZmF1bHRJbnRlcnBvbGF0b3IgPSByZXF1aXJlKCcuL2ludGVycG9sYXRvcicpLFxyXG4gIGRlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9kZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcicpO1xyXG5cclxuZnVuY3Rpb24gZGVmYXVsdERvbWFpbkdlbmVyYXRvcihkaW1lbnNpb24sIGRhdGEpe1xyXG4gIHJldHVybiBkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gK2RbZGltZW5zaW9uXTsgfSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyYWxsZWxDb29yZGluYXRlc0NoYXJ0KGNvbmZpZyl7XHJcblxyXG4gIC8vIENvbmZpZ3VyYWJsZSB2YXJpYWJsZXNcclxuICB2YXIgbWFyZ2luLCBcclxuICAgIHdpZHRoLCBcclxuICAgIGhlaWdodCwgXHJcbiAgICBzZWxlY3RlZFByb3BlcnR5LFxyXG4gICAgY29sb3JHZW5lcmF0b3IsXHJcbiAgICBkb21haW5HZW5lcmF0b3IsXHJcbiAgICBkaW1lbnNpb25zLFxyXG4gICAgaW50ZXJwb2xhdG9yO1xyXG5cclxuICAvLyBHZW5lcmF0ZWQgdmFyaWFibGVzXHJcbiAgdmFyIGlubmVyV2lkdGgsXHJcbiAgICBpbm5lckhlaWdodCxcclxuICAgIHgsXHJcbiAgICB5LCBcclxuICAgIGRyYWdnaW5nLCBcclxuICAgIGVsZW1lbnQsIFxyXG4gICAgZGF0YSwgXHJcbiAgICBzdmcsXHJcbiAgICBsaW5lO1xyXG5cclxuICB2YXIgYXhpcyA9IGQzLnN2Zy5heGlzKCkub3JpZW50KCdsZWZ0Jyk7XHJcblxyXG4gIGZ1bmN0aW9uIGluaXQoY29uZmlnKXtcclxuICAgIGlmKCdtYXJnaW4nIGluIGNvbmZpZykgZHJhdy5tYXJnaW4oY29uZmlnLm1hcmdpbik7XHJcbiAgICBlbHNlIGRyYXcubWFyZ2luKFszMCwgMTAsIDEwLCAxMF0pOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ3dpZHRoJyBpbiBjb25maWcpIGRyYXcud2lkdGgoY29uZmlnLndpZHRoKTtcclxuICAgIGVsc2UgZHJhdy53aWR0aCgxNTYwKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdoZWlnaHQnIGluIGNvbmZpZykgZHJhdy5oZWlnaHQoY29uZmlnLmhlaWdodCk7XHJcbiAgICBlbHNlIGRyYXcud2lkdGgoNTAwKTsgLy8gZGVmYXVsdDtcclxuXHJcbiAgICBpZignZG9tYWluJyBpbiBjb25maWcpIGRyYXcuZG9tYWluKGNvbmZpZy5kb21haW4pO1xyXG4gICAgZWxzZSBkcmF3LmRvbWFpbihkZWZhdWx0RG9tYWluR2VuZXJhdG9yKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdoaWdobGlnaHQnIGluIGNvbmZpZykgZHJhdy5oaWdobGlnaHQoY29uZmlnLmhpZ2hsaWdodCk7XHJcbiAgICBlbHNlIGRyYXcuaGlnaGxpZ2h0KCcnKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdpbnRlcnBvbGF0b3InIGluIGNvbmZpZykgZHJhdy5pbnRlcnBvbGF0b3IoY29uZmlnLmludGVycG9sYXRvcik7XHJcbiAgICBlbHNlIGRyYXcuaW50ZXJwb2xhdG9yKGRlZmF1bHRJbnRlcnBvbGF0b3IpOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2NvbG9yJyBpbiBjb25maWcpIGRyYXcuY29sb3IoY29uZmlnLmNvbG9yKTtcclxuICAgIGVsc2UgZHJhdy5jb2xvcihkZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcik7IC8vIGRlZmF1bHRcclxuXHJcbiAgICBpZignc2VsZWN0JyBpbiBjb25maWcpIGRyYXcuc2VsZWN0KGNvbmZpZy5zZWxlY3QpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gdXBkYXRlSGlnaGxpZ2h0KHN2Zyl7XHJcbiAgICBpZighc3ZnKSByZXR1cm47XHJcblxyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbi5zZWxlY3RlZCcpLmNsYXNzZWQoJ3NlbGVjdGVkJywgZmFsc2UpO1xyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpe1xyXG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmNsYXNzZWQoJ3NlbGVjdGVkJywgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICB2YXIgcGF0aHMgPSBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJyk7XHJcbiAgICBpZighc2VsZWN0ZWRQcm9wZXJ0eSkgcmV0dXJuIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XHJcbiAgICBpZighcGF0aHMgfHwgIXBhdGhzLmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIHN2Zy5kYXRhKClbMF0pO1xyXG4gICAgcGF0aHMuc3R5bGUoJ3N0cm9rZScsIGZ1bmN0aW9uKGQpeyBcclxuICAgICAgcmV0dXJuIGNvbG9yKGRbc2VsZWN0ZWRQcm9wZXJ0eV0pOyAgIFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgZnVuY3Rpb24gY3JlYXRlRHJhZ2dhYmxlKCl7XHJcbiAgICByZXR1cm4gZDMuYmVoYXZpb3IuZHJhZygpXHJcbiAgICAgIC5vbignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gdGhpcy5fX29yaWdpbl9fID0geChkKTtcclxuICAgICAgfSlcclxuICAgICAgLm9uKCdkcmFnJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgICAgICBkaW1lbnNpb25zLnNvcnQoZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gcG9zaXRpb24oYSkgLSBwb3NpdGlvbihiKTsgfSk7XHJcbiAgICAgICAgeC5kb21haW4oZGltZW5zaW9ucyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKS5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyBwb3NpdGlvbihkKSArICcpJzsgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5vbignZHJhZ2VuZCcsIGZ1bmN0aW9uKGQpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5fX29yaWdpbl9fO1xyXG4gICAgICAgIGRlbGV0ZSBkcmFnZ2luZ1tkXTtcclxuICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gV2hlbiBicnVzaGluZywgZG9u4oCZdCB0cmlnZ2VyIGF4aXMgZHJhZ2dpbmcuXHJcbiAgZnVuY3Rpb24gYnJ1c2hTdGFydEhhbmRsZXIoKSB7IFxyXG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IFxyXG4gIH1cclxuXHJcbiAgLy8gSGFuZGxlcyBhIGJydXNoIGV2ZW50LCB0b2dnbGluZyB0aGUgZGlzcGxheSBvZiBmb3JlZ3JvdW5kIGxpbmVzLlxyXG4gIGZ1bmN0aW9uIGJydXNoKCkge1xyXG4gICAgdmFyIGFjdGl2ZXMgPSBkaW1lbnNpb25zLmZpbHRlcihmdW5jdGlvbihwKSB7IHJldHVybiAheVtwXS5icnVzaC5lbXB0eSgpOyB9KSxcclxuICAgICAgICBleHRlbnRzID0gYWN0aXZlcy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4geVtwXS5icnVzaC5leHRlbnQoKTsgfSk7XHJcblxyXG4gICAgdmFyIHNlbGVjdGVkID0gW107XHJcbiAgICBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJykuYXR0cignY2xhc3MnLCBmdW5jdGlvbihkKSB7XHJcbiAgICAgIHZhciB2aXNpYmxlID0gYWN0aXZlcy5ldmVyeShmdW5jdGlvbihwLCBpKSB7XHJcbiAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYodmlzaWJsZSl7XHJcbiAgICAgICAgc2VsZWN0ZWQucHVzaChkKTtcclxuICAgICAgICByZXR1cm4gJ2FjdGl2ZSc7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuICdmaWx0ZXJlZCc7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBmaWx0ZXJzID0ge307XHJcbiAgICBhY3RpdmVzLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uLCBpKXtcclxuICAgICAgZmlsdGVyc1tkaW1lbnNpb25dID0gZXh0ZW50c1tpXTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBldmVudERldGFpbHMgPSB7XHJcbiAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXHJcbiAgICAgIHNlbGVjdGVkOiBzZWxlY3RlZCxcclxuICAgICAgZmlsdGVyczogZmlsdGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2NoYW5nZWZpbHRlcicsIHtkZXRhaWw6IGV2ZW50RGV0YWlsc30pO1xyXG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHBvc2l0aW9uKGQpIHtcclxuICAgIC8vIGlmIHdlJ3JlIGN1cnJlbnRseSBkcmFnZ2luZyB0aGUgYXhpcyByZXR1cm4gdGhlIGRyYWcgcG9zaXRpb25cclxuICAgIC8vIG90aGVyd2lzZSByZXR1cm4gdGhlIG5vcm1hbCB4LWF4aXMgcG9zaXRpb25cclxuICAgIHZhciB2ID0gZHJhZ2dpbmdbZF07XHJcbiAgICByZXR1cm4gdiA9PSBudWxsID8geChkKSA6IHY7XHJcbiAgfVxyXG5cclxuICAvLyBSZXR1cm5zIHRoZSBwYXRoIGZvciBhIGdpdmVuIGRhdGEgcG9pbnQuXHJcbiAgZnVuY3Rpb24gcGF0aChkKSB7XHJcbiAgICByZXR1cm4gbGluZShkaW1lbnNpb25zLm1hcChmdW5jdGlvbihwKSB7IFxyXG4gICAgICByZXR1cm4gW3Bvc2l0aW9uKHApLCB5W3BdKGRbcF0pXTsgXHJcbiAgICB9KSk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBkcmF3KGNvbnRhaW5lcil7XHJcbiAgICBkcmFnZ2luZyA9IHt9O1xyXG5cclxuICAgIGVsZW1lbnQgPSBjb250YWluZXIubm9kZSgpO1xyXG4gICAgZGF0YSA9IGNvbnRhaW5lci5kYXR1bSgpO1xyXG5cclxuICAgIC8vIEV4dHJhY3QgdGhlIGxpc3Qgb2YgZGltZW5zaW9ucyBhbmQgY3JlYXRlIGEgc2NhbGUgZm9yIGVhY2guXHJcbiAgICBpZighZGltZW5zaW9ucykgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xyXG5cclxuICAgIHguZG9tYWluKGRpbWVuc2lvbnMpO1xyXG4gICAgXHJcbiAgICB5ID0ge307XHJcbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZCkge1xyXG4gICAgICB5W2RdID0gZDMuc2NhbGUubGluZWFyKClcclxuICAgICAgICAucmFuZ2UoW2lubmVySGVpZ2h0LCAwXSlcclxuICAgICAgICAuZG9tYWluKGRvbWFpbkdlbmVyYXRvcihkLCBkYXRhKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBiYXNlIHN2Z1xyXG4gICAgc3ZnID0gY29udGFpbmVyXHJcbiAgICAgIC5zZWxlY3RBbGwoJ3N2ZycpXHJcbiAgICAgICAgLmRhdGEoW2RhdGFdKVxyXG4gICAgICAuZW50ZXIoKVxyXG4gICAgICAgIC5hcHBlbmQoJ3N2ZycpXHJcbiAgICAgICAgICAuY2xhc3NlZCgncGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQnLCB0cnVlKVxyXG4gICAgICAgICAgLmF0dHIoJ3dpZHRoJywgd2lkdGgpXHJcbiAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0KTtcclxuICAgIFxyXG4gICAgdmFyIGJvZHkgPSBzdmcgICAgICAgICAgXHJcbiAgICAgIC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW5bM10gKyAnLCcgKyBtYXJnaW5bMF0gKyAnKScpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSBwYXRoc1xyXG4gICAgYm9keS5hcHBlbmQoJ2cnKVxyXG4gICAgICAuY2xhc3NlZCgnZGF0YWxpbmVzJywgdHJ1ZSlcclxuICAgICAgLnNlbGVjdEFsbCgncGF0aCcpXHJcbiAgICAgIC5kYXRhKGRhdGEpXHJcbiAgICAgIC5lbnRlcigpXHJcbiAgICAgICAgLmFwcGVuZCgncGF0aCcpXHJcbiAgICAgICAgLmF0dHIoJ2QnLCBwYXRoKTtcclxuXHJcbiAgICAvLyBBZGQgYSBncm91cCBlbGVtZW50IGZvciBlYWNoIGRpbWVuc2lvbi5cclxuICAgIHZhciBkaW1lbnNpb25Hcm91cCA9IGJvZHlcclxuICAgICAgLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgICAgLmRhdGEoZGltZW5zaW9ucylcclxuICAgICAgICAuZW50ZXIoKVxyXG4gICAgICAgICAgLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAgIC5jbGFzc2VkKCdkaW1lbnNpb24nLCB0cnVlKVxyXG4gICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJzsgfSlcclxuICAgICAgICAgICAgLmNhbGwoY3JlYXRlRHJhZ2dhYmxlKCkpO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgYW4gYXhpcyBhbmQgdGl0bGUuXHJcbiAgICBkaW1lbnNpb25Hcm91cC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcclxuICAgICAgICAuZWFjaChmdW5jdGlvbihkKSB7IGQzLnNlbGVjdCh0aGlzKS5jYWxsKGF4aXMuc2NhbGUoeVtkXSkpOyB9KVxyXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcclxuICAgICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnbWlkZGxlJylcclxuICAgICAgICAuYXR0cigneScsIC05KVxyXG4gICAgICAgIC50ZXh0KFN0cmluZylcclxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZCl7XHJcbiAgICAgICAgICBpZiAoZDMuZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuOyAvLyBjbGljayBzdXBwcmVzc2VkXHJcbiAgICAgICAgICBpZihkID09PSBzZWxlY3RlZFByb3BlcnR5KSBkcmF3LmhpZ2hsaWdodCgnJyk7XHJcbiAgICAgICAgICBlbHNlIGRyYXcuaGlnaGxpZ2h0KGQpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBhbmQgc3RvcmUgYSBicnVzaCBmb3IgZWFjaCBheGlzLlxyXG4gICAgZGltZW5zaW9uR3JvdXAuYXBwZW5kKCdnJylcclxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYnJ1c2gnKVxyXG4gICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHsgXHJcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcykuY2FsbChcclxuICAgICAgICAgICAgeVtkXS5icnVzaCA9IGQzLnN2Zy5icnVzaCgpLnkoeVtkXSlcclxuICAgICAgICAgICAgICAub24oJ2JydXNoc3RhcnQnLCBicnVzaFN0YXJ0SGFuZGxlcilcclxuICAgICAgICAgICAgICAub24oJ2JydXNoJywgYnJ1c2gpXHJcbiAgICAgICAgICApOyBcclxuICAgICAgICB9KVxyXG4gICAgICAuc2VsZWN0QWxsKCdyZWN0JylcclxuICAgICAgICAuYXR0cigneCcsIC04KVxyXG4gICAgICAgIC5hdHRyKCd3aWR0aCcsIDE2KTtcclxuXHJcbiAgICBkcmF3LmhpZ2hsaWdodChzZWxlY3RlZFByb3BlcnR5KTtcclxuXHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9XHJcblxyXG4gIGRyYXcud2lkdGggPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHdpZHRoO1xyXG4gICAgd2lkdGggPSBfO1xyXG4gICAgaW5uZXJXaWR0aCA9IHdpZHRoIC0gbWFyZ2luWzFdIC0gbWFyZ2luWzNdO1xyXG4gICAgeCA9IGQzLnNjYWxlLm9yZGluYWwoKS5yYW5nZVBvaW50cyhbMCwgaW5uZXJXaWR0aF0sIDEpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5oZWlnaHQgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhlaWdodDtcclxuICAgIGhlaWdodCA9IF87XHJcbiAgICBpbm5lckhlaWdodCA9IGhlaWdodCAtIG1hcmdpblswXSAtIG1hcmdpblsyXTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcubWFyZ2luID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBtYXJnaW47XHJcbiAgICBtYXJnaW4gPSBfO1xyXG4gICAgZHJhdy53aWR0aCh3aWR0aCk7XHJcbiAgICBkcmF3LmhlaWdodChoZWlnaHQpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5zZWxlY3QgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpbWVuc2lvbnM7XHJcbiAgICBkaW1lbnNpb25zID0gXztcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuZG9tYWluID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkb21haW5HZW5lcmF0b3I7XHJcbiAgICBkb21haW5HZW5lcmF0b3IgPSBfO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuICBcclxuICBkcmF3LmNvbG9yID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBjb2xvckdlbmVyYXRvcjtcclxuICAgIGNvbG9yR2VuZXJhdG9yID0gXztcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuaW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBpbnRlcnBvbGF0b3I7XHJcbiAgICBpbnRlcnBvbGF0b3IgPSBfO1xyXG4gICAgbGluZSA9IGQzLnN2Zy5saW5lKCkuaW50ZXJwb2xhdGUoaW50ZXJwb2xhdG9yKTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuaGlnaGxpZ2h0ID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBzZWxlY3RlZFByb3BlcnR5O1xyXG4gICAgc2VsZWN0ZWRQcm9wZXJ0eSA9IF87XHJcbiAgICB1cGRhdGVIaWdobGlnaHQoc3ZnKTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuZmlsdGVyID0gZnVuY3Rpb24oZGltZW5zaW9uLCBleHRlbnQpe1xyXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCl7XHJcbiAgICAgIHZhciBicnVzaGVzID0ge307XHJcbiAgICAgIE9iamVjdC5rZXlzKHkpLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uKXtcclxuICAgICAgICB2YXIgZXh0ZW50ID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHNraXAgdW5zZXQgZmlsdGVyc1xyXG4gICAgICAgIGlmKGV4dGVudFswXSA9PT0gZXh0ZW50WzFdKSByZXR1cm47XHJcbiAgICAgICAgXHJcbiAgICAgICAgYnJ1c2hlc1tkaW1lbnNpb25dID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHJldHVybiBicnVzaGVzO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpe1xyXG4gICAgICBleHRlbnQgPSB5W2RpbWVuc2lvbl0uYnJ1c2guZXh0ZW50KCk7XHJcbiAgICAgIGlmKGV4dGVudFswXSA9PT0gZXh0ZW50WzFdKSByZXR1cm47IC8vIHVuZGVmaW5lZCBpZiB1bnNldFxyXG4gICAgICByZXR1cm4gZXh0ZW50O1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCFleHRlbnQpIGV4dGVudCA9IFswLDBdOyAvLyB0aGlzIGhpZGVzIGJydXNoXHJcblxyXG4gICAgc3ZnLnNlbGVjdEFsbCgnIC5icnVzaCcpLmZpbHRlcihmdW5jdGlvbihkKXtcclxuICAgICAgcmV0dXJuIGQgPT09IGRpbWVuc2lvbjtcclxuICAgIH0pLmNhbGwoeVtkaW1lbnNpb25dLmJydXNoLmV4dGVudChleHRlbnQpKS5jYWxsKGJydXNoKTsgICAgXHJcbiAgfTtcclxuXHJcbiAgZHJhdy5yZWRyYXcgPSBmdW5jdGlvbihjb250YWluZXIpe1xyXG4gICAgaWYoc3ZnKSBzdmcucmVtb3ZlKCk7XHJcbiAgICBkcmF3KGNvbnRhaW5lcik7XHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LmRyYXcgPSBmdW5jdGlvbihjb250YWluZXIpe1xyXG4gICAgZHJhdyhjb250YWluZXIpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgaW5pdChjb25maWcgfHwge30pO1xyXG5cclxuICByZXR1cm4gZHJhdztcclxufTtcclxuIiwiLy8gRm9yIElFOStcclxuKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBDdXN0b21FdmVudCAoIGV2ZW50LCBwYXJhbXMgKSB7XHJcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UsIGRldGFpbDogdW5kZWZpbmVkIH07XHJcbiAgICB2YXIgZXZ0ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcclxuICAgIGV2dC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50LCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwgKTtcclxuICAgIHJldHVybiBldnQ7XHJcbiAgIH1cclxuXHJcbiAgQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcclxuXHJcbiAgd2luZG93LkN1c3RvbUV2ZW50ID0gQ3VzdG9tRXZlbnQ7XHJcbn0pKCk7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb2xvclNjYWxlR2VuZXJhdG9yKHByb3BlcnR5LCBkYXRhKXtcclxuICByZXR1cm4gZDMuc2NhbGUubGluZWFyKClcclxuICAgIC5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICtkW3Byb3BlcnR5XTsgfSkpXHJcbiAgICAucmFuZ2UoWydoc2woMCwgNjAlLCA1MCUpJywgJ2hzbCgyNTUsIDYwJSwgNTAlKSddKSAvLyByZWQgdG8gYmx1ZVxyXG4gICAgLmludGVycG9sYXRlKGQzLmludGVycG9sYXRlSHNsKTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGludGVycG9sYXRvcihwb2ludHMpe1xyXG4gIHZhciBwb2ludCwgXHJcbiAgICBhY3Rpb24gPSAnJywgXHJcbiAgICBsaW5lQnVpbGRlciA9IFtdO1xyXG5cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKyl7XHJcbiAgICBwb2ludCA9IHBvaW50c1tpXTtcclxuXHJcbiAgICBpZihpc05hTihwb2ludFsxXSkpe1xyXG4gICAgICBpZihhY3Rpb24gIT09ICcnKSBhY3Rpb24gPSAnTSc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xyXG4gICAgICBhY3Rpb24gPSAnTCc7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIHBvaW50ID0gcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXTtcclxuICBpZighaXNOYU4ocG9pbnRbMV0pKXtcclxuICAgIGxpbmVCdWlsZGVyLnB1c2goYWN0aW9uLCBwb2ludCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbGluZUJ1aWxkZXIuam9pbignJyk7XHJcbn07Il19
(1)
});
