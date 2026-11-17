const books = document.getElementById('books');
[[0,39,'Old Testament'],[39,66,'New Testament']].forEach(([start,end,title]) => {
  const section = document.createElement('section');
  section.className = 'testament';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading);
  const grid = document.createElement('div');
  grid.className = 'book-grid';
  for (let i = start; i < end; i++) {
    const link = document.createElement('a');
    link.href = BkAbbr[i] + '.htm';
    link.className = 'book';
    link.dataset.name = (BkName[i] + ' ' + BkAbbr[i]).toLowerCase();
    const name = document.createElement('strong');
    name.textContent = BkName[i];
    const count = document.createElement('span');
    count.textContent = BkNumChs[i] + (BkNumChs[i] === 1 ? ' chapter' : ' chapters');
    link.append(name, count);
    grid.append(link);
  }
  section.append(grid);
  books.append(section);
});
document.getElementById('book-filter').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll('.book').forEach(book => { book.hidden = !book.dataset.name.includes(query); });
  document.querySelectorAll('.testament').forEach(section => { section.hidden = !section.querySelector('.book:not([hidden])'); });
  document.getElementById('empty').hidden = !!books.querySelector('.book:not([hidden])');
});
