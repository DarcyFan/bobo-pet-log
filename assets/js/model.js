/* 业务模型：记录类型定义、时间线筛选、提醒推导、统计 */

import { parseDate, dateStr, dayDiff, today, fmtMD, fmtDate } from './util.js';

export const fmtNum = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return String(Math.round(v * 100) / 100);
};

/* ---------------- 记录类型 ---------------- */
export const TYPES = {
  weight: {
    label: '体重', icon: 'scale', tone: 'gold', timeMode: 'datetime',
    fields: [
      { k: 'kg', label: '体重', type: 'number', step: '0.01', suffix: 'kg', required: true, placeholder: '0.98' }
    ],
    summary: (r) => (r.data.kg != null ? `${fmtNum(r.data.kg)} kg` : '')
  },
  feeding: {
    label: '喂食', icon: 'bowl', tone: 'blue', timeMode: 'datetime',
    fields: [
      { k: 'food', label: '食物', type: 'select', required: true,
        options: ['猫粮', '主食罐', '零食罐', '冻干', '生骨肉', '猫条零食', '营养品', '其他'] },
      { k: 'amount', label: '份量', type: 'number', step: '1', suffix: 'g', placeholder: '40' }
    ],
    summary: (r) => [r.data.food, r.data.amount ? `${fmtNum(r.data.amount)} g` : ''].filter(Boolean).join(' · ')
  },
  water: {
    label: '饮水', icon: 'drop', tone: 'blue', timeMode: 'datetime',
    fields: [
      { k: 'ml', label: '饮水量', type: 'number', step: '10', suffix: 'ml', required: true, placeholder: '60' }
    ],
    summary: (r) => (r.data.ml != null ? `${fmtNum(r.data.ml)} ml` : '')
  },
  memo: {
    label: '随手记', icon: 'camera', tone: 'violet', timeMode: 'datetime',
    fields: [],
    summary: () => ''
  },
  vaccine: {
    label: '疫苗', icon: 'shield', tone: 'green', timeMode: 'datetime',
    fields: [
      { k: 'name', label: '疫苗名称', type: 'text', required: true, placeholder: '妙三多 / 狂犬' },
      { k: 'dose', label: '针次', type: 'text', placeholder: '第 1 针' },
      { k: 'hospital', label: '医院', type: 'text', placeholder: '可选' },
      { k: 'nextDue', label: '下次接种', type: 'date', hint: '填了会自动出现在提醒里' }
    ],
    summary: (r) => [r.data.name, r.data.dose].filter(Boolean).join(' ')
  },
  deworm: {
    label: '驱虫', icon: 'bug', tone: 'green', timeMode: 'date',
    fields: [
      { k: 'kind', label: '类型', type: 'select', required: true, options: ['体内', '体外', '体内 + 体外'] },
      { k: 'product', label: '药品', type: 'text', placeholder: '海乐妙 / 大宠爱' },
      { k: 'nextDue', label: '下次驱虫', type: 'date', hint: '填了会自动出现在提醒里' }
    ],
    summary: (r) => [r.data.kind, r.data.product].filter(Boolean).join(' · ')
  },
  vet: {
    label: '就诊', icon: 'stethoscope', tone: 'rose', timeMode: 'datetime',
    fields: [
      { k: 'reason', label: '就诊原因', type: 'text', required: true, placeholder: '拉肚子 / 打疫苗前体检' },
      { k: 'hospital', label: '医院', type: 'text', placeholder: '可选' },
      { k: 'diagnosis', label: '诊断/处理', type: 'text', placeholder: '可选' },
      { k: 'cost', label: '花费', type: 'number', step: '1', suffix: '元', placeholder: '0' }
    ],
    summary: (r) => [r.data.reason, r.data.cost ? `¥${fmtNum(r.data.cost)}` : ''].filter(Boolean).join(' · ')
  },
  med: {
    label: '用药', icon: 'pill', tone: 'rose', timeMode: 'date',
    fields: [
      { k: 'name', label: '药品名称', type: 'text', required: true, placeholder: '益生菌 / 眼药水' },
      { k: 'dose', label: '用量', type: 'text', placeholder: '半包 / 1 滴' },
      { k: 'days', label: '天数', type: 'number', step: '1', suffix: '天', placeholder: '3' }
    ],
    summary: (r) => [r.data.name, r.data.dose].filter(Boolean).join(' · ')
  },
  care: {
    label: '护理', icon: 'scissors', tone: 'blue', timeMode: 'date',
    fields: [
      { k: 'kind', label: '项目', type: 'select', required: true,
        options: ['洗澡', '梳毛', '剪指甲', '清洁耳朵', '刷牙', '其他'] },
      { k: 'place', label: '在哪/谁做', type: 'text', placeholder: '可选' }
    ],
    summary: (r) => [r.data.kind, r.data.place].filter(Boolean).join(' · ')
  }
};

