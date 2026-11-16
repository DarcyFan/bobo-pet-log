/* 通用工具：DOM 构造、图标、格式化、弹层、Toast、图片压缩 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 轻量 DOM 构造：el('div', {class:'a', onclick: fn}, '文本', childNode) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(9)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/* ---------------- 图标 ---------------- */
const ICONS = {
  home: '<path d="M4 10.6 12 4l8 6.6V19a2 2 0 0 1-2 2h-3.6v-5.4H9.6V21H6a2 2 0 0 1-2-2z"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>',
  plus: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
  bell: '<path d="M18 15.4V10a6 6 0 1 0-12 0v5.4L4.4 18h15.2z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>',
  paw: '<path d="M12 21c-3 0-5.4-1.6-5.4-4 0-2.6 2.6-3.3 3.5-5.1.9-1.6 1-2.7 1.9-2.7s1 1.1 1.9 2.7c.9 1.8 3.5 2.5 3.5 5.1 0 2.4-2.4 4-5.4 4z"/><circle cx="6.2" cy="9" r="1.5"/><circle cx="17.8" cy="9" r="1.5"/><circle cx="9.3" cy="5.8" r="1.5"/><circle cx="14.7" cy="5.8" r="1.5"/>',
  scale: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="6"/><path d="M7.6 14.2a4.6 4.6 0 0 1 8.8 0"/><path d="m12 14.2 2.2-2.6"/>',
  bowl: '<path d="M3.4 11.2h17.2c0 4.5-3.9 7.6-8.6 7.6s-8.6-3.1-8.6-7.6z"/><path d="M12 7.2c0-1.5 1.3-2 1.3-3.4M8.5 7.2c0-1 .9-1.4.9-2.4"/>',
  drop: '<path d="M12 3.2s6.2 6.6 6.2 10.4A6.2 6.2 0 0 1 5.8 13.6C5.8 9.8 12 3.2 12 3.2z"/>',
  camera: '<rect x="3" y="6.4" width="18" height="13.2" rx="3.6"/><circle cx="12" cy="13" r="3.4"/><path d="M8.6 6.4 10 4h4l1.4 2.4"/>',
  image: '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="4"/><circle cx="8.6" cy="9.8" r="1.5"/><path d="m4.4 17.4 4.8-4.4 3.1 2.7 2.4-2 4.9 4.3"/>',
  shield: '<path d="M12 3.2 19 6v5.2c0 4.9-3.4 8.1-7 9.6-3.6-1.5-7-4.7-7-9.6V6z"/><path d="m8.9 12 2.2 2.2 4-4.2"/>',
  bug: '<path d="M8.1 8.6a3.9 3.9 0 0 1 7.8 0v3.6a3.9 3.9 0 0 1-7.8 0z"/><path d="M12 4.4v4.2M8.2 9.4H4.8M8.2 12.4H4.4M8.4 15.4H5.2M15.8 9.4h3.4M15.8 12.4h3.8M15.6 15.4h3.2M9.3 5.7 8 3.9M14.7 5.7 16 3.9"/>',
  stethoscope: '<path d="M5.2 3.6v5a4.1 4.1 0 0 0 8.2 0v-5"/><path d="M9.3 12.7v1.6a4.6 4.6 0 0 0 9.2 0v-2"/><circle cx="18.5" cy="10" r="2"/>',
  pill: '<rect x="3.4" y="9.2" width="17.2" height="5.6" rx="2.8" transform="rotate(-40 12 12)"/><path d="M9.6 9.4 14.4 14.2"/>',
  scissors: '<circle cx="6.4" cy="6.6" r="2.4"/><circle cx="6.4" cy="17.4" r="2.4"/><path d="M8.5 8.2 19 17.2M8.5 15.8 19 6.8"/>',
  box: '<path d="M3.6 8 12 4.2 20.4 8v8L12 19.8 3.6 16z"/><path d="M3.6 8 12 11.8 20.4 8M12 11.8v8"/>',
  note: '<path d="M5.2 4.4h9.2L19 9v10.6H5.2z"/><path d="M8.6 12.6h6.8M8.6 16h4.4"/>',
  search: '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.2 4.2"/>',
  sliders: '<path d="M4 8h9.5M18.5 8H20M4 16h3.5M12.5 16H20"/><circle cx="16" cy="8" r="2.1"/><circle cx="10" cy="16" r="2.1"/>',
  trash: '<path d="M4.6 7h14.8M9.2 7V4.9h5.6V7M6.6 7l.8 12.1h9.2L17.4 7"/><path d="M10.6 10.6v5.4M13.4 10.6v5.4"/>',
  edit: '<path d="M4.6 19.4h3.9L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="m14.6 7.4 2 2"/>',
  close: '<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>',
  check: '<path d="m5.2 12.4 4.6 4.6L18.8 7"/>',
  chevron: '<path d="m9.4 5.4 6.6 6.6-6.6 6.6"/>',
  down: '<path d="m6 9.4 6 6 6-6"/>',
  calendar: '<rect x="3.4" y="5.2" width="17.2" height="15.2" rx="3.6"/><path d="M8 3.4v3.2M16 3.4v3.2M3.4 10.2h17.2"/>',
  download: '<path d="M12 4v11M8 11.4l4 4 4-4M4.6 19.6h14.8"/>',
  upload: '<path d="M12 15.2V4M8 7.4l4-4 4 4M4.6 19.6h14.8"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11.2v5.2M12 7.9h.01"/>',
  cat: '<path d="M4.6 9.4 3.6 4l4.4 2.5a8.8 8.8 0 0 1 8 0L20.4 4l-1 5.4"/><path d="M12 5.6c4.3 0 7.1 3.5 7.1 7.5 0 4.6-3.2 7.4-7.1 7.4s-7.1-2.8-7.1-7.4c0-4 2.8-7.5 7.1-7.5z"/><path d="M9.2 12.4h.01M14.8 12.4h.01"/><path d="M12 15.1v.8"/>',
  chart: '<path d="M4.4 19.6V4.8M4.4 19.6h15.2"/><path d="m7.4 15.2 3.4-3.8 3 2.6 5.4-5.8"/>',
  sparkle: '<path d="M12 3.6 13.7 9l5.4 1.7-5.4 1.7L12 17.8 10.3 12.4 4.9 10.7 10.3 9z"/>',
  alert: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v5M12 15.9h.01"/>',
  share: '<path d="M12 15.4V4.2M8.2 7.8 12 4l3.8 3.8"/><path d="M5.4 12.8v6.4h13.2v-6.4"/>',
  lock: '<rect x="4.6" y="10.4" width="14.8" height="9.6" rx="3"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  clockSmall: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>'
};

