const SearchRange = {
  parseChapters(value, max) {
    if (!value.trim()) return null;
    const chapters = new Set();
    for (const part of value.split(',')) {
      const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(part);
      if (!match) throw new Error('Enter chapters as numbers or ranges, such as 1, 3-5.');
      const first = Number(match[1]), last = Number(match[2] || match[1]);
      if (first < 1 || last > max || first > last) throw new Error('Chapters must be between 1 and ' + max + ', with ranges in ascending order.');
      for (let chapter = first; chapter <= last; chapter++) chapters.add(chapter);
    }
    return [...chapters].sort((a, b) => a - b);
  },
  includes(ranges, book, chapter) {
    return ranges.has(book) && (ranges.get(book) === null || ranges.get(book).includes(chapter));
  }
};
if (typeof module !== 'undefined') module.exports = SearchRange;
