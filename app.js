/* Route map for the Mahmud assistant: Leaflet + OpenStreetMap, Photon search, OSRM routing,
   live traffic from the Yandex map widget (no key needed). No server of its own. The bot passes data in the URL fragment, which
   browsers never send to the web host. Every external string is inserted with textContent. */
(function () {
  'use strict';

  var HOME = [43.3017, 68.2700]; // Turkistan
  var MAX_POINTS = 15;
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTelegram = !!(tg && tg.initData !== undefined && tg.platform && tg.platform !== 'unknown');
  var $ = function (id) { return document.getElementById(id); };

  var TR = {
    "Не больше ": "En fazla ",
    " точек в маршруте.": " nokta eklenebilir.",
    "Точка на карте": "Haritadaki nokta",
    "Сохранить место": "Yeri kaydet",
    "Выше": "Yukarı",
    "Убрать точку": "Noktayı kaldır",
    "Добавьте вторую точку или нажмите 📍, чтобы ехать от себя.": "İkinci noktayı ekleyin veya bulunduğunuz yerden gitmek için 📍 düğmesine basın.",
    "Найдите место или нажмите на карту, чтобы добавить точку.": "Yer arayın veya nokta eklemek için haritaya dokunun.",
    "Строю маршрут…": "Rota oluşturuluyor…",
    "Не удалось построить маршрут. Проверьте точки или попробуйте через минуту.": "Rota oluşturulamadı. Noktaları kontrol edin veya bir dakika sonra deneyin.",
    " мин": " dk",
    " ч ": " sa ",
    "⚡ Самый быстрый": "⚡ En hızlı",
    "Вариант ": "Seçenek ",
    " км": " km",
    "Время без учёта пробок. С пробками — кнопка «🚦 Пробки».": "Süre trafik hariç. Trafik için «🚦 Trafik» düğmesi.",
    "Подбираю лучший порядок точек…": "En iyi sıra hesaplanıyor…",
    "Не удалось подобрать порядок. Попробуйте через минуту.": "Sıra hesaplanamadı. Bir dakika sonra deneyin.",
    "Место": "Yer",
    "Ищу…": "Aranıyor…",
    "Ничего не найдено. Уточните адрес или добавьте город.": "Bir şey bulunamadı. Adresi netleştirin veya şehir ekleyin.",
    "Поиск сейчас недоступен. Попробуйте через минуту.": "Arama şu anda kullanılamıyor. Bir dakika sonra deneyin.",
    "Телефон не отдаёт местоположение. Отправьте геопозицию боту в чате.": "Telefon konum vermiyor. Konumunuzu sohbette bota gönderin.",
    "Определяю, где вы…": "Konumunuz belirleniyor…",
    "Моё место": "Konumum",
    "Нет доступа к местоположению. Разрешите его для Telegram или отправьте геопозицию боту в чате.": "Konuma erişim yok. Telegram için izin verin veya konumunuzu bota gönderin.",
    "Название:": "Ad:",
    "Сохранено: ": "Kaydedildi: ",
    "Сохранить и в боте, чтобы строить маршрут голосом? Карта закроется.": "Sesle rota oluşturabilmek için bota da kaydedilsin mi? Harita kapanacak.",
    "Маршрут ": "Rota ",
    "Пока пусто. Нажмите ⭐ у точки.": "Henüz boş. Bir noktanın yanındaki ⭐ düğmesine basın.",
    "Добавить на карту": "Haritaya ekle",
    "Удалить": "Sil",
    "Куда едем? Адрес или место": "Nereye? Adres veya yer",
    "Найти": "Ara",
    "🚗 Авто": "🚗 Araba",
    "🚶 Пешком": "🚶 Yürüyerek",
    "🚦 Пробки": "🚦 Trafik",
    "⚡ Лучший порядок": "⚡ En iyi sıra",
    "💾 Сохранить маршрут": "💾 Rotayı kaydet",
    "🧹 Очистить": "🧹 Temizle",
    "Яндекс (пробки)": "Yandex (trafik)",
    "Пробки (проба)": "Trafik (deneme)",
    "Пробки TomTom не загрузились. Нажмите «🚦 Пробки» ещё раз — откроется Яндекс.": "TomTom trafiği yüklenemedi. «🚦 Trafik» düğmesine tekrar basın: Yandex açılır.",
    "Пробки TomTom (проба): зелёный — свободно, жёлтый и красный — медленнее. Время маршрута без учёта пробок.": "TomTom trafiği (deneme): yeşil açık, sarı ve kırmızı daha yavaş. Rota süresi trafik hariç.",
    "⭐ Сохранённые места и маршруты": "⭐ Kayıtlı yerler ve rotalar",
    "Свернуть или развернуть панель": "Paneli aç veya kapat",
    "Карта": "Harita",
    "Mahmud · Карта": "Mahmud · Harita"
  };
  var language = 'ru';
  function t(text) { return language === 'tr' && TR.hasOwnProperty(text) ? TR[text] : text; }

  function translatePage() {
    if (language !== 'tr') return;
    document.documentElement.lang = 'tr';
    document.title = t(document.title);
    document.querySelectorAll('button, a, summary, #status').forEach(function (el) {
      if (!el.children.length) el.textContent = t(el.textContent.trim()) || el.textContent;
    });
    ['placeholder', 'title', 'aria-label'].forEach(function (name) {
      document.querySelectorAll('[' + name + ']').forEach(function (el) { el.setAttribute(name, t(el.getAttribute(name))); });
    });
  }

  var state = { points: [], mode: 'car', routes: [], active: 0, canSend: false, request: 0, me: null };
  var saved = [];

  // ---------- data from the bot ----------
  function decodeBase64Url(value) {
    var b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bytes = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function validPoint(lat, lon, name) {
    lat = Number(lat); lon = Number(lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat: lat, lon: lon, name: String(name || '').slice(0, 200) || (lat.toFixed(5) + ', ' + lon.toFixed(5)) };
  }

  function toPoints(list) {
    return (Array.isArray(list) ? list : []).map(function (p) { return validPoint(p[0], p[1], p[2]); })
      .filter(Boolean).slice(0, MAX_POINTS);
  }

  function readLaunchData() {
    try {
      var raw = new URLSearchParams(location.hash.slice(1)).get('d');
      return raw ? decodeBase64Url(raw) : {};
    } catch (e) { return {}; }
  }

  // ---------- map ----------
  var map = L.map('map', { zoomControl: false }).setView(HOME, 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);
  var markers = L.layerGroup().addTo(map);
  var lines = L.layerGroup().addTo(map);
  var meLayer = L.layerGroup().addTo(map);

  function pinIcon(number) {
    var pin = document.createElement('div');
    pin.className = 'pin';
    var span = document.createElement('span');
    span.textContent = String(number);
    pin.appendChild(span);
    return L.divIcon({ html: pin, className: '', iconSize: [28, 28], iconAnchor: [14, 30] });
  }

  function say(text) { $('status').textContent = text; }

  function fit() {
    var all = state.points.map(function (p) { return [p.lat, p.lon]; });
    if (all.length > 1) map.fitBounds(all, { paddingTopLeft: [40, 90], paddingBottomRight: [40, 30] });
    else if (all.length === 1) map.setView(all[0], 15);
  }

  function addPoint(point, andFit) {
    if (!point) return;
    if (state.points.length >= MAX_POINTS) { say(t('Не больше ') + MAX_POINTS + t(' точек в маршруте.')); return; }
    state.points.push(point);
    changed(andFit);
  }

  function changed(andFit) {
    drawMarkers();
    drawList();
    if (andFit) fit();
    buildRoute();
  }

  function drawMarkers() {
    markers.clearLayers();
    state.points.forEach(function (p, i) {
      var marker = L.marker([p.lat, p.lon], { icon: pinIcon(i + 1), draggable: true }).addTo(markers);
      marker.on('dragend', function () {
        var at = marker.getLatLng();
        state.points[i] = { lat: at.lat, lon: at.lng, name: t('Точка на карте') };
        changed(false);
      });
    });
  }

  function smallButton(label, title, action) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.title = title; b.addEventListener('click', action);
    return b;
  }

  function drawList() {
    var list = $('points');
    list.textContent = '';
    state.points.forEach(function (p, i) {
      var li = document.createElement('li'); li.className = 'point';
      var num = document.createElement('span'); num.className = 'num'; num.textContent = String(i + 1);
      var name = document.createElement('span'); name.className = 'name'; name.textContent = p.name;
      name.addEventListener('click', function () { map.setView([p.lat, p.lon], 16); });
      li.append(num, name);
      li.appendChild(smallButton('⭐', t('Сохранить место'), function () { savePlace(p); }));
      if (i > 0) li.appendChild(smallButton('↑', t('Выше'), function () {
        state.points.splice(i - 1, 2, state.points[i], state.points[i - 1]); changed(false);
      }));
      li.appendChild(smallButton('✕', t('Убрать точку'), function () { state.points.splice(i, 1); changed(false); }));
      list.appendChild(li);
    });
    $('clear').hidden = !state.points.length;
    $('save-route').hidden = state.points.length < 2;
    $('optimize').hidden = state.points.length < 4 || state.mode !== 'car';
    updateLinks();
  }

  // ---------- links to navigators ----------
  function updateLinks() {
    var p = state.points;
    $('open-in').hidden = !p.length;
    if (!p.length) return;
    var foot = state.mode === 'foot';
    var lonLat = p.map(function (x) { return x.lon.toFixed(6) + ',' + x.lat.toFixed(6); });
    $('go-2gis').href = 'https://2gis.kz/directions/points/' + encodeURIComponent((p.length === 1 ? ['', lonLat[0]] : lonLat).join('|'));
    var latLon = p.map(function (x) { return x.lat.toFixed(6) + ',' + x.lon.toFixed(6); });
    $('go-yandex').href = 'https://yandex.kz/maps/?rtext=' + (p.length === 1 ? '~' : '') + latLon.join('~') + '&rtt=' + (foot ? 'pd' : 'auto') + '&l=trf';
    var google = 'https://www.google.com/maps/dir/?api=1&travelmode=' + (foot ? 'walking' : 'driving') + '&destination=' + latLon[latLon.length - 1];
    if (p.length > 1) google += '&origin=' + latLon[0];
    if (p.length > 2) google += '&waypoints=' + encodeURIComponent(latLon.slice(1, -1).join('|'));
    $('go-google').href = google;
  }

  // ---------- routing ----------
  function fetchJson(url) {
    var stop = new AbortController();
    var timer = setTimeout(function () { stop.abort(); }, 15000);
    return fetch(url, { signal: stop.signal }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  function osrmBase(service) {
    return state.mode === 'foot'
      ? 'https://routing.openstreetmap.de/routed-foot/' + service + '/v1/foot/'
      : 'https://router.project-osrm.org/' + service + '/v1/driving/';
  }

  function coordinates() {
    return state.points.map(function (p) { return p.lon.toFixed(6) + ',' + p.lat.toFixed(6); }).join(';');
  }

  function osrmRoutes() {
    return fetchJson(osrmBase('route') + coordinates() + '?overview=full&geometries=geojson&alternatives=3&steps=false')
      .then(function (data) {
        return data.routes.map(function (r) {
          return { seconds: r.duration, meters: r.distance,
            line: r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }) };
        });
      });
  }

  function buildRoute() {
    var ticket = ++state.request;
    lines.clearLayers();
    $('routes').textContent = '';
    state.routes = [];
    if (state.points.length < 2) {
      say(state.points.length ? t('Добавьте вторую точку или нажмите 📍, чтобы ехать от себя.')
        : t('Найдите место или нажмите на карту, чтобы добавить точку.'));
      return;
    }
    say(t('Строю маршрут…'));
    osrmRoutes().then(function (routes) {
      if (ticket !== state.request) return; // the points changed while we were waiting
      routes.sort(function (a, b) { return a.seconds - b.seconds; });
      state.routes = routes; state.active = 0;
      drawRoutes();
    }).catch(function () {
      if (ticket === state.request) say(t('Не удалось построить маршрут. Проверьте точки или попробуйте через минуту.'));
    });
  }

  function duration(seconds) {
    var minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? minutes + t(' мин') : Math.floor(minutes / 60) + t(' ч ') + (minutes % 60) + t(' мин');
  }

  function drawRoutes(keepStatus) {
    lines.clearLayers();
    var box = $('routes');
    box.textContent = '';
    var order = state.routes.map(function (_, i) { return i; })
      .sort(function (a, b) { return (a === state.active) - (b === state.active); }); // the chosen one on top
    order.forEach(function (i) {
      var on = i === state.active;
      var style = traffic.on // blue and wide but see-through: green, yellow and red must stay readable
        ? { color: on ? '#2457d6' : '#8a94a6', weight: on ? 11 : 5, opacity: on ? .38 : .35 }
        : { color: on ? '#0e7c74' : '#8a94a6', weight: on ? 7 : 5, opacity: on ? .9 : .65 };
      L.polyline(state.routes[i].line, style)
        .on('click', function () { state.active = i; drawRoutes(); }).addTo(lines);
    });
    state.routes.forEach(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button'; if (i === state.active) b.className = 'on';
      var left = document.createElement('span');
      left.textContent = i === 0 ? t('⚡ Самый быстрый') : t('Вариант ') + (i + 1);
      var right = document.createElement('strong');
      right.textContent = duration(r.seconds) + ' · ' + (r.meters / 1000).toFixed(1) + t(' км');
      b.append(left, right);
      b.addEventListener('click', function () { state.active = i; drawRoutes(); });
      box.appendChild(b);
    });
    if (keepStatus !== true) say(t('Время без учёта пробок. С пробками — кнопка «🚦 Пробки».'));
  }

  function optimizeOrder() {
    say(t('Подбираю лучший порядок точек…'));
    fetchJson(osrmBase('trip') + coordinates() + '?source=first&destination=last&roundtrip=false&overview=false')
      .then(function (data) {
        var ordered = [];
        data.waypoints.forEach(function (w, i) { ordered[w.waypoint_index] = state.points[i]; });
        state.points = ordered;
        changed(true);
      }).catch(function () { say(t('Не удалось подобрать порядок. Попробуйте через минуту.')); });
  }

  // ---------- search ----------
  function describe(feature) {
    var p = feature.properties;
    var street = [p.street, p.housenumber].filter(Boolean).join(' ');
    var title = p.name || street || p.city || t('Место');
    var rest = [p.name ? street : '', p.district, p.city, p.country].filter(Boolean).join(', ');
    return { title: title, rest: rest };
  }

  function search(text) {
    var box = $('results');
    var center = map.getCenter();
    box.hidden = false; box.textContent = t('Ищу…');
    fetchJson('https://photon.komoot.io/api/?limit=7&lat=' + center.lat.toFixed(3) + '&lon=' + center.lng.toFixed(3) +
      '&q=' + encodeURIComponent(text)).then(function (data) {
      box.textContent = '';
      if (!data.features.length) { box.textContent = t('Ничего не найдено. Уточните адрес или добавьте город.'); return; }
      data.features.forEach(function (f) {
        var d = describe(f);
        var li = document.createElement('li');
        var b = document.createElement('button'); b.type = 'button';
        var strong = document.createElement('strong'); strong.textContent = d.title;
        var small = document.createElement('small'); small.textContent = d.rest;
        b.append(strong, small);
        b.addEventListener('click', function () {
          box.hidden = true; $('query').value = '';
          addPoint(validPoint(f.geometry.coordinates[1], f.geometry.coordinates[0],
            d.title + (d.rest ? ', ' + d.rest : '')), true);
        });
        li.appendChild(b); box.appendChild(li);
      });
    }).catch(function () { box.textContent = t('Поиск сейчас недоступен. Попробуйте через минуту.'); });
  }

  // ---------- my location ----------
  function locate(thenStartHere) {
    if (!navigator.geolocation) { say(t('Телефон не отдаёт местоположение. Отправьте геопозицию боту в чате.')); return; }
    say(t('Определяю, где вы…'));
    navigator.geolocation.getCurrentPosition(function (pos) {
      state.me = validPoint(pos.coords.latitude, pos.coords.longitude, t('Моё место'));
      meLayer.clearLayers();
      var dot = document.createElement('div'); dot.className = 'me';
      L.marker([state.me.lat, state.me.lon], { icon: L.divIcon({ html: dot, className: '', iconSize: [18, 18] }) }).addTo(meLayer);
      var hasStart = state.points.length && state.points[0].name === t('Моё место');
      if (thenStartHere && state.points.length && !hasStart) { state.points.unshift(state.me); changed(true); }
      else { map.setView([state.me.lat, state.me.lon], 15); buildRoute(); }
    }, function () {
      say(t('Нет доступа к местоположению. Разрешите его для Telegram или отправьте геопозицию боту в чате.'));
    }, { enableHighAccuracy: true, timeout: 12000 });
  }

  // ---------- saved places and routes (Telegram cloud, else this phone) ----------
  var cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;

  function readSaved(done) {
    function parse(raw) { try { var v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    if (cloud) cloud.getItem('saved', function (err, value) { done(parse(err ? '' : value)); });
    else done(parse(localStorage.getItem('saved')));
  }

  function writeSaved() {
    var raw = JSON.stringify(saved);
    if (cloud) cloud.setItem('saved', raw.slice(0, 4000));
    else localStorage.setItem('saved', raw);
  }

  function askName(suggestion) {
    var name = window.prompt(t('Название:'), suggestion.slice(0, 40));
    return name ? name.trim().slice(0, 60) : '';
  }

  function store(item) {
    saved = saved.filter(function (s) { return s.name !== item.name; });
    saved.unshift(item);
    saved = saved.slice(0, 30);
    writeSaved(); drawSaved();
    say(t('Сохранено: ') + item.name);
    // opened from the bot's «🗺 Карта» button: the bot can receive it too, so voice commands know the name
    if (state.canSend && window.confirm(t('Сохранить и в боте, чтобы строить маршрут голосом? Карта закроется.'))) {
      tg.sendData(JSON.stringify({ type: 'save', name: item.name, points: item.points }));
    }
  }

  function savePlace(p) {
    var name = askName(p.name);
    if (name) store({ name: name, points: [[+p.lat.toFixed(6), +p.lon.toFixed(6), p.name.slice(0, 80)]] });
  }

  function saveRoute() {
    var name = askName(t('Маршрут ') + (saved.length + 1));
    if (name) store({ name: name, points: state.points.map(function (p) { return [+p.lat.toFixed(6), +p.lon.toFixed(6), p.name.slice(0, 60)]; }) });
  }

  function drawSaved() {
    var list = $('saved-list');
    list.textContent = '';
    if (!saved.length) { var li = document.createElement('li'); li.textContent = t('Пока пусто. Нажмите ⭐ у точки.'); list.appendChild(li); return; }
    saved.forEach(function (item) {
      var points = toPoints(item.points);
      if (!points.length) return;
      var li = document.createElement('li');
      li.appendChild(smallButton((points.length > 1 ? '🛣 ' : '📌 ') + String(item.name).slice(0, 60), t('Добавить на карту'), function () {
        if (points.length > 1) { state.points = points.slice(); changed(true); }
        else addPoint(points[0], true);
      }));
      li.appendChild(smallButton('✕', t('Удалить'), function () {
        saved = saved.filter(function (s) { return s !== item; }); writeSaved(); drawSaved();
      }));
      list.appendChild(li);
    });
  }

  // ---------- trial: TomTom traffic as a coloured layer on our own map (only when the bot sent a key) ----------
  var traffic = { key: '', layer: null, on: false, loaded: 0, failed: 0, broken: false };
  var FAILS_BEFORE_GIVING_UP = 4;

  function validKey(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : ''; }

  function setTrafficLayer(on) {
    traffic.on = on;
    $('traffic').classList.toggle('on', on);
    $('traffic').setAttribute('aria-pressed', String(on));
    if (traffic.layer) { map.removeLayer(traffic.layer); traffic.layer = null; }
    if (on) {
      traffic.loaded = 0; traffic.failed = 0;
      traffic.layer = L.tileLayer('https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&style=light&key={k}',
        { k: traffic.key, maxZoom: 19, opacity: 0.95, zIndex: 5, attribution: t('Пробки (проба)') + ' © TomTom' });
      traffic.layer.on('tileload', function () { traffic.loaded += 1; });
      traffic.layer.on('tileerror', function () {
        traffic.failed += 1;
        if (traffic.on && !traffic.loaded && traffic.failed >= FAILS_BEFORE_GIVING_UP) {
          traffic.broken = true; // wrong key or the free limit is used up: the Yandex window still works
          setTrafficLayer(false);
          say(t('Пробки TomTom не загрузились. Нажмите «🚦 Пробки» ещё раз — откроется Яндекс.'));
        }
      });
      traffic.layer.addTo(map);
      say(t('Пробки TomTom (проба): зелёный — свободно, жёлтый и красный — медленнее. Время маршрута без учёта пробок.'));
    }
    if (state.routes.length) drawRoutes(true); // a thinner route line lets the road colours show through
  }

  // ---------- traffic: the Yandex map widget shows live traffic and the time with it; no key needed ----------
  function trafficUrl() {
    var base = 'https://yandex.kz/map-widget/v1/?l=trf' + (language === 'tr' ? '&lang=tr_TR' : '');
    var p = state.points;
    if (!p.length) {
      var c = map.getCenter();
      return base + '&ll=' + c.lng.toFixed(5) + '%2C' + c.lat.toFixed(5) + '&z=' + map.getZoom();
    }
    if (p.length === 1) { // one place: its district with traffic (a route needs a start the widget cannot know)
      var at = p[0].lon.toFixed(6) + '%2C' + p[0].lat.toFixed(6);
      return base + '&ll=' + at + '&z=14&pt=' + at;
    }
    var latLon = p.map(function (x) { return x.lat.toFixed(6) + '%2C' + x.lon.toFixed(6); });
    return base + '&rtext=' + latLon.join('~') + '&rtt=' + (state.mode === 'foot' ? 'pd' : 'auto');
  }

  // Opened in its own window (inside Telegram: the in-app browser), so the route here stays as it was
  function showTraffic() {
    if (traffic.key && !traffic.broken) { setTrafficLayer(!traffic.on); return; }
    var url = trafficUrl();
    if (inTelegram && tg.openLink) tg.openLink(url);
    else window.open(url, '_blank', 'noopener');
  }

  // ---------- events ----------
  $('search').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('query').value.trim();
    if (text.length > 1) { $('query').blur(); search(text); }
  });
  map.on('click', function (e) {
    if (!$('results').hidden) { $('results').hidden = true; return; }
    addPoint(validPoint(e.latlng.lat, e.latlng.lng, t('Точка на карте')), false);
  });
  $('locate').addEventListener('click', function () { locate(true); });
  $('grip').addEventListener('click', function () { $('panel').classList.toggle('folded'); setTimeout(function () { map.invalidateSize(); }, 50); });
  document.querySelectorAll('.modes button[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.mode = b.dataset.mode;
      document.querySelectorAll('.modes button[data-mode]').forEach(function (x) { x.classList.toggle('on', x === b); });
      changed(false);
    });
  });
  $('traffic').addEventListener('click', showTraffic);
  $('optimize').addEventListener('click', optimizeOrder);
  $('save-route').addEventListener('click', saveRoute);
  $('clear').addEventListener('click', function () { state.points = []; changed(false); });

  // ---------- start ----------
  function start() {
    var data = readLaunchData();
    language = data.l === 'tr' ? 'tr' : 'ru';
    traffic.key = validKey(data.tk);
    translatePage();
    if (inTelegram) { tg.ready(); tg.expand(); if (tg.disableVerticalSwipes && tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes(); }
    state.mode = data.m === 'foot' ? 'foot' : 'car';
    document.querySelectorAll('.modes button[data-mode]').forEach(function (x) { x.classList.toggle('on', x.dataset.mode === state.mode); });
    state.canSend = !!(data.send && inTelegram && tg.sendData);
    state.points = toPoints(data.p);
    readSaved(function (items) {
      toBotSaved(data.s).forEach(function (fromBot) {
        if (!items.some(function (i) { return i.name === fromBot.name; })) items.push(fromBot);
      });
      saved = items;
      drawSaved();
    });
    changed(true);
    if (data.me) locate(true);
    setTimeout(function () { map.invalidateSize(); fit(); }, 250);
  }

  function toBotSaved(list) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && x.n && Array.isArray(x.p); })
      .map(function (x) { return { name: String(x.n).slice(0, 60), points: x.p }; });
  }

  window.addEventListener('hashchange', function () { location.reload(); });
  start();
})();
