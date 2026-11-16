/* 四个主页面的渲染函数 */

import {
  el, icon, iconNode, fmtMD, fmtDT, fmtDate, weekday, today, dayDiff,
  ageLabel, relDay, parseDate
} from './util.js';
import {
  TYPES, FILTERS, TYPE_GROUPS, sortRecords, matchesFilter, searchRecords,
  groupByMonth, weightSeries, feedWeek, overview, supplyStatus, fmtNum
} from './model.js';
import { weightChart } from './chart.js';
import { getPhotoURL } from './db.js';

/* ---------------- 小工具 ---------------- */
function pageHead(title, sub, actions = []) {
  return el('header', { class: 'page-head' },
    el('div', {},
      el('h1', { class: 'page-title' }, title),
      sub ? el('p', { class: 'page-sub' }, sub) : null
    ),
    actions.length ? el('div', { class: 'page-actions' }, ...actions) : null
  );
}

function avatarNode(pet, size = 66) {
  const node = el('div', { class: 'avatar' });
  if (pet.avatarPhotoId) {
    const img = el('img', { alt: pet.name });
    img.dataset.pid = pet.avatarPhotoId;
    node.append(img);
  } else {
    node.innerHTML = icon('cat', Math.round(size * 0.5));
  }
  return node;
}

function chip(text, tone = '') {
  return el('span', { class: 'chip ' + tone }, text);
}

function statNode(value, unit, label, onClick) {
  const inner = [
    el('div', { class: 'stat-v num' }, String(value), unit ? el('small', {}, unit) : null),
    el('div', { class: 'stat-k' }, label)
  ];
  if (onClick) {
    return el('button', { class: 'stat', type: 'button', onclick: onClick }, ...inner);
  }
  return el('div', { class: 'stat' }, ...inner);
}