export function icon(name, size = 22, cls = '') {
  const body = ICONS[name] || ICONS.paw;
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">${body}</svg>`;
}

export function iconNode(name, size = 22, cls = '') {
  const wrap = document.createElement('span');
  wrap.style.display = 'contents';
  wrap.innerHTML = icon(name, size, cls);
  return wrap.firstElementChild;
}

/* ---------------- 时间 ---------------- */
const pad = (n) => String(n).padStart(2, '0');

/** Date → 'YYYY-MM-DD'（本地） */
export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → 'YYYY-MM-DDTHH:mm'（本地） */
export function dateTimeStr(d = new Date()) {
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowStr() { return dateTimeStr(new Date()); }
export function today() { return dateStr(new Date()); }

/** 兼容 'YYYY-MM-DD' 与 'YYYY-MM-DDTHH:mm'，按本地时区解析 */
export function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
}

/** 只取日期部分做整数天差（b - a） */
export function dayDiff(aStr, bStr) {
  const a = parseDate(aStr); const b = parseDate(bStr);
  if (!a || !b) return 0;
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

export function fmtDate(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtMD(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtTime(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDT(v) {
  const d = parseDate(v);
  if (!d) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function weekday(v) {
  const d = parseDate(v);
  return d ? '周' + '日一二三四五六'[d.getDay()] : '';
}

/** 距今几天 → 中文 */
export function relDay(v) {
  const n = dayDiff(today(), v);
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  if (n === -1) return '昨天';
  if (n > 0) return `${n} 天后`;
  return `逾期 ${Math.abs(n)} 天`;
}

export function relDayShort(v) {
  const n = dayDiff(today(), v);
  if (n === 0) return '今天';
  if (n === -1) return '昨天';
  if (n > 0 && n <= 6) return `${n}天前`;
  return fmtMD(v);
}

/** 生日 → 月龄描述 */
export function ageLabel(birthday, ref = new Date()) {
  const b = parseDate(birthday);
  if (!b) return '';
  let months = (ref.getFullYear() - b.getFullYear()) * 12 + (ref.getMonth() - b.getMonth());
  let days = ref.getDate() - b.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(ref.getFullYear(), ref.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) return '';
  const totalDays = Math.round((ref - b) / 86400000);
  if (months === 0) {
    const weeks = Math.floor(totalDays / 7);
    if (weeks >= 1) return `${weeks} 周 ${totalDays % 7} 天`;
    return `${totalDays} 天`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  let out = y > 0 ? `${y} 岁` : '';
  if (m > 0) out += `${out ? ' ' : ''}${m} 个月`;
  if (days > 0) out += ` ${days} 天`;
  return out.trim();
}

/* ---------------- Toast ---------------- */
export function toast(msg, kind = '', ms = 1900) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const node = el('div', { class: 'toast' }, kind === 'check' ? iconNode('check', 16) : null, msg);
  host.append(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 280);
  }, ms);
}

/* ---------------- 弹层 ---------------- */
let openCount = 0;

/**
 * 底部弹层
 * @returns {{close:Function, body:HTMLElement, root:HTMLElement}}
 */
export function openSheet({ title = '', body = null, foot = null, onClose = null, dismissible = true, big = false } = {}) {
  const host = document.getElementById('sheets');
  const backdrop = el('div', { class: 'sheet-backdrop' });
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const bodyEl = el('div', { class: 'sheet-body' }, body || '');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(() => {
      sheet.remove();
      backdrop.remove();
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = '';
      if (onClose) onClose();
    }, 320);
  }

  const head = el('div', { class: 'sheet-head' },
    el('h2', { class: 'sheet-title' }, title),
    el('button', { class: 'icon-btn', 'aria-label': '关闭', onclick: close, html: icon('close', 20) })
  );

  sheet.append(
    el('div', { class: 'sheet-handle' }),
    head,
    bodyEl
  );
  if (foot) sheet.append(el('div', { class: 'sheet-foot' }, foot));

  backdrop.addEventListener('click', () => { if (dismissible) close(); });

  // 下滑关闭
  let startY = null, dy = 0, dragging = false;
  const onStart = (e) => {
    if (!dismissible) return;
    const t = e.touches ? e.touches[0] : e;
    if (bodyEl.scrollTop > 0) return;
    startY = t.clientY; dy = 0; dragging = true;
    sheet.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = Math.max(0, t.clientY - startY);
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110) close();
  };
  sheet.addEventListener('touchstart', onStart, { passive: true });
  sheet.addEventListener('touchmove', onMove, { passive: true });
  sheet.addEventListener('touchend', onEnd);
  sheet.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  host.append(backdrop, sheet);
  openCount += 1;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  });

  return { close, body: bodyEl, root: sheet, head };
}

export function confirmSheet(message, { okText = '确定', cancelText = '取消', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (settled) return; settled = true; resolve(v); };

    const ok = el('button', {
      class: 'btn block ' + (danger ? 'danger' : 'primary'),
      onclick: () => { done(true); s.close(); }
    }, okText);
    const cancel = el('button', { class: 'btn ghost block', onclick: () => { done(false); s.close(); } }, cancelText);

    const s = openSheet({
      title: '',
      body: el('div', { class: 'stack' },
        el('p', { style: { fontSize: '16px', fontWeight: '650', textAlign: 'center', padding: '8px 0 4px' } }, message)
      ),
      foot: el('div', { class: 'stack', style: { display: 'flex', flexDirection: 'column', gap: '9px' } }, ok, cancel),
      onClose: () => done(false)
    });
  });
}

/* ---------------- 图片 ---------------- */
/** 压缩图片到 JPEG，返回 Blob */
export function compressImage(file, maxSide = 1600, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('图片处理失败'));
        }, 'image/jpeg', quality);
      } catch (err) { reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法读取这张图片')); };
    img.src = url;
  });
}

export function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function debounce(fn, ms = 220) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
