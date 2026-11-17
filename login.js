'use strict';

window.location.replace('4ca70a9115ceec7a70a3a26e85c32caf492af4f9/index.html');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(error => console.error('Service worker registration failed', error));
}