export const TYPE_ORDER = ['weight', 'feeding', 'water', 'memo', 'vaccine', 'deworm', 'vet', 'med', 'care'];

export const TYPE_GROUPS = [
  { title: '日常记录', keys: ['weight', 'feeding', 'water', 'memo'] },
  { title: '健康与护理', keys: ['vaccine', 'deworm', 'vet', 'med', 'care'] }
];

export const FILTERS = [
  { k: 'all', label: '全部', types: null },
  { k: 'weight', label: '体重', types: ['weight'] },
  { k: 'feed', label: '喂食', types: ['feeding', 'water'] },
  { k: 'health', label: '健康', types: ['vaccine', 'deworm', 'vet', 'med'] },
  { k: 'care', label: '护理', types: ['care'] },
  { k: 'photo', label: '相册', types: null, requirePhotos: true }
];

/* ---------------- 工具 ---------------- */
export function sortRecords(list, desc = true) {
  return list.slice().sort((a, b) => {
    const ta = parseDate(a.at)?.getTime() || 0;
    const tb = parseDate(b.at)?.getTime() || 0;
    return desc ? tb - ta : ta - tb;
  });
}

export function matchesFilter(rec, filterKey) {
  const f = FILTERS.find((x) => x.k === filterKey);
  if (!f) return true;
  if (f.requirePhotos && !((rec.photos || []).length)) return false;
  if (!f.types) return true;
  return f.types.includes(rec.type);
}

export function searchRecords(list, q) {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((r) => {
    const t = TYPES[r.type];
    const hay = [
      t ? t.label : '',
      t ? t.summary(r) : '',
      r.note || '',
      ...Object.values(r.data || {})
    ].join(' ').toLowerCase();
    return hay.includes(s);
  });
}

