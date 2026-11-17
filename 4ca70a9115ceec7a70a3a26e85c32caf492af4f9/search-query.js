const SearchQuery = {
  parse(value) {
    const branches = [[]];
    let offset = 0;
    while (offset < value.length) {
      if (/\s/.test(value[offset])) { offset++; continue; }
      const match = /^(-?)(?:"([^"\n]+)"|([a-zA-Z]+(?:['’-][a-zA-Z]+)*))(?=\s|$)/.exec(value.slice(offset));
      if (!match) throw new Error('Use words, "exact phrases", OR, and -excluded words or -"excluded phrases".');
      offset += match[0].length;
      if (!match[1] && match[3] === 'OR') {
        if (!branches.at(-1).length) throw new Error('Add search words on both sides of OR.');
        branches.push([]); continue;
      }
      const text = (match[2] || match[3]).trim().replace(/\s+/g, ' ');
      const words = text.match(/[a-zA-Z]+/g);
      if (!words) throw new Error('Enter a word inside each phrase.');
      branches.at(-1).push({text, words, phrase: match[2] !== undefined, exclude: !!match[1]});
    }
    if (branches.some(branch => !branch.some(term => !term.exclude))) throw new Error('Each OR group needs at least one word or phrase to include.');
    return branches;
  },
  regex(term, matchCase, whole) {
    const escaped = term.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return new RegExp((whole ? '\\b' : '') + escaped + (whole ? '\\b' : ''), matchCase ? 'g' : 'gi');
  },
  reference(value, names, abbreviations, refs, chapterLengths) {
    const match = /^(.+?)\s*(\d+)\s*(?::\s*(\d+)\s*(?:[-–]\s*(\d+))?)?$/.exec(value.trim());
    if (!match) return null;
    const normalize = text => text.toLowerCase().replace(/\bfirst\b/g, '1').replace(/\bsecond\b/g, '2').replace(/\bthird\b/g, '3').replace(/[.\s]/g, '');
    let name = normalize(match[1]);
    if (name === 'psalm' || name === 'ps') name = 'psalms';
    const book = names.findIndex((n, i) => [n, abbreviations[i], refs[i]].some(alias => normalize(alias) === name));
    if (book < 0) return null;
    const chapter = Number(match[2]);
    if (chapter < 1 || chapter > chapterLengths[book].length) throw new Error(names[book] + ' has ' + chapterLengths[book].length + ' chapters.');
    const first = match[3] ? Number(match[3]) : 1;
    const last = match[4] ? Number(match[4]) : match[3] ? first : chapterLengths[book][chapter - 1];
    if (first < 1 || last < first || last > chapterLengths[book][chapter - 1]) throw new Error('Choose verses from 1 to ' + chapterLengths[book][chapter - 1] + ' in ' + names[book] + ' ' + chapter + '.');
    return {book, chapter, first, last};
  }
};
if (typeof module !== 'undefined') module.exports = SearchQuery;
