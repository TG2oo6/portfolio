import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchBar = document.querySelector('.searchBar');
const piePlot = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');
const projects = await fetchJSON('../lib/projects.json');
let query = '';
let selectedYear = null;
let selectedIndex = -1;

function getFilteredProjects(searchFilteredProjects) {
  return searchFilteredProjects.filter(
    (project) =>
      selectedYear === null ||
      String(project.year) === String(selectedYear),
  );
}

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (values) => values.length,
    (project) => project.year,
  );
  const data = rolledData
    .map(([year, count]) => ({
      value: count,
      label: String(year),
    }))
    .sort((a, b) => d3.ascending(a.label, b.label));
  const color = d3
    .scaleOrdinal(d3.schemeTableau10)
    .domain(
      [...new Set(projects.map((project) => String(project.year)))].sort(
        d3.ascending,
      ),
    );
  const pie = d3.pie().value((datum) => datum.value);
  const arc = d3.arc().innerRadius(0).outerRadius(50);
  const pieData = pie(data);

  selectedIndex = pieData.findIndex(
    (datum) => datum.data.label === String(selectedYear),
  );
  const slices = piePlot
    .selectAll('path')
    .data(pieData, (datum) => datum.data.label)
    .join('path')
    .attr('d', arc)
    .attr('fill', (datum) => color(datum.data.label))
    .attr(
      'aria-label',
      (datum) => `${datum.data.label}: ${datum.data.value} projects`,
    )
    .classed('selected', (datum) => datum.index === selectedIndex);

  slices.on('click', (event, datum) => {
    const year = datum.data.label;
    selectedYear = selectedYear === year ? null : year;
    updateProjects();
  });

  const legendItems = legend
    .selectAll('li')
    .data(data, (datum) => datum.label)
    .join((enter) => {
      const items = enter.append('li');
      items.append('span').attr('class', 'swatch').attr('aria-hidden', 'true');
      items.append('span').attr('class', 'legend-label');
      items.select('.legend-label').append('em');
      return items;
    })
    .attr('class', 'legend-item')
    .style('--color', (datum) => color(datum.label))
    .classed('selected', (datum) => datum.label === String(selectedYear));

  legendItems.select('.legend-label').text((datum) => datum.label);
  legendItems.select('em').text((datum) => ` (${datum.value})`);
}

function updateProjects() {
  const normalizedQuery = query.trim().toLowerCase();
  const searchFilteredProjects = projects.filter((project) =>
    Object.values(project).join('\n').toLowerCase().includes(normalizedQuery),
  );
  const visibleProjects = getFilteredProjects(searchFilteredProjects);

  renderProjects(visibleProjects, projectsContainer);
  projectsTitle.textContent = `Projects (${visibleProjects.length})`;
  renderPieChart(searchFilteredProjects);
}

if (Array.isArray(projects)) {
  searchBar.addEventListener('input', (event) => {
    query = event.currentTarget.value;
    updateProjects();
  });
  updateProjects();
}