export function groupByMonth(list) {
  const out = [];
  let cur = null;
  for (const r of list) {
    const d = parseDate(r.at);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!cur || cur.key !== key) {
      cur = { key, label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`, items: [] };
      out.push(cur);
    }
    cur.items.push(r);
  }
  return out;
}

/* ---------------- 提醒 ---------------- */
function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function nextOccurrence(atStr, repeat, from = today()) {
  const src = parseDate(atStr);
  const base = parseDate(from);
  if (!src || !base) return atStr;
  const b = midnight(base);
  if (repeat === 'yearly') {
    let cand = new Date(b.getFullYear(), src.getMonth(), src.getDate());
    if (cand < b) cand = new Date(b.getFullYear() + 1, src.getMonth(), src.getDate());
    return dateStr(cand);
  }
  if (repeat === 'monthly') {
    const day = Math.min(src.getDate(), 28);
    let cand = new Date(b.getFullYear(), b.getMonth(), day);
    if (cand < b) cand = new Date(b.getFullYear(), b.getMonth() + 1, day);
    return dateStr(cand);
  }
  return atStr;
}

function withStatus(item, t = today()) {
  const n = dayDiff(t, item.at);
  item.days = n;
  item.status = n < 0 ? 'over' : n <= 7 ? 'soon' : 'later';
  item.label = n < 0 ? `逾期 ${Math.abs(n)} 天` : n === 0 ? '今天' : n === 1 ? '明天' : `${n} 天后`;
  return item;
}

/**
 * 汇总所有提醒来源：疫苗/驱虫记录、用品保质期、自定义提醒、生日
 */
export function buildReminders({ pet, records = [], reminders = [], supplies = [] }) {
  const items = [];
  const t = today();

  for (const r of records) {
    const d = r.data || {};
    if (r.type === 'vaccine' && d.nextDue) {
      items.push({
        id: 'v:' + r.id, icon: 'shield', tone: 'green', kind: '疫苗',
        title: `${d.name || '疫苗'} 下次接种`,
        sub: `上次 ${fmtMD(r.at)}`,
        at: d.nextDue, sourceId: r.id, cat: 'health'
      });
    }
    if (r.type === 'deworm' && d.nextDue) {
      items.push({
        id: 'd:' + r.id, icon: 'bug', tone: 'green', kind: '驱虫',
        title: `下次驱虫 · ${d.kind || '体内'}`,
        sub: `上次 ${fmtMD(r.at)}`,
        at: d.nextDue, sourceId: r.id, cat: 'health'
      });
    }
  }

  for (const s of supplies) {
    if (!s.expiresAt) continue;
    items.push({
      id: 's:' + s.id, icon: 'box', tone: 'gold', kind: '用品',
      title: `${s.name} 到期`,
      sub: s.category || '用品',
      at: s.expiresAt, sourceId: s.id, cat: 'supply'
    });
  }

  for (const r of reminders) {
    // 每年重复的自动滚到下一个纪念日；每月/一次性的保留原日期，过期就显示逾期
    const at = r.repeat === 'yearly' ? nextOccurrence(r.at, 'yearly', t) : r.at;
    items.push({
      id: 'r:' + r.id, icon: 'bell', tone: 'rose', kind: '提醒',
      title: r.title, sub: r.repeat === 'yearly' ? '每年' : r.repeat === 'monthly' ? '每月' : '一次性',
      at, sourceId: r.id, cat: 'custom', repeat: r.repeat || 'none',
      doneAt: r.doneAt || null
    });
  }

  // 生日
  if (pet && pet.birthday) {
    const b = parseDate(pet.birthday);
    if (b) {
      let cand = new Date(new Date().getFullYear(), b.getMonth(), b.getDate());
      if (cand < midnight(new Date())) cand = new Date(new Date().getFullYear() + 1, b.getMonth(), b.getDate());
      items.push({
        id: 'birthday', icon: 'sparkle', tone: 'violet', kind: '生日',
        title: `${pet.name} 生日`,
        sub: `每年 ${b.getMonth() + 1} 月 ${b.getDate()} 日`,
        at: dateStr(cand), cat: 'birthday'
      });
    }
  }

  items.forEach((it) => withStatus(it, t));

  const pending = items.filter((it) => !(it.doneAt && it.repeat === 'none'));
  const done = items.filter((it) => it.doneAt && it.repeat === 'none');

  // 生日属于「纪念日」，不算待办，不参与计数
  const birthdays = pending.filter((it) => it.cat === 'birthday');
  const todo = pending.filter((it) => it.cat !== 'birthday');

  todo.sort((a, b) => a.days - b.days);
  return {
    all: todo,
    overdue: todo.filter((i) => i.status === 'over'),
    soon: todo.filter((i) => i.status === 'soon'),
    later: todo.filter((i) => i.status === 'later'),
    done,
    urgent: todo.filter((i) => i.days <= 7),
    birthdays
  };
}

export function supplyStatus(s) {
  if (!s.expiresAt) return { status: 'later', label: '无期限' };
  const n = dayDiff(today(), s.expiresAt);
  return {
    status: n < 0 ? 'over' : n <= 15 ? 'soon' : 'later',
    label: n < 0 ? `已过期 ${Math.abs(n)} 天` : n === 0 ? '今天到期' : `${n} 天后`
  };
}

/* ---------------- 统计 ---------------- */
export function weightSeries(records, days = 0) {
  let list = records.filter((r) => r.type === 'weight' && r.data && r.data.kg != null);
  list = sortRecords(list, false);
  if (days > 0) {
    const from = Date.now() - days * 86400000;
    list = list.filter((r) => (parseDate(r.at)?.getTime() || 0) >= from);
  }
  return list.map((r) => ({
    t: parseDate(r.at)?.getTime() || 0,
    at: r.at,
    v: Number(r.data.kg),
    id: r.id
  }));
}

export function feedWeek(records, days = 7) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateStr(d);
    let g = 0;
    for (const r of records) {
      if (r.type !== 'feeding') continue;
      if ((r.at || '').slice(0, 10) !== key) continue;
      g += Number(r.data.amount) || 0;
    }
    out.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, g });
  }
  return out;
}

export function overview(records) {
  const todayStr = today();
  const todayRecs = records.filter((r) => (r.at || '').slice(0, 10) === todayStr);
  const weights = records.filter((r) => r.type === 'weight').length;
  const photos = records.filter((r) => (r.photos || []).length).length;
  return { count: records.length, todayCount: todayRecs.length, weights, photos };
}
