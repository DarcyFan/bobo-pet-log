/* 应用入口：状态、路由、底栏、各种动作 */

import {
  el, icon, toast, openSheet, confirmSheet, today, nowStr, parseDate, dateStr, fmtDate
} from './util.js';
import * as db from './db.js';
import { buildReminders } from './model.js';
import { renderHome, renderTimeline, renderReminders, renderArchive, hydratePhotos } from './views.js';
import { openAddPicker, openRecordForm, openRecordDetail, openPetForm, openReminderForm, openSupplyForm } from './forms.js';

const VIEWS = {
  home: renderHome,
  timeline: renderTimeline,
  reminders: renderReminders,
  archive: renderArchive
};

const TABS = [
  { k: 'home', label: '首页', icon: 'home' },
  { k: 'timeline', label: '时间线', icon: 'clock' },
  { k: 'add', label: '', icon: 'plus' },
  { k: 'reminders', label: '提醒', icon: 'bell' },
  { k: 'archive', label: '档案', icon: 'paw' }
];

const app = {
  state: {
    view: 'home',
    pet: null,
    records: [],
    reminders: [],
    supplies: [],
    filter: 'all',
    q: '',
    searchOpen: false,
    weightRange: '90'
  },
  derived: { rem: { all: [], overdue: [], soon: [], later: [], done: [], urgent: [] } },

  async boot() {
    try {
      await db.seedIfEmpty();
      await this.loadAll();
      this.render();
      this.registerSW();
      this.installHint();
    } catch (err) {
      console.error(err);
      document.getElementById('view').innerHTML =
        `<div class="empty" style="padding-top:60px">数据打不开：${err.message}<br><br>试试完全关掉页面再重新打开</div>`;
    }
  },

  async loadAll() {
    const [pets, records, reminders, supplies] = await Promise.all([
      db.all('pet'), db.all('records'), db.all('reminders'), db.all('supplies')
    ]);
    this.state.pet = pets[0] || { name: '我的猫', breed: '', birthday: '', homeDate: '' };
    this.state.records = records;
    this.state.reminders = reminders;
    this.state.supplies = supplies;
    this.derived.rem = buildReminders({
      pet: this.state.pet,
      records,
      reminders,
      supplies
    });
  },

  async reload() {
    await this.loadAll();
    this.render({ keepScroll: true });
  },

  render({ keepScroll = false } = {}) {
    const host = document.getElementById('view');
    const y = window.scrollY;
    const fn = VIEWS[this.state.view] || renderHome;
    const node = fn(this);
    host.textContent = '';
    host.append(node);
    hydratePhotos(host);
    renderTabbar(this);
    if (keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  },

  go(view) {
    if (!VIEWS[view]) return;
    this.state.view = view;
    this.render();
  },

  openAdd() {
    openAddPicker(this);
  },

  openForm(type, existing = null) {
    openRecordForm(this, type, existing);
  },

  openDetail(rec) {
    openRecordDetail(this, rec);
  },

  openPetForm() {
    openPetForm(this);
  },

  openReminderForm(r) {
    openReminderForm(this, r);
  },

  openSupplyForm(s) {
    openSupplyForm(this, s);
  },

  /* ---------- 提醒项点击 ---------- */
  openReminder(item) {
    if (item.cat === 'health') {
      const rec = this.state.records.find((r) => r.id === item.sourceId);
      if (rec) return this.openDetail(rec);
      return;
    }
    if (item.cat === 'supply') {
      const s = this.state.supplies.find((x) => x.id === item.sourceId);
      if (s) return this.openSupplyForm(s);
      return;
    }
    if (item.cat === 'birthday') {
      toast(`🎂 ${this.state.pet.name} 生日 ${fmtDate(item.at)}`);
      return;
    }

    // 自定义提醒
    const r = this.state.reminders.find((x) => x.id === item.sourceId);
    if (!r) return;

    const doComplete = async () => {
      if (r.repeat && r.repeat !== 'none') {
        const d = parseDate(r.at);
        const next = r.repeat === 'monthly'
          ? new Date(d.getFullYear(), d.getMonth() + 1, d.getDate())
          : new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
        await db.put('reminders', { ...r, at: dateStr(next), doneAt: null });
      } else {
        await db.put('reminders', { ...r, doneAt: today() });
      }
      sheet.close();
      this.reload();
      toast('完成', 'check');
    };

    const sheet = openSheet({
      title: item.title,
      body: el('div', { class: 'stack' },
        el('div', { class: 'card', style: { background: 'var(--card-2)', border: '0', padding: '2px 14px' } },
          el('div', { class: 'kv' }, el('span', { class: 'kv-k' }, '日期'), el('span', { class: 'kv-v' }, fmtDate(r.at))),
          el('div', { class: 'kv' }, el('span', { class: 'kv-k' }, '重复'),
            el('span', { class: 'kv-v' }, r.repeat === 'monthly' ? '每月' : r.repeat === 'yearly' ? '每年' : '不重复'))
        )
      ),
      foot: el('div', { class: 'stack', style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        el('button', { class: 'btn primary block', onclick: doComplete }, '标记完成'),
        el('button', { class: 'btn ghost block', onclick: () => { sheet.close(); setTimeout(() => this.openReminderForm(r), 80); } }, '编辑'),
        el('button', {
          class: 'btn danger block',
          onclick: async () => {
            if (await confirmSheet('删除这条提醒？', { danger: true, okText: '删除' })) {
              await db.del('reminders', r.id);
              sheet.close();
              this.reload();
              toast('已删除', 'check');
            }
          }
        }, '删除')
      )
    });
  },

  /* ---------- 日历导出 ---------- */
  exportICS() {
    const items = this.derived.rem.all;
    if (!items.length) { toast('现在没有提醒可以导出'); return; }

    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
    const fmtUTC = (dt) => dt.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
    // 提醒当天早上 9:00（东八区）触发，提前 30 分钟响
    const baseUTC = (ymd) => {
      const [y, m, d] = ymd.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 1, 0, 0));
    };

    const events = items.map((it) => {
      const start = baseUTC(it.at);
      const end = new Date(start.getTime() + 3600000);
      return [
        'BEGIN:VEVENT',
        `UID:${it.id.replace(/[^a-zA-Z0-9]/g, '')}-${it.at}@bobodiary`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${fmtUTC(start)}`,
        `DTEND:${fmtUTC(end)}`,
        `SUMMARY:${esc('波波 · ' + it.title)}`,
        `DESCRIPTION:${esc([it.kind, it.sub, '来自波波日记'].filter(Boolean).join(' / '))}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(it.title)}`,
        'END:VALARM',
        'END:VEVENT'
      ].join('\r\n');
    });

    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bobo Diary//Pet Log//ZH',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:波波日记提醒',
      ...events, 'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const name = `波波日记提醒-${items.length}项.ics`;
    const file = new File([blob], name, { type: 'text/calendar' });

    const fallback = () => {
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('已导出，用「文件」打开即可导入日历', '', 3200);
    };

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: '波波日记提醒' })
        .then(() => toast('选择「日历」即可导入', 'check', 2600))
        .catch((e) => { if (e && e.name === 'AbortError') return; fallback(); });
    } else {
      fallback();
    }
  },

  /* ---------- 数据管理 ---------- */
  async doExport() {
    try {
      const data = await db.exportBackup();
      const text = JSON.stringify(data);
      const name = `波波日记备份-${today()}.json`;
      const blob = new Blob([text], { type: 'application/json' });

      // iPhone 上优先用系统分享（可存到「文件」）
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: '波波日记备份' });
          toast('备份已导出', 'check');
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('备份已导出', 'check');
    } catch (err) {
      console.error(err);
      toast('导出失败：' + (err.message || '未知错误'));
    }
  },

  async doImport(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const ok = await confirmSheet(
        `将用备份覆盖当前数据（${(data.records || []).length} 条记录）。继续吗？`,
        { okText: '覆盖导入' }
      );
      if (!ok) return;
      await db.importBackup(data);
      await this.reload();
      toast('恢复完成', 'check');
    } catch (err) {
      console.error(err);
      toast('导入失败：' + (err.message || '文件读不了'));
    }
  },

  async clearAll() {
    const ok = await confirmSheet('清空所有数据？包括照片，清空后无法恢复。', { danger: true, okText: '全部清空' });
    if (!ok) return;
    const sure = await confirmSheet('最后确认一次：建议先导出备份。', { danger: true, okText: '确认清空' });
    if (!sure) return;
    for (const s of ['records', 'reminders', 'supplies', 'photos']) await db.clear(s);
    db.revokeAllPhotoURLs();
    await db.seedIfEmpty();
    await this.reload();
    this.go('home');
    toast('已清空', 'check');
  },

  /* ---------- 帮助 ---------- */
  showInstallHelp() {
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const steps = standalone
      ? ['你现在已经在独立窗口里运行了 🎉', '想要更新，直接在 Safari 里打开网址即可', '数据都在本机，换手机前记得导出备份']
      : ['用 Safari 打开这个网页（不要用微信/QQ 内置浏览器）', '点底部中间的「分享」按钮', '往下找到「添加到主屏幕」，点「添加」', '桌面会出现一个图标，从它打开就是全屏 App'];

    openSheet({
      title: '添加到主屏幕',
      body: el('div', {
        style: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0 10px' }
      },
        ...steps.map((t, i) => el('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
          el('span', {
            style: {
              flex: 'none', width: '24px', height: '24px', borderRadius: '50%',
              background: 'var(--gold-bg)', color: 'var(--gold-ink)', display: 'grid',
              placeItems: 'center', fontSize: '12.5px', fontWeight: '700'
            }
          }, String(i + 1)),
          el('p', { style: { fontSize: '14.5px', lineHeight: '1.55', paddingTop: '2px' } }, t)
        ))
      )
    });
  },

  showAbout() {
    openSheet({
      title: '关于',
      body: el('div', { class: 'stack', style: { padding: '4px 0 12px' } },
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
          el('div', {
            style: {
              width: '56px', height: '56px', borderRadius: '16px', overflow: 'hidden', flex: 'none'
            },
            html: `<img src="assets/icons/icon-192.png" alt="" style="width:100%;height:100%;object-fit:cover">`
          }),
          el('div', {},
            el('div', { class: 'detail-title' }, '波波日记'),
            el('div', { class: 'detail-sub' }, '版本 1.0.0 · 宠物记录本')
          )
        ),
        el('p', { class: 'muted', style: { fontSize: '13.5px', lineHeight: '1.7' } },
          '所有记录与照片都保存在这台 iPhone 的浏览器本地存储里，不上传任何服务器，也没有账号。',
          el('br'), '因此：删除 App 或清除 Safari 数据会连数据一起删掉，请定期在「档案 → 导出备份」存一份。'
        )
      )
    });
  },

  registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    const reg = () => {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 注册失败', e));
    };
    // boot 是异步的，可能 load 已经过去了，这时要立刻注册
    if (document.readyState === 'complete') reg();
    else window.addEventListener('load', reg, { once: true });
  },

  installHint() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (!isIOS || standalone) return;
    if (localStorage.getItem('bobo_hint_shown')) return;
    localStorage.setItem('bobo_hint_shown', '1');
    setTimeout(() => {
      toast('点 Safari 的「分享」→「添加到主屏幕」，就能像 App 一样用', '', 4200);
    }, 1500);
  }
};

/* ---------------- 底栏 ---------------- */
function renderTabbar(app) {
  const bar = document.getElementById('tabbar');
  bar.textContent = '';

  for (const t of TABS) {
    if (t.k === 'add') {
      bar.append(el('button', {
        class: 'tab add', 'aria-label': '添加记录', onclick: () => app.openAdd()
      },
        el('span', { class: 'tab-add', html: icon('plus', 22) })
      ));
      continue;
    }
    const active = app.state.view === t.k;
    const badge = t.k === 'reminders' && app.derived.rem.overdue.length;
    const btn = el('button', {
      class: 'tab' + (active ? ' is-active' : ''),
      'aria-label': t.label,
      'aria-current': active ? 'page' : null,
      onclick: () => app.go(t.k)
    },
      el('span', { class: 'tab-icon', style: { position: 'relative', display: 'grid', placeItems: 'center' }, html: icon(t.icon, 23) }),
      el('span', { class: 'tab-label' }, t.label)
    );
    if (badge) {
      btn.firstChild.append(el('span', {
        style: {
          position: 'absolute', top: '-2px', right: '-2px', width: '7px', height: '7px',
          borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 0 2px var(--card)'
        }
      }));
    }
    bar.append(btn);
  }
}

/* ---------------- 启动 ---------------- */
window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

app.boot();

// 方便调试
window.__bobo = app;
