import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const numberFormat = d3.format(',');
const decimalFormat = d3.format('.1f');
const percentageFormat = d3.format('.1~%');
const tooltip = d3.select('#commit-tooltip');
let tooltipHideTimeout;
let commits = [];
let filteredCommits = [];
let commitProgress = 100;
let commitMaxTime;
let timeScale;
let svg;
let xScale;
let yScale;
let rScale;
let brush;
let brushGroup;
let dots;
let currentCommits = [];
let allLines = [];
let lineColorScale;
let scroller;

tooltip
  .on('mouseenter', () => window.clearTimeout(tooltipHideTimeout))
  .on('mouseleave', () => updateTooltipVisibility(false));

function convertRow(row) {
  const converted = {
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T12:00:00Z`),
    datetime: new Date(row.datetime),
  };

  if (
    !Number.isFinite(converted.line) ||
    !Number.isFinite(converted.depth) ||
    !Number.isFinite(converted.length) ||
    Number.isNaN(converted.date.valueOf()) ||
    Number.isNaN(converted.datetime.valueOf())
  ) {
    throw new Error(`Invalid LOC record for ${row.file ?? 'an unknown file'}.`);
  }

  return converted;
}

function processCommits(data) {
  return d3.groups(data, (line) => line.commit)
    .map(([id, lines]) => {
      const firstLine = lines[0];
      const hourParts = firstLine.time.split(':').map(Number);
      const [hour = 0, minute = 0, second = 0] = hourParts;
      const commit = {
        id,
        url: `https://github.com/TG2oo6/portfolio/commit/${id}`,
        author: firstLine.author,
        date: firstLine.date,
        time: firstLine.time,
        timezone: firstLine.timezone,
        datetime: firstLine.datetime,
        hourFrac: hour + minute / 60 + second / 3600,
        totalLines: lines.length,
      };

      Object.defineProperty(commit, 'lines', {
        value: lines,
        enumerable: false,
      });

      return commit;
    })
    .sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function linesOf(commitList) {
  return commitList.flatMap((commit) => commit.lines);
}

function renderCommitInfo(data, commits) {
  const fileLengths = d3.rollups(
    data,
    (lines) => lines.length,
    (line) => line.file,
  );
  const weekdayCounts = d3.rollups(
    commits,
    (weekdayCommits) => weekdayCommits.length,
    (commit) => commit.date.getUTCDay(),
  );
  const mostActiveWeekday = d3.greatest(
    weekdayCounts,
    ([, count]) => count,
  );
  const weekdayName = mostActiveWeekday
    ? new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      timeZone: 'UTC',
      }).format(
      new Date(Date.UTC(2023, 0, 1 + mostActiveWeekday[0])),
      )
    : '—';

  const stats = [
    ['Lines of code analyzed', numberFormat(data.length)],
    ['Total commits', numberFormat(commits.length)],
    ['Files analyzed', numberFormat(d3.group(data, (line) => line.file).size)],
    [
      'Average line length',
      data.length ? `${decimalFormat(d3.mean(data, (line) => line.length))} characters` : '—',
    ],
    ['Maximum nesting depth', numberFormat(d3.max(data, (line) => line.depth) ?? 0)],
    [
      'Average file length',
      fileLengths.length
        ? `${decimalFormat(d3.mean(fileLengths, ([, lines]) => lines))} lines`
        : '—',
    ],
    ['Most active weekday', weekdayName],
  ];
  const container = d3.select('#commit-stats');

  const items = container.selectAll('div')
    .data(stats)
    .join(
      (enter) => {
        const div = enter.append('div');
        div.append('dt');
        div.append('dd');
        return div;
      },
      (update) => update,
      (exit) => exit.remove(),
    );

  items.select('dt').text(([label]) => label);
  items.select('dd').text(([, value]) => value);
}

function renderTooltipContent(commit) {
  tooltip.selectAll('*').remove();

  const fields = [
    ['Commit', commit.id],
    ['Date', d3.utcFormat('%B %-d, %Y')(commit.date)],
    ['Time', `${commit.time} ${commit.timezone}`],
    ['Author', commit.author],
    ['Lines edited', numberFormat(commit.totalLines)],
  ];

  for (const [label, value] of fields) {
    tooltip.append('dt').text(label);
    const description = tooltip.append('dd');
    if (label === 'Commit') {
      description.append('a')
        .attr('href', commit.url)
        .attr('target', '_blank')
        .attr('rel', 'noopener noreferrer')
        .text(value);
    } else {
      description.text(value);
    }
  }
}

