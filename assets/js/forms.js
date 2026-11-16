/* 各类表单与详情弹层 */

import {
  el, icon, openSheet, toast, confirmSheet, compressImage,
  nowStr, today, dateStr, dateTimeStr, fmtDate, fmtDT, fmtMD, parseDate, uid
} from './util.js';
import { TYPES, TYPE_GROUPS, fmtNum } from './model.js';
import { put, del, savePhoto, deletePhoto, getPhotoURL } from './db.js';

/* ---------------- 字段构建 ---------------- */
function buildFields(specs, values = {}) {
  const items = [];
  const nodes = [];

  for (const f of specs) {
    const wrap = el('div', { class: 'field' });
    wrap.dataset.k = f.k;
    const labelText = f.label + (f.required ? ' *' : '');
    wrap.append(el('div', { class: 'field-label' }, labelText));

    let getValue;

    if (f.type === 'select') {
      const box = el('div', { class: 'field-box' });
      const selWrap = el('div', { class: 'select-wrap' });
      const sel = el('select', {});
      const opts = (f.options || []).slice();
      const cur = values[f.k];
      if (cur && !opts.includes(cur)) opts.unshift(cur);
      for (const o of opts) sel.append(el('option', { value: o }, o));
      if (!f.required) sel.prepend(el('option', { value: '' }, '未选择'));
      sel.value = cur != null && cur !== '' ? cur : (f.required ? (opts[0] || '') : '');
      selWrap.append(sel);
      box.append(selWrap);
      wrap.append(box);
      getValue = () => sel.value;
    } else if (f.type === 'date' || f.type === 'datetime') {
      const box = el('div', { class: 'field-box' });
      const input = el('input', {
        type: f.type === 'date' ? 'date' : 'datetime-local',
        value: values[f.k] || ''
      });
      box.append(input);
      wrap.append(box);
      getValue = () => input.value;
    } else if (f.type === 'textarea') {
      const box = el('div', { class: 'field-box' });
      const ta = el('textarea', { placeholder: f.placeholder || '', rows: '3' });
      ta.value = values[f.k] || '';
      box.append(ta);
      wrap.append(box);
      wrap.append(el('div', { class: 'field-hint' }, f.hint || ''));
      getValue = () => ta.value;
    } else {
      const box = el('div', { class: 'field-box' });
      const input = el('input', {
        type: 'text',
        inputmode: f.type === 'number' ? 'decimal' : undefined,
        placeholder: f.placeholder || '',
        value: values[f.k] != null ? values[f.k] : ''
      });
      box.append(input);
      if (f.suffix) box.append(el('span', { class: 'field-suffix' }, f.suffix));
      wrap.append(box);
      getValue = () => input.value.trim();
    }

    if (f.hint && f.type !== 'textarea') {
      wrap.append(el('div', { class: 'field-hint' }, f.hint));
    }

    items.push({ ...f, wrap, get: getValue });
    nodes.push(wrap);
  }

  return {
    nodes,
    items,
    read() {
      const out = {};
      for (const it of items) out[it.k] = it.get();
      return out;
    },
    validate() {
      let firstBad = null;
      for (const it of items) {
        const v = it.get();
        const empty = v == null || String(v).trim() === '' || v === '';
        const bad = it.required && empty;
        it.wrap.classList.toggle('invalid', bad);
        if (bad && !firstBad) firstBad = it.wrap;
      }
      if (firstBad) {
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('还有必填项没填');
        return false;
      }
      return true;
    }
  };
}

