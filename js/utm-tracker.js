(function () {
  'use strict';

  var STORAGE_KEY = 'principia_track';
  var TRACKED_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'sck', 'fbclid'];

  function readStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeStored(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* localStorage indisponível (modo privado etc.) — segue sem persistir */
    }
  }

  var params = new URLSearchParams(window.location.search);
  var stored = readStored();
  var changed = false;

  TRACKED_KEYS.forEach(function (key) {
    var value = params.get(key);
    if (value) {
      stored[key] = value;
      changed = true;
    }
  });

  if (changed) writeStored(stored);

  window.principiaGetTracking = function () {
    return readStored();
  };

  window.principiaTrackingQueryString = function () {
    var tracking = readStored();
    var qs = new URLSearchParams();
    Object.keys(tracking).forEach(function (key) {
      if (tracking[key]) qs.set(key, tracking[key]);
    });
    var str = qs.toString();
    return str ? '?' + str : '';
  };
})();