function updateTooltipVisibility(isVisible) {
  const node = tooltip.node();
  node.setAttribute('aria-hidden', String(!isVisible));
  node.style.visibility = isVisible ? 'visible' : 'hidden';
}

function updateTooltipPosition(event) {
  const node = tooltip.node();
  const edgePadding = 8;
  const pointerOffset = 14;
  const x = event.clientX + pointerOffset;
  const y = event.clientY + pointerOffset;

  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  const bounds = node.getBoundingClientRect();
  node.style.left = `${Math.max(edgePadding, Math.min(x, innerWidth - bounds.width - edgePadding))}px`;
  node.style.top = `${Math.max(edgePadding, Math.min(y, innerHeight - bounds.height - edgePadding))}px`;
}

function renderLanguageBreakdown(selection) {
  const container = d3.select('#language-breakdown');
  container.selectAll('*').remove();
  if (selection.length === 0) return;

  const lines = selection.flatMap((commit) => commit.lines);
  const languages = d3.rollup(
    lines,
    (languageLines) => languageLines.length,
    (line) => line.type,
  );
  const totalLines = lines.length;
  const breakdown = [...languages].sort((a, b) => d3.descending(a[1], b[1]));

  container.selectAll('div')
    .data(breakdown)
    .join('div')
    .each(function ([language, lineCount]) {
      const item = d3.select(this);
      item.append('dt').text(language.toUpperCase());
      item.append('dd').text(
        `${numberFormat(lineCount)} lines (${percentageFormat(lineCount / totalLines)})`,
      );
    });
}

function dateDomain(commitList) {
  let [start, end] = d3.extent(commitList, (commit) => commit.datetime);
  if (!start || !end) {
    [start, end] = d3.extent(commits, (commit) => commit.datetime);
  }
  if (!start || !end) {
    return [new Date(0), new Date(1)];
  }
  if (+start === +end) {
    const halfDay = 12 * 60 * 60 * 1000;
    start = new Date(+start - halfDay);
    end = new Date(+end + halfDay);
  }
  return [start, end];
}

