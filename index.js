import { fetchGitHubData, fetchJSON, renderProjects } from './global.js';

const projectsContainer = document.querySelector('.projects');
const projects = await fetchJSON('./lib/projects.json');
if (Array.isArray(projects)) {
  renderProjects(projects.slice(0, 3), projectsContainer, 'h3');
}

const statsContainer = document.querySelector('#profile-stats');
const profile = await fetchGitHubData('TG2oo6');
const statisticFields = [
  'public_repos',
  'public_gists',
  'followers',
  'following',
];
if (
  profile &&
  statisticFields.every((field) => Number.isInteger(profile[field]))
) {
  statsContainer.innerHTML = `
    <dl class="profile-stats">
      <div><dt>Public repositories</dt><dd>${profile.public_repos}</dd></div>
      <div><dt>Public gists</dt><dd>${profile.public_gists}</dd></div>
      <div><dt>Followers</dt><dd>${profile.followers}</dd></div>
      <div><dt>Following</dt><dd>${profile.following}</dd></div>
    </dl>
  `;
} else {
  if (profile) {
    console.error('GitHub profile response is missing expected statistics.');
  }
  statsContainer.textContent = 'GitHub statistics are currently unavailable.';
}