function quickBtn(label, ic, tone, onClick) {
  return el('button', { class: 'quick', onclick: onClick },
    el('span', { class: 'quick-i tone-' + tone, html: icon(ic, 18) }),
    el('span', { class: 'quick-t' }, label)
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 13) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 异步把照片 URL 填进 img[data-pid] */
export function hydratePhotos(root) {
  root.querySelectorAll('img[data-pid]').forEach(async (img) => {
    const id = img.dataset.pid;
    try {
      const url = await getPhotoURL(id);
      if (url) img.src = url;
    } catch (e) { /* 忽略单张照片失败 */ }
  });
}

/* ---------------- 记录行 / 提醒行 ---------------- */
function recordRow(r, app) {
  const def = TYPES[r.type] || { label: r.type, icon: 'note', tone: 'gold', summary: () => '' };
  const sum = def.summary(r);
  const note = (r.note || '').trim();
  const when = def.timeMode === 'date' ? fmtDate(r.at) : fmtDT(r.at);
  return el('button', { class: 'row', onclick: () => app.openDetail(r) },
    el('span', { class: 'quick-i tone-' + def.tone, html: icon(def.icon, 18) }),
    el('div', { class: 'row-main' },
      el('div', { class: 'row-t' }, def.label, sum ? el('span', { class: 'tl-val', style: { marginLeft: '6px' } }, sum) : null),
      el('div', { class: 'row-s' }, when + (note ? ' · ' + note.replace(/\n/g, ' ') : ''))
    ),
    el('span', { class: 'chev', html: icon('chevron', 15) })
  );
}

function remRow(item, app, { showKind = true } = {}) {
  const badgeCls = item.status === 'over' ? 'over' : item.status === 'soon' ? 'soon' : '';
  return el('button', { class: 'rem', onclick: () => app.openReminder(item) },
    el('span', { class: 'rem-i tone-' + item.tone, html: icon(item.icon, 18) }),
    el('div', { class: 'rem-main' },
      el('div', { class: 'rem-t' }, item.title),
      el('div', { class: 'rem-s' }, `${fmtMD(item.at)}${showKind ? ' · ' + item.kind : ''}`)
    ),
    el('span', { class: 'rem-badge ' + badgeCls }, item.label)
  );
}

/* =========================================================
   首页
   ========================================================= */
export function renderHome(app) {
  const { pet, records } = app.state;
  const rem = app.derived.rem;
  const allW = weightSeries(records, 0);
  const rangeDays = app.state.weightRange === 'all' ? 0 : Number(app.state.weightRange || 90);
  const w = weightSeries(records, rangeDays);
  const latest = allW[allW.length - 1];
  const prev = allW[allW.length - 2];
  const ov = overview(records);
  const homeDays = pet.homeDate ? dayDiff(pet.homeDate, today()) : null;
  const age = ageLabel(pet.birthday);

  const root = el('div', { class: 'stack' });

  /* 顶部 */
  const bell = el('button', {
    class: 'icon-btn', 'aria-label': '提醒',
    onclick: () => app.go('reminders'),
    html: icon('bell', 19)
  });
  if (rem.overdue.length) {
    bell.style.position = 'relative';
    bell.append(el('span', {
      style: {
        position: 'absolute', top: '7px', right: '8px',
        width: '7px', height: '7px', borderRadius: '50%',
        background: 'var(--rose)', boxShadow: '0 0 0 2px var(--bg)'
      }
    }));
  }
  root.append(pageHead(greeting(), `${fmtMD(today())} ${weekday(today())} · 到家 ${homeDays == null ? '—' : homeDays <= 0 ? '今天' : homeDays + ' 天'}`, [bell]));

  /* 猫咪卡片 */
  root.append(el('section', { class: 'hero anim' },
    el('div', { class: 'hero-top' },
      avatarNode(pet),
      el('div', { class: 'hero-id', style: { minWidth: '0' } },
        el('h2', { class: 'hero-name' }, pet.name),
        el('p', { class: 'hero-meta' }, [pet.breed, pet.variety].filter(Boolean).join(' · ') || '还没填品种'),
        el('div', { class: 'hero-chips' },
          age ? chip(age, 'gold') : null,
          pet.sex ? chip(pet.sex, 'blue') : null
        )
      )
    ),
    el('div', { class: 'hero-stats' },
      statNode(latest ? fmtNum(latest.v) : '—', latest ? 'kg' : '', '最新体重', () => app.openTimeline('weight')),
      statNode(ov.count, '', '条记录', () => app.openTimeline('all')),
      statNode(rem.all.length, '', '项待办', () => app.go('reminders'))
    )
  ));

  /* 快捷入口 */
  root.append(el('div', { class: 'quick-row anim anim-1' },
    quickBtn('记体重', 'scale', 'gold', () => app.openForm('weight')),
    quickBtn('喂食', 'bowl', 'blue', () => app.openForm('feeding')),
    quickBtn('疫苗', 'shield', 'green', () => app.openForm('vaccine')),
    quickBtn('随手记', 'camera', 'violet', () => app.openForm('memo'))
  ));

  /* 近期待办 */
  if (rem.urgent.length) {
    root.append(el('section', { class: 'card anim anim-2' },
      el('div', { class: 'card-head' },
        el('h3', { class: 'card-title' }, '近期待办'),
        el('button', { class: 'card-link', onclick: () => app.go('reminders') }, '全部 ', el('span', { html: icon('chevron', 13) }))
      ),
      ...rem.urgent.slice(0, 3).map((it) => remRow(it, app))
    ));
  }

  /* 体重趋势 */
  const seg = el('div', { class: 'seg' },
    ...[['30', '30天'], ['90', '90天'], ['all', '全部']].map(([k, label]) =>
      el('button', {
        class: app.state.weightRange === k ? 'on' : '',
        onclick: () => { app.state.weightRange = k; app.render({ keepScroll: true }); }
      }, label)
    )
  );

  let chartBody;
  if (!w.length) {
    chartBody = el('div', { class: 'empty' }, '还没有体重记录，记一次就能看到趋势');
  } else {
    const chartNode = el('div', { class: 'chart-wrap', style: { marginTop: '4px' } });
    chartNode.innerHTML = weightChart(w, { width: 340, height: 152 });
    const delta = latest && prev ? latest.v - prev.v : null;
    chartBody = el('div', {},
      chartNode,
      el('div', { class: 'chart-foot' },
        el('span', { class: 'chart-big num' }, fmtNum(latest.v), el('span', {}, 'kg')),
        delta != null
          ? el('span', { class: 'delta ' + (delta >= 0 ? 'up' : 'down') },
            `${delta >= 0 ? '↑' : '↓'} ${fmtNum(Math.abs(delta))} kg`)
          : null,
        el('span', { class: 'tiny', style: { marginLeft: 'auto' } }, '最近 ' + fmtMD(latest.at))
      ),
      w.length === 1
        ? el('div', { class: 'tiny', style: { padding: '6px 2px 0' } }, '再记录一次体重，就能看到趋势线')
        : null
    );
  }

  root.append(el('section', { class: 'card anim anim-3' },
    el('div', { class: 'card-head' }, el('h3', { class: 'card-title' }, '体重趋势'), seg),
    chartBody
  ));

  /* 最近记录 */
  const recent = sortRecords(records, true).slice(0, 3);
  root.append(el('section', { class: 'card anim anim-4' },
    el('div', { class: 'card-head' },
      el('h3', { class: 'card-title' }, '最近记录'),
      el('button', { class: 'card-link', onclick: () => app.go('timeline') }, '查看全部 ', el('span', { html: icon('chevron', 13) }))
    ),
    recent.length
      ? recent.map((r) => recordRow(r, app))
      : el('div', { class: 'empty' }, '还没有任何记录，点下面的 ＋ 开始')
  ));

  return root;
}

/* =========================================================
   时间线
   ========================================================= */
export function renderTimeline(app) {
  const { records } = app.state;
  const root = el('div', {});

  const searchBtn = el('button', {
    class: 'icon-btn', 'aria-label': '搜索', html: icon('search', 19),
    onclick: () => {
      app.state.searchOpen = !app.state.searchOpen;
      if (!app.state.searchOpen) app.state.q = '';
      app.render({ keepScroll: true });
    }
  });

  root.append(pageHead('时间线', `共 ${records.length} 条记录`, [searchBtn]));

  const listHost = el('div', {});

  const paint = () => {
    listHost.textContent = '';
    let list = app.state.records.filter((r) => matchesFilter(r, app.state.filter));
    list = searchRecords(list, app.state.q || '');
    list = sortRecords(list, true);

    if (!list.length) {
      listHost.append(el('div', { class: 'empty' },
        el('div', { html: icon('cat', 34) }),
        el('p', {}, app.state.q ? '没有匹配的记录' : '这个分类下还没有记录')
      ));
      return;
    }
    for (const g of groupByMonth(list)) {
      listHost.append(el('div', { class: 'tl-month' }, g.label));
      const wrap = el('div', { class: 'tl-list' });
      for (const r of g.items) wrap.append(tlItem(r, app));
      listHost.append(wrap);
    }
  };

  if (app.state.searchOpen) {
    const input = el('input', {
      type: 'search', placeholder: '搜索记录内容…', value: app.state.q || '',
      style: {
        width: '100%', border: 0, outline: 0, background: 'transparent',
        fontSize: '16px', padding: '12px 0'
      }
    });
    // 只重绘列表，不替换输入框 —— 否则中文输入法会被打断
    input.addEventListener('input', (e) => {
      if (e.isComposing) return;
      app.state.q = e.target.value;
      paint();
    });
    input.addEventListener('compositionend', (e) => {
      app.state.q = e.target.value;
      paint();
    });

    root.append(el('div', { class: 'search-box', style: {
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: '14px', padding: '0 12px', marginBottom: '12px'
    } },
      el('span', { style: { color: 'var(--ink-3)', display: 'grid' }, html: icon('search', 17) }),
      input
    ));
    setTimeout(() => input.focus(), 40);
  }

  /* 筛选 */
  const filters = el('div', { class: 'filter-row' },
    ...FILTERS.map((f) => el('button', {
      class: 'fchip' + (app.state.filter === f.k ? ' on' : ''),
      onclick: () => { app.state.filter = f.k; app.render({ keepScroll: true }); }
    }, f.label))
  );
  root.append(filters);
  root.append(listHost);
  paint();

  return root;
}

function tlItem(r, app) {
  const def = TYPES[r.type] || { label: r.type, icon: 'note', tone: 'gold', summary: () => '' };
  const sum = def.summary(r);
  const photos = r.photos || [];
  const d = parseDate(r.at);
  const dateOnly = def.timeMode === 'date';
  const time = dateOnly
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return el('button', { class: 'tl-item', onclick: () => app.openDetail(r) },
    el('div', { class: 'tl-rail' }, el('div', { class: 'tl-dot tone-' + def.tone, html: icon(def.icon, 19) })),
    el('div', { class: 'tl-main' },
      el('div', { class: 'tl-top' },
        el('span', { class: 'tl-name' }, def.label),
        sum ? el('span', { class: 'tl-val' }, sum) : null,
        el('span', { class: 'tl-time' }, time)
      ),
      (r.note || '').trim() ? el('p', { class: 'tl-note' }, r.note) : null,
      photos.length
        ? el('div', { class: 'thumbs' },
          ...photos.slice(0, 3).map((pid) => {
            const img = el('img', { class: 'thumb', alt: '' });
            img.dataset.pid = pid;
            return img;
          }),
          photos.length > 3 ? el('span', { class: 'thumb', style: { display: 'grid', placeItems: 'center', fontSize: '12px', color: 'var(--ink-3)' } }, `+${photos.length - 3}`) : null
        )
        : null
    )
  );
}

/* =========================================================
   提醒
   ========================================================= */
export function renderReminders(app) {
  const rem = app.derived.rem;
  const root = el('div', {});
  const sub = rem.all.length
    ? `${rem.all.length} 项待处理`
    : (rem.birthdays && rem.birthdays.length ? '暂无待办' : '暂无提醒');
  root.append(pageHead('提醒', sub, [
    el('button', {
      class: 'icon-btn', 'aria-label': '导出到系统日历', html: icon('calendar', 19),
      onclick: () => app.exportICS()
    }),
    el('button', {
      class: 'icon-btn', 'aria-label': '新建提醒', html: icon('plus', 19),
      onclick: () => app.openReminderForm(null)
    })
  ]));

  const section = (title, items) => {
    if (!items.length) return null;
    return el('section', {},
      el('div', { class: 'sec-title' }, title),
      el('div', { class: 'card flush', style: { padding: '2px 14px' } }, ...items.map((i) => remRow(i, app)))
    );
  };

  root.append(
    section('已逾期', rem.overdue) || document.createComment(''),
    section('7 天内', rem.soon) || document.createComment(''),
    section('以后', rem.later) || document.createComment('')
  );

  // 纪念日不参与「待办」计数，单独一块
  if (rem.birthdays && rem.birthdays.length) {
    root.append(el('div', { class: 'sec-title' }, '纪念日'));
    root.append(el('div', { class: 'card flush', style: { padding: '2px 14px' } },
      ...rem.birthdays.map((i) => remRow(i, app))
    ));
  }

  if (!rem.all.length && !(rem.birthdays && rem.birthdays.length)) {
    root.append(el('div', { class: 'empty' },
      el('div', { html: icon('bell', 34) }),
      el('p', {}, '没有待办提醒'),
      el('p', { class: 'tiny', style: { marginTop: '6px' } }, '给疫苗/驱虫记录填上「下次日期」，或新建一条自定义提醒')
    ));
  }

  if (rem.done.length) {
    root.append(el('div', { class: 'sec-title' }, '已完成'));
    root.append(el('div', { class: 'card flush', style: { padding: '2px 14px' } },
      ...rem.done.map((i) => el('div', { class: 'rem', style: { opacity: '.55' } },
        el('span', { class: 'rem-i tone-green', html: icon('check', 18) }),
        el('div', { class: 'rem-main' },
          el('div', { class: 'rem-t', style: { textDecoration: 'line-through' } }, i.title),
          el('div', { class: 'rem-s' }, fmtMD(i.at))
        ),
        el('span', { class: 'rem-badge done' }, '已完成')
      ))
    ));
  }

  root.append(el('div', { class: 'tiny', style: { padding: '18px 6px', textAlign: 'center', lineHeight: '1.7', maxWidth: '310px', margin: '0 auto' } },
    '网页应用无法后台推送通知，提醒只在 App 内显示。', el('br'),
    '点右上角日历图标，可把全部提醒导出到 iPhone 系统日历，那样才会真的响。'
  ));

  return root;
}

/* =========================================================
   档案
   ========================================================= */
export function renderArchive(app) {
  const { pet, records, supplies } = app.state;
  const ov = overview(records);
  const root = el('div', {});
  const age = ageLabel(pet.birthday);
  const homeDays = pet.homeDate ? dayDiff(pet.homeDate, today()) : null;

  root.append(pageHead('档案', '关于 ' + pet.name + ' 的一切', [
    el('button', {
      class: 'icon-btn', 'aria-label': '编辑档案', html: icon('edit', 18),
      onclick: () => app.openPetForm()
    })
  ]));

  /* 基本信息 */
  const kv = (k, v) => el('div', { class: 'kv' }, el('span', { class: 'kv-k' }, k), el('span', { class: 'kv-v' }, v || '—'));

  root.append(el('section', { class: 'card', style: { marginBottom: '14px' } },
    el('div', { class: 'detail-hero' },
      avatarNode(pet, 52),
      el('div', { style: { minWidth: '0' } },
        el('div', { class: 'detail-title' }, pet.name),
        el('div', { class: 'detail-sub' }, [pet.breed, pet.variety].filter(Boolean).join(' · ') || '还没填品种'),
        el('div', { class: 'hero-chips', style: { marginTop: '7px' } },
          age ? chip(age, 'gold') : null,
          homeDays != null && homeDays >= 0 ? chip(`到家 ${homeDays} 天`, 'blue') : null
        )
      )
    ),
    kv('生日', pet.birthday ? fmtDate(pet.birthday) : ''),
    kv('到家', pet.homeDate ? fmtDate(pet.homeDate) : ''),
    kv('性别', pet.sex),
    pet.vet ? kv('常去医院', pet.vet) : null,
    pet.microchip ? kv('芯片号', pet.microchip) : null,
    pet.notes ? el('div', { class: 'detail-note' }, pet.notes) : null
  ));

  /* 数据概览 */
  const week = feedWeek(records, 7);
  const maxG = Math.max(1, ...week.map((d) => d.g));
  const totalG = week.reduce((s, d) => s + d.g, 0);

  root.append(el('div', { class: 'sec-title' }, '数据概览'));
  root.append(el('section', { class: 'card' },
    el('div', { class: 'hero-stats', style: { marginTop: '0', paddingTop: '0', borderTop: '0' } },
      statNode(ov.count, '', '条记录', () => app.openTimeline('all')),
      statNode(ov.weights, '', '次称重', () => app.openTimeline('weight')),
      statNode(ov.photos, '', '条带照片', () => app.openTimeline('photo'))
    ),
    el('div', { class: 'card-head', style: { marginTop: '16px' } },
      el('h3', { class: 'card-title', style: { fontSize: '13.5px' } }, '近 7 天喂食'),
      el('span', { class: 'tiny' }, totalG ? `合计 ${fmtNum(totalG)} g` : '暂无数据')
    ),
    el('div', { class: 'bars' },
      ...week.map((d) => el('div', { class: 'bar-col' },
        el('div', {
          class: 'bar-fill',
          style: { height: `${d.g ? Math.max(6, (d.g / maxG) * 100) : 3}%`, opacity: d.g ? 1 : .22 }
        })
      ))
    ),
    el('div', { class: 'bar-labs' }, ...week.map((d) => el('div', { class: 'bar-lab' }, d.label)))
  ));

  /* 用品库存 */
  root.append(el('div', { class: 'sec-title' },
    '用品与库存',
    el('button', { class: 'card-link', style: { marginLeft: 'auto' }, onclick: () => app.openSupplyForm(null) }, '+ 添加')
  ));
  root.append(el('section', { class: 'card', style: { padding: '4px 14px' } },
    supplies.length
      ? supplies
        .slice()
        .sort((a, b) => (a.expiresAt || '9999') < (b.expiresAt || '9999') ? -1 : 1)
        .map((s) => {
          const st = supplyStatus(s);
          return el('button', { class: 'supply', style: { width: '100%', textAlign: 'left' }, onclick: () => app.openSupplyForm(s) },
            el('span', { class: 'quick-i tone-gold', html: icon('box', 17) }),
            el('div', { class: 'row-main' },
              el('div', { class: 'row-t' }, s.name),
              el('div', { class: 'row-s' }, [s.category, s.expiresAt ? '到期 ' + fmtDate(s.expiresAt) : ''].filter(Boolean).join(' · '))
            ),
            el('span', { class: 'supply-d ' + st.status }, st.label)
          );
        })
      : el('div', { class: 'empty', style: { padding: '20px 8px' } }, '还没有添加猫粮、罐头或药品')
  ));

  /* 数据管理 */
  root.append(el('div', { class: 'sec-title' }, '数据与设置'));
  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', style: { display: 'none' },
    onchange: (e) => { const f = e.target.files && e.target.files[0]; if (f) app.doImport(f); e.target.value = ''; }
  });

  root.append(el('section', { class: 'card', style: { padding: '2px 14px' } },
    settingRow('download', '导出备份', '存成文件，换手机也不丢', () => app.doExport()),
    settingRow('upload', '导入备份', '从备份文件恢复', () => fileInput.click()),
    settingRow('share', '添加到主屏幕', '像 App 一样全屏使用', () => app.showInstallHelp()),
    settingRow('info', '关于这个 App', '版本 1.0.0 · 数据只存在本机', () => app.showAbout()),
    settingRow('trash', '清空所有数据', '不可恢复，请先备份', () => app.clearAll(), true),
    fileInput
  ));

  return root;
}

function settingRow(ic, title, sub, onClick, danger = false) {
  return el('button', { class: 'row', style: { width: '100%', textAlign: 'left' }, onclick: onClick },
    el('span', {
      class: 'quick-i ' + (danger ? 'tone-rose' : 'tone-blue'),
      html: icon(ic, 18)
    }),
    el('div', { class: 'row-main' },
      el('div', { class: 'row-t', style: danger ? { color: 'var(--rose)' } : {} }, title),
      el('div', { class: 'row-s' }, sub)
    ),
    el('span', { class: 'chev', html: icon('chevron', 15) })
  );
}
