# Parallel Coordinates Chart

[Parallel coordinates](http://en.wikipedia.org/wiki/Parallel_coordinates) are useful for
visualizing multivariate data. This is a tool written using d3 to enable you to create 
parallel coordinates charts that look similar to this:

<img src="https://github.com/oztu/parallel-coordinates-chart/blob/master/example/screenshot.png"/>

## Example
```html
<script src="http://d3js.org/d3.v3.min.js" charset="utf-8"></script>
<link type="text/css" rel="stylesheet" href="parallel-coordinates-chart.css" />
<script src="parallel-coordinates-chart.js"></script>
<script>
// Create chart draw function
var chart = parallelCoordinatesChart()
	.width(window.innerWidth)
	.height(window.innerHeight);

// Draw the chart after loading external data
d3.csv('data.csv', function(err, data){
  d3.select(document.body).datum(data).call(chart);
});
</script>
```

## API and Usage
```javascript

// Create chart draw function
var chart = parallelCoordinatesChart();

// or do it with config options...
var chart = parallelCoordinatesChart({
	// width of chart in pixels
	width: 1560, 
	
	// height of chart in pixels
	height: 500, 
	
	// left, top, right, bottom margin in pixels
	margin: [30, 10, 10, 10], 
	
	// the subset of dimensions from the data to show
	select: ['Dim1', 'Dim2', 'Dim 3'], 
	
	// the dimension to initially highlight, this is what happens when
	// users click on a dimension name
	highlight: 'Dim1', 
	
	// the domain function recieves (dimension, data) and it should
	// return a two element array representing the min and max of
	// the given dimension's domain
	domain: domainFunc,

	// color generator which recieves (dimension, data) and it should
	// return a d3 scale which can be used for coloring the lines according
	// the the highlighted dimension
	color: colorFunc
});

// or do it by chaining
chart.width(1500)
	.height(500)
	.margin([30, 10, 10, 10])
	.select(['Dim1', 'Dim2', 'Dim 3'])
	.highlight('Dim1')
	.domain(domainFunc)
	.color(colorFunc)

// then draw the draw, in this case, both document.body and data
// should be inputs provided by you. The first is the root of the chart
// the second is the array containing the objects which will be used
// to generate the chart
d3.select(document.body).datum(data).call(chart);
// or
chart.draw(d3.select(document.body).datum(data));

// if you modify anything and want to draw the chart again, you can do so
// by calling redraw, which just throws away the old graph and draws a new
// one
chart.redraw(d3.select(document.body));
// or
d3.select(document.body).call(chart.redraw);
```

## Credits

This is largely based off of [Jason Davies's example](http://bl.ocks.org/jasondavies/1341281).