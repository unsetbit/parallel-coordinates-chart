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
    filters,
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

  // Handles a brush event, toggling the display of lines.
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
          
          if(d === selectedProperty) d = '';
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
    draw.filters(filters);

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

    if(selectedProperty !== _){
      selectedProperty = _;
      
      if(element){
        element.dispatchEvent(new CustomEvent('changehighlight', {detail: {
          element: element,
          highlight: selectedProperty
        }}));
      }
    }

    updateHighlight(svg);

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

    svg.selectAll(' .brush').filter(function(d){
      return d === dimension;
    }).call(y[dimension].brush.extent(extent)).call(brush);    

    return draw;
  };

  draw.filters = function(newFilters){
    filters = newFilters;
    var current = {};
    var dimensions = Object.keys(y || []);

    dimensions.forEach(function(dimension){
      var extent = y[dimension].brush.extent();
      
      // skip unset filters
      if(extent[0] === extent[1]) return;
      
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
      if(!(dimension in newFilters)){
        newFilters[dimension] = [0,0];
      }
    });

    var newKeys = Object.keys(newFilters);

    svg.selectAll(' .brush').filter(function(d){
      return ~newKeys.indexOf(d);
    }).each(function(d){
      d3.select(this).call(y[d].brush.extent(newFilters[d]));
    });

    svg.call(brush);

    return draw;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG96YW5cXHdvcmtzcGFjZVxccGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnRcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2N1c3RvbUV2ZW50UG9seWZpbGwuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3IuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQm9ycm93cyBoZWF2aWx5IGZyb20gaHR0cDovL2JsLm9ja3Mub3JnL21ib3N0b2NrLzc1ODYzMzRcclxucmVxdWlyZSgnLi9jdXN0b21FdmVudFBvbHlmaWxsJyk7XHJcblxyXG5cclxudmFyIGRlZmF1bHRJbnRlcnBvbGF0b3IgPSByZXF1aXJlKCcuL2ludGVycG9sYXRvcicpLFxyXG4gIGRlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9kZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcicpO1xyXG5cclxuZnVuY3Rpb24gZGVmYXVsdERvbWFpbkdlbmVyYXRvcihkaW1lbnNpb24sIGRhdGEpe1xyXG4gIHJldHVybiBkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gK2RbZGltZW5zaW9uXTsgfSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyYWxsZWxDb29yZGluYXRlc0NoYXJ0KGNvbmZpZyl7XHJcblxyXG4gIC8vIENvbmZpZ3VyYWJsZSB2YXJpYWJsZXNcclxuICB2YXIgbWFyZ2luLCBcclxuICAgIHdpZHRoLCBcclxuICAgIGhlaWdodCwgXHJcbiAgICBzZWxlY3RlZFByb3BlcnR5LFxyXG4gICAgZmlsdGVycyxcclxuICAgIGNvbG9yR2VuZXJhdG9yLFxyXG4gICAgZG9tYWluR2VuZXJhdG9yLFxyXG4gICAgZGltZW5zaW9ucyxcclxuICAgIGludGVycG9sYXRvcjtcclxuXHJcbiAgLy8gR2VuZXJhdGVkIHZhcmlhYmxlc1xyXG4gIHZhciBpbm5lcldpZHRoLFxyXG4gICAgaW5uZXJIZWlnaHQsXHJcbiAgICB4LFxyXG4gICAgeSwgXHJcbiAgICBkcmFnZ2luZywgXHJcbiAgICBlbGVtZW50LCBcclxuICAgIGRhdGEsIFxyXG4gICAgc3ZnLFxyXG4gICAgbGluZTtcclxuXHJcbiAgdmFyIGF4aXMgPSBkMy5zdmcuYXhpcygpLm9yaWVudCgnbGVmdCcpO1xyXG5cclxuICBmdW5jdGlvbiBpbml0KGNvbmZpZyl7XHJcbiAgICBpZignbWFyZ2luJyBpbiBjb25maWcpIGRyYXcubWFyZ2luKGNvbmZpZy5tYXJnaW4pO1xyXG4gICAgZWxzZSBkcmF3Lm1hcmdpbihbMzAsIDEwLCAxMCwgMTBdKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCd3aWR0aCcgaW4gY29uZmlnKSBkcmF3LndpZHRoKGNvbmZpZy53aWR0aCk7XHJcbiAgICBlbHNlIGRyYXcud2lkdGgoMTU2MCk7IC8vIGRlZmF1bHRcclxuXHJcbiAgICBpZignaGVpZ2h0JyBpbiBjb25maWcpIGRyYXcuaGVpZ2h0KGNvbmZpZy5oZWlnaHQpO1xyXG4gICAgZWxzZSBkcmF3LmhlaWdodCg1MDApOyAvLyBkZWZhdWx0O1xyXG5cclxuICAgIGlmKCdkb21haW4nIGluIGNvbmZpZykgZHJhdy5kb21haW4oY29uZmlnLmRvbWFpbik7XHJcbiAgICBlbHNlIGRyYXcuZG9tYWluKGRlZmF1bHREb21haW5HZW5lcmF0b3IpOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2hpZ2hsaWdodCcgaW4gY29uZmlnKSBkcmF3LmhpZ2hsaWdodChjb25maWcuaGlnaGxpZ2h0KTtcclxuICAgIGVsc2UgZHJhdy5oaWdobGlnaHQoJycpOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2ZpbHRlcnMnIGluIGNvbmZpZykgZHJhdy5maWx0ZXJzKGNvbmZpZy5maWx0ZXJzKTtcclxuICAgIGVsc2UgZHJhdy5maWx0ZXJzKHt9KTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdpbnRlcnBvbGF0b3InIGluIGNvbmZpZykgZHJhdy5pbnRlcnBvbGF0b3IoY29uZmlnLmludGVycG9sYXRvcik7XHJcbiAgICBlbHNlIGRyYXcuaW50ZXJwb2xhdG9yKGRlZmF1bHRJbnRlcnBvbGF0b3IpOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2NvbG9yJyBpbiBjb25maWcpIGRyYXcuY29sb3IoY29uZmlnLmNvbG9yKTtcclxuICAgIGVsc2UgZHJhdy5jb2xvcihkZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcik7IC8vIGRlZmF1bHRcclxuXHJcbiAgICBpZignc2VsZWN0JyBpbiBjb25maWcpIGRyYXcuc2VsZWN0KGNvbmZpZy5zZWxlY3QpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gdXBkYXRlSGlnaGxpZ2h0KHN2Zyl7XHJcbiAgICBpZighc3ZnKSByZXR1cm47XHJcblxyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbi5zZWxlY3RlZCcpLmNsYXNzZWQoJ3NlbGVjdGVkJywgZmFsc2UpO1xyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpe1xyXG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmNsYXNzZWQoJ3NlbGVjdGVkJywgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICB2YXIgcGF0aHMgPSBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJyk7XHJcbiAgICBpZighc2VsZWN0ZWRQcm9wZXJ0eSkgcmV0dXJuIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XHJcbiAgICBpZighcGF0aHMgfHwgIXBhdGhzLmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIHN2Zy5kYXRhKClbMF0pO1xyXG4gICAgcGF0aHMuc3R5bGUoJ3N0cm9rZScsIGZ1bmN0aW9uKGQpeyBcclxuICAgICAgcmV0dXJuIGNvbG9yKGRbc2VsZWN0ZWRQcm9wZXJ0eV0pOyAgIFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgZnVuY3Rpb24gY3JlYXRlRHJhZ2dhYmxlKCl7XHJcbiAgICByZXR1cm4gZDMuYmVoYXZpb3IuZHJhZygpXHJcbiAgICAgIC5vbignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gdGhpcy5fX29yaWdpbl9fID0geChkKTtcclxuICAgICAgfSlcclxuICAgICAgLm9uKCdkcmFnJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgICAgICBkaW1lbnNpb25zLnNvcnQoZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gcG9zaXRpb24oYSkgLSBwb3NpdGlvbihiKTsgfSk7XHJcbiAgICAgICAgeC5kb21haW4oZGltZW5zaW9ucyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKS5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyBwb3NpdGlvbihkKSArICcpJzsgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5vbignZHJhZ2VuZCcsIGZ1bmN0aW9uKGQpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5fX29yaWdpbl9fO1xyXG4gICAgICAgIGRlbGV0ZSBkcmFnZ2luZ1tkXTtcclxuICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gV2hlbiBicnVzaGluZywgZG9u4oCZdCB0cmlnZ2VyIGF4aXMgZHJhZ2dpbmcuXHJcbiAgZnVuY3Rpb24gYnJ1c2hTdGFydEhhbmRsZXIoKSB7IFxyXG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IFxyXG4gIH1cclxuXHJcbiAgLy8gSGFuZGxlcyBhIGJydXNoIGV2ZW50LCB0b2dnbGluZyB0aGUgZGlzcGxheSBvZiBsaW5lcy5cclxuICBmdW5jdGlvbiBicnVzaCgpIHtcclxuICAgIHZhciBhY3RpdmVzID0gZGltZW5zaW9ucy5maWx0ZXIoZnVuY3Rpb24ocCkgeyByZXR1cm4gIXlbcF0uYnJ1c2guZW1wdHkoKTsgfSksXHJcbiAgICAgICAgZXh0ZW50cyA9IGFjdGl2ZXMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHlbcF0uYnJ1c2guZXh0ZW50KCk7IH0pO1xyXG5cclxuICAgIHZhciBzZWxlY3RlZCA9IFtdO1xyXG4gICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICB2YXIgdmlzaWJsZSA9IGFjdGl2ZXMuZXZlcnkoZnVuY3Rpb24ocCwgaSkge1xyXG4gICAgICAgIHJldHVybiBleHRlbnRzW2ldWzBdIDw9IGRbcF0gJiYgZFtwXSA8PSBleHRlbnRzW2ldWzFdO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmKHZpc2libGUpe1xyXG4gICAgICAgIHNlbGVjdGVkLnB1c2goZCk7XHJcbiAgICAgICAgcmV0dXJuICdhY3RpdmUnO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiAnZmlsdGVyZWQnO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgZmlsdGVycyA9IHt9O1xyXG4gICAgYWN0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbiwgaSl7XHJcbiAgICAgIGZpbHRlcnNbZGltZW5zaW9uXSA9IGV4dGVudHNbaV07XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgZXZlbnREZXRhaWxzID0ge1xyXG4gICAgICBlbGVtZW50OiBlbGVtZW50LFxyXG4gICAgICBzZWxlY3RlZDogc2VsZWN0ZWQsXHJcbiAgICAgIGZpbHRlcnM6IGZpbHRlcnNcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdjaGFuZ2VmaWx0ZXInLCB7ZGV0YWlsOiBldmVudERldGFpbHN9KTtcclxuICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChldmVudCk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBwb3NpdGlvbihkKSB7XHJcbiAgICAvLyBpZiB3ZSdyZSBjdXJyZW50bHkgZHJhZ2dpbmcgdGhlIGF4aXMgcmV0dXJuIHRoZSBkcmFnIHBvc2l0aW9uXHJcbiAgICAvLyBvdGhlcndpc2UgcmV0dXJuIHRoZSBub3JtYWwgeC1heGlzIHBvc2l0aW9uXHJcbiAgICB2YXIgdiA9IGRyYWdnaW5nW2RdO1xyXG4gICAgcmV0dXJuIHYgPT0gbnVsbCA/IHgoZCkgOiB2O1xyXG4gIH1cclxuXHJcbiAgLy8gUmV0dXJucyB0aGUgcGF0aCBmb3IgYSBnaXZlbiBkYXRhIHBvaW50LlxyXG4gIGZ1bmN0aW9uIHBhdGgoZCkge1xyXG4gICAgcmV0dXJuIGxpbmUoZGltZW5zaW9ucy5tYXAoZnVuY3Rpb24ocCkgeyBcclxuICAgICAgcmV0dXJuIFtwb3NpdGlvbihwKSwgeVtwXShkW3BdKV07IFxyXG4gICAgfSkpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gZHJhdyhjb250YWluZXIpe1xyXG4gICAgZHJhZ2dpbmcgPSB7fTtcclxuXHJcbiAgICBlbGVtZW50ID0gY29udGFpbmVyLm5vZGUoKTtcclxuICAgIGRhdGEgPSBjb250YWluZXIuZGF0dW0oKTtcclxuXHJcbiAgICAvLyBFeHRyYWN0IHRoZSBsaXN0IG9mIGRpbWVuc2lvbnMgYW5kIGNyZWF0ZSBhIHNjYWxlIGZvciBlYWNoLlxyXG4gICAgaWYoIWRpbWVuc2lvbnMpIGRpbWVuc2lvbnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcclxuXHJcbiAgICB4LmRvbWFpbihkaW1lbnNpb25zKTtcclxuICAgIFxyXG4gICAgeSA9IHt9O1xyXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcclxuICAgICAgeVtkXSA9IGQzLnNjYWxlLmxpbmVhcigpXHJcbiAgICAgICAgLnJhbmdlKFtpbm5lckhlaWdodCwgMF0pXHJcbiAgICAgICAgLmRvbWFpbihkb21haW5HZW5lcmF0b3IoZCwgZGF0YSkpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gYmFzZSBzdmdcclxuICAgIHN2ZyA9IGNvbnRhaW5lclxyXG4gICAgICAuc2VsZWN0QWxsKCdzdmcnKVxyXG4gICAgICAgIC5kYXRhKFtkYXRhXSlcclxuICAgICAgLmVudGVyKClcclxuICAgICAgICAuYXBwZW5kKCdzdmcnKVxyXG4gICAgICAgICAgLmNsYXNzZWQoJ3BhcmFsbGVsLWNvb3JkaW5hdGVzLWNoYXJ0JywgdHJ1ZSlcclxuICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIHdpZHRoKVxyXG4gICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIGhlaWdodCk7XHJcbiAgICBcclxuICAgIHZhciBib2R5ID0gc3ZnICAgICAgICAgIFxyXG4gICAgICAuYXBwZW5kKCdnJylcclxuICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgbWFyZ2luWzNdICsgJywnICsgbWFyZ2luWzBdICsgJyknKTtcclxuXHJcbiAgICAvLyBjcmVhdGUgcGF0aHNcclxuICAgIGJvZHkuYXBwZW5kKCdnJylcclxuICAgICAgLmNsYXNzZWQoJ2RhdGFsaW5lcycsIHRydWUpXHJcbiAgICAgIC5zZWxlY3RBbGwoJ3BhdGgnKVxyXG4gICAgICAuZGF0YShkYXRhKVxyXG4gICAgICAuZW50ZXIoKVxyXG4gICAgICAgIC5hcHBlbmQoJ3BhdGgnKVxyXG4gICAgICAgIC5hdHRyKCdkJywgcGF0aCk7XHJcblxyXG4gICAgLy8gQWRkIGEgZ3JvdXAgZWxlbWVudCBmb3IgZWFjaCBkaW1lbnNpb24uXHJcbiAgICB2YXIgZGltZW5zaW9uR3JvdXAgPSBib2R5XHJcbiAgICAgIC5zZWxlY3RBbGwoJy5kaW1lbnNpb24nKVxyXG4gICAgICAgIC5kYXRhKGRpbWVuc2lvbnMpXHJcbiAgICAgICAgLmVudGVyKClcclxuICAgICAgICAgIC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgICAgICAuY2xhc3NlZCgnZGltZW5zaW9uJywgdHJ1ZSlcclxuICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICd0cmFuc2xhdGUoJyArIHgoZCkgKyAnKSc7IH0pXHJcbiAgICAgICAgICAgIC5jYWxsKGNyZWF0ZURyYWdnYWJsZSgpKTtcclxuICAgIFxyXG4gICAgLy8gQWRkIGFuIGF4aXMgYW5kIHRpdGxlLlxyXG4gICAgZGltZW5zaW9uR3JvdXAuYXBwZW5kKCdnJylcclxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcycpXHJcbiAgICAgICAgLmVhY2goZnVuY3Rpb24oZCkgeyBkMy5zZWxlY3QodGhpcykuY2FsbChheGlzLnNjYWxlKHlbZF0pKTsgfSlcclxuICAgICAgLmFwcGVuZCgndGV4dCcpXHJcbiAgICAgICAgLmF0dHIoJ3RleHQtYW5jaG9yJywgJ21pZGRsZScpXHJcbiAgICAgICAgLmF0dHIoJ3knLCAtOSlcclxuICAgICAgICAudGV4dChTdHJpbmcpXHJcbiAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgICAgaWYgKGQzLmV2ZW50LmRlZmF1bHRQcmV2ZW50ZWQpIHJldHVybjsgLy8gY2xpY2sgc3VwcHJlc3NlZFxyXG4gICAgICAgICAgXHJcbiAgICAgICAgICBpZihkID09PSBzZWxlY3RlZFByb3BlcnR5KSBkID0gJyc7XHJcbiAgICAgICAgICBlbHNlIGRyYXcuaGlnaGxpZ2h0KGQpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBhbmQgc3RvcmUgYSBicnVzaCBmb3IgZWFjaCBheGlzLlxyXG4gICAgZGltZW5zaW9uR3JvdXAuYXBwZW5kKCdnJylcclxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYnJ1c2gnKVxyXG4gICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHsgXHJcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcykuY2FsbChcclxuICAgICAgICAgICAgeVtkXS5icnVzaCA9IGQzLnN2Zy5icnVzaCgpLnkoeVtkXSlcclxuICAgICAgICAgICAgICAub24oJ2JydXNoc3RhcnQnLCBicnVzaFN0YXJ0SGFuZGxlcilcclxuICAgICAgICAgICAgICAub24oJ2JydXNoJywgYnJ1c2gpXHJcbiAgICAgICAgICApOyBcclxuICAgICAgICB9KVxyXG4gICAgICAuc2VsZWN0QWxsKCdyZWN0JylcclxuICAgICAgICAuYXR0cigneCcsIC04KVxyXG4gICAgICAgIC5hdHRyKCd3aWR0aCcsIDE2KTtcclxuXHJcbiAgICBkcmF3LmhpZ2hsaWdodChzZWxlY3RlZFByb3BlcnR5KTtcclxuICAgIGRyYXcuZmlsdGVycyhmaWx0ZXJzKTtcclxuXHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9XHJcblxyXG4gIGRyYXcud2lkdGggPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHdpZHRoO1xyXG4gICAgd2lkdGggPSBfO1xyXG4gICAgaW5uZXJXaWR0aCA9IHdpZHRoIC0gbWFyZ2luWzFdIC0gbWFyZ2luWzNdO1xyXG4gICAgeCA9IGQzLnNjYWxlLm9yZGluYWwoKS5yYW5nZVBvaW50cyhbMCwgaW5uZXJXaWR0aF0sIDEpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5oZWlnaHQgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGhlaWdodDtcclxuICAgIGhlaWdodCA9IF87XHJcbiAgICBpbm5lckhlaWdodCA9IGhlaWdodCAtIG1hcmdpblswXSAtIG1hcmdpblsyXTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcubWFyZ2luID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBtYXJnaW47XHJcbiAgICBtYXJnaW4gPSBfO1xyXG4gICAgZHJhdy53aWR0aCh3aWR0aCk7XHJcbiAgICBkcmF3LmhlaWdodChoZWlnaHQpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5zZWxlY3QgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRpbWVuc2lvbnM7XHJcbiAgICBkaW1lbnNpb25zID0gXztcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuZG9tYWluID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkb21haW5HZW5lcmF0b3I7XHJcbiAgICBkb21haW5HZW5lcmF0b3IgPSBfO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuICBcclxuICBkcmF3LmNvbG9yID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBjb2xvckdlbmVyYXRvcjtcclxuICAgIGNvbG9yR2VuZXJhdG9yID0gXztcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuaW50ZXJwb2xhdG9yID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBpbnRlcnBvbGF0b3I7XHJcbiAgICBpbnRlcnBvbGF0b3IgPSBfO1xyXG4gICAgbGluZSA9IGQzLnN2Zy5saW5lKCkuaW50ZXJwb2xhdGUoaW50ZXJwb2xhdG9yKTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGRyYXcuaGlnaGxpZ2h0ID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBzZWxlY3RlZFByb3BlcnR5O1xyXG5cclxuICAgIGlmKHNlbGVjdGVkUHJvcGVydHkgIT09IF8pe1xyXG4gICAgICBzZWxlY3RlZFByb3BlcnR5ID0gXztcclxuICAgICAgXHJcbiAgICAgIGlmKGVsZW1lbnQpe1xyXG4gICAgICAgIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQoJ2NoYW5nZWhpZ2hsaWdodCcsIHtkZXRhaWw6IHtcclxuICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXHJcbiAgICAgICAgICBoaWdobGlnaHQ6IHNlbGVjdGVkUHJvcGVydHlcclxuICAgICAgICB9fSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdXBkYXRlSGlnaGxpZ2h0KHN2Zyk7XHJcblxyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5maWx0ZXIgPSBmdW5jdGlvbihkaW1lbnNpb24sIGV4dGVudCl7XHJcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcbiAgICB2YXIgY3VycmVudCA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcclxuXHJcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAxKXtcclxuICAgICAgaWYoY3VycmVudFswXSA9PT0gY3VycmVudFsxXSkgcmV0dXJuOyAvLyB1bmRlZmluZWQgaWYgdW5zZXRcclxuICAgICAgcmV0dXJuIGN1cnJlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIWV4dGVudCkgZXh0ZW50ID0gWzAsMF07IC8vIHRoaXMgaGlkZXMgYnJ1c2hcclxuXHJcbiAgICBpZihjdXJyZW50WzBdID09PSBleHRlbnRbMF0gJiYgY3VycmVudFsxXSA9PT0gZXh0ZW50WzFdKSByZXR1cm4gZHJhdztcclxuXHJcbiAgICBzdmcuc2VsZWN0QWxsKCcgLmJydXNoJykuZmlsdGVyKGZ1bmN0aW9uKGQpe1xyXG4gICAgICByZXR1cm4gZCA9PT0gZGltZW5zaW9uO1xyXG4gICAgfSkuY2FsbCh5W2RpbWVuc2lvbl0uYnJ1c2guZXh0ZW50KGV4dGVudCkpLmNhbGwoYnJ1c2gpOyAgICBcclxuXHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LmZpbHRlcnMgPSBmdW5jdGlvbihuZXdGaWx0ZXJzKXtcclxuICAgIGZpbHRlcnMgPSBuZXdGaWx0ZXJzO1xyXG4gICAgdmFyIGN1cnJlbnQgPSB7fTtcclxuICAgIHZhciBkaW1lbnNpb25zID0gT2JqZWN0LmtleXMoeSB8fCBbXSk7XHJcblxyXG4gICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XHJcbiAgICAgIHZhciBleHRlbnQgPSB5W2RpbWVuc2lvbl0uYnJ1c2guZXh0ZW50KCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBza2lwIHVuc2V0IGZpbHRlcnNcclxuICAgICAgaWYoZXh0ZW50WzBdID09PSBleHRlbnRbMV0pIHJldHVybjtcclxuICAgICAgXHJcbiAgICAgIGN1cnJlbnRbZGltZW5zaW9uXSA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gY3VycmVudDtcclxuXHJcbiAgICB2YXIgc2FtZSA9IGRpbWVuc2lvbnMuZXZlcnkoZnVuY3Rpb24oZGltZW5zaW9uKXtcclxuICAgICAgaWYoZGltZW5zaW9uIGluIG5ld0ZpbHRlcnMpe1xyXG4gICAgICAgIGlmKCEoZGltZW5zaW9uIGluIGN1cnJlbnQpKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIHJldHVybiAoY3VycmVudFtkaW1lbnNpb25dWzBdID09PSBuZXdGaWx0ZXJzW2RpbWVuc2lvbl1bMF0gJiZcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRbZGltZW5zaW9uXVsxXSA9PT0gbmV3RmlsdGVyc1tkaW1lbnNpb25dWzFdKTtcclxuICAgICAgfSBlbHNlIHJldHVybiAhKGRpbWVuc2lvbiBpbiBjdXJyZW50KTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmKHNhbWUpIHJldHVybiBkcmF3O1xyXG5cclxuICAgIC8vIFplcm8gb3V0IGFueSBpbXBsaWNpdGx5IGV4Y2x1ZGVkIGRpbWVuc2lvbnNcclxuICAgIGRpbWVuc2lvbnMuZm9yRWFjaChmdW5jdGlvbihkaW1lbnNpb24pe1xyXG4gICAgICBpZighKGRpbWVuc2lvbiBpbiBuZXdGaWx0ZXJzKSl7XHJcbiAgICAgICAgbmV3RmlsdGVyc1tkaW1lbnNpb25dID0gWzAsMF07XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBuZXdLZXlzID0gT2JqZWN0LmtleXMobmV3RmlsdGVycyk7XHJcblxyXG4gICAgc3ZnLnNlbGVjdEFsbCgnIC5icnVzaCcpLmZpbHRlcihmdW5jdGlvbihkKXtcclxuICAgICAgcmV0dXJuIH5uZXdLZXlzLmluZGV4T2YoZCk7XHJcbiAgICB9KS5lYWNoKGZ1bmN0aW9uKGQpe1xyXG4gICAgICBkMy5zZWxlY3QodGhpcykuY2FsbCh5W2RdLmJydXNoLmV4dGVudChuZXdGaWx0ZXJzW2RdKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzdmcuY2FsbChicnVzaCk7XHJcblxyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5yZWRyYXcgPSBmdW5jdGlvbihjb250YWluZXIpe1xyXG4gICAgaWYoc3ZnKSBzdmcucmVtb3ZlKCk7XHJcbiAgICBkcmF3KGNvbnRhaW5lcik7XHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LmRyYXcgPSBmdW5jdGlvbihjb250YWluZXIpe1xyXG4gICAgZHJhdyhjb250YWluZXIpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgaW5pdChjb25maWcgfHwge30pO1xyXG5cclxuICByZXR1cm4gZHJhdztcclxufTtcclxuIiwiLy8gRm9yIElFOStcclxuKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBDdXN0b21FdmVudCAoIGV2ZW50LCBwYXJhbXMgKSB7XHJcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UsIGRldGFpbDogdW5kZWZpbmVkIH07XHJcbiAgICB2YXIgZXZ0ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcclxuICAgIGV2dC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50LCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwgKTtcclxuICAgIHJldHVybiBldnQ7XHJcbiAgIH1cclxuXHJcbiAgQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcclxuXHJcbiAgd2luZG93LkN1c3RvbUV2ZW50ID0gQ3VzdG9tRXZlbnQ7XHJcbn0pKCk7IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb2xvclNjYWxlR2VuZXJhdG9yKHByb3BlcnR5LCBkYXRhKXtcclxuICByZXR1cm4gZDMuc2NhbGUubGluZWFyKClcclxuICAgIC5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICtkW3Byb3BlcnR5XTsgfSkpXHJcbiAgICAucmFuZ2UoWydoc2woMCwgNjAlLCA1MCUpJywgJ2hzbCgyNTUsIDYwJSwgNTAlKSddKSAvLyByZWQgdG8gYmx1ZVxyXG4gICAgLmludGVycG9sYXRlKGQzLmludGVycG9sYXRlSHNsKTtcclxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGludGVycG9sYXRvcihwb2ludHMpe1xyXG4gIHZhciBwb2ludCwgXHJcbiAgICBhY3Rpb24gPSAnJywgXHJcbiAgICBsaW5lQnVpbGRlciA9IFtdO1xyXG5cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKyl7XHJcbiAgICBwb2ludCA9IHBvaW50c1tpXTtcclxuXHJcbiAgICBpZihpc05hTihwb2ludFsxXSkpe1xyXG4gICAgICBpZihhY3Rpb24gIT09ICcnKSBhY3Rpb24gPSAnTSc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xyXG4gICAgICBhY3Rpb24gPSAnTCc7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIHBvaW50ID0gcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXTtcclxuICBpZighaXNOYU4ocG9pbnRbMV0pKXtcclxuICAgIGxpbmVCdWlsZGVyLnB1c2goYWN0aW9uLCBwb2ludCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbGluZUJ1aWxkZXIuam9pbignJyk7XHJcbn07Il19
(1)
});
