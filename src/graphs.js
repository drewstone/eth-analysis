import Promise from 'bluebird';
import D3Node from 'd3-node';
import * as d3 from 'd3';
import * as p from 'p-iteration';
import output from './output';

const STATISTICS_COLLECTION = 'STATS';

var promiseFor = Promise.method(function(condition, action, value) {
    if (!condition(value)) return value;
    return action(value).then(promiseFor.bind(null, condition, action));
});

export default function(db) {
  return {
    getTxAmountHistogram: async () => {
      const tokens = ['OMGToken', 'ZRXToken', 'BATToken', 'REPToken'];
      const count = await db.collection(STATISTICS_COLLECTION)
                            .find()
                            .count();
      
      let query = {};
      let txBlocks = {};
      let txAmounts = {};

      let min = Infinity;
      let max = 0

      await db.collection(STATISTICS_COLLECTION)
      .find()
      .forEach(doc => {
        tokens.forEach(token => {
          if (Number(doc.data[token].totalTransferAmount) > max) {
            max = Number(doc.data[token].totalTransferAmount);
          }

          if (Number(doc.data[token].totalTransferAmount) < min) {
            min = Number(doc.data[token].totalTransferAmount);
          }

          if (txAmounts[token]) {
            if (Number(doc.data[token].totalTransferAmount) > 0) {
              txBlocks[token].push(doc.blockNumber);
              txAmounts[token].push(Number(doc.data[token].totalTransferAmount))
            }
          } else {
            if (Number(doc.data[token].totalTransferAmount) > 0) {
              txBlocks[token] = [ doc.blockNumber ];
              txAmounts[token] = [ Number(doc.data[token].totalTransferAmount) ]
            }
            
          }
        });
      });

      console.log('done', min, max);

      const styles = `
      .bar rect {
        fill: steelblue;
      }
      .bar text {
        fill: #fff;
        font: 10px sans-serif;
      }`;

      var options = {
        styles: styles,
        d3Module: d3
      };

      var d3n = new D3Node(options);
      var formatCount = d3.format(",.0f");

      var margin = {top: 10, right: 30, bottom: 30, left: 30},
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;

      var x = d3.scaleLinear()
        .domain([0, max])
        .rangeRound([0, width]);

      tokens.forEach(token => {
        var bins = d3.histogram()
          .domain(x.domain())
          .thresholds(x.ticks(100))
        (txAmounts[token]);

        var y = d3.scaleLinear()
          .domain([0, d3.max(bins, function(d) { return d.length; })])
          .range([height, 0]);

        const svgWidth = width + margin.left + margin.right
        const svgHeight = height + margin.top + margin.bottom

        var svg = d3n.createSVG(svgWidth, svgHeight)
          .append("g")
          .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var bar = svg.selectAll(".bar")
          .data(bins)
          .enter().append("g")
          .attr("class", "bar")
          .attr("transform", function(d) { return "translate(" + x(d.x0) + "," + y(d.length) + ")"; });

        bar.append("rect")
          .attr("x", 1)
          .attr("width", x(bins[0].x1) - x(bins[0].x0) - 1)
          .attr("height", function(d) { return height - y(d.length); });

        bar.append("text")
          .attr("dy", ".75em")
          .attr("y", 6)
          .attr("x", (x(bins[0].x1) - x(bins[0].x0)) / 2)
          .attr("text-anchor", "middle")
          .text(function(d) { return formatCount(d.length); });

        svg.append("g")
          .attr("class", "axis axis--x")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(x));

        output(`histogram-${token}`, d3n);
      })
    }
  }
}