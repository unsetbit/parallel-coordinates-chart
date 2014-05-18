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
    else draw.height(500); // default;

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG96YW5cXHdvcmtzcGFjZVxccGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnRcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2N1c3RvbUV2ZW50UG9seWZpbGwuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3IuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBCb3Jyb3dzIGhlYXZpbHkgZnJvbSBodHRwOi8vYmwub2Nrcy5vcmcvbWJvc3RvY2svNzU4NjMzNFxyXG5yZXF1aXJlKCcuL2N1c3RvbUV2ZW50UG9seWZpbGwnKTtcclxuXHJcblxyXG52YXIgZGVmYXVsdEludGVycG9sYXRvciA9IHJlcXVpcmUoJy4vaW50ZXJwb2xhdG9yJyksXHJcbiAgZGVmYXVsdENvbG9yU2NhbGVHZW5lcmF0b3IgPSByZXF1aXJlKCcuL2RlZmF1bHRDb2xvclNjYWxlR2VuZXJhdG9yJyk7XHJcblxyXG5mdW5jdGlvbiBkZWZhdWx0RG9tYWluR2VuZXJhdG9yKGRpbWVuc2lvbiwgZGF0YSl7XHJcbiAgcmV0dXJuIGQzLmV4dGVudChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiArZFtkaW1lbnNpb25dOyB9KTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJhbGxlbENvb3JkaW5hdGVzQ2hhcnQoY29uZmlnKXtcclxuXHJcbiAgLy8gQ29uZmlndXJhYmxlIHZhcmlhYmxlc1xyXG4gIHZhciBtYXJnaW4sIFxyXG4gICAgd2lkdGgsIFxyXG4gICAgaGVpZ2h0LCBcclxuICAgIHNlbGVjdGVkUHJvcGVydHksXHJcbiAgICBjb2xvckdlbmVyYXRvcixcclxuICAgIGRvbWFpbkdlbmVyYXRvcixcclxuICAgIGRpbWVuc2lvbnMsXHJcbiAgICBpbnRlcnBvbGF0b3I7XHJcblxyXG4gIC8vIEdlbmVyYXRlZCB2YXJpYWJsZXNcclxuICB2YXIgaW5uZXJXaWR0aCxcclxuICAgIGlubmVySGVpZ2h0LFxyXG4gICAgeCxcclxuICAgIHksIFxyXG4gICAgZHJhZ2dpbmcsIFxyXG4gICAgZWxlbWVudCwgXHJcbiAgICBkYXRhLCBcclxuICAgIHN2ZyxcclxuICAgIGxpbmU7XHJcblxyXG4gIHZhciBheGlzID0gZDMuc3ZnLmF4aXMoKS5vcmllbnQoJ2xlZnQnKTtcclxuXHJcbiAgZnVuY3Rpb24gaW5pdChjb25maWcpe1xyXG4gICAgaWYoJ21hcmdpbicgaW4gY29uZmlnKSBkcmF3Lm1hcmdpbihjb25maWcubWFyZ2luKTtcclxuICAgIGVsc2UgZHJhdy5tYXJnaW4oWzMwLCAxMCwgMTAsIDEwXSk7IC8vIGRlZmF1bHRcclxuXHJcbiAgICBpZignd2lkdGgnIGluIGNvbmZpZykgZHJhdy53aWR0aChjb25maWcud2lkdGgpO1xyXG4gICAgZWxzZSBkcmF3LndpZHRoKDE1NjApOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2hlaWdodCcgaW4gY29uZmlnKSBkcmF3LmhlaWdodChjb25maWcuaGVpZ2h0KTtcclxuICAgIGVsc2UgZHJhdy5oZWlnaHQoNTAwKTsgLy8gZGVmYXVsdDtcclxuXHJcbiAgICBpZignZG9tYWluJyBpbiBjb25maWcpIGRyYXcuZG9tYWluKGNvbmZpZy5kb21haW4pO1xyXG4gICAgZWxzZSBkcmF3LmRvbWFpbihkZWZhdWx0RG9tYWluR2VuZXJhdG9yKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdoaWdobGlnaHQnIGluIGNvbmZpZykgZHJhdy5oaWdobGlnaHQoY29uZmlnLmhpZ2hsaWdodCk7XHJcbiAgICBlbHNlIGRyYXcuaGlnaGxpZ2h0KCcnKTsgLy8gZGVmYXVsdFxyXG5cclxuICAgIGlmKCdpbnRlcnBvbGF0b3InIGluIGNvbmZpZykgZHJhdy5pbnRlcnBvbGF0b3IoY29uZmlnLmludGVycG9sYXRvcik7XHJcbiAgICBlbHNlIGRyYXcuaW50ZXJwb2xhdG9yKGRlZmF1bHRJbnRlcnBvbGF0b3IpOyAvLyBkZWZhdWx0XHJcblxyXG4gICAgaWYoJ2NvbG9yJyBpbiBjb25maWcpIGRyYXcuY29sb3IoY29uZmlnLmNvbG9yKTtcclxuICAgIGVsc2UgZHJhdy5jb2xvcihkZWZhdWx0Q29sb3JTY2FsZUdlbmVyYXRvcik7IC8vIGRlZmF1bHRcclxuXHJcbiAgICBpZignc2VsZWN0JyBpbiBjb25maWcpIGRyYXcuc2VsZWN0KGNvbmZpZy5zZWxlY3QpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gdXBkYXRlSGlnaGxpZ2h0KHN2Zyl7XHJcbiAgICBpZighc3ZnKSByZXR1cm47XHJcblxyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbi5zZWxlY3RlZCcpLmNsYXNzZWQoJ3NlbGVjdGVkJywgZmFsc2UpO1xyXG4gICAgc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpe1xyXG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmNsYXNzZWQoJ3NlbGVjdGVkJywgdHJ1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICB2YXIgcGF0aHMgPSBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJyk7XHJcbiAgICBpZighc2VsZWN0ZWRQcm9wZXJ0eSkgcmV0dXJuIHBhdGhzLnN0eWxlKCdzdHJva2UnLCAnJyk7XHJcbiAgICBpZighcGF0aHMgfHwgIXBhdGhzLmxlbmd0aCkgcmV0dXJuO1xyXG5cclxuICAgIHZhciBjb2xvciA9IGNvbG9yR2VuZXJhdG9yKHNlbGVjdGVkUHJvcGVydHksIHN2Zy5kYXRhKClbMF0pO1xyXG4gICAgcGF0aHMuc3R5bGUoJ3N0cm9rZScsIGZ1bmN0aW9uKGQpeyBcclxuICAgICAgcmV0dXJuIGNvbG9yKGRbc2VsZWN0ZWRQcm9wZXJ0eV0pOyAgIFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuXHJcbiAgZnVuY3Rpb24gY3JlYXRlRHJhZ2dhYmxlKCl7XHJcbiAgICByZXR1cm4gZDMuYmVoYXZpb3IuZHJhZygpXHJcbiAgICAgIC5vbignZHJhZ3N0YXJ0JywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gdGhpcy5fX29yaWdpbl9fID0geChkKTtcclxuICAgICAgfSlcclxuICAgICAgLm9uKCdkcmFnJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgICAgICBkaW1lbnNpb25zLnNvcnQoZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gcG9zaXRpb24oYSkgLSBwb3NpdGlvbihiKTsgfSk7XHJcbiAgICAgICAgeC5kb21haW4oZGltZW5zaW9ucyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kaW1lbnNpb24nKS5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyBwb3NpdGlvbihkKSArICcpJzsgfSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5vbignZHJhZ2VuZCcsIGZ1bmN0aW9uKGQpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5fX29yaWdpbl9fO1xyXG4gICAgICAgIGRlbGV0ZSBkcmFnZ2luZ1tkXTtcclxuICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJyk7XHJcbiAgICAgICAgc3ZnLnNlbGVjdEFsbCgnZy5kYXRhbGluZXMgcGF0aCcpLmF0dHIoJ2QnLCBwYXRoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gV2hlbiBicnVzaGluZywgZG9u4oCZdCB0cmlnZ2VyIGF4aXMgZHJhZ2dpbmcuXHJcbiAgZnVuY3Rpb24gYnJ1c2hTdGFydEhhbmRsZXIoKSB7IFxyXG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7IFxyXG4gIH1cclxuXHJcbiAgLy8gSGFuZGxlcyBhIGJydXNoIGV2ZW50LCB0b2dnbGluZyB0aGUgZGlzcGxheSBvZiBmb3JlZ3JvdW5kIGxpbmVzLlxyXG4gIGZ1bmN0aW9uIGJydXNoKCkge1xyXG4gICAgdmFyIGFjdGl2ZXMgPSBkaW1lbnNpb25zLmZpbHRlcihmdW5jdGlvbihwKSB7IHJldHVybiAheVtwXS5icnVzaC5lbXB0eSgpOyB9KSxcclxuICAgICAgICBleHRlbnRzID0gYWN0aXZlcy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4geVtwXS5icnVzaC5leHRlbnQoKTsgfSk7XHJcblxyXG4gICAgdmFyIHNlbGVjdGVkID0gW107XHJcbiAgICBzdmcuc2VsZWN0QWxsKCdnLmRhdGFsaW5lcyBwYXRoJykuYXR0cignY2xhc3MnLCBmdW5jdGlvbihkKSB7XHJcbiAgICAgIHZhciB2aXNpYmxlID0gYWN0aXZlcy5ldmVyeShmdW5jdGlvbihwLCBpKSB7XHJcbiAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYodmlzaWJsZSl7XHJcbiAgICAgICAgc2VsZWN0ZWQucHVzaChkKTtcclxuICAgICAgICByZXR1cm4gJ2FjdGl2ZSc7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmV0dXJuICdmaWx0ZXJlZCc7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBmaWx0ZXJzID0ge307XHJcbiAgICBhY3RpdmVzLmZvckVhY2goZnVuY3Rpb24oZGltZW5zaW9uLCBpKXtcclxuICAgICAgZmlsdGVyc1tkaW1lbnNpb25dID0gZXh0ZW50c1tpXTtcclxuICAgIH0pO1xyXG5cclxuICAgIHZhciBldmVudERldGFpbHMgPSB7XHJcbiAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXHJcbiAgICAgIHNlbGVjdGVkOiBzZWxlY3RlZCxcclxuICAgICAgZmlsdGVyczogZmlsdGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgZXZlbnQgPSBuZXcgQ3VzdG9tRXZlbnQoJ2NoYW5nZWZpbHRlcicsIHtkZXRhaWw6IGV2ZW50RGV0YWlsc30pO1xyXG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcclxuICB9XHJcblxyXG4gIGZ1bmN0aW9uIHBvc2l0aW9uKGQpIHtcclxuICAgIC8vIGlmIHdlJ3JlIGN1cnJlbnRseSBkcmFnZ2luZyB0aGUgYXhpcyByZXR1cm4gdGhlIGRyYWcgcG9zaXRpb25cclxuICAgIC8vIG90aGVyd2lzZSByZXR1cm4gdGhlIG5vcm1hbCB4LWF4aXMgcG9zaXRpb25cclxuICAgIHZhciB2ID0gZHJhZ2dpbmdbZF07XHJcbiAgICByZXR1cm4gdiA9PSBudWxsID8geChkKSA6IHY7XHJcbiAgfVxyXG5cclxuICAvLyBSZXR1cm5zIHRoZSBwYXRoIGZvciBhIGdpdmVuIGRhdGEgcG9pbnQuXHJcbiAgZnVuY3Rpb24gcGF0aChkKSB7XHJcbiAgICByZXR1cm4gbGluZShkaW1lbnNpb25zLm1hcChmdW5jdGlvbihwKSB7IFxyXG4gICAgICByZXR1cm4gW3Bvc2l0aW9uKHApLCB5W3BdKGRbcF0pXTsgXHJcbiAgICB9KSk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBkcmF3KGNvbnRhaW5lcil7XHJcbiAgICBkcmFnZ2luZyA9IHt9O1xyXG5cclxuICAgIGVsZW1lbnQgPSBjb250YWluZXIubm9kZSgpO1xyXG4gICAgZGF0YSA9IGNvbnRhaW5lci5kYXR1bSgpO1xyXG5cclxuICAgIC8vIEV4dHJhY3QgdGhlIGxpc3Qgb2YgZGltZW5zaW9ucyBhbmQgY3JlYXRlIGEgc2NhbGUgZm9yIGVhY2guXHJcbiAgICBpZighZGltZW5zaW9ucykgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xyXG5cclxuICAgIHguZG9tYWluKGRpbWVuc2lvbnMpO1xyXG4gICAgXHJcbiAgICB5ID0ge307XHJcbiAgICBkaW1lbnNpb25zLmZvckVhY2goZnVuY3Rpb24oZCkge1xyXG4gICAgICB5W2RdID0gZDMuc2NhbGUubGluZWFyKClcclxuICAgICAgICAucmFuZ2UoW2lubmVySGVpZ2h0LCAwXSlcclxuICAgICAgICAuZG9tYWluKGRvbWFpbkdlbmVyYXRvcihkLCBkYXRhKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBiYXNlIHN2Z1xyXG4gICAgc3ZnID0gY29udGFpbmVyXHJcbiAgICAgIC5zZWxlY3RBbGwoJ3N2ZycpXHJcbiAgICAgICAgLmRhdGEoW2RhdGFdKVxyXG4gICAgICAuZW50ZXIoKVxyXG4gICAgICAgIC5hcHBlbmQoJ3N2ZycpXHJcbiAgICAgICAgICAuY2xhc3NlZCgncGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQnLCB0cnVlKVxyXG4gICAgICAgICAgLmF0dHIoJ3dpZHRoJywgd2lkdGgpXHJcbiAgICAgICAgICAuYXR0cignaGVpZ2h0JywgaGVpZ2h0KTtcclxuICAgIFxyXG4gICAgdmFyIGJvZHkgPSBzdmcgICAgICAgICAgXHJcbiAgICAgIC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyBtYXJnaW5bM10gKyAnLCcgKyBtYXJnaW5bMF0gKyAnKScpO1xyXG5cclxuICAgIC8vIGNyZWF0ZSBwYXRoc1xyXG4gICAgYm9keS5hcHBlbmQoJ2cnKVxyXG4gICAgICAuY2xhc3NlZCgnZGF0YWxpbmVzJywgdHJ1ZSlcclxuICAgICAgLnNlbGVjdEFsbCgncGF0aCcpXHJcbiAgICAgIC5kYXRhKGRhdGEpXHJcbiAgICAgIC5lbnRlcigpXHJcbiAgICAgICAgLmFwcGVuZCgncGF0aCcpXHJcbiAgICAgICAgLmF0dHIoJ2QnLCBwYXRoKTtcclxuXHJcbiAgICAvLyBBZGQgYSBncm91cCBlbGVtZW50IGZvciBlYWNoIGRpbWVuc2lvbi5cclxuICAgIHZhciBkaW1lbnNpb25Hcm91cCA9IGJvZHlcclxuICAgICAgLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgICAgLmRhdGEoZGltZW5zaW9ucylcclxuICAgICAgICAuZW50ZXIoKVxyXG4gICAgICAgICAgLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAgIC5jbGFzc2VkKCdkaW1lbnNpb24nLCB0cnVlKVxyXG4gICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeChkKSArICcpJzsgfSlcclxuICAgICAgICAgICAgLmNhbGwoY3JlYXRlRHJhZ2dhYmxlKCkpO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgYW4gYXhpcyBhbmQgdGl0bGUuXHJcbiAgICBkaW1lbnNpb25Hcm91cC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcclxuICAgICAgICAuZWFjaChmdW5jdGlvbihkKSB7IGQzLnNlbGVjdCh0aGlzKS5jYWxsKGF4aXMuc2NhbGUoeVtkXSkpOyB9KVxyXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcclxuICAgICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnbWlkZGxlJylcclxuICAgICAgICAuYXR0cigneScsIC05KVxyXG4gICAgICAgIC50ZXh0KFN0cmluZylcclxuICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24oZCl7XHJcbiAgICAgICAgICBpZiAoZDMuZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuOyAvLyBjbGljayBzdXBwcmVzc2VkXHJcbiAgICAgICAgICBcclxuICAgICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpIGQgPSAnJztcclxuICAgICAgICAgIGVsc2UgZHJhdy5oaWdobGlnaHQoZCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgLy8gQWRkIGFuZCBzdG9yZSBhIGJydXNoIGZvciBlYWNoIGF4aXMuXHJcbiAgICBkaW1lbnNpb25Hcm91cC5hcHBlbmQoJ2cnKVxyXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdicnVzaCcpXHJcbiAgICAgICAgLmVhY2goZnVuY3Rpb24oZCkgeyBcclxuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5jYWxsKFxyXG4gICAgICAgICAgICB5W2RdLmJydXNoID0gZDMuc3ZnLmJydXNoKCkueSh5W2RdKVxyXG4gICAgICAgICAgICAgIC5vbignYnJ1c2hzdGFydCcsIGJydXNoU3RhcnRIYW5kbGVyKVxyXG4gICAgICAgICAgICAgIC5vbignYnJ1c2gnLCBicnVzaClcclxuICAgICAgICAgICk7IFxyXG4gICAgICAgIH0pXHJcbiAgICAgIC5zZWxlY3RBbGwoJ3JlY3QnKVxyXG4gICAgICAgIC5hdHRyKCd4JywgLTgpXHJcbiAgICAgICAgLmF0dHIoJ3dpZHRoJywgMTYpO1xyXG5cclxuICAgIGRyYXcuaGlnaGxpZ2h0KHNlbGVjdGVkUHJvcGVydHkpO1xyXG5cclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH1cclxuXHJcbiAgZHJhdy53aWR0aCA9IGZ1bmN0aW9uKF8pe1xyXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gd2lkdGg7XHJcbiAgICB3aWR0aCA9IF87XHJcbiAgICBpbm5lcldpZHRoID0gd2lkdGggLSBtYXJnaW5bMV0gLSBtYXJnaW5bM107XHJcbiAgICB4ID0gZDMuc2NhbGUub3JkaW5hbCgpLnJhbmdlUG9pbnRzKFswLCBpbm5lcldpZHRoXSwgMSk7XHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LmhlaWdodCA9IGZ1bmN0aW9uKF8pe1xyXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gaGVpZ2h0O1xyXG4gICAgaGVpZ2h0ID0gXztcclxuICAgIGlubmVySGVpZ2h0ID0gaGVpZ2h0IC0gbWFyZ2luWzBdIC0gbWFyZ2luWzJdO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5tYXJnaW4gPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIG1hcmdpbjtcclxuICAgIG1hcmdpbiA9IF87XHJcbiAgICBkcmF3LndpZHRoKHdpZHRoKTtcclxuICAgIGRyYXcuaGVpZ2h0KGhlaWdodCk7XHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LnNlbGVjdCA9IGZ1bmN0aW9uKF8pe1xyXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gZGltZW5zaW9ucztcclxuICAgIGRpbWVuc2lvbnMgPSBfO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5kb21haW4gPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGRvbWFpbkdlbmVyYXRvcjtcclxuICAgIGRvbWFpbkdlbmVyYXRvciA9IF87XHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG4gIFxyXG4gIGRyYXcuY29sb3IgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbG9yR2VuZXJhdG9yO1xyXG4gICAgY29sb3JHZW5lcmF0b3IgPSBfO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5pbnRlcnBvbGF0b3IgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGludGVycG9sYXRvcjtcclxuICAgIGludGVycG9sYXRvciA9IF87XHJcbiAgICBsaW5lID0gZDMuc3ZnLmxpbmUoKS5pbnRlcnBvbGF0ZShpbnRlcnBvbGF0b3IpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5oaWdobGlnaHQgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIHNlbGVjdGVkUHJvcGVydHk7XHJcblxyXG4gICAgaWYoc2VsZWN0ZWRQcm9wZXJ0eSAhPT0gXyl7XHJcbiAgICAgIHNlbGVjdGVkUHJvcGVydHkgPSBfO1xyXG4gICAgICBcclxuICAgICAgaWYoZWxlbWVudCl7XHJcbiAgICAgICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudCgnY2hhbmdlaGlnaGxpZ2h0Jywge2RldGFpbDoge1xyXG4gICAgICAgICAgZWxlbWVudDogZWxlbWVudCxcclxuICAgICAgICAgIGhpZ2hsaWdodDogc2VsZWN0ZWRQcm9wZXJ0eVxyXG4gICAgICAgIH19KSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGVIaWdobGlnaHQoc3ZnKTtcclxuXHJcbiAgICByZXR1cm4gZHJhdztcclxuICB9O1xyXG5cclxuICBkcmF3LmZpbHRlciA9IGZ1bmN0aW9uKGRpbWVuc2lvbiwgZXh0ZW50KXtcclxuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDApe1xyXG4gICAgICB2YXIgYnJ1c2hlcyA9IHt9O1xyXG4gICAgICBPYmplY3Qua2V5cyh5KS5mb3JFYWNoKGZ1bmN0aW9uKGRpbWVuc2lvbil7XHJcbiAgICAgICAgdmFyIGV4dGVudCA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBza2lwIHVuc2V0IGZpbHRlcnNcclxuICAgICAgICBpZihleHRlbnRbMF0gPT09IGV4dGVudFsxXSkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGJydXNoZXNbZGltZW5zaW9uXSA9IHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICByZXR1cm4gYnJ1c2hlcztcclxuICAgIH1cclxuXHJcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAxKXtcclxuICAgICAgZXh0ZW50ID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xyXG4gICAgICBpZihleHRlbnRbMF0gPT09IGV4dGVudFsxXSkgcmV0dXJuOyAvLyB1bmRlZmluZWQgaWYgdW5zZXRcclxuICAgICAgcmV0dXJuIGV4dGVudDtcclxuICAgIH1cclxuXHJcbiAgICBpZighZXh0ZW50KSBleHRlbnQgPSBbMCwwXTsgLy8gdGhpcyBoaWRlcyBicnVzaFxyXG5cclxuICAgIHN2Zy5zZWxlY3RBbGwoJyAuYnJ1c2gnKS5maWx0ZXIoZnVuY3Rpb24oZCl7XHJcbiAgICAgIHJldHVybiBkID09PSBkaW1lbnNpb247XHJcbiAgICB9KS5jYWxsKHlbZGltZW5zaW9uXS5icnVzaC5leHRlbnQoZXh0ZW50KSkuY2FsbChicnVzaCk7ICAgIFxyXG4gIH07XHJcblxyXG4gIGRyYXcucmVkcmF3ID0gZnVuY3Rpb24oY29udGFpbmVyKXtcclxuICAgIGlmKHN2Zykgc3ZnLnJlbW92ZSgpO1xyXG4gICAgZHJhdyhjb250YWluZXIpO1xyXG4gICAgcmV0dXJuIGRyYXc7XHJcbiAgfTtcclxuXHJcbiAgZHJhdy5kcmF3ID0gZnVuY3Rpb24oY29udGFpbmVyKXtcclxuICAgIGRyYXcoY29udGFpbmVyKTtcclxuICAgIHJldHVybiBkcmF3O1xyXG4gIH07XHJcblxyXG4gIGluaXQoY29uZmlnIHx8IHt9KTtcclxuXHJcbiAgcmV0dXJuIGRyYXc7XHJcbn07XHJcbiIsIi8vIEZvciBJRTkrXHJcbihmdW5jdGlvbiAoKSB7XHJcbiAgZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKCBldmVudCwgcGFyYW1zICkge1xyXG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHsgYnViYmxlczogZmFsc2UsIGNhbmNlbGFibGU6IGZhbHNlLCBkZXRhaWw6IHVuZGVmaW5lZCB9O1xyXG4gICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XHJcbiAgICBldnQuaW5pdEN1c3RvbUV2ZW50KCBldmVudCwgcGFyYW1zLmJ1YmJsZXMsIHBhcmFtcy5jYW5jZWxhYmxlLCBwYXJhbXMuZGV0YWlsICk7XHJcbiAgICByZXR1cm4gZXZ0O1xyXG4gICB9XHJcblxyXG4gIEN1c3RvbUV2ZW50LnByb3RvdHlwZSA9IHdpbmRvdy5FdmVudC5wcm90b3R5cGU7XHJcblxyXG4gIHdpbmRvdy5DdXN0b21FdmVudCA9IEN1c3RvbUV2ZW50O1xyXG59KSgpOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29sb3JTY2FsZUdlbmVyYXRvcihwcm9wZXJ0eSwgZGF0YSl7XHJcbiAgcmV0dXJuIGQzLnNjYWxlLmxpbmVhcigpXHJcbiAgICAuZG9tYWluKGQzLmV4dGVudChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiArZFtwcm9wZXJ0eV07IH0pKVxyXG4gICAgLnJhbmdlKFsnaHNsKDAsIDYwJSwgNTAlKScsICdoc2woMjU1LCA2MCUsIDUwJSknXSkgLy8gcmVkIHRvIGJsdWVcclxuICAgIC5pbnRlcnBvbGF0ZShkMy5pbnRlcnBvbGF0ZUhzbCk7XHJcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnRlcnBvbGF0b3IocG9pbnRzKXtcclxuICB2YXIgcG9pbnQsIFxyXG4gICAgYWN0aW9uID0gJycsIFxyXG4gICAgbGluZUJ1aWxkZXIgPSBbXTtcclxuXHJcbiAgZm9yKHZhciBpID0gMDsgaSA8IHBvaW50cy5sZW5ndGggLSAxOyBpKyspe1xyXG4gICAgcG9pbnQgPSBwb2ludHNbaV07XHJcblxyXG4gICAgaWYoaXNOYU4ocG9pbnRbMV0pKXtcclxuICAgICAgaWYoYWN0aW9uICE9PSAnJykgYWN0aW9uID0gJ00nO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGluZUJ1aWxkZXIucHVzaChhY3Rpb24sIHBvaW50KTtcclxuICAgICAgYWN0aW9uID0gJ0wnO1xyXG4gICAgfVxyXG4gIH1cclxuICBcclxuICBwb2ludCA9IHBvaW50c1twb2ludHMubGVuZ3RoIC0gMV07XHJcbiAgaWYoIWlzTmFOKHBvaW50WzFdKSl7XHJcbiAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpbmVCdWlsZGVyLmpvaW4oJycpO1xyXG59OyJdfQ==
(1)
});
