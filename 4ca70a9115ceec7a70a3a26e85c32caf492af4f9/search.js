'use strict';
// The index files call this legacy completion hook after loading.
function resume_js() {}
function ex(context, error) { console.error(context, error); }
const loaded = new Map();
function loadIndex(path) {
  if (!loaded.has(path)) {
    loaded.set(path, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.onload = resolve;
      script.onerror = () => { loaded.delete(path); script.remove(); reject(new Error('Unable to load search data. Check your connection and try again.')); };
      document.head.appendChild(script);
    }));
  }
  return loaded.get(path);
}
const el = id => document.getElementById(id);
let generation = 0, matches = [], shown = 0, highlight = null;
function busy(value) {
  el('cancel').hidden = !value;
  el('search-results').setAttribute('aria-busy', String(value));
}
function markWords(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    let last = 0;
    for (const match of node.textContent.matchAll(highlight)) {
      fragment.append(document.createTextNode(node.textContent.slice(last, match.index)));
      const mark = document.createElement('mark'); mark.textContent = match[0]; fragment.append(mark);
      last = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(node.textContent.slice(last)));
    node.replaceWith(fragment);
  }
}
async function showMore(token) {
  const end = Math.min(shown + 30, matches.length);
  busy(true); el('more').hidden = true;
  try {
    const batch = matches.slice(shown, end);
    await Promise.all([...new Set(batch.map(keyhash))].map(hash => loadIndex('idx-bd/' + hash + '.js')));
    if (token !== generation) return;
    for (const key of batch) {
      const [reference, href] = keyvref(key);
      const article = document.createElement('article'); article.className = 'result';
      const heading = document.createElement('h2');
      const link = document.createElement('a'); link.href = href; link.innerHTML = reference; heading.append(link);
      const text = document.createElement('div'); text.className = 'result-text'; text.innerHTML = BD[key] || '';
      markWords(text); article.append(heading, text); el('search-results').append(article);
    }
    shown = end;
    el('search-status').textContent = `${matches.length.toLocaleString()} result${matches.length === 1 ? '' : 's'} · Showing ${shown.toLocaleString()}`;
    el('more').hidden = shown >= matches.length;
  } catch (error) {
    if (token === generation) { el('search-status').textContent = error.message; el('more').hidden = false; }
  } finally { if (token === generation) busy(false); }
}
async function search() {
  const token = ++generation;
  const query = el('query').value.trim();
  if (!query) return;
  const words = [...new Set(query.match(/[a-zA-Z]+/g) || [])];
  el('search-results').replaceChildren(); el('suggestions').hidden = true; el('clear').hidden = false; el('more').hidden = true;
  matches = []; shown = 0;
  if (!words.length) { busy(false); el('search-status').textContent = 'Enter a word to search the Bible.'; return; }
  const verses = el('verses').checked, notes = el('notes').checked, outlines = el('outlines').checked;
  if (!verses && !notes && !outlines) { busy(false); el('search-status').textContent = 'Choose at least one area to search in Search options.'; el('filters').open = true; return; }
  const matchCase = el('case').checked, whole = el('whole').checked, scope = el('scope').value;
  let ranges = null;
  el('range-error').hidden = true;
  if (scope === 'custom') {
    ranges = new Map();
    try {
      for (const row of document.querySelectorAll('.range-book')) {
        if (!row.querySelector('input[type=checkbox]').checked) continue;
        const book = Number(row.dataset.book);
        ranges.set(book, SearchRange.parseChapters(row.querySelector('input[type=text]').value, BkNumChs[book]));
      }
      if (!ranges.size) throw new Error('Select at least one book to search.');
    } catch (error) {
      busy(false); el('range-error').textContent = error.message; el('range-error').hidden = false;
      el('filters').open = true; el('search-status').textContent = 'Check your book and chapter selection.'; return;
    }
  }
  const params = new URLSearchParams({ss:query});
  if (ranges) params.set('books', JSON.stringify([...ranges]));
  for (const id of ['verses','notes','outlines','whole','case']) params.set(id, el(id).checked ? '1' : '0');
  params.set('scope', scope); history.replaceState(null, '', '?' + params);
  busy(true); el('search-status').textContent = 'Searching the Scriptures…';
  try {
    await loadIndex('ww.js'); if (token !== generation) return;
    const groups = words.map(word => ww_get_words(word, matchCase, whole));
    if (groups.every(group => group.length)) {
      const hashes = new Set(groups.flat().map(word => WW[word.toLowerCase()][0]));
      await Promise.all([...hashes].map(hash => loadIndex('idx-kw/' + hash + '.js')));
      if (token !== generation) return;
      let intersection;
      for (const group of groups) {
        const keys = new Set();
        for (const word of group) for (const key of Object.keys(KW[word] || {})) {
          const book = codenum(key.charCodeAt(0));
          if ((scope === 'old' && book >= 39) || (scope === 'new' && book < 39) || (Number.isInteger(Number(scope)) && book !== Number(scope))) continue;
          if (ranges && !SearchRange.includes(ranges, book, codenum(key.charCodeAt(1)))) continue;
          if (key_is_verse(key) ? !verses : key_is_footnote(key) ? !notes : !outlines) continue;
          if (!intersection || intersection.has(key)) keys.add(key);
        }
        intersection = keys;
      }
      matches = [...intersection].sort();
    }
    if (!matches.length) { el('search-status').textContent = 'No results found. Try fewer words or broaden your search options.'; return; }
    highlight = new RegExp((whole ? '\\b' : '') + '(' + words.join('|') + ')' + (whole ? '\\b' : ''), matchCase ? 'g' : 'gi');
    await showMore(token);
  } catch (error) { if (token === generation) el('search-status').textContent = error.message; }
  finally { if (token === generation) busy(false); }
}
function updateRange() {
  el('book-range').hidden = el('scope').value !== 'custom';
  let count = 0;
  document.querySelectorAll('.range-book').forEach(row => {
    const checked = row.querySelector('input[type=checkbox]').checked;
    row.querySelector('.chapter-choice').hidden = !checked;
    if (checked) count++;
  });
  el('range-count').textContent = count + (count === 1 ? ' book selected' : ' books selected');
}
BkName.forEach((name, i) => {
  const option = document.createElement('option'); option.value = i; option.textContent = name; el('scope').append(option);
  const row = document.createElement('div'); row.className = 'range-book'; row.dataset.book = i;
  const label = document.createElement('label');
  const check = document.createElement('input'); check.type = 'checkbox'; check.value = i;
  label.append(check, document.createTextNode(name));
  const chapters = document.createElement('label'); chapters.className = 'chapter-choice'; chapters.hidden = true;
  chapters.append(document.createTextNode('Chapters'));
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'All (1–' + BkNumChs[i] + ')';
  input.setAttribute('aria-label', name + ' chapters'); input.autocomplete = 'off';
  input.addEventListener('focus', hotkeys_disable); input.addEventListener('blur', hotkeys_enable);
  chapters.append(input); row.append(label, chapters); el('range-books').append(row);
  check.addEventListener('change', updateRange);
});
el('scope').addEventListener('change', updateRange);
for (const [id, checked] of [['select-all-books', true], ['clear-books', false]]) {
  el(id).addEventListener('click', () => {
    document.querySelectorAll('.range-book input[type=checkbox]').forEach(input => { input.checked = checked; }); updateRange();
  });
}
el('search-form').addEventListener('submit', event => { event.preventDefault(); search(); });
el('more').addEventListener('click', () => showMore(generation));
el('cancel').addEventListener('click', () => { generation++; busy(false); el('search-status').textContent = 'Search canceled.'; el('more').hidden = shown >= matches.length; });
el('clear').addEventListener('click', () => { generation++; busy(false); matches = []; shown = 0; el('query').value = ''; el('search-results').replaceChildren(); el('suggestions').hidden = false; el('clear').hidden = true; el('more').hidden = true; el('search-status').textContent = 'Where would you like to begin?'; history.replaceState(null, '', location.pathname); el('query').focus(); });
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => { el('query').value = button.dataset.query; search(); }));
const initial = new URLSearchParams(location.search);
let invalidSharedRange = false;
for (const id of ['verses','notes','outlines','whole','case']) if (initial.has(id)) el(id).checked = initial.get(id) === '1';
if ([...el('scope').options].some(option => option.value === initial.get('scope'))) el('scope').value = initial.get('scope');
if (initial.has('books')) {
  try {
    const ranges = JSON.parse(initial.get('books'));
    if (!Array.isArray(ranges)) throw new Error('Invalid books');
    for (const [book, chapters] of ranges) {
      if (!Number.isInteger(book) || book < 0 || book >= NumBks || (chapters !== null && !Array.isArray(chapters))) throw new Error('Invalid range');
      const row = document.querySelector('.range-book[data-book="' + book + '"]');
      const value = chapters === null ? '' : chapters.join(', ');
      SearchRange.parseChapters(value, BkNumChs[book]);
      row.querySelector('input[type=checkbox]').checked = true;
      row.querySelector('input[type=text]').value = value;
    }
    el('scope').value = 'custom';
  } catch (error) { invalidSharedRange = true; el('range-error').textContent = 'The shared book range is invalid. Choose your books again.'; el('range-error').hidden = false; el('filters').open = true; el('scope').value = 'custom'; }
}
updateRange();
if (el('scope').value !== 'all') el('filters').open = true;
if (initial.get('ss')) { el('query').value = initial.get('ss'); if (!invalidSharedRange) search(); }
// Keep the reader's single-letter shortcuts out of the search field.
el('query').addEventListener('focus', hotkeys_disable);
el('query').addEventListener('blur', hotkeys_enable);
