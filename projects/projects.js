import { fetchJSON, renderProjects } from '../global.js';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const projects = await fetchJSON('../lib/projects.json');
if (Array.isArray(projects)) {
  renderProjects(projects, projectsContainer);
  projectsTitle.textContent = `Projects (${projects.length})`;
}