/* ---------------- 照片 ---------------- */
function photoEditor(initialIds = [], onChange) {
  const items = (initialIds || []).map((id) => ({ kind: 'old', id }));
  const grid = el('div', { class: 'photo-grid' });

  async function render() {
    grid.textContent = '';
    for (const it of items) {
      const cell = el('div', { class: 'photo-cell' });
      const img = el('img', { alt: '' });
      if (it.kind === 'old') {
        if (it.url) img.src = it.url;
        else { it.url = await getPhotoURL(it.id); if (it.url) img.src = it.url; }
      } else {
        img.src = it.url;
      }
      const rm = el('button', {
        class: 'photo-rm', type: 'button', 'aria-label': '移除照片',
        html: icon('close', 13),
        onclick: (e) => {
          e.stopPropagation();
          items.splice(items.indexOf(it), 1);
          if (it.kind === 'new' && it.url) URL.revokeObjectURL(it.url);
          render(); onChange && onChange();
        }
      });
      cell.append(img, rm);
      grid.append(cell);
    }
    grid.append(el('button', {
      class: 'photo-add', type: 'button', html: icon('camera', 22),
      onclick: () => fileInput.click()
    }));
  }

  const fileInput = el('input', {
    type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' },
    onchange: async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      for (const f of files) {
        try {
          const blob = await compressImage(f);
          items.push({ kind: 'new', blob, url: URL.createObjectURL(blob) });
        } catch (err) {
          toast('有一张照片读取失败');
        }
      }
      render(); onChange && onChange();
    }
  });

  return {
    node: el('div', {}, el('div', { class: 'field-label', style: { marginBottom: '8px' } }, '照片'), grid, fileInput),
    items,
    /** 提交时落盘，返回最终 id 列表 */
    async commit() {
      const ids = [];
      for (const it of items) {
        if (it.kind === 'old') ids.push(it.id);
        else ids.push(await savePhoto(it.blob));
      }
      return ids;
    },
    cleanup() {
      items.forEach((it) => { if (it.kind === 'new' && it.url) URL.revokeObjectURL(it.url); });
    }
  };
}

function photoViewer(url) {
  const v = el('div', { class: 'viewer' },
    el('img', { src: url, alt: '' }),
    el('button', { class: 'viewer-close', onclick: () => v.remove(), html: icon('close', 20) })
  );
  document.body.append(v);
}

/* =========================================================
   新增记录入口
   ========================================================= */
export function openAddPicker(app) {
  const body = el('div', {});
  for (const g of TYPE_GROUPS) {
    body.append(el('div', { class: 'sec-title', style: { margin: '4px 2px 10px' } }, g.title));
    body.append(el('div', { class: 'type-grid', style: { marginBottom: '16px' } },
      ...g.keys.map((k) => {
        const def = TYPES[k];
        return el('button', {
          class: 'type-btn',
          onclick: () => { sheet.close(); setTimeout(() => openRecordForm(app, k), 60); }
        },
          el('span', { class: 'quick-i tone-' + def.tone, html: icon(def.icon, 19) }),
          el('span', { class: 'type-t' }, def.label)
        );
      })
    ));
  }

  const sheet = openSheet({ title: '记录什么？', body });
  return sheet;
}

/* =========================================================
   记录表单
   ========================================================= */
