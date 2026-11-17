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
    for (const match of node.textContent.matchAll(highlight || /(?!) /g)) {
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
      markWords(text); article.append(heading, text); addContext(article, key, token); el('search-results').append(article);
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
  el('search-results').replaceChildren(); el('more').hidden = true;
  let branches, reference;
  try {
    reference = SearchQuery.reference(query, BkName, BkAbbr, BkRef, BkChNV);
    if (!reference) branches = SearchQuery.parse(query);
  } catch (error) { busy(false); el('search-status').textContent = error.message; return; }
  el('search-results').replaceChildren(); el('suggestions').hidden = true; el('clear').hidden = false; el('more').hidden = true;
  matches = []; shown = 0;
  const verses = el('verses').checked, notes = el('notes').checked, outlines = el('outlines').checked;
  if (!reference && !verses && !notes && !outlines) { busy(false); el('search-status').textContent = 'Choose at least one area to search in Search options.'; el('filters').open = true; return; }
  const matchCase = el('case').checked, whole = el('whole').checked, scope = el('scope').value;
  let ranges = null;
  el('range-error').hidden = true;
  if (!reference && scope === 'custom') {
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
  busy(true); el('recent-searches').hidden = true; el('search-status').textContent = reference ? 'Opening passage…' : 'Searching the Scriptures…';
  try {
    if (reference) {
      for (let verse = reference.first; verse <= reference.last; verse++) matches.push(hkey_verse(reference.book, reference.chapter, verse));
      highlight = null;
    } else {
      await loadIndex('ww.js'); if (token !== generation) return;
      const terms = branches.flat();
      const wordGroups = new Map();
      for (const word of terms.flatMap(term => term.words)) {
        if (!wordGroups.has(word)) wordGroups.set(word, ww_get_words(word, matchCase, whole));
      }
      const hashes = new Set([...wordGroups.values()].flat().map(word => WW[word.toLowerCase()][0]));
      await Promise.all([...hashes].map(hash => loadIndex('idx-kw/' + hash + '.js')));
      if (token !== generation) return;
      const wordSets = new Map([...wordGroups].map(([word, variants]) => [word, new Set(variants.flatMap(variant => Object.keys(KW[variant] || {})))]));
      const allowed = key => {
        const book = codenum(key.charCodeAt(0));
        if ((scope === 'old' && book >= 39) || (scope === 'new' && book < 39) || (Number.isInteger(Number(scope)) && book !== Number(scope))) return false;
        if (ranges && !SearchRange.includes(ranges, book, codenum(key.charCodeAt(1)))) return false;
        return key_is_verse(key) ? verses : key_is_footnote(key) ? notes : outlines;
      };
      const termKeys = term => {
        const sets = term.words.map(word => wordSets.get(word));
        const smallest = sets.reduce((a, b) => a.size < b.size ? a : b);
        return new Set([...smallest].filter(key => allowed(key) && sets.every(set => set.has(key))));
      };
      const candidates = new Map(terms.map(term => [term, termKeys(term)]));
      // Narrow phrase checks using every positive indexed term before loading passage text.
      const possible = new Set();
      for (const branch of branches) {
        const sets = branch.filter(term => !term.exclude).map(term => candidates.get(term));
        const smallest = sets.reduce((a, b) => a.size < b.size ? a : b);
        for (const key of smallest) if (sets.every(set => set.has(key))) possible.add(key);
      }
      // Phrases need the actual passage text; ordinary word queries use the index alone.
      for (const term of terms.filter(term => term.phrase)) {
        const keys = [...candidates.get(term)].filter(key => possible.has(key));
        const hashes = [...new Set(keys.map(keyhash))];
        for (let i = 0; i < hashes.length; i += 20) {
          if (token !== generation) return;
          el('search-status').textContent = 'Checking exact phrases…';
          await Promise.all(hashes.slice(i, i + 20).map(hash => loadIndex('idx-bd/' + hash + '.js')));
        }
        if (token !== generation) return;
        const pattern = SearchQuery.regex(term, matchCase, whole);
        candidates.set(term, new Set(keys.filter(key => { pattern.lastIndex = 0; return pattern.test(plainPassage(BD[key] || '')); })));
      }
      const union = new Set();
      for (const branch of branches) {
        const positive = branch.filter(term => !term.exclude).map(term => candidates.get(term));
        const negative = branch.filter(term => term.exclude).map(term => candidates.get(term));
        const smallest = positive.reduce((a, b) => a.size < b.size ? a : b);
        for (const key of smallest) if (positive.every(set => set.has(key)) && negative.every(set => !set.has(key))) union.add(key);
      }
      matches = [...union].sort();
      const expressions = terms.filter(term => !term.exclude).map(term => SearchQuery.regex(term, matchCase, whole).source).sort((a, b) => b.length - a.length);
      highlight = new RegExp(expressions.join('|'), matchCase ? 'g' : 'gi');
    }
    rememberSearch(query, params, ranges);
    if (!matches.length) { el('search-status').textContent = 'No results found. Try fewer words or broaden your search options.'; return; }
    await showMore(token);
  } catch (error) { if (token === generation) el('search-status').textContent = error.message; }
  finally { if (token === generation) busy(false); }
}
function plainPassage(html) {
  const container = document.createElement('div'); container.innerHTML = html;
  // Footnote markers interrupt words visually but are not part of the passage.
  container.querySelectorAll('s, sup').forEach(node => node.remove());
  return container.textContent.replace(/\s+/g, ' ').trim();
}
function addContext(article, key, token) {
  if (!key_is_verse(key)) return;
  const book = codenum(key.charCodeAt(0)), chapter = codenum(key.charCodeAt(1)), verse = codenum(key.charCodeAt(2));
  const button = document.createElement('button'); button.type = 'button'; button.className = 'context-toggle'; button.textContent = 'Show surrounding verses'; button.setAttribute('aria-expanded', 'false');
  const context = document.createElement('div'); context.className = 'passage-context'; context.hidden = true;
  let ready = false;
  button.addEventListener('click', async () => {
    if (ready) { context.hidden = !context.hidden; button.setAttribute('aria-expanded', String(!context.hidden)); button.textContent = context.hidden ? 'Show surrounding verses' : 'Hide surrounding verses'; return; }
    button.disabled = true; button.textContent = 'Loading context…';
    try {
      const keys = [];
      // Include two verses on each side, crossing chapter boundaries within this book.
      let ch = chapter, vn = verse;
      for (let offset = 0; offset < 2; offset++) {
        if (--vn < 1) { if (--ch < 1) break; vn = BkChNV[book][ch - 1]; }
        keys.unshift(hkey_verse(book, ch, vn));
      }
      keys.push(key); ch = chapter; vn = verse;
      for (let offset = 0; offset < 2; offset++) {
        if (++vn > BkChNV[book][ch - 1]) { if (++ch > BkNumChs[book]) break; vn = 1; }
        keys.push(hkey_verse(book, ch, vn));
      }
      await Promise.all([...new Set(keys.map(keyhash))].map(hash => loadIndex('idx-bd/' + hash + '.js')));
      if (token !== generation) return;
      for (const contextKey of keys) {
        const p = document.createElement('p');
        if (contextKey === key) p.className = 'context-current';
        const [ref, href] = keyvref(contextKey);
        const link = document.createElement('a'); link.href = href; link.textContent = ref;
        p.append(link, document.createTextNode(' ' + plainPassage(BD[contextKey] || ''))); context.append(p);
      }
      ready = true; context.hidden = false; button.textContent = 'Hide surrounding verses'; button.setAttribute('aria-expanded', 'true');
    } catch (error) { button.textContent = 'Retry loading context'; }
    finally { button.disabled = false; }
  });
  article.append(button, context);
}
const storageKey = 'bible-search-history-v1';
function readHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored && Array.isArray(stored.recent) && Array.isArray(stored.ranges)) return stored;
  } catch (error) { /* Search works when browser storage is unavailable. */ }
  return {recent: [], ranges: []};
}
let searchHistory = readHistory();
function saveHistory() { try { localStorage.setItem(storageKey, JSON.stringify(searchHistory)); } catch (error) {} }
function rangeLabel(entries) {
  return entries.map(([book, chapters]) => BkName[book] + (chapters ? ' ' + compactChapters(chapters) : '')).join('; ');
}
function compactChapters(chapters) {
  const parts = [];
  for (let i = 0; i < chapters.length; i++) {
    const first = chapters[i]; let last = first;
    while (chapters[i + 1] === last + 1) last = chapters[++i];
    parts.push(first === last ? String(first) : first + '–' + last);
  }
  return parts.join(', ');
}
function rememberSearch(query, params, ranges) {
  const url = params.toString();
  searchHistory.recent = [{query, url}, ...searchHistory.recent.filter(entry => entry.url !== url)].slice(0, 8);
  if (ranges && ranges.size) {
    const entries = [...ranges]; const id = JSON.stringify(entries);
    const previous = searchHistory.ranges.find(entry => entry.id === id);
    searchHistory.ranges = [{id, entries, uses: (previous?.uses || 0) + 1, last: Date.now()}, ...searchHistory.ranges.filter(entry => entry.id !== id)].sort((a, b) => b.uses - a.uses || b.last - a.last).slice(0, 5);
  }
  saveHistory(); renderHistory(); el('recent-searches').hidden = true;
}
function renderHistory() {
  el('recent-list').replaceChildren();
  for (const entry of searchHistory.recent) {
    const link = document.createElement('a'); link.href = 'vsearch.htm?' + entry.url; link.textContent = entry.query; el('recent-list').append(link);
  }
  el('recent-searches').hidden = !searchHistory.recent.length || !!el('query').value.trim();
  el('range-history').replaceChildren();
  for (const entry of searchHistory.ranges) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = rangeLabel(entry.entries); button.title = 'Reuse this book selection';
    button.addEventListener('click', () => {
      document.querySelectorAll('.range-book input[type=checkbox]').forEach(input => { input.checked = false; });
      for (const [book, chapters] of entry.entries) {
        const row = document.querySelector('.range-book[data-book="' + book + '"]');
        if (!row) continue;
        row.querySelector('input[type=checkbox]').checked = true; row.querySelector('input[type=text]').value = chapters ? compactChapters(chapters) : '';
      }
      el('scope').value = 'custom'; el('filters').open = true; updateRange();
    });
    el('range-history').append(button);
  }
  el('saved-ranges').hidden = !searchHistory.ranges.length;
}
function renderSelectedBooks() {
  el('selected-books').replaceChildren();
  document.querySelectorAll('.range-book').forEach(row => {
    if (!row.querySelector('input[type=checkbox]').checked) return;
    const book = Number(row.dataset.book), chapters = row.querySelector('input[type=text]').value.trim();
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'selected-book';
    chip.textContent = BkName[book] + (chapters ? ' ' + chapters : ' · All chapters') + ' ×';
    chip.setAttribute('aria-label', 'Remove ' + BkName[book] + ' from search');
    chip.addEventListener('click', () => { row.querySelector('input[type=checkbox]').checked = false; updateRange(); });
    el('selected-books').append(chip);
  });
}

