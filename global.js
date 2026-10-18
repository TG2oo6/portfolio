console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/tg2oo6', title: 'GitHub' },
];

const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/portfolio/';

const nav = document.createElement('nav');
document.body.prepend(nav);

for (const page of pages) {
  const { url, title } = page;
  const href = url.startsWith('http') ? url : `${BASE_PATH}${url}`;
  const a = document.createElement('a');
  a.href = href;
  a.textContent = title;

  if (a.host === location.host && a.pathname === location.pathname) {
    a.classList.add('current');
  }
  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  nav.append(a);
}

const themeLabel = document.createElement('label');
themeLabel.className = 'color-scheme';
themeLabel.append('Theme: ');

const themeSelect = document.createElement('select');
for (const [title, value] of [
  ['Automatic', 'light dark'],
  ['Light', 'light'],
  ['Dark', 'dark'],
]) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = title;
  themeSelect.append(option);
}
themeLabel.append(themeSelect);
document.body.prepend(themeLabel);

const colorSchemeSelect = document.querySelector('.color-scheme select');
const validColorSchemes = ['light dark', 'light', 'dark'];
const storedColorScheme = localStorage.getItem('colorScheme');
const initialColorScheme = validColorSchemes.includes(storedColorScheme)
  ? storedColorScheme
  : 'light dark';

document.documentElement.style.setProperty('color-scheme', initialColorScheme);
colorSchemeSelect.value = initialColorScheme;

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  colorSchemeSelect.value = colorScheme;
  localStorage.setItem('colorScheme', colorScheme);
}

colorSchemeSelect.addEventListener('input', (event) => {
  setColorScheme(event.target.value);
});

const form = document.querySelector('form');
form?.addEventListener('submit', function (event) {
  event.preventDefault();

  const formData = new FormData(form);
  const parameters = [];
  for (const [name, value] of formData) {
    parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  }

  const url = `${form.action}?${parameters.join('&')}`;
  location.href = url;
});
