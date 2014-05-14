!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.parallelCoordinatesChart=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// Borrows heavily from http://bl.ocks.org/mbostock/7586334
_dereq_('./customEventPolyfill');


var interpolator = _dereq_('./interpolator'),
  defaultColorGenerator = _dereq_('./colorGenerator');

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
      var element = this;

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
            d3.select(this).call(
              y[d].brush = d3.svg.brush().y(y[d])
                .on('brushstart', brushStartHandler)
                .on('brush', brush)
                .on('brushend', brushEndHandler)
            ); 
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
      

      function setBrush(dimension, extent){
        svg.selectAll('.brush').filter(function(d){
          return d === dimension;
        }).call(y[dimension].brush.extent(extent)).call(brush);
      }

      window.setBrush = setBrush;

      function brushEndHandler(){
        var selected = svg.selectAll('.foreground .active').data();
        var filters = {};
        dimensions.filter(function(dimension) { return !y[dimension].brush.empty(); })
          .forEach(function(dimension){
            var extent = y[dimension].brush.extent();
            filters[dimension] = {
              min: extent[0],
              max: extent[1]
            }; 
          });

        var eventDetails = {
          element: element,
          selected: selected,
          filters: filters
        };

        var event = new CustomEvent('changefilter', {detail: eventDetails});
        element.dispatchEvent(event);
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

},{"./colorGenerator":2,"./customEventPolyfill":4,"./interpolator":5}],2:[function(_dereq_,module,exports){
var colorbrewer = _dereq_('./colorbrewer');

module.exports = function colorGenerator(property, data){
  var range = colorbrewer.RdYlGn[10].slice(0);
  
  return d3.scale.quantile()
    .range(range)
    .domain(d3.extent(data, function(d) { return +d[property]; }));
};
},{"./colorbrewer":3}],3:[function(_dereq_,module,exports){
// Copied from D3: https://github.com/mbostock/d3/blob/master/lib/colorbrewer/colorbrewer.js
// This product includes color specifications and designs developed by Cynthia Brewer (http://colorbrewer.org/).
module.exports = {YlGn: {
3: ['#f7fcb9','#addd8e','#31a354'],
4: ['#ffffcc','#c2e699','#78c679','#238443'],
5: ['#ffffcc','#c2e699','#78c679','#31a354','#006837'],
6: ['#ffffcc','#d9f0a3','#addd8e','#78c679','#31a354','#006837'],
7: ['#ffffcc','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32'],
8: ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32'],
9: ['#ffffe5','#f7fcb9','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#006837','#004529']
},YlGnBu: {
3: ['#edf8b1','#7fcdbb','#2c7fb8'],
4: ['#ffffcc','#a1dab4','#41b6c4','#225ea8'],
5: ['#ffffcc','#a1dab4','#41b6c4','#2c7fb8','#253494'],
6: ['#ffffcc','#c7e9b4','#7fcdbb','#41b6c4','#2c7fb8','#253494'],
7: ['#ffffcc','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#0c2c84'],
8: ['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#0c2c84'],
9: ['#ffffd9','#edf8b1','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#253494','#081d58']
},GnBu: {
3: ['#e0f3db','#a8ddb5','#43a2ca'],
4: ['#f0f9e8','#bae4bc','#7bccc4','#2b8cbe'],
5: ['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'],
6: ['#f0f9e8','#ccebc5','#a8ddb5','#7bccc4','#43a2ca','#0868ac'],
7: ['#f0f9e8','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'],
8: ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#08589e'],
9: ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081']
},BuGn: {
3: ['#e5f5f9','#99d8c9','#2ca25f'],
4: ['#edf8fb','#b2e2e2','#66c2a4','#238b45'],
5: ['#edf8fb','#b2e2e2','#66c2a4','#2ca25f','#006d2c'],
6: ['#edf8fb','#ccece6','#99d8c9','#66c2a4','#2ca25f','#006d2c'],
7: ['#edf8fb','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
8: ['#f7fcfd','#e5f5f9','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#005824'],
9: ['#f7fcfd','#e5f5f9','#ccece6','#99d8c9','#66c2a4','#41ae76','#238b45','#006d2c','#00441b']
},PuBuGn: {
3: ['#ece2f0','#a6bddb','#1c9099'],
4: ['#f6eff7','#bdc9e1','#67a9cf','#02818a'],
5: ['#f6eff7','#bdc9e1','#67a9cf','#1c9099','#016c59'],
6: ['#f6eff7','#d0d1e6','#a6bddb','#67a9cf','#1c9099','#016c59'],
7: ['#f6eff7','#d0d1e6','#a6bddb','#67a9cf','#3690c0','#02818a','#016450'],
8: ['#fff7fb','#ece2f0','#d0d1e6','#a6bddb','#67a9cf','#3690c0','#02818a','#016450'],
9: ['#fff7fb','#ece2f0','#d0d1e6','#a6bddb','#67a9cf','#3690c0','#02818a','#016c59','#014636']
},PuBu: {
3: ['#ece7f2','#a6bddb','#2b8cbe'],
4: ['#f1eef6','#bdc9e1','#74a9cf','#0570b0'],
5: ['#f1eef6','#bdc9e1','#74a9cf','#2b8cbe','#045a8d'],
6: ['#f1eef6','#d0d1e6','#a6bddb','#74a9cf','#2b8cbe','#045a8d'],
7: ['#f1eef6','#d0d1e6','#a6bddb','#74a9cf','#3690c0','#0570b0','#034e7b'],
8: ['#fff7fb','#ece7f2','#d0d1e6','#a6bddb','#74a9cf','#3690c0','#0570b0','#034e7b'],
9: ['#fff7fb','#ece7f2','#d0d1e6','#a6bddb','#74a9cf','#3690c0','#0570b0','#045a8d','#023858']
},BuPu: {
3: ['#e0ecf4','#9ebcda','#8856a7'],
4: ['#edf8fb','#b3cde3','#8c96c6','#88419d'],
5: ['#edf8fb','#b3cde3','#8c96c6','#8856a7','#810f7c'],
6: ['#edf8fb','#bfd3e6','#9ebcda','#8c96c6','#8856a7','#810f7c'],
7: ['#edf8fb','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'],
8: ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#6e016b'],
9: ['#f7fcfd','#e0ecf4','#bfd3e6','#9ebcda','#8c96c6','#8c6bb1','#88419d','#810f7c','#4d004b']
},RdPu: {
3: ['#fde0dd','#fa9fb5','#c51b8a'],
4: ['#feebe2','#fbb4b9','#f768a1','#ae017e'],
5: ['#feebe2','#fbb4b9','#f768a1','#c51b8a','#7a0177'],
6: ['#feebe2','#fcc5c0','#fa9fb5','#f768a1','#c51b8a','#7a0177'],
7: ['#feebe2','#fcc5c0','#fa9fb5','#f768a1','#dd3497','#ae017e','#7a0177'],
8: ['#fff7f3','#fde0dd','#fcc5c0','#fa9fb5','#f768a1','#dd3497','#ae017e','#7a0177'],
9: ['#fff7f3','#fde0dd','#fcc5c0','#fa9fb5','#f768a1','#dd3497','#ae017e','#7a0177','#49006a']
},PuRd: {
3: ['#e7e1ef','#c994c7','#dd1c77'],
4: ['#f1eef6','#d7b5d8','#df65b0','#ce1256'],
5: ['#f1eef6','#d7b5d8','#df65b0','#dd1c77','#980043'],
6: ['#f1eef6','#d4b9da','#c994c7','#df65b0','#dd1c77','#980043'],
7: ['#f1eef6','#d4b9da','#c994c7','#df65b0','#e7298a','#ce1256','#91003f'],
8: ['#f7f4f9','#e7e1ef','#d4b9da','#c994c7','#df65b0','#e7298a','#ce1256','#91003f'],
9: ['#f7f4f9','#e7e1ef','#d4b9da','#c994c7','#df65b0','#e7298a','#ce1256','#980043','#67001f']
},OrRd: {
3: ['#fee8c8','#fdbb84','#e34a33'],
4: ['#fef0d9','#fdcc8a','#fc8d59','#d7301f'],
5: ['#fef0d9','#fdcc8a','#fc8d59','#e34a33','#b30000'],
6: ['#fef0d9','#fdd49e','#fdbb84','#fc8d59','#e34a33','#b30000'],
7: ['#fef0d9','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'],
8: ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#990000'],
9: ['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000']
},YlOrRd: {
3: ['#ffeda0','#feb24c','#f03b20'],
4: ['#ffffb2','#fecc5c','#fd8d3c','#e31a1c'],
5: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'],
6: ['#ffffb2','#fed976','#feb24c','#fd8d3c','#f03b20','#bd0026'],
7: ['#ffffb2','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'],
8: ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'],
9: ['#ffffcc','#ffeda0','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#bd0026','#800026']
},YlOrBr: {
3: ['#fff7bc','#fec44f','#d95f0e'],
4: ['#ffffd4','#fed98e','#fe9929','#cc4c02'],
5: ['#ffffd4','#fed98e','#fe9929','#d95f0e','#993404'],
6: ['#ffffd4','#fee391','#fec44f','#fe9929','#d95f0e','#993404'],
7: ['#ffffd4','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#8c2d04'],
8: ['#ffffe5','#fff7bc','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#8c2d04'],
9: ['#ffffe5','#fff7bc','#fee391','#fec44f','#fe9929','#ec7014','#cc4c02','#993404','#662506']
},Purples: {
3: ['#efedf5','#bcbddc','#756bb1'],
4: ['#f2f0f7','#cbc9e2','#9e9ac8','#6a51a3'],
5: ['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f'],
6: ['#f2f0f7','#dadaeb','#bcbddc','#9e9ac8','#756bb1','#54278f'],
7: ['#f2f0f7','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
8: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
9: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#54278f','#3f007d']
},Blues: {
3: ['#deebf7','#9ecae1','#3182bd'],
4: ['#eff3ff','#bdd7e7','#6baed6','#2171b5'],
5: ['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c'],
6: ['#eff3ff','#c6dbef','#9ecae1','#6baed6','#3182bd','#08519c'],
7: ['#eff3ff','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
8: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
9: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#08519c','#08306b']
},Greens: {
3: ['#e5f5e0','#a1d99b','#31a354'],
4: ['#edf8e9','#bae4b3','#74c476','#238b45'],
5: ['#edf8e9','#bae4b3','#74c476','#31a354','#006d2c'],
6: ['#edf8e9','#c7e9c0','#a1d99b','#74c476','#31a354','#006d2c'],
7: ['#edf8e9','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
8: ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
9: ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#006d2c','#00441b']
},Oranges: {
3: ['#fee6ce','#fdae6b','#e6550d'],
4: ['#feedde','#fdbe85','#fd8d3c','#d94701'],
5: ['#feedde','#fdbe85','#fd8d3c','#e6550d','#a63603'],
6: ['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#e6550d','#a63603'],
7: ['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
8: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04'],
9: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#a63603','#7f2704']
},Reds: {
3: ['#fee0d2','#fc9272','#de2d26'],
4: ['#fee5d9','#fcae91','#fb6a4a','#cb181d'],
5: ['#fee5d9','#fcae91','#fb6a4a','#de2d26','#a50f15'],
6: ['#fee5d9','#fcbba1','#fc9272','#fb6a4a','#de2d26','#a50f15'],
7: ['#fee5d9','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
8: ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
9: ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#a50f15','#67000d']
},Greys: {
3: ['#f0f0f0','#bdbdbd','#636363'],
4: ['#f7f7f7','#cccccc','#969696','#525252'],
5: ['#f7f7f7','#cccccc','#969696','#636363','#252525'],
6: ['#f7f7f7','#d9d9d9','#bdbdbd','#969696','#636363','#252525'],
7: ['#f7f7f7','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525'],
8: ['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525'],
9: ['#ffffff','#f0f0f0','#d9d9d9','#bdbdbd','#969696','#737373','#525252','#252525','#000000']
},PuOr: {
3: ['#f1a340','#f7f7f7','#998ec3'],
4: ['#e66101','#fdb863','#b2abd2','#5e3c99'],
5: ['#e66101','#fdb863','#f7f7f7','#b2abd2','#5e3c99'],
6: ['#b35806','#f1a340','#fee0b6','#d8daeb','#998ec3','#542788'],
7: ['#b35806','#f1a340','#fee0b6','#f7f7f7','#d8daeb','#998ec3','#542788'],
8: ['#b35806','#e08214','#fdb863','#fee0b6','#d8daeb','#b2abd2','#8073ac','#542788'],
9: ['#b35806','#e08214','#fdb863','#fee0b6','#f7f7f7','#d8daeb','#b2abd2','#8073ac','#542788'],
10: ['#7f3b08','#b35806','#e08214','#fdb863','#fee0b6','#d8daeb','#b2abd2','#8073ac','#542788','#2d004b'],
11: ['#7f3b08','#b35806','#e08214','#fdb863','#fee0b6','#f7f7f7','#d8daeb','#b2abd2','#8073ac','#542788','#2d004b']
},BrBG: {
3: ['#d8b365','#f5f5f5','#5ab4ac'],
4: ['#a6611a','#dfc27d','#80cdc1','#018571'],
5: ['#a6611a','#dfc27d','#f5f5f5','#80cdc1','#018571'],
6: ['#8c510a','#d8b365','#f6e8c3','#c7eae5','#5ab4ac','#01665e'],
7: ['#8c510a','#d8b365','#f6e8c3','#f5f5f5','#c7eae5','#5ab4ac','#01665e'],
8: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5','#80cdc1','#35978f','#01665e'],
9: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e'],
10: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#c7eae5','#80cdc1','#35978f','#01665e','#003c30'],
11: ['#543005','#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e','#003c30']
},PRGn: {
3: ['#af8dc3','#f7f7f7','#7fbf7b'],
4: ['#7b3294','#c2a5cf','#a6dba0','#008837'],
5: ['#7b3294','#c2a5cf','#f7f7f7','#a6dba0','#008837'],
6: ['#762a83','#af8dc3','#e7d4e8','#d9f0d3','#7fbf7b','#1b7837'],
7: ['#762a83','#af8dc3','#e7d4e8','#f7f7f7','#d9f0d3','#7fbf7b','#1b7837'],
8: ['#762a83','#9970ab','#c2a5cf','#e7d4e8','#d9f0d3','#a6dba0','#5aae61','#1b7837'],
9: ['#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837'],
10: ['#40004b','#762a83','#9970ab','#c2a5cf','#e7d4e8','#d9f0d3','#a6dba0','#5aae61','#1b7837','#00441b'],
11: ['#40004b','#762a83','#9970ab','#c2a5cf','#e7d4e8','#f7f7f7','#d9f0d3','#a6dba0','#5aae61','#1b7837','#00441b']
},PiYG: {
3: ['#e9a3c9','#f7f7f7','#a1d76a'],
4: ['#d01c8b','#f1b6da','#b8e186','#4dac26'],
5: ['#d01c8b','#f1b6da','#f7f7f7','#b8e186','#4dac26'],
6: ['#c51b7d','#e9a3c9','#fde0ef','#e6f5d0','#a1d76a','#4d9221'],
7: ['#c51b7d','#e9a3c9','#fde0ef','#f7f7f7','#e6f5d0','#a1d76a','#4d9221'],
8: ['#c51b7d','#de77ae','#f1b6da','#fde0ef','#e6f5d0','#b8e186','#7fbc41','#4d9221'],
9: ['#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221'],
10: ['#8e0152','#c51b7d','#de77ae','#f1b6da','#fde0ef','#e6f5d0','#b8e186','#7fbc41','#4d9221','#276419'],
11: ['#8e0152','#c51b7d','#de77ae','#f1b6da','#fde0ef','#f7f7f7','#e6f5d0','#b8e186','#7fbc41','#4d9221','#276419']
},RdBu: {
3: ['#ef8a62','#f7f7f7','#67a9cf'],
4: ['#ca0020','#f4a582','#92c5de','#0571b0'],
5: ['#ca0020','#f4a582','#f7f7f7','#92c5de','#0571b0'],
6: ['#b2182b','#ef8a62','#fddbc7','#d1e5f0','#67a9cf','#2166ac'],
7: ['#b2182b','#ef8a62','#fddbc7','#f7f7f7','#d1e5f0','#67a9cf','#2166ac'],
8: ['#b2182b','#d6604d','#f4a582','#fddbc7','#d1e5f0','#92c5de','#4393c3','#2166ac'],
9: ['#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac'],
10: ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061'],
11: ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#f7f7f7','#d1e5f0','#92c5de','#4393c3','#2166ac','#053061']
},RdGy: {
3: ['#ef8a62','#ffffff','#999999'],
4: ['#ca0020','#f4a582','#bababa','#404040'],
5: ['#ca0020','#f4a582','#ffffff','#bababa','#404040'],
6: ['#b2182b','#ef8a62','#fddbc7','#e0e0e0','#999999','#4d4d4d'],
7: ['#b2182b','#ef8a62','#fddbc7','#ffffff','#e0e0e0','#999999','#4d4d4d'],
8: ['#b2182b','#d6604d','#f4a582','#fddbc7','#e0e0e0','#bababa','#878787','#4d4d4d'],
9: ['#b2182b','#d6604d','#f4a582','#fddbc7','#ffffff','#e0e0e0','#bababa','#878787','#4d4d4d'],
10: ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#e0e0e0','#bababa','#878787','#4d4d4d','#1a1a1a'],
11: ['#67001f','#b2182b','#d6604d','#f4a582','#fddbc7','#ffffff','#e0e0e0','#bababa','#878787','#4d4d4d','#1a1a1a']
},RdYlBu: {
3: ['#fc8d59','#ffffbf','#91bfdb'],
4: ['#d7191c','#fdae61','#abd9e9','#2c7bb6'],
5: ['#d7191c','#fdae61','#ffffbf','#abd9e9','#2c7bb6'],
6: ['#d73027','#fc8d59','#fee090','#e0f3f8','#91bfdb','#4575b4'],
7: ['#d73027','#fc8d59','#fee090','#ffffbf','#e0f3f8','#91bfdb','#4575b4'],
8: ['#d73027','#f46d43','#fdae61','#fee090','#e0f3f8','#abd9e9','#74add1','#4575b4'],
9: ['#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4'],
10: ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'],
11: ['#a50026','#d73027','#f46d43','#fdae61','#fee090','#ffffbf','#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']
},Spectral: {
3: ['#fc8d59','#ffffbf','#99d594'],
4: ['#d7191c','#fdae61','#abdda4','#2b83ba'],
5: ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'],
6: ['#d53e4f','#fc8d59','#fee08b','#e6f598','#99d594','#3288bd'],
7: ['#d53e4f','#fc8d59','#fee08b','#ffffbf','#e6f598','#99d594','#3288bd'],
8: ['#d53e4f','#f46d43','#fdae61','#fee08b','#e6f598','#abdda4','#66c2a5','#3288bd'],
9: ['#d53e4f','#f46d43','#fdae61','#fee08b','#ffffbf','#e6f598','#abdda4','#66c2a5','#3288bd'],
10: ['#9e0142','#d53e4f','#f46d43','#fdae61','#fee08b','#e6f598','#abdda4','#66c2a5','#3288bd','#5e4fa2'],
11: ['#9e0142','#d53e4f','#f46d43','#fdae61','#fee08b','#ffffbf','#e6f598','#abdda4','#66c2a5','#3288bd','#5e4fa2']
},RdYlGn: {
3: ['#fc8d59','#ffffbf','#91cf60'],
4: ['#d7191c','#fdae61','#a6d96a','#1a9641'],
5: ['#d7191c','#fdae61','#ffffbf','#a6d96a','#1a9641'],
6: ['#d73027','#fc8d59','#fee08b','#d9ef8b','#91cf60','#1a9850'],
7: ['#d73027','#fc8d59','#fee08b','#ffffbf','#d9ef8b','#91cf60','#1a9850'],
8: ['#d73027','#f46d43','#fdae61','#fee08b','#d9ef8b','#a6d96a','#66bd63','#1a9850'],
9: ['#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850'],
10: ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837'],
11: ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#ffffbf','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837']
},Accent: {
3: ['#7fc97f','#beaed4','#fdc086'],
4: ['#7fc97f','#beaed4','#fdc086','#ffff99'],
5: ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0'],
6: ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f'],
7: ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f','#bf5b17'],
8: ['#7fc97f','#beaed4','#fdc086','#ffff99','#386cb0','#f0027f','#bf5b17','#666666']
},Dark2: {
3: ['#1b9e77','#d95f02','#7570b3'],
4: ['#1b9e77','#d95f02','#7570b3','#e7298a'],
5: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e'],
6: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02'],
7: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d'],
8: ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666']
},Paired: {
3: ['#a6cee3','#1f78b4','#b2df8a'],
4: ['#a6cee3','#1f78b4','#b2df8a','#33a02c'],
5: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99'],
6: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c'],
7: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f'],
8: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00'],
9: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6'],
10: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a'],
11: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99'],
12: ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a','#ffff99','#b15928']
},Pastel1: {
3: ['#fbb4ae','#b3cde3','#ccebc5'],
4: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4'],
5: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6'],
6: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc'],
7: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd'],
8: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec'],
9: ['#fbb4ae','#b3cde3','#ccebc5','#decbe4','#fed9a6','#ffffcc','#e5d8bd','#fddaec','#f2f2f2']
},Pastel2: {
3: ['#b3e2cd','#fdcdac','#cbd5e8'],
4: ['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4'],
5: ['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4','#e6f5c9'],
6: ['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4','#e6f5c9','#fff2ae'],
7: ['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4','#e6f5c9','#fff2ae','#f1e2cc'],
8: ['#b3e2cd','#fdcdac','#cbd5e8','#f4cae4','#e6f5c9','#fff2ae','#f1e2cc','#cccccc']
},Set1: {
3: ['#e41a1c','#377eb8','#4daf4a'],
4: ['#e41a1c','#377eb8','#4daf4a','#984ea3'],
5: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00'],
6: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33'],
7: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628'],
8: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf'],
9: ['#e41a1c','#377eb8','#4daf4a','#984ea3','#ff7f00','#ffff33','#a65628','#f781bf','#999999']
},Set2: {
3: ['#66c2a5','#fc8d62','#8da0cb'],
4: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3'],
5: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854'],
6: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f'],
7: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494'],
8: ['#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854','#ffd92f','#e5c494','#b3b3b3']
},Set3: {
3: ['#8dd3c7','#ffffb3','#bebada'],
4: ['#8dd3c7','#ffffb3','#bebada','#fb8072'],
5: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3'],
6: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462'],
7: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69'],
8: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5'],
9: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9'],
10: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd'],
11: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5'],
12: ['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#d9d9d9','#bc80bd','#ccebc5','#ffed6f']
}};
},{}],4:[function(_dereq_,module,exports){
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
},{}],5:[function(_dereq_,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJjOlxcVXNlcnNcXG96YW5cXHdvcmtzcGFjZVxccGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnRcXG5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NoYXJ0LmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NvbG9yR2VuZXJhdG9yLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2NvbG9yYnJld2VyLmpzIiwiYzovVXNlcnMvb3phbi93b3Jrc3BhY2UvcGFyYWxsZWwtY29vcmRpbmF0ZXMtY2hhcnQvc3JjL2pzL2N1c3RvbUV2ZW50UG9seWZpbGwuanMiLCJjOi9Vc2Vycy9vemFuL3dvcmtzcGFjZS9wYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydC9zcmMvanMvaW50ZXJwb2xhdG9yLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQm9ycm93cyBoZWF2aWx5IGZyb20gaHR0cDovL2JsLm9ja3Mub3JnL21ib3N0b2NrLzc1ODYzMzRcclxucmVxdWlyZSgnLi9jdXN0b21FdmVudFBvbHlmaWxsJyk7XHJcblxyXG5cclxudmFyIGludGVycG9sYXRvciA9IHJlcXVpcmUoJy4vaW50ZXJwb2xhdG9yJyksXHJcbiAgZGVmYXVsdENvbG9yR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9jb2xvckdlbmVyYXRvcicpO1xyXG5cclxuZnVuY3Rpb24gZGVmYXVsdERvbWFpbkdlbmVyYXRvcihkaW1lbnNpb24sIGRhdGEpe1xyXG4gIHJldHVybiBkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gK2RbZGltZW5zaW9uXTsgfSk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyYWxsZWxDb29yZGluYXRlc0NoYXJ0KGNvbmZpZyl7XHJcbiAgY29uZmlnIHx8IChjb25maWcgPSB7fSk7XHJcblxyXG4gIHZhciBtYXJnaW4gPSBbMzAsIDEwLCAxMCwgMTBdO1xyXG4gIHZhciB3aWR0aCA9IDE1NjA7XHJcbiAgdmFyIGhlaWdodCA9IDUwMDtcclxuICB2YXIgaW5uZXJXaWR0aCA9IHdpZHRoIC0gbWFyZ2luWzFdIC0gbWFyZ2luWzNdO1xyXG4gIHZhciBpbm5lckhlaWdodCA9IGhlaWdodCAtIG1hcmdpblswXSAtIG1hcmdpblsyXTtcclxuICB2YXIgeCA9IGQzLnNjYWxlLm9yZGluYWwoKS5yYW5nZVBvaW50cyhbMCwgaW5uZXJXaWR0aF0sIDEpO1xyXG4gIHZhciBzZWxlY3RlZFByb3BlcnR5ID0gJyc7XHJcbiAgdmFyIGRpbWVuc2lvbnM7XHJcbiAgdmFyIGNvbG9yR2VuZXJhdG9yID0gZGVmYXVsdENvbG9yR2VuZXJhdG9yO1xyXG4gIHZhciBkb21haW5HZW5lcmF0b3IgPSBkZWZhdWx0RG9tYWluR2VuZXJhdG9yO1xyXG5cclxuICB2YXIgbGluZSA9IGQzLnN2Zy5saW5lKCkuaW50ZXJwb2xhdGUoaW50ZXJwb2xhdG9yKTtcclxuICB2YXIgYXhpcyA9IGQzLnN2Zy5heGlzKCkub3JpZW50KCdsZWZ0Jyk7XHJcblxyXG4gIC8vIFdoZW4gYnJ1c2hpbmcsIGRvbuKAmXQgdHJpZ2dlciBheGlzIGRyYWdnaW5nLlxyXG4gIGZ1bmN0aW9uIGJydXNoU3RhcnRIYW5kbGVyKCkge1xyXG4gICAgZDMuZXZlbnQuc291cmNlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBjaGFydChzZWxlY3Rpb24pe1xyXG4gICAgLy8gSnVzdCBpbiBjYXNlIHdlJ3JlIGRyYXdpbmcgaXQgaW4gbXVsdGlwbGUgcGxhY2VzXHJcbiAgICBzZWxlY3Rpb24uZWFjaChmdW5jdGlvbihkYXRhKXtcclxuICAgICAgaWYoIWRhdGEpIHJldHVybjtcclxuICAgICAgdmFyIGVsZW1lbnQgPSB0aGlzO1xyXG5cclxuICAgICAgdmFyIHkgPSB7fSxcclxuICAgICAgICBkcmFnZ2luZyA9IHt9O1xyXG5cclxuICAgICAgdmFyIHN2ZyA9IGQzLnNlbGVjdCh0aGlzKVxyXG4gICAgICAgIC5zZWxlY3RBbGwoJ3N2ZycpXHJcbiAgICAgICAgICAuZGF0YShbZGF0YV0pXHJcbiAgICAgICAgLmVudGVyKClcclxuICAgICAgICAgIC5hcHBlbmQoJ3N2ZycpXHJcbiAgICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdwYXJhbGxlbC1jb29yZGluYXRlcy1jaGFydCcpXHJcbiAgICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGlubmVyV2lkdGggKyBtYXJnaW5bMV0gKyBtYXJnaW5bM10pXHJcbiAgICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBpbm5lckhlaWdodCArIG1hcmdpblswXSArIG1hcmdpblsyXSlcclxuICAgICAgICAgICAgLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIG1hcmdpblszXSArICcsJyArIG1hcmdpblswXSArICcpJyk7XHJcblxyXG4gICAgICAvLyBFeHRyYWN0IHRoZSBsaXN0IG9mIGRpbWVuc2lvbnMgYW5kIGNyZWF0ZSBhIHNjYWxlIGZvciBlYWNoLlxyXG4gICAgICBpZighZGltZW5zaW9ucykgZGltZW5zaW9ucyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xyXG4gICAgICB4LmRvbWFpbihkaW1lbnNpb25zKTtcclxuICAgICAgZGltZW5zaW9ucy5mb3JFYWNoKGZ1bmN0aW9uKGQpIHtcclxuICAgICAgICB5W2RdID0gZDMuc2NhbGUubGluZWFyKClcclxuICAgICAgICAgICAgICAgIC5yYW5nZShbaW5uZXJIZWlnaHQsIDBdKVxyXG4gICAgICAgICAgICAgICAgLmRvbWFpbihkb21haW5HZW5lcmF0b3IoZCwgZGF0YSkpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEFkZCBncmV5IGJhY2tncm91bmQgbGluZXMgZm9yIGNvbnRleHQuXHJcbiAgICAgIHZhciBiYWNrZ3JvdW5kID0gc3ZnLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAuYXR0cignY2xhc3MnLCAnYmFja2dyb3VuZCcpXHJcbiAgICAgICAgLnNlbGVjdEFsbCgncGF0aCcpXHJcbiAgICAgICAgICAuZGF0YShkYXRhKVxyXG4gICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXHJcbiAgICAgICAgICAuYXR0cignZCcsIHBhdGgpO1xyXG5cclxuICAgICAgLy8gQWRkIGJsdWUgZm9yZWdyb3VuZCBsaW5lcyBmb3IgZm9jdXMuXHJcbiAgICAgIHZhciBmb3JlZ3JvdW5kID0gc3ZnLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZm9yZWdyb3VuZCcpXHJcbiAgICAgICAgLnNlbGVjdEFsbCgncGF0aCcpXHJcbiAgICAgICAgICAuZGF0YShkYXRhKVxyXG4gICAgICAgIC5lbnRlcigpLmFwcGVuZCgncGF0aCcpXHJcbiAgICAgICAgICAuYXR0cignZCcsIHBhdGgpO1xyXG5cclxuICAgICAgLy8gQWRkIGEgZ3JvdXAgZWxlbWVudCBmb3IgZWFjaCBkaW1lbnNpb24uXHJcbiAgICAgIHZhciBnID0gc3ZnLnNlbGVjdEFsbCgnLmRpbWVuc2lvbicpXHJcbiAgICAgICAgICAuZGF0YShkaW1lbnNpb25zKVxyXG4gICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXHJcbiAgICAgICAgICAuYXR0cignY2xhc3MnLCAnZGltZW5zaW9uJylcclxuICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkKSB7IHJldHVybiAndHJhbnNsYXRlKCcgKyB4KGQpICsgJyknOyB9KVxyXG4gICAgICAgICAgLm9uKCdjbGljaycsIGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgICAgICBpZiAoZDMuZXZlbnQuZGVmYXVsdFByZXZlbnRlZCkgcmV0dXJuOyAvLyBjbGljayBzdXBwcmVzc2VkXHJcbiAgICAgICAgICAgIGlmKGQgPT09IHNlbGVjdGVkUHJvcGVydHkpIHNldFByb3BlcnR5KCcnKTtcclxuICAgICAgICAgICAgZWxzZSBzZXRQcm9wZXJ0eShkKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuY2FsbChkMy5iZWhhdmlvci5kcmFnKClcclxuICAgICAgICAgICAgLm9uKCdkcmFnc3RhcnQnLCBmdW5jdGlvbihkKSB7XHJcbiAgICAgICAgICAgICAgZHJhZ2dpbmdbZF0gPSB0aGlzLl9fb3JpZ2luX18gPSB4KGQpO1xyXG4gICAgICAgICAgICAgIGJhY2tncm91bmQuYXR0cigndmlzaWJpbGl0eScsICdoaWRkZW4nKTtcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLm9uKCdkcmFnJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgICAgICAgIGRyYWdnaW5nW2RdID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5fX29yaWdpbl9fICs9IGQzLmV2ZW50LmR4KSk7XHJcbiAgICAgICAgICAgICAgZm9yZWdyb3VuZC5hdHRyKCdkJywgcGF0aCk7XHJcbiAgICAgICAgICAgICAgZGltZW5zaW9ucy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHsgcmV0dXJuIHBvc2l0aW9uKGEpIC0gcG9zaXRpb24oYik7IH0pO1xyXG4gICAgICAgICAgICAgIHguZG9tYWluKGRpbWVuc2lvbnMpO1xyXG4gICAgICAgICAgICAgIGcuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgcG9zaXRpb24oZCkgKyAnKSc7IH0pO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAub24oJ2RyYWdlbmQnLCBmdW5jdGlvbihkKSB7XHJcbiAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuX19vcmlnaW5fXztcclxuICAgICAgICAgICAgICBkZWxldGUgZHJhZ2dpbmdbZF07XHJcbiAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHgoZCkgKyAnKScpO1xyXG4gICAgICAgICAgICAgIGZvcmVncm91bmQuYXR0cignZCcsIHBhdGgpO1xyXG4gICAgICAgICAgICAgIGJhY2tncm91bmQuYXR0cignZCcsIHBhdGgpXHJcbiAgICAgICAgICAgICAgICAgIC5hdHRyKCd2aXNpYmlsaXR5JywgbnVsbCk7XHJcbiAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgIC8vIEFkZCBhbiBheGlzIGFuZCB0aXRsZS5cclxuICAgICAgZy5hcHBlbmQoJ2cnKVxyXG4gICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMnKVxyXG4gICAgICAgICAgLmVhY2goZnVuY3Rpb24oZCkgeyBkMy5zZWxlY3QodGhpcykuY2FsbChheGlzLnNjYWxlKHlbZF0pKTsgfSlcclxuICAgICAgICAuYXBwZW5kKCd0ZXh0JylcclxuICAgICAgICAgIC5hdHRyKCd0ZXh0LWFuY2hvcicsICdtaWRkbGUnKVxyXG4gICAgICAgICAgLmF0dHIoJ3knLCAtOSlcclxuICAgICAgICAgIC50ZXh0KFN0cmluZyk7XHJcblxyXG4gICAgICAvLyBBZGQgYW5kIHN0b3JlIGEgYnJ1c2ggZm9yIGVhY2ggYXhpcy5cclxuICAgICAgZy5hcHBlbmQoJ2cnKVxyXG4gICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2JydXNoJylcclxuICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHsgXHJcbiAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5jYWxsKFxyXG4gICAgICAgICAgICAgIHlbZF0uYnJ1c2ggPSBkMy5zdmcuYnJ1c2goKS55KHlbZF0pXHJcbiAgICAgICAgICAgICAgICAub24oJ2JydXNoc3RhcnQnLCBicnVzaFN0YXJ0SGFuZGxlcilcclxuICAgICAgICAgICAgICAgIC5vbignYnJ1c2gnLCBicnVzaClcclxuICAgICAgICAgICAgICAgIC5vbignYnJ1c2hlbmQnLCBicnVzaEVuZEhhbmRsZXIpXHJcbiAgICAgICAgICAgICk7IFxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAuc2VsZWN0QWxsKCdyZWN0JylcclxuICAgICAgICAgIC5hdHRyKCd4JywgLTgpXHJcbiAgICAgICAgICAuYXR0cignd2lkdGgnLCAxNik7XHJcblxyXG4gICAgICBzZXRQcm9wZXJ0eShzZWxlY3RlZFByb3BlcnR5KTtcclxuXHJcbiAgICAgIGZ1bmN0aW9uIHNldFByb3BlcnR5KHApe1xyXG4gICAgICAgIHNlbGVjdGVkUHJvcGVydHkgPSBwO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHN2Zy5zZWxlY3RBbGwoJy5kaW1lbnNpb24uc2VsZWN0ZWQnKS5hdHRyKCdjbGFzcycsICdkaW1lbnNpb24nKTtcclxuICAgICAgICBzdmcuc2VsZWN0QWxsKCcuZGltZW5zaW9uJylcclxuICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgICAgICBpZihkID09PSBzZWxlY3RlZFByb3BlcnR5KXtcclxuICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykuYXR0cignY2xhc3MnLCAnZGltZW5zaW9uIHNlbGVjdGVkJyk7ICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIGlmKCFwKSByZXR1cm4gZm9yZWdyb3VuZC5zdHlsZSgnc3Ryb2tlJywgJycpO1xyXG5cclxuICAgICAgICB2YXIgY29sb3IgPSBjb2xvckdlbmVyYXRvcihwLCBkYXRhKTtcclxuICAgICAgICBmb3JlZ3JvdW5kLnN0eWxlKCdzdHJva2UnLCBmdW5jdGlvbihkKXsgXHJcbiAgICAgICAgICAgIGlmKCFkW3BdKSByZXR1cm4gJ2dyYXknO1xyXG4gICAgICAgICAgICByZXR1cm4gY29sb3IoZFtwXSk7ICAgXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICBcclxuXHJcbiAgICAgIGZ1bmN0aW9uIHNldEJydXNoKGRpbWVuc2lvbiwgZXh0ZW50KXtcclxuICAgICAgICBzdmcuc2VsZWN0QWxsKCcuYnJ1c2gnKS5maWx0ZXIoZnVuY3Rpb24oZCl7XHJcbiAgICAgICAgICByZXR1cm4gZCA9PT0gZGltZW5zaW9uO1xyXG4gICAgICAgIH0pLmNhbGwoeVtkaW1lbnNpb25dLmJydXNoLmV4dGVudChleHRlbnQpKS5jYWxsKGJydXNoKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgd2luZG93LnNldEJydXNoID0gc2V0QnJ1c2g7XHJcblxyXG4gICAgICBmdW5jdGlvbiBicnVzaEVuZEhhbmRsZXIoKXtcclxuICAgICAgICB2YXIgc2VsZWN0ZWQgPSBzdmcuc2VsZWN0QWxsKCcuZm9yZWdyb3VuZCAuYWN0aXZlJykuZGF0YSgpO1xyXG4gICAgICAgIHZhciBmaWx0ZXJzID0ge307XHJcbiAgICAgICAgZGltZW5zaW9ucy5maWx0ZXIoZnVuY3Rpb24oZGltZW5zaW9uKSB7IHJldHVybiAheVtkaW1lbnNpb25dLmJydXNoLmVtcHR5KCk7IH0pXHJcbiAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihkaW1lbnNpb24pe1xyXG4gICAgICAgICAgICB2YXIgZXh0ZW50ID0geVtkaW1lbnNpb25dLmJydXNoLmV4dGVudCgpO1xyXG4gICAgICAgICAgICBmaWx0ZXJzW2RpbWVuc2lvbl0gPSB7XHJcbiAgICAgICAgICAgICAgbWluOiBleHRlbnRbMF0sXHJcbiAgICAgICAgICAgICAgbWF4OiBleHRlbnRbMV1cclxuICAgICAgICAgICAgfTsgXHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdmFyIGV2ZW50RGV0YWlscyA9IHtcclxuICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXHJcbiAgICAgICAgICBzZWxlY3RlZDogc2VsZWN0ZWQsXHJcbiAgICAgICAgICBmaWx0ZXJzOiBmaWx0ZXJzXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCdjaGFuZ2VmaWx0ZXInLCB7ZGV0YWlsOiBldmVudERldGFpbHN9KTtcclxuICAgICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBIYW5kbGVzIGEgYnJ1c2ggZXZlbnQsIHRvZ2dsaW5nIHRoZSBkaXNwbGF5IG9mIGZvcmVncm91bmQgbGluZXMuXHJcbiAgICAgIGZ1bmN0aW9uIGJydXNoKCkge1xyXG4gICAgICAgIHZhciBhY3RpdmVzID0gZGltZW5zaW9ucy5maWx0ZXIoZnVuY3Rpb24ocCkgeyByZXR1cm4gIXlbcF0uYnJ1c2guZW1wdHkoKTsgfSksXHJcbiAgICAgICAgICAgIGV4dGVudHMgPSBhY3RpdmVzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiB5W3BdLmJydXNoLmV4dGVudCgpOyB9KTtcclxuICAgICAgICBcclxuICAgICAgICBmb3JlZ3JvdW5kLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24oZCkge1xyXG4gICAgICAgICAgdmFyIHZpc2libGUgPSBhY3RpdmVzLmV2ZXJ5KGZ1bmN0aW9uKHAsIGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGV4dGVudHNbaV1bMF0gPD0gZFtwXSAmJiBkW3BdIDw9IGV4dGVudHNbaV1bMV07XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICByZXR1cm4gdmlzaWJsZSA/ICdhY3RpdmUnIDogJ2ZpbHRlcmVkJztcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICBmdW5jdGlvbiBwb3NpdGlvbihkKSB7XHJcbiAgICAgICAgLy8gaWYgd2UncmUgY3VycmVudGx5IGRyYWdnaW5nIHRoZSBheGlzIHJldHVybiB0aGUgZHJhZyBwb3NpdGlvblxyXG4gICAgICAgIC8vIG90aGVyd2lzZSByZXR1cm4gdGhlIG5vcm1hbCB4LWF4aXMgcG9zaXRpb25cclxuICAgICAgICB2YXIgdiA9IGRyYWdnaW5nW2RdO1xyXG4gICAgICAgIHJldHVybiB2ID09IG51bGwgPyB4KGQpIDogdjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gUmV0dXJucyB0aGUgcGF0aCBmb3IgYSBnaXZlbiBkYXRhIHBvaW50LlxyXG4gICAgICBmdW5jdGlvbiBwYXRoKGQpIHtcclxuICAgICAgICByZXR1cm4gbGluZShkaW1lbnNpb25zLm1hcChmdW5jdGlvbihwKSB7IFxyXG4gICAgICAgICAgcmV0dXJuIFtwb3NpdGlvbihwKSwgeVtwXShkW3BdKV07IFxyXG4gICAgICAgIH0pKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjaGFydC53aWR0aCA9IGZ1bmN0aW9uKF8pe1xyXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gd2lkdGg7XHJcbiAgICB3aWR0aCA9IF87XHJcbiAgICBpbm5lcldpZHRoID0gd2lkdGggLSBtYXJnaW5bMV0gLSBtYXJnaW5bM107XHJcbiAgICB4ID0gZDMuc2NhbGUub3JkaW5hbCgpLnJhbmdlUG9pbnRzKFswLCBpbm5lcldpZHRoXSwgMSk7XHJcbiAgICByZXR1cm4gY2hhcnQ7XHJcbiAgfTtcclxuXHJcbiAgY2hhcnQuaGVpZ2h0ID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBoZWlnaHQ7XHJcbiAgICBoZWlnaHQgPSBfO1xyXG4gICAgaW5uZXJIZWlnaHQgPSBoZWlnaHQgLSBtYXJnaW5bMF0gLSBtYXJnaW5bMl07XHJcbiAgICByZXR1cm4gY2hhcnQ7XHJcbiAgfTtcclxuXHJcbiAgY2hhcnQubWFyZ2luID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBtYXJnaW47XHJcbiAgICBtYXJnaW4gPSBfO1xyXG4gICAgY2hhcnQud2lkdGgod2lkdGgpO1xyXG4gICAgY2hhcnQuaGVpZ2h0KGhlaWdodCk7XHJcbiAgICByZXR1cm4gY2hhcnQ7XHJcbiAgfTtcclxuXHJcbiAgY2hhcnQuc2VsZWN0ID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkaW1lbnNpb25zO1xyXG4gICAgZGltZW5zaW9ucyA9IF87XHJcbiAgICByZXR1cm4gY2hhcnQ7XHJcbiAgfTtcclxuXHJcbiAgY2hhcnQuZG9tYWluID0gZnVuY3Rpb24oXyl7XHJcbiAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBkb21haW5HZW5lcmF0b3I7XHJcbiAgICBkb21haW5HZW5lcmF0b3IgPSBfO1xyXG4gICAgcmV0dXJuIGNoYXJ0O1xyXG4gIH07XHJcbiAgXHJcbiAgY2hhcnQuY29sb3IgPSBmdW5jdGlvbihfKXtcclxuICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkgcmV0dXJuIGNvbG9yR2VuZXJhdG9yO1xyXG4gICAgY29sb3JHZW5lcmF0b3IgPSBfO1xyXG4gICAgcmV0dXJuIGNoYXJ0O1xyXG4gIH07XHJcblxyXG4gIGNoYXJ0LmhpZ2hsaWdodCA9IGZ1bmN0aW9uKF8pe1xyXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSByZXR1cm4gc2VsZWN0ZWRQcm9wZXJ0eTtcclxuICAgIHNlbGVjdGVkUHJvcGVydHkgPSBfO1xyXG4gICAgcmV0dXJuIGNoYXJ0O1xyXG4gIH07XHJcblxyXG4gIGNoYXJ0LnJlZHJhdyA9IGZ1bmN0aW9uKHNlbGVjdGlvbil7XHJcbiAgICBzZWxlY3Rpb24uc2VsZWN0QWxsKCdzdmcnKS5yZW1vdmUoKTtcclxuICAgIGNoYXJ0KHNlbGVjdGlvbik7XHJcbiAgICByZXR1cm4gY2hhcnQ7XHJcbiAgfTtcclxuXHJcbiAgY2hhcnQuZHJhdyA9IGZ1bmN0aW9uKHNlbGVjdGlvbil7XHJcbiAgICBjaGFydChzZWxlY3Rpb24pO1xyXG4gICAgcmV0dXJuIGNoYXJ0O1xyXG4gIH07XHJcblxyXG4gIGlmKCd3aWR0aCcgaW4gY29uZmlnKSBjaGFydC53aWR0aChjb25maWcud2lkdGgpO1xyXG4gIGlmKCdoZWlnaHQnIGluIGNvbmZpZykgY2hhcnQuaGVpZ2h0KGNvbmZpZy5oZWlnaHQpO1xyXG4gIGlmKCdtYXJnaW4nIGluIGNvbmZpZykgY2hhcnQubWFyZ2luKGNvbmZpZy5tYXJnaW4pO1xyXG4gIGlmKCdzZWxlY3QnIGluIGNvbmZpZykgY2hhcnQuc2VsZWN0KGNvbmZpZy5zZWxlY3QpO1xyXG4gIGlmKCdkb21haW4nIGluIGNvbmZpZykgY2hhcnQuZG9tYWluKGNvbmZpZy5kb21haW4pO1xyXG4gIGlmKCdoaWdobGlnaHQnIGluIGNvbmZpZykgY2hhcnQuaGlnaGxpZ2h0KGNvbmZpZy5oaWdobGlnaHQpO1xyXG4gIGlmKCdjb2xvcicgaW4gY29uZmlnKSBjaGFydC5jb2xvcihjb25maWcuY29sb3IpO1xyXG5cclxuICByZXR1cm4gY2hhcnQ7XHJcbn07XHJcbiIsInZhciBjb2xvcmJyZXdlciA9IHJlcXVpcmUoJy4vY29sb3JicmV3ZXInKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29sb3JHZW5lcmF0b3IocHJvcGVydHksIGRhdGEpe1xyXG4gIHZhciByYW5nZSA9IGNvbG9yYnJld2VyLlJkWWxHblsxMF0uc2xpY2UoMCk7XHJcbiAgXHJcbiAgcmV0dXJuIGQzLnNjYWxlLnF1YW50aWxlKClcclxuICAgIC5yYW5nZShyYW5nZSlcclxuICAgIC5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICtkW3Byb3BlcnR5XTsgfSkpO1xyXG59OyIsIi8vIENvcGllZCBmcm9tIEQzOiBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvYmxvYi9tYXN0ZXIvbGliL2NvbG9yYnJld2VyL2NvbG9yYnJld2VyLmpzXHJcbi8vIFRoaXMgcHJvZHVjdCBpbmNsdWRlcyBjb2xvciBzcGVjaWZpY2F0aW9ucyBhbmQgZGVzaWducyBkZXZlbG9wZWQgYnkgQ3ludGhpYSBCcmV3ZXIgKGh0dHA6Ly9jb2xvcmJyZXdlci5vcmcvKS5cclxubW9kdWxlLmV4cG9ydHMgPSB7WWxHbjoge1xyXG4zOiBbJyNmN2ZjYjknLCcjYWRkZDhlJywnIzMxYTM1NCddLFxyXG40OiBbJyNmZmZmY2MnLCcjYzJlNjk5JywnIzc4YzY3OScsJyMyMzg0NDMnXSxcclxuNTogWycjZmZmZmNjJywnI2MyZTY5OScsJyM3OGM2NzknLCcjMzFhMzU0JywnIzAwNjgzNyddLFxyXG42OiBbJyNmZmZmY2MnLCcjZDlmMGEzJywnI2FkZGQ4ZScsJyM3OGM2NzknLCcjMzFhMzU0JywnIzAwNjgzNyddLFxyXG43OiBbJyNmZmZmY2MnLCcjZDlmMGEzJywnI2FkZGQ4ZScsJyM3OGM2NzknLCcjNDFhYjVkJywnIzIzODQ0MycsJyMwMDVhMzInXSxcclxuODogWycjZmZmZmU1JywnI2Y3ZmNiOScsJyNkOWYwYTMnLCcjYWRkZDhlJywnIzc4YzY3OScsJyM0MWFiNWQnLCcjMjM4NDQzJywnIzAwNWEzMiddLFxyXG45OiBbJyNmZmZmZTUnLCcjZjdmY2I5JywnI2Q5ZjBhMycsJyNhZGRkOGUnLCcjNzhjNjc5JywnIzQxYWI1ZCcsJyMyMzg0NDMnLCcjMDA2ODM3JywnIzAwNDUyOSddXHJcbn0sWWxHbkJ1OiB7XHJcbjM6IFsnI2VkZjhiMScsJyM3ZmNkYmInLCcjMmM3ZmI4J10sXHJcbjQ6IFsnI2ZmZmZjYycsJyNhMWRhYjQnLCcjNDFiNmM0JywnIzIyNWVhOCddLFxyXG41OiBbJyNmZmZmY2MnLCcjYTFkYWI0JywnIzQxYjZjNCcsJyMyYzdmYjgnLCcjMjUzNDk0J10sXHJcbjY6IFsnI2ZmZmZjYycsJyNjN2U5YjQnLCcjN2ZjZGJiJywnIzQxYjZjNCcsJyMyYzdmYjgnLCcjMjUzNDk0J10sXHJcbjc6IFsnI2ZmZmZjYycsJyNjN2U5YjQnLCcjN2ZjZGJiJywnIzQxYjZjNCcsJyMxZDkxYzAnLCcjMjI1ZWE4JywnIzBjMmM4NCddLFxyXG44OiBbJyNmZmZmZDknLCcjZWRmOGIxJywnI2M3ZTliNCcsJyM3ZmNkYmInLCcjNDFiNmM0JywnIzFkOTFjMCcsJyMyMjVlYTgnLCcjMGMyYzg0J10sXHJcbjk6IFsnI2ZmZmZkOScsJyNlZGY4YjEnLCcjYzdlOWI0JywnIzdmY2RiYicsJyM0MWI2YzQnLCcjMWQ5MWMwJywnIzIyNWVhOCcsJyMyNTM0OTQnLCcjMDgxZDU4J11cclxufSxHbkJ1OiB7XHJcbjM6IFsnI2UwZjNkYicsJyNhOGRkYjUnLCcjNDNhMmNhJ10sXHJcbjQ6IFsnI2YwZjllOCcsJyNiYWU0YmMnLCcjN2JjY2M0JywnIzJiOGNiZSddLFxyXG41OiBbJyNmMGY5ZTgnLCcjYmFlNGJjJywnIzdiY2NjNCcsJyM0M2EyY2EnLCcjMDg2OGFjJ10sXHJcbjY6IFsnI2YwZjllOCcsJyNjY2ViYzUnLCcjYThkZGI1JywnIzdiY2NjNCcsJyM0M2EyY2EnLCcjMDg2OGFjJ10sXHJcbjc6IFsnI2YwZjllOCcsJyNjY2ViYzUnLCcjYThkZGI1JywnIzdiY2NjNCcsJyM0ZWIzZDMnLCcjMmI4Y2JlJywnIzA4NTg5ZSddLFxyXG44OiBbJyNmN2ZjZjAnLCcjZTBmM2RiJywnI2NjZWJjNScsJyNhOGRkYjUnLCcjN2JjY2M0JywnIzRlYjNkMycsJyMyYjhjYmUnLCcjMDg1ODllJ10sXHJcbjk6IFsnI2Y3ZmNmMCcsJyNlMGYzZGInLCcjY2NlYmM1JywnI2E4ZGRiNScsJyM3YmNjYzQnLCcjNGViM2QzJywnIzJiOGNiZScsJyMwODY4YWMnLCcjMDg0MDgxJ11cclxufSxCdUduOiB7XHJcbjM6IFsnI2U1ZjVmOScsJyM5OWQ4YzknLCcjMmNhMjVmJ10sXHJcbjQ6IFsnI2VkZjhmYicsJyNiMmUyZTInLCcjNjZjMmE0JywnIzIzOGI0NSddLFxyXG41OiBbJyNlZGY4ZmInLCcjYjJlMmUyJywnIzY2YzJhNCcsJyMyY2EyNWYnLCcjMDA2ZDJjJ10sXHJcbjY6IFsnI2VkZjhmYicsJyNjY2VjZTYnLCcjOTlkOGM5JywnIzY2YzJhNCcsJyMyY2EyNWYnLCcjMDA2ZDJjJ10sXHJcbjc6IFsnI2VkZjhmYicsJyNjY2VjZTYnLCcjOTlkOGM5JywnIzY2YzJhNCcsJyM0MWFlNzYnLCcjMjM4YjQ1JywnIzAwNTgyNCddLFxyXG44OiBbJyNmN2ZjZmQnLCcjZTVmNWY5JywnI2NjZWNlNicsJyM5OWQ4YzknLCcjNjZjMmE0JywnIzQxYWU3NicsJyMyMzhiNDUnLCcjMDA1ODI0J10sXHJcbjk6IFsnI2Y3ZmNmZCcsJyNlNWY1ZjknLCcjY2NlY2U2JywnIzk5ZDhjOScsJyM2NmMyYTQnLCcjNDFhZTc2JywnIzIzOGI0NScsJyMwMDZkMmMnLCcjMDA0NDFiJ11cclxufSxQdUJ1R246IHtcclxuMzogWycjZWNlMmYwJywnI2E2YmRkYicsJyMxYzkwOTknXSxcclxuNDogWycjZjZlZmY3JywnI2JkYzllMScsJyM2N2E5Y2YnLCcjMDI4MThhJ10sXHJcbjU6IFsnI2Y2ZWZmNycsJyNiZGM5ZTEnLCcjNjdhOWNmJywnIzFjOTA5OScsJyMwMTZjNTknXSxcclxuNjogWycjZjZlZmY3JywnI2QwZDFlNicsJyNhNmJkZGInLCcjNjdhOWNmJywnIzFjOTA5OScsJyMwMTZjNTknXSxcclxuNzogWycjZjZlZmY3JywnI2QwZDFlNicsJyNhNmJkZGInLCcjNjdhOWNmJywnIzM2OTBjMCcsJyMwMjgxOGEnLCcjMDE2NDUwJ10sXHJcbjg6IFsnI2ZmZjdmYicsJyNlY2UyZjAnLCcjZDBkMWU2JywnI2E2YmRkYicsJyM2N2E5Y2YnLCcjMzY5MGMwJywnIzAyODE4YScsJyMwMTY0NTAnXSxcclxuOTogWycjZmZmN2ZiJywnI2VjZTJmMCcsJyNkMGQxZTYnLCcjYTZiZGRiJywnIzY3YTljZicsJyMzNjkwYzAnLCcjMDI4MThhJywnIzAxNmM1OScsJyMwMTQ2MzYnXVxyXG59LFB1QnU6IHtcclxuMzogWycjZWNlN2YyJywnI2E2YmRkYicsJyMyYjhjYmUnXSxcclxuNDogWycjZjFlZWY2JywnI2JkYzllMScsJyM3NGE5Y2YnLCcjMDU3MGIwJ10sXHJcbjU6IFsnI2YxZWVmNicsJyNiZGM5ZTEnLCcjNzRhOWNmJywnIzJiOGNiZScsJyMwNDVhOGQnXSxcclxuNjogWycjZjFlZWY2JywnI2QwZDFlNicsJyNhNmJkZGInLCcjNzRhOWNmJywnIzJiOGNiZScsJyMwNDVhOGQnXSxcclxuNzogWycjZjFlZWY2JywnI2QwZDFlNicsJyNhNmJkZGInLCcjNzRhOWNmJywnIzM2OTBjMCcsJyMwNTcwYjAnLCcjMDM0ZTdiJ10sXHJcbjg6IFsnI2ZmZjdmYicsJyNlY2U3ZjInLCcjZDBkMWU2JywnI2E2YmRkYicsJyM3NGE5Y2YnLCcjMzY5MGMwJywnIzA1NzBiMCcsJyMwMzRlN2InXSxcclxuOTogWycjZmZmN2ZiJywnI2VjZTdmMicsJyNkMGQxZTYnLCcjYTZiZGRiJywnIzc0YTljZicsJyMzNjkwYzAnLCcjMDU3MGIwJywnIzA0NWE4ZCcsJyMwMjM4NTgnXVxyXG59LEJ1UHU6IHtcclxuMzogWycjZTBlY2Y0JywnIzllYmNkYScsJyM4ODU2YTcnXSxcclxuNDogWycjZWRmOGZiJywnI2IzY2RlMycsJyM4Yzk2YzYnLCcjODg0MTlkJ10sXHJcbjU6IFsnI2VkZjhmYicsJyNiM2NkZTMnLCcjOGM5NmM2JywnIzg4NTZhNycsJyM4MTBmN2MnXSxcclxuNjogWycjZWRmOGZiJywnI2JmZDNlNicsJyM5ZWJjZGEnLCcjOGM5NmM2JywnIzg4NTZhNycsJyM4MTBmN2MnXSxcclxuNzogWycjZWRmOGZiJywnI2JmZDNlNicsJyM5ZWJjZGEnLCcjOGM5NmM2JywnIzhjNmJiMScsJyM4ODQxOWQnLCcjNmUwMTZiJ10sXHJcbjg6IFsnI2Y3ZmNmZCcsJyNlMGVjZjQnLCcjYmZkM2U2JywnIzllYmNkYScsJyM4Yzk2YzYnLCcjOGM2YmIxJywnIzg4NDE5ZCcsJyM2ZTAxNmInXSxcclxuOTogWycjZjdmY2ZkJywnI2UwZWNmNCcsJyNiZmQzZTYnLCcjOWViY2RhJywnIzhjOTZjNicsJyM4YzZiYjEnLCcjODg0MTlkJywnIzgxMGY3YycsJyM0ZDAwNGInXVxyXG59LFJkUHU6IHtcclxuMzogWycjZmRlMGRkJywnI2ZhOWZiNScsJyNjNTFiOGEnXSxcclxuNDogWycjZmVlYmUyJywnI2ZiYjRiOScsJyNmNzY4YTEnLCcjYWUwMTdlJ10sXHJcbjU6IFsnI2ZlZWJlMicsJyNmYmI0YjknLCcjZjc2OGExJywnI2M1MWI4YScsJyM3YTAxNzcnXSxcclxuNjogWycjZmVlYmUyJywnI2ZjYzVjMCcsJyNmYTlmYjUnLCcjZjc2OGExJywnI2M1MWI4YScsJyM3YTAxNzcnXSxcclxuNzogWycjZmVlYmUyJywnI2ZjYzVjMCcsJyNmYTlmYjUnLCcjZjc2OGExJywnI2RkMzQ5NycsJyNhZTAxN2UnLCcjN2EwMTc3J10sXHJcbjg6IFsnI2ZmZjdmMycsJyNmZGUwZGQnLCcjZmNjNWMwJywnI2ZhOWZiNScsJyNmNzY4YTEnLCcjZGQzNDk3JywnI2FlMDE3ZScsJyM3YTAxNzcnXSxcclxuOTogWycjZmZmN2YzJywnI2ZkZTBkZCcsJyNmY2M1YzAnLCcjZmE5ZmI1JywnI2Y3NjhhMScsJyNkZDM0OTcnLCcjYWUwMTdlJywnIzdhMDE3NycsJyM0OTAwNmEnXVxyXG59LFB1UmQ6IHtcclxuMzogWycjZTdlMWVmJywnI2M5OTRjNycsJyNkZDFjNzcnXSxcclxuNDogWycjZjFlZWY2JywnI2Q3YjVkOCcsJyNkZjY1YjAnLCcjY2UxMjU2J10sXHJcbjU6IFsnI2YxZWVmNicsJyNkN2I1ZDgnLCcjZGY2NWIwJywnI2RkMWM3NycsJyM5ODAwNDMnXSxcclxuNjogWycjZjFlZWY2JywnI2Q0YjlkYScsJyNjOTk0YzcnLCcjZGY2NWIwJywnI2RkMWM3NycsJyM5ODAwNDMnXSxcclxuNzogWycjZjFlZWY2JywnI2Q0YjlkYScsJyNjOTk0YzcnLCcjZGY2NWIwJywnI2U3Mjk4YScsJyNjZTEyNTYnLCcjOTEwMDNmJ10sXHJcbjg6IFsnI2Y3ZjRmOScsJyNlN2UxZWYnLCcjZDRiOWRhJywnI2M5OTRjNycsJyNkZjY1YjAnLCcjZTcyOThhJywnI2NlMTI1NicsJyM5MTAwM2YnXSxcclxuOTogWycjZjdmNGY5JywnI2U3ZTFlZicsJyNkNGI5ZGEnLCcjYzk5NGM3JywnI2RmNjViMCcsJyNlNzI5OGEnLCcjY2UxMjU2JywnIzk4MDA0MycsJyM2NzAwMWYnXVxyXG59LE9yUmQ6IHtcclxuMzogWycjZmVlOGM4JywnI2ZkYmI4NCcsJyNlMzRhMzMnXSxcclxuNDogWycjZmVmMGQ5JywnI2ZkY2M4YScsJyNmYzhkNTknLCcjZDczMDFmJ10sXHJcbjU6IFsnI2ZlZjBkOScsJyNmZGNjOGEnLCcjZmM4ZDU5JywnI2UzNGEzMycsJyNiMzAwMDAnXSxcclxuNjogWycjZmVmMGQ5JywnI2ZkZDQ5ZScsJyNmZGJiODQnLCcjZmM4ZDU5JywnI2UzNGEzMycsJyNiMzAwMDAnXSxcclxuNzogWycjZmVmMGQ5JywnI2ZkZDQ5ZScsJyNmZGJiODQnLCcjZmM4ZDU5JywnI2VmNjU0OCcsJyNkNzMwMWYnLCcjOTkwMDAwJ10sXHJcbjg6IFsnI2ZmZjdlYycsJyNmZWU4YzgnLCcjZmRkNDllJywnI2ZkYmI4NCcsJyNmYzhkNTknLCcjZWY2NTQ4JywnI2Q3MzAxZicsJyM5OTAwMDAnXSxcclxuOTogWycjZmZmN2VjJywnI2ZlZThjOCcsJyNmZGQ0OWUnLCcjZmRiYjg0JywnI2ZjOGQ1OScsJyNlZjY1NDgnLCcjZDczMDFmJywnI2IzMDAwMCcsJyM3ZjAwMDAnXVxyXG59LFlsT3JSZDoge1xyXG4zOiBbJyNmZmVkYTAnLCcjZmViMjRjJywnI2YwM2IyMCddLFxyXG40OiBbJyNmZmZmYjInLCcjZmVjYzVjJywnI2ZkOGQzYycsJyNlMzFhMWMnXSxcclxuNTogWycjZmZmZmIyJywnI2ZlY2M1YycsJyNmZDhkM2MnLCcjZjAzYjIwJywnI2JkMDAyNiddLFxyXG42OiBbJyNmZmZmYjInLCcjZmVkOTc2JywnI2ZlYjI0YycsJyNmZDhkM2MnLCcjZjAzYjIwJywnI2JkMDAyNiddLFxyXG43OiBbJyNmZmZmYjInLCcjZmVkOTc2JywnI2ZlYjI0YycsJyNmZDhkM2MnLCcjZmM0ZTJhJywnI2UzMWExYycsJyNiMTAwMjYnXSxcclxuODogWycjZmZmZmNjJywnI2ZmZWRhMCcsJyNmZWQ5NzYnLCcjZmViMjRjJywnI2ZkOGQzYycsJyNmYzRlMmEnLCcjZTMxYTFjJywnI2IxMDAyNiddLFxyXG45OiBbJyNmZmZmY2MnLCcjZmZlZGEwJywnI2ZlZDk3NicsJyNmZWIyNGMnLCcjZmQ4ZDNjJywnI2ZjNGUyYScsJyNlMzFhMWMnLCcjYmQwMDI2JywnIzgwMDAyNiddXHJcbn0sWWxPckJyOiB7XHJcbjM6IFsnI2ZmZjdiYycsJyNmZWM0NGYnLCcjZDk1ZjBlJ10sXHJcbjQ6IFsnI2ZmZmZkNCcsJyNmZWQ5OGUnLCcjZmU5OTI5JywnI2NjNGMwMiddLFxyXG41OiBbJyNmZmZmZDQnLCcjZmVkOThlJywnI2ZlOTkyOScsJyNkOTVmMGUnLCcjOTkzNDA0J10sXHJcbjY6IFsnI2ZmZmZkNCcsJyNmZWUzOTEnLCcjZmVjNDRmJywnI2ZlOTkyOScsJyNkOTVmMGUnLCcjOTkzNDA0J10sXHJcbjc6IFsnI2ZmZmZkNCcsJyNmZWUzOTEnLCcjZmVjNDRmJywnI2ZlOTkyOScsJyNlYzcwMTQnLCcjY2M0YzAyJywnIzhjMmQwNCddLFxyXG44OiBbJyNmZmZmZTUnLCcjZmZmN2JjJywnI2ZlZTM5MScsJyNmZWM0NGYnLCcjZmU5OTI5JywnI2VjNzAxNCcsJyNjYzRjMDInLCcjOGMyZDA0J10sXHJcbjk6IFsnI2ZmZmZlNScsJyNmZmY3YmMnLCcjZmVlMzkxJywnI2ZlYzQ0ZicsJyNmZTk5MjknLCcjZWM3MDE0JywnI2NjNGMwMicsJyM5OTM0MDQnLCcjNjYyNTA2J11cclxufSxQdXJwbGVzOiB7XHJcbjM6IFsnI2VmZWRmNScsJyNiY2JkZGMnLCcjNzU2YmIxJ10sXHJcbjQ6IFsnI2YyZjBmNycsJyNjYmM5ZTInLCcjOWU5YWM4JywnIzZhNTFhMyddLFxyXG41OiBbJyNmMmYwZjcnLCcjY2JjOWUyJywnIzllOWFjOCcsJyM3NTZiYjEnLCcjNTQyNzhmJ10sXHJcbjY6IFsnI2YyZjBmNycsJyNkYWRhZWInLCcjYmNiZGRjJywnIzllOWFjOCcsJyM3NTZiYjEnLCcjNTQyNzhmJ10sXHJcbjc6IFsnI2YyZjBmNycsJyNkYWRhZWInLCcjYmNiZGRjJywnIzllOWFjOCcsJyM4MDdkYmEnLCcjNmE1MWEzJywnIzRhMTQ4NiddLFxyXG44OiBbJyNmY2ZiZmQnLCcjZWZlZGY1JywnI2RhZGFlYicsJyNiY2JkZGMnLCcjOWU5YWM4JywnIzgwN2RiYScsJyM2YTUxYTMnLCcjNGExNDg2J10sXHJcbjk6IFsnI2ZjZmJmZCcsJyNlZmVkZjUnLCcjZGFkYWViJywnI2JjYmRkYycsJyM5ZTlhYzgnLCcjODA3ZGJhJywnIzZhNTFhMycsJyM1NDI3OGYnLCcjM2YwMDdkJ11cclxufSxCbHVlczoge1xyXG4zOiBbJyNkZWViZjcnLCcjOWVjYWUxJywnIzMxODJiZCddLFxyXG40OiBbJyNlZmYzZmYnLCcjYmRkN2U3JywnIzZiYWVkNicsJyMyMTcxYjUnXSxcclxuNTogWycjZWZmM2ZmJywnI2JkZDdlNycsJyM2YmFlZDYnLCcjMzE4MmJkJywnIzA4NTE5YyddLFxyXG42OiBbJyNlZmYzZmYnLCcjYzZkYmVmJywnIzllY2FlMScsJyM2YmFlZDYnLCcjMzE4MmJkJywnIzA4NTE5YyddLFxyXG43OiBbJyNlZmYzZmYnLCcjYzZkYmVmJywnIzllY2FlMScsJyM2YmFlZDYnLCcjNDI5MmM2JywnIzIxNzFiNScsJyMwODQ1OTQnXSxcclxuODogWycjZjdmYmZmJywnI2RlZWJmNycsJyNjNmRiZWYnLCcjOWVjYWUxJywnIzZiYWVkNicsJyM0MjkyYzYnLCcjMjE3MWI1JywnIzA4NDU5NCddLFxyXG45OiBbJyNmN2ZiZmYnLCcjZGVlYmY3JywnI2M2ZGJlZicsJyM5ZWNhZTEnLCcjNmJhZWQ2JywnIzQyOTJjNicsJyMyMTcxYjUnLCcjMDg1MTljJywnIzA4MzA2YiddXHJcbn0sR3JlZW5zOiB7XHJcbjM6IFsnI2U1ZjVlMCcsJyNhMWQ5OWInLCcjMzFhMzU0J10sXHJcbjQ6IFsnI2VkZjhlOScsJyNiYWU0YjMnLCcjNzRjNDc2JywnIzIzOGI0NSddLFxyXG41OiBbJyNlZGY4ZTknLCcjYmFlNGIzJywnIzc0YzQ3NicsJyMzMWEzNTQnLCcjMDA2ZDJjJ10sXHJcbjY6IFsnI2VkZjhlOScsJyNjN2U5YzAnLCcjYTFkOTliJywnIzc0YzQ3NicsJyMzMWEzNTQnLCcjMDA2ZDJjJ10sXHJcbjc6IFsnI2VkZjhlOScsJyNjN2U5YzAnLCcjYTFkOTliJywnIzc0YzQ3NicsJyM0MWFiNWQnLCcjMjM4YjQ1JywnIzAwNWEzMiddLFxyXG44OiBbJyNmN2ZjZjUnLCcjZTVmNWUwJywnI2M3ZTljMCcsJyNhMWQ5OWInLCcjNzRjNDc2JywnIzQxYWI1ZCcsJyMyMzhiNDUnLCcjMDA1YTMyJ10sXHJcbjk6IFsnI2Y3ZmNmNScsJyNlNWY1ZTAnLCcjYzdlOWMwJywnI2ExZDk5YicsJyM3NGM0NzYnLCcjNDFhYjVkJywnIzIzOGI0NScsJyMwMDZkMmMnLCcjMDA0NDFiJ11cclxufSxPcmFuZ2VzOiB7XHJcbjM6IFsnI2ZlZTZjZScsJyNmZGFlNmInLCcjZTY1NTBkJ10sXHJcbjQ6IFsnI2ZlZWRkZScsJyNmZGJlODUnLCcjZmQ4ZDNjJywnI2Q5NDcwMSddLFxyXG41OiBbJyNmZWVkZGUnLCcjZmRiZTg1JywnI2ZkOGQzYycsJyNlNjU1MGQnLCcjYTYzNjAzJ10sXHJcbjY6IFsnI2ZlZWRkZScsJyNmZGQwYTInLCcjZmRhZTZiJywnI2ZkOGQzYycsJyNlNjU1MGQnLCcjYTYzNjAzJ10sXHJcbjc6IFsnI2ZlZWRkZScsJyNmZGQwYTInLCcjZmRhZTZiJywnI2ZkOGQzYycsJyNmMTY5MTMnLCcjZDk0ODAxJywnIzhjMmQwNCddLFxyXG44OiBbJyNmZmY1ZWInLCcjZmVlNmNlJywnI2ZkZDBhMicsJyNmZGFlNmInLCcjZmQ4ZDNjJywnI2YxNjkxMycsJyNkOTQ4MDEnLCcjOGMyZDA0J10sXHJcbjk6IFsnI2ZmZjVlYicsJyNmZWU2Y2UnLCcjZmRkMGEyJywnI2ZkYWU2YicsJyNmZDhkM2MnLCcjZjE2OTEzJywnI2Q5NDgwMScsJyNhNjM2MDMnLCcjN2YyNzA0J11cclxufSxSZWRzOiB7XHJcbjM6IFsnI2ZlZTBkMicsJyNmYzkyNzInLCcjZGUyZDI2J10sXHJcbjQ6IFsnI2ZlZTVkOScsJyNmY2FlOTEnLCcjZmI2YTRhJywnI2NiMTgxZCddLFxyXG41OiBbJyNmZWU1ZDknLCcjZmNhZTkxJywnI2ZiNmE0YScsJyNkZTJkMjYnLCcjYTUwZjE1J10sXHJcbjY6IFsnI2ZlZTVkOScsJyNmY2JiYTEnLCcjZmM5MjcyJywnI2ZiNmE0YScsJyNkZTJkMjYnLCcjYTUwZjE1J10sXHJcbjc6IFsnI2ZlZTVkOScsJyNmY2JiYTEnLCcjZmM5MjcyJywnI2ZiNmE0YScsJyNlZjNiMmMnLCcjY2IxODFkJywnIzk5MDAwZCddLFxyXG44OiBbJyNmZmY1ZjAnLCcjZmVlMGQyJywnI2ZjYmJhMScsJyNmYzkyNzInLCcjZmI2YTRhJywnI2VmM2IyYycsJyNjYjE4MWQnLCcjOTkwMDBkJ10sXHJcbjk6IFsnI2ZmZjVmMCcsJyNmZWUwZDInLCcjZmNiYmExJywnI2ZjOTI3MicsJyNmYjZhNGEnLCcjZWYzYjJjJywnI2NiMTgxZCcsJyNhNTBmMTUnLCcjNjcwMDBkJ11cclxufSxHcmV5czoge1xyXG4zOiBbJyNmMGYwZjAnLCcjYmRiZGJkJywnIzYzNjM2MyddLFxyXG40OiBbJyNmN2Y3ZjcnLCcjY2NjY2NjJywnIzk2OTY5NicsJyM1MjUyNTInXSxcclxuNTogWycjZjdmN2Y3JywnI2NjY2NjYycsJyM5Njk2OTYnLCcjNjM2MzYzJywnIzI1MjUyNSddLFxyXG42OiBbJyNmN2Y3ZjcnLCcjZDlkOWQ5JywnI2JkYmRiZCcsJyM5Njk2OTYnLCcjNjM2MzYzJywnIzI1MjUyNSddLFxyXG43OiBbJyNmN2Y3ZjcnLCcjZDlkOWQ5JywnI2JkYmRiZCcsJyM5Njk2OTYnLCcjNzM3MzczJywnIzUyNTI1MicsJyMyNTI1MjUnXSxcclxuODogWycjZmZmZmZmJywnI2YwZjBmMCcsJyNkOWQ5ZDknLCcjYmRiZGJkJywnIzk2OTY5NicsJyM3MzczNzMnLCcjNTI1MjUyJywnIzI1MjUyNSddLFxyXG45OiBbJyNmZmZmZmYnLCcjZjBmMGYwJywnI2Q5ZDlkOScsJyNiZGJkYmQnLCcjOTY5Njk2JywnIzczNzM3MycsJyM1MjUyNTInLCcjMjUyNTI1JywnIzAwMDAwMCddXHJcbn0sUHVPcjoge1xyXG4zOiBbJyNmMWEzNDAnLCcjZjdmN2Y3JywnIzk5OGVjMyddLFxyXG40OiBbJyNlNjYxMDEnLCcjZmRiODYzJywnI2IyYWJkMicsJyM1ZTNjOTknXSxcclxuNTogWycjZTY2MTAxJywnI2ZkYjg2MycsJyNmN2Y3ZjcnLCcjYjJhYmQyJywnIzVlM2M5OSddLFxyXG42OiBbJyNiMzU4MDYnLCcjZjFhMzQwJywnI2ZlZTBiNicsJyNkOGRhZWInLCcjOTk4ZWMzJywnIzU0Mjc4OCddLFxyXG43OiBbJyNiMzU4MDYnLCcjZjFhMzQwJywnI2ZlZTBiNicsJyNmN2Y3ZjcnLCcjZDhkYWViJywnIzk5OGVjMycsJyM1NDI3ODgnXSxcclxuODogWycjYjM1ODA2JywnI2UwODIxNCcsJyNmZGI4NjMnLCcjZmVlMGI2JywnI2Q4ZGFlYicsJyNiMmFiZDInLCcjODA3M2FjJywnIzU0Mjc4OCddLFxyXG45OiBbJyNiMzU4MDYnLCcjZTA4MjE0JywnI2ZkYjg2MycsJyNmZWUwYjYnLCcjZjdmN2Y3JywnI2Q4ZGFlYicsJyNiMmFiZDInLCcjODA3M2FjJywnIzU0Mjc4OCddLFxyXG4xMDogWycjN2YzYjA4JywnI2IzNTgwNicsJyNlMDgyMTQnLCcjZmRiODYzJywnI2ZlZTBiNicsJyNkOGRhZWInLCcjYjJhYmQyJywnIzgwNzNhYycsJyM1NDI3ODgnLCcjMmQwMDRiJ10sXHJcbjExOiBbJyM3ZjNiMDgnLCcjYjM1ODA2JywnI2UwODIxNCcsJyNmZGI4NjMnLCcjZmVlMGI2JywnI2Y3ZjdmNycsJyNkOGRhZWInLCcjYjJhYmQyJywnIzgwNzNhYycsJyM1NDI3ODgnLCcjMmQwMDRiJ11cclxufSxCckJHOiB7XHJcbjM6IFsnI2Q4YjM2NScsJyNmNWY1ZjUnLCcjNWFiNGFjJ10sXHJcbjQ6IFsnI2E2NjExYScsJyNkZmMyN2QnLCcjODBjZGMxJywnIzAxODU3MSddLFxyXG41OiBbJyNhNjYxMWEnLCcjZGZjMjdkJywnI2Y1ZjVmNScsJyM4MGNkYzEnLCcjMDE4NTcxJ10sXHJcbjY6IFsnIzhjNTEwYScsJyNkOGIzNjUnLCcjZjZlOGMzJywnI2M3ZWFlNScsJyM1YWI0YWMnLCcjMDE2NjVlJ10sXHJcbjc6IFsnIzhjNTEwYScsJyNkOGIzNjUnLCcjZjZlOGMzJywnI2Y1ZjVmNScsJyNjN2VhZTUnLCcjNWFiNGFjJywnIzAxNjY1ZSddLFxyXG44OiBbJyM4YzUxMGEnLCcjYmY4MTJkJywnI2RmYzI3ZCcsJyNmNmU4YzMnLCcjYzdlYWU1JywnIzgwY2RjMScsJyMzNTk3OGYnLCcjMDE2NjVlJ10sXHJcbjk6IFsnIzhjNTEwYScsJyNiZjgxMmQnLCcjZGZjMjdkJywnI2Y2ZThjMycsJyNmNWY1ZjUnLCcjYzdlYWU1JywnIzgwY2RjMScsJyMzNTk3OGYnLCcjMDE2NjVlJ10sXHJcbjEwOiBbJyM1NDMwMDUnLCcjOGM1MTBhJywnI2JmODEyZCcsJyNkZmMyN2QnLCcjZjZlOGMzJywnI2M3ZWFlNScsJyM4MGNkYzEnLCcjMzU5NzhmJywnIzAxNjY1ZScsJyMwMDNjMzAnXSxcclxuMTE6IFsnIzU0MzAwNScsJyM4YzUxMGEnLCcjYmY4MTJkJywnI2RmYzI3ZCcsJyNmNmU4YzMnLCcjZjVmNWY1JywnI2M3ZWFlNScsJyM4MGNkYzEnLCcjMzU5NzhmJywnIzAxNjY1ZScsJyMwMDNjMzAnXVxyXG59LFBSR246IHtcclxuMzogWycjYWY4ZGMzJywnI2Y3ZjdmNycsJyM3ZmJmN2InXSxcclxuNDogWycjN2IzMjk0JywnI2MyYTVjZicsJyNhNmRiYTAnLCcjMDA4ODM3J10sXHJcbjU6IFsnIzdiMzI5NCcsJyNjMmE1Y2YnLCcjZjdmN2Y3JywnI2E2ZGJhMCcsJyMwMDg4MzcnXSxcclxuNjogWycjNzYyYTgzJywnI2FmOGRjMycsJyNlN2Q0ZTgnLCcjZDlmMGQzJywnIzdmYmY3YicsJyMxYjc4MzcnXSxcclxuNzogWycjNzYyYTgzJywnI2FmOGRjMycsJyNlN2Q0ZTgnLCcjZjdmN2Y3JywnI2Q5ZjBkMycsJyM3ZmJmN2InLCcjMWI3ODM3J10sXHJcbjg6IFsnIzc2MmE4MycsJyM5OTcwYWInLCcjYzJhNWNmJywnI2U3ZDRlOCcsJyNkOWYwZDMnLCcjYTZkYmEwJywnIzVhYWU2MScsJyMxYjc4MzcnXSxcclxuOTogWycjNzYyYTgzJywnIzk5NzBhYicsJyNjMmE1Y2YnLCcjZTdkNGU4JywnI2Y3ZjdmNycsJyNkOWYwZDMnLCcjYTZkYmEwJywnIzVhYWU2MScsJyMxYjc4MzcnXSxcclxuMTA6IFsnIzQwMDA0YicsJyM3NjJhODMnLCcjOTk3MGFiJywnI2MyYTVjZicsJyNlN2Q0ZTgnLCcjZDlmMGQzJywnI2E2ZGJhMCcsJyM1YWFlNjEnLCcjMWI3ODM3JywnIzAwNDQxYiddLFxyXG4xMTogWycjNDAwMDRiJywnIzc2MmE4MycsJyM5OTcwYWInLCcjYzJhNWNmJywnI2U3ZDRlOCcsJyNmN2Y3ZjcnLCcjZDlmMGQzJywnI2E2ZGJhMCcsJyM1YWFlNjEnLCcjMWI3ODM3JywnIzAwNDQxYiddXHJcbn0sUGlZRzoge1xyXG4zOiBbJyNlOWEzYzknLCcjZjdmN2Y3JywnI2ExZDc2YSddLFxyXG40OiBbJyNkMDFjOGInLCcjZjFiNmRhJywnI2I4ZTE4NicsJyM0ZGFjMjYnXSxcclxuNTogWycjZDAxYzhiJywnI2YxYjZkYScsJyNmN2Y3ZjcnLCcjYjhlMTg2JywnIzRkYWMyNiddLFxyXG42OiBbJyNjNTFiN2QnLCcjZTlhM2M5JywnI2ZkZTBlZicsJyNlNmY1ZDAnLCcjYTFkNzZhJywnIzRkOTIyMSddLFxyXG43OiBbJyNjNTFiN2QnLCcjZTlhM2M5JywnI2ZkZTBlZicsJyNmN2Y3ZjcnLCcjZTZmNWQwJywnI2ExZDc2YScsJyM0ZDkyMjEnXSxcclxuODogWycjYzUxYjdkJywnI2RlNzdhZScsJyNmMWI2ZGEnLCcjZmRlMGVmJywnI2U2ZjVkMCcsJyNiOGUxODYnLCcjN2ZiYzQxJywnIzRkOTIyMSddLFxyXG45OiBbJyNjNTFiN2QnLCcjZGU3N2FlJywnI2YxYjZkYScsJyNmZGUwZWYnLCcjZjdmN2Y3JywnI2U2ZjVkMCcsJyNiOGUxODYnLCcjN2ZiYzQxJywnIzRkOTIyMSddLFxyXG4xMDogWycjOGUwMTUyJywnI2M1MWI3ZCcsJyNkZTc3YWUnLCcjZjFiNmRhJywnI2ZkZTBlZicsJyNlNmY1ZDAnLCcjYjhlMTg2JywnIzdmYmM0MScsJyM0ZDkyMjEnLCcjMjc2NDE5J10sXHJcbjExOiBbJyM4ZTAxNTInLCcjYzUxYjdkJywnI2RlNzdhZScsJyNmMWI2ZGEnLCcjZmRlMGVmJywnI2Y3ZjdmNycsJyNlNmY1ZDAnLCcjYjhlMTg2JywnIzdmYmM0MScsJyM0ZDkyMjEnLCcjMjc2NDE5J11cclxufSxSZEJ1OiB7XHJcbjM6IFsnI2VmOGE2MicsJyNmN2Y3ZjcnLCcjNjdhOWNmJ10sXHJcbjQ6IFsnI2NhMDAyMCcsJyNmNGE1ODInLCcjOTJjNWRlJywnIzA1NzFiMCddLFxyXG41OiBbJyNjYTAwMjAnLCcjZjRhNTgyJywnI2Y3ZjdmNycsJyM5MmM1ZGUnLCcjMDU3MWIwJ10sXHJcbjY6IFsnI2IyMTgyYicsJyNlZjhhNjInLCcjZmRkYmM3JywnI2QxZTVmMCcsJyM2N2E5Y2YnLCcjMjE2NmFjJ10sXHJcbjc6IFsnI2IyMTgyYicsJyNlZjhhNjInLCcjZmRkYmM3JywnI2Y3ZjdmNycsJyNkMWU1ZjAnLCcjNjdhOWNmJywnIzIxNjZhYyddLFxyXG44OiBbJyNiMjE4MmInLCcjZDY2MDRkJywnI2Y0YTU4MicsJyNmZGRiYzcnLCcjZDFlNWYwJywnIzkyYzVkZScsJyM0MzkzYzMnLCcjMjE2NmFjJ10sXHJcbjk6IFsnI2IyMTgyYicsJyNkNjYwNGQnLCcjZjRhNTgyJywnI2ZkZGJjNycsJyNmN2Y3ZjcnLCcjZDFlNWYwJywnIzkyYzVkZScsJyM0MzkzYzMnLCcjMjE2NmFjJ10sXHJcbjEwOiBbJyM2NzAwMWYnLCcjYjIxODJiJywnI2Q2NjA0ZCcsJyNmNGE1ODInLCcjZmRkYmM3JywnI2QxZTVmMCcsJyM5MmM1ZGUnLCcjNDM5M2MzJywnIzIxNjZhYycsJyMwNTMwNjEnXSxcclxuMTE6IFsnIzY3MDAxZicsJyNiMjE4MmInLCcjZDY2MDRkJywnI2Y0YTU4MicsJyNmZGRiYzcnLCcjZjdmN2Y3JywnI2QxZTVmMCcsJyM5MmM1ZGUnLCcjNDM5M2MzJywnIzIxNjZhYycsJyMwNTMwNjEnXVxyXG59LFJkR3k6IHtcclxuMzogWycjZWY4YTYyJywnI2ZmZmZmZicsJyM5OTk5OTknXSxcclxuNDogWycjY2EwMDIwJywnI2Y0YTU4MicsJyNiYWJhYmEnLCcjNDA0MDQwJ10sXHJcbjU6IFsnI2NhMDAyMCcsJyNmNGE1ODInLCcjZmZmZmZmJywnI2JhYmFiYScsJyM0MDQwNDAnXSxcclxuNjogWycjYjIxODJiJywnI2VmOGE2MicsJyNmZGRiYzcnLCcjZTBlMGUwJywnIzk5OTk5OScsJyM0ZDRkNGQnXSxcclxuNzogWycjYjIxODJiJywnI2VmOGE2MicsJyNmZGRiYzcnLCcjZmZmZmZmJywnI2UwZTBlMCcsJyM5OTk5OTknLCcjNGQ0ZDRkJ10sXHJcbjg6IFsnI2IyMTgyYicsJyNkNjYwNGQnLCcjZjRhNTgyJywnI2ZkZGJjNycsJyNlMGUwZTAnLCcjYmFiYWJhJywnIzg3ODc4NycsJyM0ZDRkNGQnXSxcclxuOTogWycjYjIxODJiJywnI2Q2NjA0ZCcsJyNmNGE1ODInLCcjZmRkYmM3JywnI2ZmZmZmZicsJyNlMGUwZTAnLCcjYmFiYWJhJywnIzg3ODc4NycsJyM0ZDRkNGQnXSxcclxuMTA6IFsnIzY3MDAxZicsJyNiMjE4MmInLCcjZDY2MDRkJywnI2Y0YTU4MicsJyNmZGRiYzcnLCcjZTBlMGUwJywnI2JhYmFiYScsJyM4Nzg3ODcnLCcjNGQ0ZDRkJywnIzFhMWExYSddLFxyXG4xMTogWycjNjcwMDFmJywnI2IyMTgyYicsJyNkNjYwNGQnLCcjZjRhNTgyJywnI2ZkZGJjNycsJyNmZmZmZmYnLCcjZTBlMGUwJywnI2JhYmFiYScsJyM4Nzg3ODcnLCcjNGQ0ZDRkJywnIzFhMWExYSddXHJcbn0sUmRZbEJ1OiB7XHJcbjM6IFsnI2ZjOGQ1OScsJyNmZmZmYmYnLCcjOTFiZmRiJ10sXHJcbjQ6IFsnI2Q3MTkxYycsJyNmZGFlNjEnLCcjYWJkOWU5JywnIzJjN2JiNiddLFxyXG41OiBbJyNkNzE5MWMnLCcjZmRhZTYxJywnI2ZmZmZiZicsJyNhYmQ5ZTknLCcjMmM3YmI2J10sXHJcbjY6IFsnI2Q3MzAyNycsJyNmYzhkNTknLCcjZmVlMDkwJywnI2UwZjNmOCcsJyM5MWJmZGInLCcjNDU3NWI0J10sXHJcbjc6IFsnI2Q3MzAyNycsJyNmYzhkNTknLCcjZmVlMDkwJywnI2ZmZmZiZicsJyNlMGYzZjgnLCcjOTFiZmRiJywnIzQ1NzViNCddLFxyXG44OiBbJyNkNzMwMjcnLCcjZjQ2ZDQzJywnI2ZkYWU2MScsJyNmZWUwOTAnLCcjZTBmM2Y4JywnI2FiZDllOScsJyM3NGFkZDEnLCcjNDU3NWI0J10sXHJcbjk6IFsnI2Q3MzAyNycsJyNmNDZkNDMnLCcjZmRhZTYxJywnI2ZlZTA5MCcsJyNmZmZmYmYnLCcjZTBmM2Y4JywnI2FiZDllOScsJyM3NGFkZDEnLCcjNDU3NWI0J10sXHJcbjEwOiBbJyNhNTAwMjYnLCcjZDczMDI3JywnI2Y0NmQ0MycsJyNmZGFlNjEnLCcjZmVlMDkwJywnI2UwZjNmOCcsJyNhYmQ5ZTknLCcjNzRhZGQxJywnIzQ1NzViNCcsJyMzMTM2OTUnXSxcclxuMTE6IFsnI2E1MDAyNicsJyNkNzMwMjcnLCcjZjQ2ZDQzJywnI2ZkYWU2MScsJyNmZWUwOTAnLCcjZmZmZmJmJywnI2UwZjNmOCcsJyNhYmQ5ZTknLCcjNzRhZGQxJywnIzQ1NzViNCcsJyMzMTM2OTUnXVxyXG59LFNwZWN0cmFsOiB7XHJcbjM6IFsnI2ZjOGQ1OScsJyNmZmZmYmYnLCcjOTlkNTk0J10sXHJcbjQ6IFsnI2Q3MTkxYycsJyNmZGFlNjEnLCcjYWJkZGE0JywnIzJiODNiYSddLFxyXG41OiBbJyNkNzE5MWMnLCcjZmRhZTYxJywnI2ZmZmZiZicsJyNhYmRkYTQnLCcjMmI4M2JhJ10sXHJcbjY6IFsnI2Q1M2U0ZicsJyNmYzhkNTknLCcjZmVlMDhiJywnI2U2ZjU5OCcsJyM5OWQ1OTQnLCcjMzI4OGJkJ10sXHJcbjc6IFsnI2Q1M2U0ZicsJyNmYzhkNTknLCcjZmVlMDhiJywnI2ZmZmZiZicsJyNlNmY1OTgnLCcjOTlkNTk0JywnIzMyODhiZCddLFxyXG44OiBbJyNkNTNlNGYnLCcjZjQ2ZDQzJywnI2ZkYWU2MScsJyNmZWUwOGInLCcjZTZmNTk4JywnI2FiZGRhNCcsJyM2NmMyYTUnLCcjMzI4OGJkJ10sXHJcbjk6IFsnI2Q1M2U0ZicsJyNmNDZkNDMnLCcjZmRhZTYxJywnI2ZlZTA4YicsJyNmZmZmYmYnLCcjZTZmNTk4JywnI2FiZGRhNCcsJyM2NmMyYTUnLCcjMzI4OGJkJ10sXHJcbjEwOiBbJyM5ZTAxNDInLCcjZDUzZTRmJywnI2Y0NmQ0MycsJyNmZGFlNjEnLCcjZmVlMDhiJywnI2U2ZjU5OCcsJyNhYmRkYTQnLCcjNjZjMmE1JywnIzMyODhiZCcsJyM1ZTRmYTInXSxcclxuMTE6IFsnIzllMDE0MicsJyNkNTNlNGYnLCcjZjQ2ZDQzJywnI2ZkYWU2MScsJyNmZWUwOGInLCcjZmZmZmJmJywnI2U2ZjU5OCcsJyNhYmRkYTQnLCcjNjZjMmE1JywnIzMyODhiZCcsJyM1ZTRmYTInXVxyXG59LFJkWWxHbjoge1xyXG4zOiBbJyNmYzhkNTknLCcjZmZmZmJmJywnIzkxY2Y2MCddLFxyXG40OiBbJyNkNzE5MWMnLCcjZmRhZTYxJywnI2E2ZDk2YScsJyMxYTk2NDEnXSxcclxuNTogWycjZDcxOTFjJywnI2ZkYWU2MScsJyNmZmZmYmYnLCcjYTZkOTZhJywnIzFhOTY0MSddLFxyXG42OiBbJyNkNzMwMjcnLCcjZmM4ZDU5JywnI2ZlZTA4YicsJyNkOWVmOGInLCcjOTFjZjYwJywnIzFhOTg1MCddLFxyXG43OiBbJyNkNzMwMjcnLCcjZmM4ZDU5JywnI2ZlZTA4YicsJyNmZmZmYmYnLCcjZDllZjhiJywnIzkxY2Y2MCcsJyMxYTk4NTAnXSxcclxuODogWycjZDczMDI3JywnI2Y0NmQ0MycsJyNmZGFlNjEnLCcjZmVlMDhiJywnI2Q5ZWY4YicsJyNhNmQ5NmEnLCcjNjZiZDYzJywnIzFhOTg1MCddLFxyXG45OiBbJyNkNzMwMjcnLCcjZjQ2ZDQzJywnI2ZkYWU2MScsJyNmZWUwOGInLCcjZmZmZmJmJywnI2Q5ZWY4YicsJyNhNmQ5NmEnLCcjNjZiZDYzJywnIzFhOTg1MCddLFxyXG4xMDogWycjYTUwMDI2JywnI2Q3MzAyNycsJyNmNDZkNDMnLCcjZmRhZTYxJywnI2ZlZTA4YicsJyNkOWVmOGInLCcjYTZkOTZhJywnIzY2YmQ2MycsJyMxYTk4NTAnLCcjMDA2ODM3J10sXHJcbjExOiBbJyNhNTAwMjYnLCcjZDczMDI3JywnI2Y0NmQ0MycsJyNmZGFlNjEnLCcjZmVlMDhiJywnI2ZmZmZiZicsJyNkOWVmOGInLCcjYTZkOTZhJywnIzY2YmQ2MycsJyMxYTk4NTAnLCcjMDA2ODM3J11cclxufSxBY2NlbnQ6IHtcclxuMzogWycjN2ZjOTdmJywnI2JlYWVkNCcsJyNmZGMwODYnXSxcclxuNDogWycjN2ZjOTdmJywnI2JlYWVkNCcsJyNmZGMwODYnLCcjZmZmZjk5J10sXHJcbjU6IFsnIzdmYzk3ZicsJyNiZWFlZDQnLCcjZmRjMDg2JywnI2ZmZmY5OScsJyMzODZjYjAnXSxcclxuNjogWycjN2ZjOTdmJywnI2JlYWVkNCcsJyNmZGMwODYnLCcjZmZmZjk5JywnIzM4NmNiMCcsJyNmMDAyN2YnXSxcclxuNzogWycjN2ZjOTdmJywnI2JlYWVkNCcsJyNmZGMwODYnLCcjZmZmZjk5JywnIzM4NmNiMCcsJyNmMDAyN2YnLCcjYmY1YjE3J10sXHJcbjg6IFsnIzdmYzk3ZicsJyNiZWFlZDQnLCcjZmRjMDg2JywnI2ZmZmY5OScsJyMzODZjYjAnLCcjZjAwMjdmJywnI2JmNWIxNycsJyM2NjY2NjYnXVxyXG59LERhcmsyOiB7XHJcbjM6IFsnIzFiOWU3NycsJyNkOTVmMDInLCcjNzU3MGIzJ10sXHJcbjQ6IFsnIzFiOWU3NycsJyNkOTVmMDInLCcjNzU3MGIzJywnI2U3Mjk4YSddLFxyXG41OiBbJyMxYjllNzcnLCcjZDk1ZjAyJywnIzc1NzBiMycsJyNlNzI5OGEnLCcjNjZhNjFlJ10sXHJcbjY6IFsnIzFiOWU3NycsJyNkOTVmMDInLCcjNzU3MGIzJywnI2U3Mjk4YScsJyM2NmE2MWUnLCcjZTZhYjAyJ10sXHJcbjc6IFsnIzFiOWU3NycsJyNkOTVmMDInLCcjNzU3MGIzJywnI2U3Mjk4YScsJyM2NmE2MWUnLCcjZTZhYjAyJywnI2E2NzYxZCddLFxyXG44OiBbJyMxYjllNzcnLCcjZDk1ZjAyJywnIzc1NzBiMycsJyNlNzI5OGEnLCcjNjZhNjFlJywnI2U2YWIwMicsJyNhNjc2MWQnLCcjNjY2NjY2J11cclxufSxQYWlyZWQ6IHtcclxuMzogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnXSxcclxuNDogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJ10sXHJcbjU6IFsnI2E2Y2VlMycsJyMxZjc4YjQnLCcjYjJkZjhhJywnIzMzYTAyYycsJyNmYjlhOTknXSxcclxuNjogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJywnI2ZiOWE5OScsJyNlMzFhMWMnXSxcclxuNzogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJywnI2ZiOWE5OScsJyNlMzFhMWMnLCcjZmRiZjZmJ10sXHJcbjg6IFsnI2E2Y2VlMycsJyMxZjc4YjQnLCcjYjJkZjhhJywnIzMzYTAyYycsJyNmYjlhOTknLCcjZTMxYTFjJywnI2ZkYmY2ZicsJyNmZjdmMDAnXSxcclxuOTogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJywnI2ZiOWE5OScsJyNlMzFhMWMnLCcjZmRiZjZmJywnI2ZmN2YwMCcsJyNjYWIyZDYnXSxcclxuMTA6IFsnI2E2Y2VlMycsJyMxZjc4YjQnLCcjYjJkZjhhJywnIzMzYTAyYycsJyNmYjlhOTknLCcjZTMxYTFjJywnI2ZkYmY2ZicsJyNmZjdmMDAnLCcjY2FiMmQ2JywnIzZhM2Q5YSddLFxyXG4xMTogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJywnI2ZiOWE5OScsJyNlMzFhMWMnLCcjZmRiZjZmJywnI2ZmN2YwMCcsJyNjYWIyZDYnLCcjNmEzZDlhJywnI2ZmZmY5OSddLFxyXG4xMjogWycjYTZjZWUzJywnIzFmNzhiNCcsJyNiMmRmOGEnLCcjMzNhMDJjJywnI2ZiOWE5OScsJyNlMzFhMWMnLCcjZmRiZjZmJywnI2ZmN2YwMCcsJyNjYWIyZDYnLCcjNmEzZDlhJywnI2ZmZmY5OScsJyNiMTU5MjgnXVxyXG59LFBhc3RlbDE6IHtcclxuMzogWycjZmJiNGFlJywnI2IzY2RlMycsJyNjY2ViYzUnXSxcclxuNDogWycjZmJiNGFlJywnI2IzY2RlMycsJyNjY2ViYzUnLCcjZGVjYmU0J10sXHJcbjU6IFsnI2ZiYjRhZScsJyNiM2NkZTMnLCcjY2NlYmM1JywnI2RlY2JlNCcsJyNmZWQ5YTYnXSxcclxuNjogWycjZmJiNGFlJywnI2IzY2RlMycsJyNjY2ViYzUnLCcjZGVjYmU0JywnI2ZlZDlhNicsJyNmZmZmY2MnXSxcclxuNzogWycjZmJiNGFlJywnI2IzY2RlMycsJyNjY2ViYzUnLCcjZGVjYmU0JywnI2ZlZDlhNicsJyNmZmZmY2MnLCcjZTVkOGJkJ10sXHJcbjg6IFsnI2ZiYjRhZScsJyNiM2NkZTMnLCcjY2NlYmM1JywnI2RlY2JlNCcsJyNmZWQ5YTYnLCcjZmZmZmNjJywnI2U1ZDhiZCcsJyNmZGRhZWMnXSxcclxuOTogWycjZmJiNGFlJywnI2IzY2RlMycsJyNjY2ViYzUnLCcjZGVjYmU0JywnI2ZlZDlhNicsJyNmZmZmY2MnLCcjZTVkOGJkJywnI2ZkZGFlYycsJyNmMmYyZjInXVxyXG59LFBhc3RlbDI6IHtcclxuMzogWycjYjNlMmNkJywnI2ZkY2RhYycsJyNjYmQ1ZTgnXSxcclxuNDogWycjYjNlMmNkJywnI2ZkY2RhYycsJyNjYmQ1ZTgnLCcjZjRjYWU0J10sXHJcbjU6IFsnI2IzZTJjZCcsJyNmZGNkYWMnLCcjY2JkNWU4JywnI2Y0Y2FlNCcsJyNlNmY1YzknXSxcclxuNjogWycjYjNlMmNkJywnI2ZkY2RhYycsJyNjYmQ1ZTgnLCcjZjRjYWU0JywnI2U2ZjVjOScsJyNmZmYyYWUnXSxcclxuNzogWycjYjNlMmNkJywnI2ZkY2RhYycsJyNjYmQ1ZTgnLCcjZjRjYWU0JywnI2U2ZjVjOScsJyNmZmYyYWUnLCcjZjFlMmNjJ10sXHJcbjg6IFsnI2IzZTJjZCcsJyNmZGNkYWMnLCcjY2JkNWU4JywnI2Y0Y2FlNCcsJyNlNmY1YzknLCcjZmZmMmFlJywnI2YxZTJjYycsJyNjY2NjY2MnXVxyXG59LFNldDE6IHtcclxuMzogWycjZTQxYTFjJywnIzM3N2ViOCcsJyM0ZGFmNGEnXSxcclxuNDogWycjZTQxYTFjJywnIzM3N2ViOCcsJyM0ZGFmNGEnLCcjOTg0ZWEzJ10sXHJcbjU6IFsnI2U0MWExYycsJyMzNzdlYjgnLCcjNGRhZjRhJywnIzk4NGVhMycsJyNmZjdmMDAnXSxcclxuNjogWycjZTQxYTFjJywnIzM3N2ViOCcsJyM0ZGFmNGEnLCcjOTg0ZWEzJywnI2ZmN2YwMCcsJyNmZmZmMzMnXSxcclxuNzogWycjZTQxYTFjJywnIzM3N2ViOCcsJyM0ZGFmNGEnLCcjOTg0ZWEzJywnI2ZmN2YwMCcsJyNmZmZmMzMnLCcjYTY1NjI4J10sXHJcbjg6IFsnI2U0MWExYycsJyMzNzdlYjgnLCcjNGRhZjRhJywnIzk4NGVhMycsJyNmZjdmMDAnLCcjZmZmZjMzJywnI2E2NTYyOCcsJyNmNzgxYmYnXSxcclxuOTogWycjZTQxYTFjJywnIzM3N2ViOCcsJyM0ZGFmNGEnLCcjOTg0ZWEzJywnI2ZmN2YwMCcsJyNmZmZmMzMnLCcjYTY1NjI4JywnI2Y3ODFiZicsJyM5OTk5OTknXVxyXG59LFNldDI6IHtcclxuMzogWycjNjZjMmE1JywnI2ZjOGQ2MicsJyM4ZGEwY2InXSxcclxuNDogWycjNjZjMmE1JywnI2ZjOGQ2MicsJyM4ZGEwY2InLCcjZTc4YWMzJ10sXHJcbjU6IFsnIzY2YzJhNScsJyNmYzhkNjInLCcjOGRhMGNiJywnI2U3OGFjMycsJyNhNmQ4NTQnXSxcclxuNjogWycjNjZjMmE1JywnI2ZjOGQ2MicsJyM4ZGEwY2InLCcjZTc4YWMzJywnI2E2ZDg1NCcsJyNmZmQ5MmYnXSxcclxuNzogWycjNjZjMmE1JywnI2ZjOGQ2MicsJyM4ZGEwY2InLCcjZTc4YWMzJywnI2E2ZDg1NCcsJyNmZmQ5MmYnLCcjZTVjNDk0J10sXHJcbjg6IFsnIzY2YzJhNScsJyNmYzhkNjInLCcjOGRhMGNiJywnI2U3OGFjMycsJyNhNmQ4NTQnLCcjZmZkOTJmJywnI2U1YzQ5NCcsJyNiM2IzYjMnXVxyXG59LFNldDM6IHtcclxuMzogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnXSxcclxuNDogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJ10sXHJcbjU6IFsnIzhkZDNjNycsJyNmZmZmYjMnLCcjYmViYWRhJywnI2ZiODA3MicsJyM4MGIxZDMnXSxcclxuNjogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJywnIzgwYjFkMycsJyNmZGI0NjInXSxcclxuNzogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJywnIzgwYjFkMycsJyNmZGI0NjInLCcjYjNkZTY5J10sXHJcbjg6IFsnIzhkZDNjNycsJyNmZmZmYjMnLCcjYmViYWRhJywnI2ZiODA3MicsJyM4MGIxZDMnLCcjZmRiNDYyJywnI2IzZGU2OScsJyNmY2NkZTUnXSxcclxuOTogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJywnIzgwYjFkMycsJyNmZGI0NjInLCcjYjNkZTY5JywnI2ZjY2RlNScsJyNkOWQ5ZDknXSxcclxuMTA6IFsnIzhkZDNjNycsJyNmZmZmYjMnLCcjYmViYWRhJywnI2ZiODA3MicsJyM4MGIxZDMnLCcjZmRiNDYyJywnI2IzZGU2OScsJyNmY2NkZTUnLCcjZDlkOWQ5JywnI2JjODBiZCddLFxyXG4xMTogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJywnIzgwYjFkMycsJyNmZGI0NjInLCcjYjNkZTY5JywnI2ZjY2RlNScsJyNkOWQ5ZDknLCcjYmM4MGJkJywnI2NjZWJjNSddLFxyXG4xMjogWycjOGRkM2M3JywnI2ZmZmZiMycsJyNiZWJhZGEnLCcjZmI4MDcyJywnIzgwYjFkMycsJyNmZGI0NjInLCcjYjNkZTY5JywnI2ZjY2RlNScsJyNkOWQ5ZDknLCcjYmM4MGJkJywnI2NjZWJjNScsJyNmZmVkNmYnXVxyXG59fTsiLCIvLyBGb3IgSUU5K1xyXG4oZnVuY3Rpb24gKCkge1xyXG4gIGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICggZXZlbnQsIHBhcmFtcyApIHtcclxuICAgIHBhcmFtcyA9IHBhcmFtcyB8fCB7IGJ1YmJsZXM6IGZhbHNlLCBjYW5jZWxhYmxlOiBmYWxzZSwgZGV0YWlsOiB1bmRlZmluZWQgfTtcclxuICAgIHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xyXG4gICAgZXZ0LmluaXRDdXN0b21FdmVudCggZXZlbnQsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCApO1xyXG4gICAgcmV0dXJuIGV2dDtcclxuICAgfVxyXG5cclxuICBDdXN0b21FdmVudC5wcm90b3R5cGUgPSB3aW5kb3cuRXZlbnQucHJvdG90eXBlO1xyXG5cclxuICB3aW5kb3cuQ3VzdG9tRXZlbnQgPSBDdXN0b21FdmVudDtcclxufSkoKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGludGVycG9sYXRvcihwb2ludHMpe1xyXG4gIHZhciBwb2ludCwgXHJcbiAgICBhY3Rpb24gPSAnJywgXHJcbiAgICBsaW5lQnVpbGRlciA9IFtdO1xyXG5cclxuICBmb3IodmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aCAtIDE7IGkrKyl7XHJcbiAgICBwb2ludCA9IHBvaW50c1tpXTtcclxuXHJcbiAgICBpZihpc05hTihwb2ludFsxXSkpe1xyXG4gICAgICBpZihhY3Rpb24gIT09ICcnKSBhY3Rpb24gPSAnTSc7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBsaW5lQnVpbGRlci5wdXNoKGFjdGlvbiwgcG9pbnQpO1xyXG4gICAgICBhY3Rpb24gPSAnTCc7XHJcbiAgICB9XHJcbiAgfVxyXG4gIFxyXG4gIHBvaW50ID0gcG9pbnRzW3BvaW50cy5sZW5ndGggLSAxXTtcclxuICBpZighaXNOYU4ocG9pbnRbMV0pKXtcclxuICAgIGxpbmVCdWlsZGVyLnB1c2goYWN0aW9uLCBwb2ludCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbGluZUJ1aWxkZXIuam9pbignJyk7XHJcbn07Il19
(1)
});