export function openRecordForm(app, typeKey, existing = null) {
  const def = TYPES[typeKey];
  if (!def) return;

  const rec = existing
    ? { ...existing, data: { ...(existing.data || {}) }, photos: (existing.photos || []).slice() }
    : {
      id: null, type: typeKey,
      at: def.timeMode === 'date' ? today() : dateTimeStr(new Date()),
      data: {}, note: '', photos: []
    };

  const specs = [];
  const vals = {};
  for (const f of def.fields) vals[f.k] = rec.data[f.k] != null ? rec.data[f.k] : '';
  specs.push(...def.fields);

  const timeSpec = {
    k: '__at', label: def.timeMode === 'date' ? '日期' : '时间',
    type: def.timeMode === 'date' ? 'date' : 'datetime', required: true
  };
  vals.__at = def.timeMode === 'date'
    ? (existing ? (rec.at || '').slice(0, 10) : today())
    : (existing ? rec.at : dateTimeStr(new Date()));
  specs.push(timeSpec);

  specs.push({ k: '__note', label: '文字备注', type: 'textarea', placeholder: '当时发生了什么？' });
  vals.__note = rec.note || '';

  const form = el('div', { class: 'form' });
  const fields = buildFields(specs, vals);
  form.append(...fields.nodes);

  const photos = photoEditor(rec.photos, null);
  form.append(photos.node);

  const originalPhotoIds = (rec.photos || []).slice();

  const saveBtn = el('button', { class: 'btn primary', onclick: submit }, existing ? '保存修改' : '保存记录');
  const foot = el('div', { style: { display: 'flex', gap: '10px' } }, saveBtn);

  if (existing) {
    const delBtn = el('button', {
      class: 'btn danger', style: { flex: '0 0 auto', width: '52px' }, 'aria-label': '删除',
      html: icon('trash', 19),
      onclick: async () => {
        if (await confirmSheet('删除这条记录？删掉就找不回来了。', { danger: true, okText: '删除' })) {
          for (const id of rec.photos || []) await deletePhoto(id);
          await del('records', rec.id);
          sheet.close();
          app.reload();
          toast('已删除', 'check');
        }
      }
    });
    foot.prepend(delBtn);
  }

  const sheet = openSheet({ title: (existing ? '编辑' : '记录') + def.label, body: form, foot });

  async function submit() {
    if (!fields.validate()) return;
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中…';
    try {
      const raw = fields.read();
      const at = raw.__at;
      const note = (raw.__note || '').trim();
      delete raw.__at;
      delete raw.__note;

      const data = {};
      for (const f of def.fields) {
        let v = raw[f.k];
        if (f.type === 'number') {
          if (v === '' || v == null) { data[f.k] = null; continue; }
          const n = Number(v);
          if (!isFinite(n)) { toast(`${f.label}请填数字`); saveBtn.disabled = false; saveBtn.textContent = existing ? '保存修改' : '保存记录'; return; }
          data[f.k] = n;
        } else {
          data[f.k] = v;
        }
      }

      const photosIds = await photos.commit();
      const removed = originalPhotoIds.filter((id) => !photosIds.includes(id));

      const out = {
        id: rec.id || uid('r_'),
        type: typeKey,
        at,
        data,
        note,
        photos: photosIds,
        createdAt: rec.createdAt || nowStr(),
        updatedAt: nowStr()
      };
      await put('records', out);
      for (const id of removed) await deletePhoto(id);

      sheet.close();
      app.reload();
      toast(existing ? '已更新' : '已记录', 'check');
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? '保存修改' : '保存记录';
      toast('保存失败：' + (err.message || '未知错误'));
    }
  }

  const onClose = () => photos.cleanup();
  return { sheet, onClose };
}

/* =========================================================
   记录详情
   ========================================================= */
export async function openRecordDetail(app, rec) {
  const def = TYPES[rec.type] || { label: rec.type, icon: 'note', tone: 'gold', fields: [], summary: () => '' };
  const body = el('div', {});

  body.append(el('div', { class: 'detail-hero' },
    el('span', { class: 'quick-i tone-' + def.tone, html: icon(def.icon, 22) }),
    el('div', {},
      el('div', { class: 'detail-title' }, def.label),
      el('div', { class: 'detail-sub' }, def.timeMode === 'date' ? fmtDate(rec.at) : fmtDT(rec.at))
    )
  ));

  const rows = [];
  for (const f of def.fields) {
    let v = rec.data ? rec.data[f.k] : '';
    if (v == null || v === '') continue;
    if (f.type === 'date') v = fmtDate(v);
    else if (f.type === 'number' && f.suffix) v = fmtNum(v) + ' ' + f.suffix;
    else if (f.type === 'number' && f.k === 'kg') v = fmtNum(v) + ' kg';
    else if (f.type === 'number' && f.k === 'cost') v = '¥' + fmtNum(v);
    rows.push([f.label, v]);
  }
  if (rows.length) {
    body.append(el('div', { class: 'card', style: { background: 'var(--card-2)', border: '0', padding: '2px 14px', marginTop: '4px' } },
      ...rows.map(([k, v]) => el('div', { class: 'kv' }, el('span', { class: 'kv-k' }, k), el('span', { class: 'kv-v' }, String(v))))
    ));
  }

  if ((rec.note || '').trim()) body.append(el('div', { class: 'detail-note' }, rec.note));

  if ((rec.photos || []).length) {
    const grid = el('div', { class: 'detail-photos' + (rec.photos.length === 1 ? ' single' : '') });
    for (const pid of rec.photos) {
      const img = el('img', { alt: '' });
      img.dataset.pid = pid;
      img.addEventListener('click', async () => {
        const url = await getPhotoURL(pid);
        if (url) photoViewer(url);
      });
      grid.append(img);
    }
    body.append(grid);
  }

  const editBtn = el('button', {
    class: 'btn primary block',
    onclick: () => { sheet.close(); setTimeout(() => openRecordForm(app, rec.type, rec), 80); }
  }, '编辑');

  const sheet = openSheet({
    title: '',
    body,
    foot: el('div', { style: { display: 'flex', gap: '10px' } }, editBtn)
  });

  // 详情里的照片异步填充
  body.querySelectorAll('img[data-pid]').forEach(async (img) => {
    const url = await getPhotoURL(img.dataset.pid);
    if (url) img.src = url;
  });

  return sheet;
}