function initScatterPlot(allCommits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 28, right: 34, bottom: 76, left: 76 };
  const maxRadius = 24;
  const area = {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: height - margin.bottom,
  };
  const innerWidth = area.right - area.left;
  xScale = d3.scaleTime()
    .domain(dateDomain(allCommits))
    .nice()
    .range([area.left + maxRadius, area.right - maxRadius]);
  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([area.bottom - maxRadius, area.top + maxRadius]);
  rScale = d3.scaleSqrt()
    .domain(d3.extent(allCommits, (commit) => commit.totalLines))
    .range([3, maxRadius]);

  const chart = d3.select('#chart');
  chart.selectAll('*').remove();
  svg = chart.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-labelledby', 'chart-heading chart-description');
  svg.append('desc')
    .attr('id', 'chart-description')
    .text(`Each circle represents a commit. Its horizontal position is the date, vertical position is the time of day, and area represents lines edited. The chart includes ${numberFormat(allCommits.length)} commits based on ${numberFormat(linesOf(allCommits).length)} line records.`);

  const plot = svg.append('g').attr('class', 'meta-plot');
  plot.append('g')
    .attr('class', 'meta-grid')
    .attr('transform', `translate(${area.left},0)`)
    .call(
      d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat(() => ''),
    )
    .call((grid) => grid.select('.domain').remove());

  plot.append('g')
    .attr('class', 'meta-y-axis')
    .attr('transform', `translate(${area.left},0)`)
    .call(
      d3.axisLeft(yScale)
        .ticks(8)
        .tickFormat((hour) => `${String(Math.floor(hour)).padStart(2, '0')}:00`),
    );
  plot.append('g')
    .attr('class', 'meta-x-axis')
    .attr('transform', `translate(0,${area.bottom})`)
    .call(
      d3.axisBottom(xScale)
        .ticks(Math.max(3, Math.floor(innerWidth / 115)))
        .tickFormat(d3.timeFormat('%b %d')),
    );

  plot.append('text')
    .attr('class', 'meta-axis-label')
    .attr('x', (area.left + area.right) / 2)
    .attr('y', height - 19)
    .attr('text-anchor', 'middle')
    .text('Commit date');
  plot.append('text')
    .attr('class', 'meta-axis-label')
    .attr('transform', `translate(20,${(area.top + area.bottom) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text('Local time of day');

  brushGroup = plot.append('g').attr('class', 'meta-brush');
  dots = plot.append('g').attr('class', 'meta-dots');
  brush = d3.brush()
    .extent([
      [area.left, area.top],
      [area.right, area.bottom],
    ])
    .on('brush end', brushed);
  brushGroup.call(brush);
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function brushed(event) {
  const selectedCommits = event.selection
    ? currentCommits.filter((commit) => isCommitSelected(event.selection, commit))
    : [];
  const selectedIds = new Set(selectedCommits.map((commit) => commit.id));

  dots.selectAll('circle').classed('selected', (commit) => selectedIds.has(commit.id));
  d3.select('#selection-count').text(
    selectedCommits.length === 0
      ? 'No commits selected'
      : `${numberFormat(selectedCommits.length)} ${selectedCommits.length === 1 ? 'commit' : 'commits'} selected`,
  );
  renderLanguageBreakdown(selectedCommits);
}

function showTooltip(event, commit) {
  window.clearTimeout(tooltipHideTimeout);
  renderTooltipContent(commit);
  updateTooltipVisibility(true);
  updateTooltipPosition(event);
}

function updateScatterPlot(commitList) {
  currentCommits = commitList;
  brushGroup.call(brush.move, null);
  xScale.domain(dateDomain(commitList)).nice();
  svg.select('.meta-x-axis')
    .transition()
    .duration(180)
    .call(
      d3.axisBottom(xScale)
        .ticks(Math.max(3, Math.floor(892 / 115)))
        .tickFormat(d3.timeFormat('%b %d')),
    );

  const orderedCommits = [...commitList].sort(
    (a, b) => d3.descending(a.totalLines, b.totalLines),
  );
  const circles = dots.selectAll('circle')
    .data(orderedCommits, (commit) => commit.id)
    .join(
      (enter) => enter.append('circle').attr('class', 'meta-dot'),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('cx', (commit) => xScale(commit.datetime))
    .attr('cy', (commit) => yScale(commit.hourFrac))
    .style('--r', (commit) => rScale(commit.totalLines))
    .attr('r', (commit) => rScale(commit.totalLines))
    .attr('tabindex', 0)
    .attr('aria-label', (commit) =>
      `${commit.author}, ${d3.utcFormat('%B %-d, %Y')(commit.date)} at ${commit.time}, ${commit.totalLines} lines edited`,
    );

  svg.select('#chart-description')
    .text(`Each circle represents a commit. Its horizontal position is the date, vertical position is the time of day, and area represents lines edited. The chart includes ${numberFormat(commitList.length)} commits based on ${numberFormat(linesOf(commitList).length)} line records.`);

  circles
    .on('mouseenter', function (event, commit) {
      d3.select(this)
        .raise()
        .interrupt()
        .transition()
        .duration(140)
        .attr('r', Math.min(28, rScale(commit.totalLines) * 1.35));
      showTooltip(event, commit);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', function (_event, commit) {
      d3.select(this)
        .interrupt()
        .transition()
        .duration(140)
        .attr('r', rScale(commit.totalLines));
      tooltipHideTimeout = window.setTimeout(
        () => updateTooltipVisibility(false),
        180,
      );
      dots.selectAll('circle').sort(
        (a, b) => d3.descending(a.totalLines, b.totalLines),
      );
    })
    .on('focus', function (event, commit) {
      const bounds = this.getBoundingClientRect();
      showTooltip(
        {
          clientX: bounds.left + bounds.width / 2,
          clientY: bounds.top + bounds.height / 2,
        },
        commit,
      );
    })
    .on('blur', () => updateTooltipVisibility(false));

  d3.select('#selection-count').text('No commits selected');
  d3.select('#language-breakdown').selectAll('*').remove();
}

function updateFileDisplay(commitList) {
  const lines = linesOf(commitList);
  const files = d3.groups(lines, (line) => line.file)
    .map(([name, fileLines]) => ({ name, lines: fileLines }))
    .sort((a, b) => b.lines.length - a.lines.length);
  const fileItems = d3.select('#files').selectAll('div')
    .data(files, (file) => file.name)
    .join(
      (enter) => {
        const div = enter.append('div');
        const term = div.append('dt');
        term.append('code');
        term.append('small');
        div.append('dd');
        return div;
      },
      (update) => update,
      (exit) => exit.remove(),
    );

  fileItems.select('code').text((file) => file.name);
  fileItems.select('small').text((file) => `${numberFormat(file.lines.length)} lines`);
  fileItems.select('dd')
    .selectAll('div.loc')
    .data((file) => file.lines, (line) => `${line.commit}-${line.line}`)
    .join('div')
    .attr('class', 'loc')
    .style('--color', (line) => lineColorScale(line.type))
    .attr('aria-hidden', 'true');
}

function renderFileLegend(lineTypes) {
  const entries = d3.select('#file-legend').selectAll('li')
    .data(lineTypes, (type) => type)
    .join(
      (enter) => {
        const item = enter.append('li');
        item.append('span').attr('class', 'meta-file-legend-swatch');
        item.append('span').attr('class', 'meta-file-legend-label');
        return item;
      },
      (update) => update,
      (exit) => exit.remove(),
    );
  entries.select('.meta-file-legend-swatch')
    .style('--color', (type) => lineColorScale(type));
  entries.select('.meta-file-legend-label').text((type) => type);
}

function renderScatterStory() {
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  d3.select('#scatter-story').selectAll('div.step')
    .data(commits, (commit) => commit.id)
    .join(
      (enter) => enter.append('div')
        .attr('class', 'step')
        .each(function (commit, index) {
          const paragraph = d3.select(this).append('p');
          paragraph.append('span')
            .text(`On ${dateFormat.format(commit.datetime)}, I made `);
          paragraph.append('a')
            .attr('href', commit.url)
            .attr('target', '_blank')
            .attr('rel', 'noopener noreferrer')
            .text(index === 0 ? 'my first commit, and it was glorious' : 'another glorious commit');
          paragraph.append('span')
            .text(`. I edited ${numberFormat(commit.totalLines)} lines across ${numberFormat(d3.group(commit.lines, (line) => line.file).size)} files. Then I looked over all I had made, and I saw that it was very good.`);
        }),
      (update) => update,
      (exit) => exit.remove(),
    );
}

function updateAll(maxTime) {
  commitMaxTime = maxTime;
  d3.select('#commit-time')
    .text(commitMaxTime.toLocaleString(undefined, {
      dateStyle: 'long',
      timeStyle: 'short',
    }))
    .attr('datetime', commitMaxTime.toISOString());
  filteredCommits = commits.filter((commit) => commit.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);
  renderCommitInfo(linesOf(filteredCommits), filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange() {
  commitProgress = Number(d3.select('#commit-progress').property('value'));
  commitMaxTime = timeScale.invert(commitProgress);
  updateAll(commitMaxTime);
}

function onStepEnter({ element }) {
  const datetime = element.__data__.datetime;
  commitProgress = timeScale(datetime);
  d3.select('#commit-progress').property('value', Math.round(commitProgress));
  d3.selectAll('#scatter-story .step')
    .classed('is-active', function () {
      return this === element;
    });
  updateAll(datetime);
}

try {
  const data = await d3.csv('./loc.csv', convertRow);
  if (data.length === 0) {
    throw new Error('The LOC file contains no line records.');
  }

  allLines = data;
  commits = processCommits(data);
  timeScale = d3.scaleTime()
    .domain(d3.extent(commits, (commit) => commit.datetime))
    .range([0, 100]);
  const lineTypes = [...new Set(allLines.map((line) => line.type))];
  lineColorScale = d3.scaleOrdinal(d3.schemeTableau10)
    .domain(lineTypes);

  initScatterPlot(commits);
  renderScatterStory();
  renderFileLegend(lineTypes);
  d3.select('#commit-progress').on('input', onTimeSliderChange);
  onTimeSliderChange();

  scroller = scrollama()
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
  window.addEventListener('resize', () => scroller.resize());
} catch (error) {
  console.error('Unable to load the portfolio LOC analysis:', error);
  d3.select('#chart')
    .text('Repository history could not be loaded. Please try again later.');
}