function updateRange() {
  el('book-range').hidden = el('scope').value !== 'custom';
  let count = 0;
  document.querySelectorAll('.range-book').forEach(row => {
    const checked = row.querySelector('input[type=checkbox]').checked;
    row.querySelector('.chapter-choice').hidden = !checked;
    if (checked) count++;
  });
  renderSelectedBooks();
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
  input.addEventListener('input', renderSelectedBooks);
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
el('clear').addEventListener('click', () => { generation++; busy(false); matches = []; shown = 0; el('query').value = ''; el('search-results').replaceChildren(); el('suggestions').hidden = false; el('clear').hidden = true; el('more').hidden = true; el('search-status').textContent = 'Where would you like to begin?'; renderHistory(); history.replaceState(null, '', location.pathname); el('query').focus(); });
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
renderHistory();
updateRange();
if (el('scope').value !== 'all') el('filters').open = true;
if (initial.get('ss')) { el('query').value = initial.get('ss'); if (!invalidSharedRange) search(); }
// Keep the reader's single-letter shortcuts out of the search field.
el('query').addEventListener('focus', hotkeys_disable);
el('query').addEventListener('blur', hotkeys_enable);

el('range-filter').addEventListener('input', () => {
  const query = el('range-filter').value.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll('.range-book').forEach(row => {
    const book = Number(row.dataset.book);
    row.hidden = !(BkName[book] + ' ' + BkAbbr[book]).toLowerCase().includes(query);
    if (!row.hidden) visible++;
  });
  el('no-range-books').hidden = visible > 0;
});
el('range-filter').addEventListener('focus', hotkeys_disable);
el('range-filter').addEventListener('blur', hotkeys_enable);
el('clear-history').addEventListener('click', () => { searchHistory.recent = []; saveHistory(); renderHistory(); });
el('clear-ranges').addEventListener('click', () => { searchHistory.ranges = []; saveHistory(); renderHistory(); });