/* =========================================================
   宠物档案表单
   ========================================================= */
export function openPetForm(app) {
  const pet = app.state.pet;
  const specs = [
    { k: 'name', label: '名字', type: 'text', required: true },
    { k: 'species', label: '种类', type: 'select', options: ['猫', '狗', '其他'] },
    { k: 'breed', label: '品种', type: 'text', placeholder: '英国长毛猫' },
    { k: 'variety', label: '品相/花色', type: 'text', placeholder: '长毛蓝金渐层' },
    { k: 'sex', label: '性别', type: 'select', options: ['公', '母', '未知'] },
    { k: 'birthday', label: '生日', type: 'date' },
    { k: 'homeDate', label: '到家日期', type: 'date' },
    { k: 'vet', label: '常去医院', type: 'text', placeholder: '可选' },
    { k: 'microchip', label: '芯片号', type: 'text', placeholder: '可选' },
    { k: 'notes', label: '备注', type: 'textarea', placeholder: '性格、过敏、忌口…' }
  ];
  const vals = {};
  for (const s of specs) vals[s.k] = pet[s.k] != null ? pet[s.k] : '';

  const form = el('div', { class: 'form' });
  const fields = buildFields(specs, vals);
  form.append(...fields.nodes);

  // 头像
  const avatarState = { id: pet.avatarPhotoId || null, blob: null };
  const avatarImg = el('img', { alt: '' });
  const avatarBox = el('button', {
    type: 'button',
    style: {
      width: '78px', height: '78px', borderRadius: '24px', overflow: 'hidden',
      background: 'linear-gradient(160deg,#E7C894,#C79A55)', display: 'grid',
      placeItems: 'center', color: '#fff', flex: 'none'
    },
    html: icon('cat', 34)
  });
  if (pet.avatarPhotoId) {
    getPhotoURL(pet.avatarPhotoId).then((u) => { if (u) { avatarBox.textContent = ''; avatarBox.append(avatarImg); avatarImg.src = u; } });
  }
  const avatarInput = el('input', {
    type: 'file', accept: 'image/*', style: { display: 'none' },
    onchange: async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const blob = await compressImage(f, 800, 0.86);
        avatarState.blob = blob;
        avatarBox.textContent = '';
        avatarBox.append(avatarImg);
        avatarImg.src = URL.createObjectURL(blob);
      } catch (err) { toast('头像读取失败'); }
    }
  });
  avatarBox.addEventListener('click', () => avatarInput.click());

  form.prepend(el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '2px 2px 6px' } },
    avatarBox, avatarInput,
    el('div', {},
      el('div', { class: 'row-t' }, '头像'),
      el('div', { class: 'row-s' }, '点左边的方块换一张')
    )
  ));

  const saveBtn = el('button', { class: 'btn primary', onclick: submit }, '保存');
  const sheet = openSheet({ title: '宠物档案', body: form, foot: el('div', { style: { display: 'flex' } }, saveBtn) });

  async function submit() {
    if (!fields.validate()) return;
    saveBtn.disabled = true; saveBtn.textContent = '保存中…';
    try {
      const raw = fields.read();
      let avatarPhotoId = avatarState.id;
      if (avatarState.blob) {
        avatarPhotoId = await savePhoto(avatarState.blob);
        if (avatarState.id) await deletePhoto(avatarState.id);
      }
      const out = { ...pet, ...raw, avatarPhotoId, updatedAt: nowStr() };
      await put('pet', out);
      sheet.close();
      app.reload();
      toast('档案已保存', 'check');
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false; saveBtn.textContent = '保存';
      toast('保存失败');
    }
  }

  return sheet;
}

