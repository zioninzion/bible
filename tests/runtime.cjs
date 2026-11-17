const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const content = '4ca70a9115ceec7a70a3a26e85c32caf492af4f9';

for (const file of ['sw.js', `${content}/sw.js`]) {
  test(`${file}: installation waits for existing local assets`, async () => {
    const handlers = {};
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
      self: { registration: { scope: 'https://example.com/bible/' }, skipWaiting: async () => {}, addEventListener: (name, fn) => handlers[name] = fn },
      caches: { open: async () => ({ addAll: assets => {
        for (const asset of assets) assert.ok(fs.existsSync(path.join(path.dirname(file), asset)), asset);
        return pending;
      } }) }
    });
    let settled = false;
    let installation;
    handlers.install({ waitUntil: promise => { installation = promise.then(() => { settled = true; }); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    finish();
    await installation;
    assert.equal(settled, true);
  });
}

test('scroll works with and without a navigation bar', () => {
  let scroll;
  let navbar = null;
  const window = { pageYOffset: 0, addEventListener: (name, fn) => { scroll = fn; } };
  vm.runInNewContext(fs.readFileSync(`${content}/main.js`, 'utf8'), {
    window, navigator: {}, parent: { location: { pathname: '/index.html' } },
    location: { pathname: '/index.html' }, document: { write: () => {}, getElementById: () => navbar }
  });
  window.pageYOffset = 20;
  assert.doesNotThrow(() => scroll());
  navbar = { style: {} };
  window.pageYOffset = 10;
  scroll();
  assert.equal(navbar.style.opacity, '0.8');
  window.pageYOffset = 30;
  scroll();
  assert.equal(navbar.style.opacity, '0.3');
});

test('entry page opens the Bible without a password', () => {
  let target;
  vm.runInNewContext(fs.readFileSync('login.js', 'utf8'), {
    navigator: {},
    window: { location: { replace: url => target = url } }
  });
  assert.equal(target, `${content}/index.html`);
  assert.ok(fs.existsSync(target));
  const html = fs.readFileSync('index.html', 'utf8');
  assert.doesNotMatch(html, /PERMISSION|type="password"|loginbutton/);
  assert.ok(html.includes(`href="${target}"`));
});