/* =========================================================
   自定义提醒
   ========================================================= */
export function openReminderForm(app, existing = null) {
  const specs = [
    { k: 'title', label: '提醒内容', type: 'text', required: true, placeholder: '买猫砂 / 复诊' },
    { k: 'at', label: '日期', type: 'date', required: true },
    { k: 'repeat', label: '重复', type: 'select', options: ['不重复', '每月', '每年'] }
  ];
  const vals = {
    title: existing ? existing.title : '',
    at: existing ? existing.at : today(),
    repeat: existing ? (existing.repeat === 'monthly' ? '每月' : existing.repeat === 'yearly' ? '每年' : '不重复') : '不重复'
  };
  const fields = buildFields(specs, vals);
  const form = el('div', { class: 'form' }, ...fields.nodes);
  const saveBtn = el('button', { class: 'btn primary', onclick: submit }, existing ? '保存' : '添加提醒');
  const sheet = openSheet({ title: existing ? '编辑提醒' : '新建提醒', body: form, foot: el('div', { style: { display: 'flex' } }, saveBtn) });

  async function submit() {
    if (!fields.validate()) return;
    const raw = fields.read();
    const repeat = raw.repeat === '每月' ? 'monthly' : raw.repeat === '每年' ? 'yearly' : 'none';
    const out = {
      id: existing ? existing.id : uid('rm_'),
      title: raw.title.trim(),
      at: raw.at,
      repeat,
      doneAt: existing ? (existing.doneAt || null) : null,
      createdAt: existing ? existing.createdAt : nowStr()
    };
    await put('reminders', out);
    sheet.close();
    app.reload();
    toast(existing ? '已更新' : '提醒已添加', 'check');
  }
  return sheet;
}

/* =========================================================
   用品库存
   ========================================================= */
export function openSupplyForm(app, existing = null) {
  const specs = [
    { k: 'name', label: '名称', type: 'text', required: true, placeholder: '渴望鸡肉猫粮 1.8kg' },
    { k: 'category', label: '类别', type: 'select', options: ['猫粮', '罐头', '零食', '药品', '猫砂', '用品', '其他'] },
    { k: 'openedAt', label: '开封日期', type: 'date' },
    { k: 'expiresAt', label: '到期日期', type: 'date', hint: '填了会在提醒里倒计时' }
  ];
  const vals = {};
  for (const s of specs) vals[s.k] = existing && existing[s.k] ? existing[s.k] : '';

  const fields = buildFields(specs, vals);
  const form = el('div', { class: 'form' }, ...fields.nodes);
  const saveBtn = el('button', { class: 'btn primary', onclick: submit }, existing ? '保存' : '添加');
  const foot = el('div', { style: { display: 'flex', gap: '10px' } }, saveBtn);

  if (existing) {
    foot.prepend(el('button', {
      class: 'btn danger', style: { flex: '0 0 auto', width: '52px' }, 'aria-label': '删除',
      html: icon('trash', 19),
      onclick: async () => {
        if (await confirmSheet('删除这条用品记录？', { danger: true, okText: '删除' })) {
          await del('supplies', existing.id);
          sheet.close(); app.reload(); toast('已删除', 'check');
        }
      }
    }));
  }
  const sheet = openSheet({ title: existing ? '编辑用品' : '添加用品', body: form, foot });

  async function submit() {
    if (!fields.validate()) return;
    const raw = fields.read();
    const out = {
      id: existing ? existing.id : uid('sp_'),
      name: raw.name.trim(),
      category: raw.category,
      openedAt: raw.openedAt || '',
      expiresAt: raw.expiresAt || '',
      createdAt: existing ? existing.createdAt : nowStr()
    };
    await put('supplies', out);
    sheet.close(); app.reload(); toast('已保存', 'check');
  }
  return sheet;
}
