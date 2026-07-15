// app.js — Water Sale System frontend logic (Vanilla JS SPA, no build step needed)

const appEl = document.getElementById('app');

/* ============================== Helpers ============================== */

function formatMoney(n) {
  n = Number(n) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ₭';
}

function formatNumber(n) {
  return (Number(n) || 0).toLocaleString('en-US');
}

function showToast(message, type) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ແປງເບີໂທ (8 ໂຕເລກ ຫຼື ຮູບແບບອື່ນ) ໃຫ້ເປັນລິ້ງ WhatsApp ອັດຕະໂນມັດ (ລະຫັດປະເທດລາວ 856)
function whatsappLink(rawPhone) {
  if (!rawPhone) return null;
  let digits = String(rawPhone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('856')) return `https://wa.me/${digits}`;
  if (digits.startsWith('0')) digits = digits.substring(1);
  return `https://wa.me/856${digits}`;
}

function whatsappButtonHtml(rawPhone, label) {
  const link = whatsappLink(rawPhone);
  if (!link) return '';
  return `<a class="wa-btn" href="${link}" target="_blank" rel="noopener">💬 ${escapeHtml(label || 'WhatsApp')}</a>`;
}

/* ============================== Bootstrapping ============================== */

function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const session = getSession();
  if (!session) {
    renderLoginView();
  } else if (session.role === 'admin') {
    renderAdminApp(session);
  } else {
    renderAgentApp(session);
  }
}

document.addEventListener('DOMContentLoaded', init);

/* ============================== Login View ============================== */

function renderLoginView(errorMsg) {
  appEl.innerHTML = '';
  const screen = el(`
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C12 2 5 11 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 11 12 2 12 2Z"
              fill="white" fill-opacity="0.95"/>
          </svg>
        </div>
        <h1 class="login-title">ລະບົບຂາຍນ້ຳດື່ມ</h1>
        <p class="login-subtitle">ເຂົ້າສູ່ລະບົບເພື່ອຈັດການສະຕັອກ ແລະ ການຂາຍ</p>
        ${errorMsg ? `<div class="error-box">${escapeHtml(errorMsg)}</div>` : ''}
        <form id="login-form">
          <div class="field">
            <label>ຊື່ຜູ້ໃຊ້ (Username)</label>
            <input type="text" id="login-username" autocomplete="username" required>
          </div>
          <div class="field">
            <label>ລະຫັດຜ່ານ (Password)</label>
            <input type="password" id="login-password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block" id="login-submit-btn">ເຂົ້າສູ່ລະບົບ</button>
        </form>
        <p class="login-demo-note">ຕົວແທນ ແລະ ຜູ້ບໍລິຫານ ໃຊ້ໜ້າດຽວກັນນີ້ ລະບົບຈະພາໄປໜ້າທີ່ຖືກຕ້ອງອັດຕະໂນມັດ</p>
      </div>
    </div>
  `);
  appEl.appendChild(screen);

  screen.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.textContent = 'ກຳລັງກວດສອບ...';
    try {
      const data = await apiCall('login', { username, password });
      saveSession(data);
      showToast('ເຂົ້າສູ່ລະບົບສຳເລັດ', 'success');
      if (data.role === 'admin') renderAdminApp(data);
      else renderAgentApp(data);
    } catch (err) {
      renderLoginView(err.message);
    }
  });
}

function logout() {
  clearSession();
  renderLoginView();
}

/* ============================== Admin App ============================== */

const ADMIN_NAV = [
  { key: 'dashboard', label: 'ພາບລວມ (Dashboard)', icon: '📊' },
  { key: 'stock', label: 'ຈັດການສະຕັອກ', icon: '📦' },
  { key: 'sell', label: 'ຂາຍໃຫ້ຕົວແທນ', icon: '🚚' },
  { key: 'purchase_requests', label: 'ຄຳສັ່ງຊື້ / ຂໍ້ຄວາມ', icon: '📥' },
  { key: 'agents', label: 'ຈັດການຕົວແທນ', icon: '👥' },
  { key: 'prices', label: 'ຕັ້ງລາຄາ', icon: '💰' },
  { key: 'reports', label: 'ລາຍງານ', icon: '📑' }
];

let adminState = { view: 'dashboard' };

function renderAdminApp(session) {
  appEl.innerHTML = '';
  const shell = el(`
    <div class="admin-shell">
      <div class="sidebar">
        <div class="sidebar-brand">
          <span class="sidebar-dot"></span> ໂຮງງານ Admin
        </div>
        <div id="admin-nav"></div>
        <div class="sidebar-footer">
          <div class="sidebar-user">👤 ${escapeHtml(session.agent_name || session.username)}</div>
          <button class="btn btn-outline btn-block btn-sm" id="admin-logout-btn" style="color:#fff;border-color:rgba(255,255,255,0.4)">ອອກຈາກລະບົບ</button>
        </div>
      </div>
      <div class="main-content" id="admin-main"></div>
    </div>
  `);
  appEl.appendChild(shell);

  const nav = shell.querySelector('#admin-nav');
  ADMIN_NAV.forEach((item) => {
    const btn = el(`<button class="nav-item" data-key="${item.key}">${item.icon} ${item.label}</button>`);
    btn.addEventListener('click', () => navigateAdmin(item.key));
    nav.appendChild(btn);
  });

  shell.querySelector('#admin-logout-btn').addEventListener('click', logout);

  navigateAdmin('dashboard');
  refreshAdminUnreadBadge();
}

async function refreshAdminUnreadBadge() {
  try {
    const res = await apiCall('get_admin_unread_count');
    const navBtn = document.querySelector('.nav-item[data-key="purchase_requests"]');
    if (!navBtn) return;
    const existing = navBtn.querySelector('.nav-badge');
    if (existing) existing.remove();
    if (res.count > 0) {
      const badge = el(`<span class="nav-badge">${res.count > 99 ? '99+' : res.count}</span>`);
      navBtn.appendChild(badge);
    }
  } catch (err) { /* ບໍ່ຕ້ອງລົບກວນຜູ້ໃຊ້ ຖ້າດຶງບໍ່ໄດ້ */ }
}

function navigateAdmin(view) {
  adminState.view = view;
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.key === view);
  });
  const main = document.getElementById('admin-main');
  main.innerHTML = '<div class="spinner"></div>';

  const renderers = {
    dashboard: renderAdminDashboard,
    stock: renderAdminStock,
    sell: renderAdminSell,
    purchase_requests: renderAdminPurchaseRequests,
    agents: renderAdminAgents,
    prices: renderAdminPrices,
    reports: renderAdminReports
  };
  renderers[view](main);
  refreshAdminUnreadBadge();
}

async function renderAdminDashboard(main) {
  try {
    const data = await apiCall('get_dashboard');
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ພາບລວມລະບົບ</h1>
          <div class="page-subtitle">ສະຫຼຸບສະຕັອກ ແລະ ຍອດຂາຍລ່າສຸດ</div>
        </div>
      </div>
      <div class="grid grid-3">
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍມື້ນີ້</div>
          <div class="stat-value">${formatMoney(data.sales_today)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍ 7 ວັນ</div>
          <div class="stat-value">${formatMoney(data.sales_week)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍ 30 ວັນ</div>
          <div class="stat-value">${formatMoney(data.sales_month)}</div>
        </div>
      </div>

      <div class="section-title">⚠️ ສິນຄ້າໃກ້ໝົດ (${data.low_stock_alerts.length})</div>
      ${data.low_stock_alerts.length === 0
        ? '<div class="card"><div class="empty-state"><div class="icon">✅</div>ບໍ່ມີສິນຄ້າໃກ້ໝົດໃນຂະນະນີ້</div></div>'
        : renderTable(
            ['ສິນຄ້າ', 'ຄົງເຫຼືອ', 'ຂັ້ນຕ່ຳແຈ້ງເຕືອນ'],
            data.low_stock_alerts.map((s) => [
              escapeHtml(s.product_name),
              `<span class="badge badge-danger">${formatNumber(s.quantity)} ${escapeHtml(s.unit)}</span>`,
              formatNumber(s.min_stock_alert)
            ])
          )
      }

      <div class="section-title">📦 ສະຕັອກໂຮງງານທັງໝົດ</div>
      ${renderTable(
        ['ສິນຄ້າ', 'ຫົວໜ່ວຍ', 'ຄົງເຫຼືອ', 'ອັບເດດລ່າສຸດ'],
        data.factory_stock.map((s) => [
          escapeHtml(s.product_name),
          escapeHtml(s.unit),
          s.low_stock ? `<span class="badge badge-danger">${formatNumber(s.quantity)}</span>` : formatNumber(s.quantity),
          escapeHtml(s.last_updated)
        ])
      )}
    `;
  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

function renderTable(headers, rows) {
  if (rows.length === 0) {
    return '<div class="card"><div class="empty-state">ຍັງບໍ່ມີຂໍ້ມູນ</div></div>';
  }
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderErrorCard(msg) {
  return `<div class="card"><div class="error-box">${escapeHtml(msg)}</div></div>`;
}

async function renderAdminStock(main) {
  try {
    const [stock, products] = await Promise.all([apiCall('get_factory_stock'), apiCall('get_products')]);
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ຈັດການສະຕັອກໂຮງງານ</h1>
          <div class="page-subtitle">ເພີ່ມສະຕັອກຈາກການຜະລິດ ຫຼື ສ້າງສິນຄ້າໃໝ່</div>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;margin-bottom:12px;">➕ ເພີ່ມສະຕັອກ (ຈາກການຜະລິດ)</div>
        <form id="add-stock-form" class="form-row">
          <div class="field">
            <label>ສິນຄ້າ</label>
            <select id="add-stock-product" required>
              ${products.map((p) => `<option value="${p.product_id}">${escapeHtml(p.product_name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>ຈຳນວນທີ່ຈະເພີ່ມ</label>
            <input type="number" id="add-stock-qty" min="1" required>
          </div>
          <button class="btn btn-primary" type="submit">ເພີ່ມສະຕັອກ</button>
        </form>
      </div>

      <div class="section-title">🆕 ສ້າງສິນຄ້າໃໝ່</div>
      <div class="card">
        <form id="new-product-form" class="form-row">
          <div class="field">
            <label>ຊື່ສິນຄ້າ</label>
            <input type="text" id="new-product-name" placeholder="ເຊັ່ນ ນ້ຳດື່ມຖັງ 20L" required>
          </div>
          <div class="field">
            <label>ຫົວໜ່ວຍ</label>
            <input type="text" id="new-product-unit" placeholder="ຖັງ / ແພັກ" required>
          </div>
          <div class="field">
            <label>ຂັ້ນຕ່ຳແຈ້ງເຕືອນ</label>
            <input type="number" id="new-product-min" min="0" value="10" required>
          </div>
          <button class="btn btn-accent" type="submit">ສ້າງສິນຄ້າ</button>
        </form>
      </div>

      <div class="section-title">ສະຕັອກປັດຈຸບັນ</div>
      ${renderTable(
        ['ສິນຄ້າ', 'ຫົວໜ່ວຍ', 'ຄົງເຫຼືອ', 'ອັບເດດລ່າສຸດ'],
        stock.map((s) => [
          escapeHtml(s.product_name),
          escapeHtml(s.unit),
          s.low_stock ? `<span class="badge badge-danger">${formatNumber(s.quantity)}</span>` : formatNumber(s.quantity),
          escapeHtml(s.last_updated)
        ])
      )}
    `;

    main.querySelector('#add-stock-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const product_id = document.getElementById('add-stock-product').value;
      const qty = document.getElementById('add-stock-qty').value;
      try {
        await apiCall('add_factory_stock', { product_id, qty });
        showToast('ເພີ່ມສະຕັອກສຳເລັດ', 'success');
        renderAdminStock(main);
      } catch (err) { showToast(err.message, 'error'); }
    });

    main.querySelector('#new-product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-product-name').value.trim();
      const unit = document.getElementById('new-product-unit').value.trim();
      const min_stock_alert = document.getElementById('new-product-min').value;
      try {
        await apiCall('create_product', { name, unit, min_stock_alert });
        showToast('ສ້າງສິນຄ້າສຳເລັດ', 'success');
        renderAdminStock(main);
      } catch (err) { showToast(err.message, 'error'); }
    });

  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

async function renderAdminSell(main) {
  try {
    const [agents, products, stock, prices] = await Promise.all([
      apiCall('get_agents'), apiCall('get_products'), apiCall('get_factory_stock'), apiCall('get_prices')
    ]);
    const stockMap = {};
    stock.forEach((s) => { stockMap[s.product_id] = s; });
    const priceMap = {};
    prices.forEach((p) => { priceMap[p.product_id] = p; });
    const activeAgents = agents.filter((a) => a.status === 'active');

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ຂາຍ/ໂອນສະຕັອກໃຫ້ຕົວແທນ</h1>
          <div class="page-subtitle">ຕັດສະຕັອກໂຮງງານ ແລະ ບວກເຂົ້າສະຕັອກຕົວແທນອັດຕະໂນມັດ</div>
        </div>
      </div>
      <div class="card" style="max-width:520px;">
        <form id="sell-form">
          <div class="field">
            <label>ເລືອກຕົວແທນ</label>
            <select id="sell-agent" required>
              ${activeAgents.length === 0 ? '<option value="">— ບໍ່ມີຕົວແທນທີ່ active —</option>' :
                activeAgents.map((a) => `<option value="${a.user_id}">${escapeHtml(a.agent_name)} (${escapeHtml(a.username)})</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>ເລືອກສິນຄ້າ</label>
            <select id="sell-product" required>
              ${products.map((p) => {
                const s = stockMap[p.product_id];
                return `<option value="${p.product_id}">${escapeHtml(p.product_name)} (ຄົງເຫຼືອ ${s ? formatNumber(s.quantity) : 0})</option>`;
              }).join('')}
            </select>
          </div>
          <div id="sell-price-hint" style="font-size:12.5px;margin-bottom:12px;"></div>
          <div class="field">
            <label>ຈຳນວນ</label>
            <input type="number" id="sell-qty" min="1" required>
          </div>
          <button class="btn btn-primary btn-block" type="submit" ${activeAgents.length === 0 ? 'disabled' : ''}>ຢືນຢັນການໂອນສະຕັອກ</button>
        </form>
      </div>
    `;

    const priceHintEl = main.querySelector('#sell-price-hint');
    const updatePriceHint = () => {
      const pid = main.querySelector('#sell-product').value;
      const price = priceMap[pid];
      const wholesale = price ? Number(price.wholesale_price) : 0;
      if (!wholesale) {
        priceHintEl.innerHTML = `<span style="color:var(--color-danger);font-weight:600;">⚠️ ສິນຄ້ານີ້ຍັງບໍ່ໄດ້ຕັ້ງລາຄາຂາຍສົ່ງ (ຈະຄິດເປັນ 0 ກີບ) — ໄປຕັ້ງລາຄາກ່ອນທີ່ໜ້າ "ຕັ້ງລາຄາ"</span>`;
      } else {
        priceHintEl.innerHTML = `<span style="color:var(--color-text-muted);">ລາຄາຂາຍສົ່ງ: <strong>${formatMoney(wholesale)}</strong> / ໜ່ວຍ</span>`;
      }
    };
    main.querySelector('#sell-product').addEventListener('change', updatePriceHint);
    updatePriceHint();

    main.querySelector('#sell-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const agent_id = document.getElementById('sell-agent').value;
      const product_id = document.getElementById('sell-product').value;
      const qty = document.getElementById('sell-qty').value;
      try {
        const res = await apiCall('sell_to_agent', { agent_id, product_id, qty });
        showToast(`ໂອນສະຕັອກສຳເລັດ, ຍອດລວມ ${formatMoney(res.total_amount)}`, 'success');
        renderAdminSell(main);
      } catch (err) { showToast(err.message, 'error'); }
    });
  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

async function renderAdminPurchaseRequests(main) {
  try {
    const [prs, agents, settings] = await Promise.all([
      apiCall('get_all_purchase_requests'), apiCall('get_agents'), apiCall('get_settings')
    ]);
    const activeAgents = agents.filter((a) => a.status === 'active');

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ຄຳສັ່ງຊື້ ແລະ ຂໍ້ຄວາມ</h1>
          <div class="page-subtitle">ຮັບ PR ສັ່ງເພີ່ມສະຕັອກຈາກຕົວແທນ ແລະ ສົ່ງແຈ້ງເຕືອນຫາຕົວແທນ</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div style="font-weight:700;margin-bottom:12px;">📱 ເບີ WhatsApp ຂອງໂຮງງານ</div>
        <div class="settings-inline">
          <div class="field" style="min-width:220px;">
            <label>ເບີໂທ (8 ໂຕເລກ)</label>
            <input type="text" id="factory-whatsapp-input" value="${escapeHtml(settings.factory_whatsapp || '')}" placeholder="ເຊັ່ນ 20xxxxxxx">
          </div>
          <button class="btn btn-primary btn-sm" id="save-whatsapp-btn">ບັນທຶກ</button>
          ${settings.factory_whatsapp ? whatsappButtonHtml(settings.factory_whatsapp, 'ທົດສອບ') : ''}
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div style="font-weight:700;">📢 ສົ່ງແຈ້ງເຕືອນຫາຕົວແທນ</div>
          <button class="btn btn-accent btn-sm" id="open-announcement-btn">✏️ ຂຽນຂໍ້ຄວາມແຈ້ງເຕືອນ</button>
        </div>
      </div>

      <div class="section-title">📥 ລາຍການຄຳສັ່ງຊື້ (${prs.length})</div>
      ${prs.length === 0
        ? '<div class="card"><div class="empty-state"><div class="icon">📭</div>ຍັງບໍ່ມີຄຳສັ່ງຊື້ເຂົ້າມາ</div></div>'
        : prs.map((pr) => `
          <div class="pr-card" data-id="${pr.request_id}">
            <div class="pr-card-row">
              <div>
                <div style="font-weight:700;font-size:14.5px;">${escapeHtml(pr.agent_name)}</div>
                <div class="pr-card-items">${pr.items.map((it) => `${escapeHtml(it.product_name)} x${formatNumber(it.qty)}`).join(', ')}</div>
              </div>
              <div style="text-align:right;">
                ${statusBadgeHtml(pr.status)}
                <div style="font-size:11.5px;color:var(--color-text-muted);margin-top:6px;">${escapeHtml(pr.created_at)}</div>
              </div>
            </div>
          </div>
        `).join('')
      }
    `;

    main.querySelectorAll('.pr-card').forEach((card) => {
      card.addEventListener('click', () => {
        const pr = prs.find((p) => p.request_id === card.dataset.id);
        openPurchaseRequestModal(pr, main);
      });
    });

    main.querySelector('#save-whatsapp-btn').addEventListener('click', async () => {
      const value = document.getElementById('factory-whatsapp-input').value.trim();
      try {
        await apiCall('update_setting', { key: 'factory_whatsapp', value });
        showToast('ບັນທຶກເບີ WhatsApp ສຳເລັດ', 'success');
        renderAdminPurchaseRequests(main);
      } catch (err) { showToast(err.message, 'error'); }
    });

    main.querySelector('#open-announcement-btn').addEventListener('click', () => {
      openAnnouncementModal(activeAgents, main);
    });

  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

function statusBadgeHtml(status) {
  const labels = {
    pending: 'ລໍຖ້າດຳເນີນການ', confirmed: 'ຢືນຢັນຄຳສັ່ງຊື້', producing: 'ກຳລັງຜະລິດ',
    shipping: 'ກຳລັງຈັດສົ່ງ', delivered: 'ສົ່ງເຖິງແລ້ວ', rejected: 'ປະຕິເສດ'
  };
  const classes = {
    pending: 'badge-warning', confirmed: 'badge-warning', producing: 'badge-warning',
    shipping: 'badge-warning', delivered: 'badge-success', rejected: 'badge-danger'
  };
  return `<span class="badge ${classes[status] || 'badge-warning'}">${labels[status] || status}</span>`;
}

const PR_FLOW_STEPS = [
  { key: 'pending', label: 'ລໍຖ້າດຳເນີນການ' },
  { key: 'confirmed', label: 'ຢືນຢັນຄຳສັ່ງຊື້' },
  { key: 'producing', label: 'ກຳລັງຜະລິດ' },
  { key: 'shipping', label: 'ກຳລັງຈັດສົ່ງ' },
  { key: 'delivered', label: 'ສົ່ງເຖິງແລ້ວ' }
];

function openPurchaseRequestModal(pr, main) {
  const currentIdx = PR_FLOW_STEPS.findIndex((s) => s.key === pr.status);
  const isRejected = pr.status === 'rejected';

  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal-box" style="max-width:520px;">
        <div class="modal-title">ຄຳສັ່ງຊື້ຈາກ ${escapeHtml(pr.agent_name)}</div>
        <div style="margin-bottom:6px;">${whatsappButtonHtml(pr.agent_phone, 'ຕິດຕໍ່ຕົວແທນ')}</div>

        <div style="margin-top:14px;font-weight:700;font-size:13.5px;">ລາຍການສິນຄ້າ:</div>
        <div class="table-wrap" style="margin-top:8px;">
          <table>
            <thead><tr><th>ສິນຄ້າ</th><th>ຈຳນວນ</th></tr></thead>
            <tbody>
              ${pr.items.map((it) => `<tr><td>${escapeHtml(it.product_name)}</td><td>${formatNumber(it.qty)} ${escapeHtml(it.unit || '')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${pr.note ? `<div class="error-box" style="background:var(--color-primary-light);color:var(--color-primary-dark);margin-top:12px;">📝 ໝາຍເຫດຈາກຕົວແທນ: ${escapeHtml(pr.note)}</div>` : ''}

        ${isRejected
          ? `<div class="error-box" style="margin-top:16px;">ຄຳສັ່ງຊື້ນີ້ຖືກປະຕິເສດແລ້ວ</div>`
          : `<div class="status-stepper">
              ${PR_FLOW_STEPS.map((s, idx) => `
                <div class="status-step ${idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : ''}">${escapeHtml(s.label)}</div>
              `).join('')}
            </div>`
        }

        <div class="field">
          <label>ໝາຍເຫດເຖິງຕົວແທນ (ທາງເລືອກ)</label>
          <input type="text" id="pr-admin-note" placeholder="ເຊັ່ນ ຈະຮອດພາຍໃນ 2 ວັນ">
        </div>

        <div class="status-flow-actions">
          ${!isRejected && currentIdx < PR_FLOW_STEPS.length - 1
            ? `<button class="btn btn-primary" id="pr-advance-btn">✅ ອັບເດດເປັນ: ${escapeHtml(PR_FLOW_STEPS[currentIdx + 1].label)}</button>`
            : ''}
          ${pr.status === 'pending' ? `<button class="btn btn-danger" id="pr-reject-btn">❌ ປະຕິເສດຄຳສັ່ງຊື້</button>` : ''}
          <button class="btn btn-outline" id="pr-close-btn">ປິດ</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);

  overlay.querySelector('#pr-close-btn').addEventListener('click', () => overlay.remove());

  const advanceBtn = overlay.querySelector('#pr-advance-btn');
  if (advanceBtn) {
    advanceBtn.addEventListener('click', async () => {
      const nextStatus = PR_FLOW_STEPS[currentIdx + 1].key;
      const adminNote = overlay.querySelector('#pr-admin-note').value.trim();
      try {
        await apiCall('update_purchase_request_status', { request_id: pr.request_id, status: nextStatus, admin_note: adminNote });
        showToast('ອັບເດດສະຖານະສຳເລັດ', 'success');
        overlay.remove();
        renderAdminPurchaseRequests(main);
      } catch (err) { showToast(err.message, 'error'); }
    });
  }

  const rejectBtn = overlay.querySelector('#pr-reject-btn');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', async () => {
      const adminNote = overlay.querySelector('#pr-admin-note').value.trim();
      try {
        await apiCall('update_purchase_request_status', { request_id: pr.request_id, status: 'rejected', admin_note: adminNote });
        showToast('ປະຕິເສດຄຳສັ່ງຊື້ແລ້ວ', 'success');
        overlay.remove();
        renderAdminPurchaseRequests(main);
      } catch (err) { showToast(err.message, 'error'); }
    });
  }
}

function openAnnouncementModal(activeAgents, main) {
  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-title">ສົ່ງແຈ້ງເຕືອນຫາຕົວແທນ</div>
        <div class="field">
          <label>ສົ່ງຫາ</label>
          <select id="announce-target">
            <option value="ALL">📢 ທຸກຕົວແທນ (Active)</option>
            ${activeAgents.map((a) => `<option value="${a.user_id}">${escapeHtml(a.agent_name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>ຫົວຂໍ້</label>
          <input type="text" id="announce-title" placeholder="ເຊັ່ນ ແຈ້ງປິດຮັບອໍເດີ້ມື້ພັກ">
        </div>
        <div class="field">
          <label>ຂໍ້ຄວາມ</label>
          <input type="text" id="announce-message" placeholder="ລາຍລະອຽດຂໍ້ຄວາມ...">
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="announce-cancel">ຍົກເລີກ</button>
          <button class="btn btn-primary" id="announce-send">ສົ່ງແຈ້ງເຕືອນ</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  overlay.querySelector('#announce-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#announce-send').addEventListener('click', async () => {
    const target_agent_id = overlay.querySelector('#announce-target').value;
    const title = overlay.querySelector('#announce-title').value.trim();
    const message = overlay.querySelector('#announce-message').value.trim();
    if (!title || !message) { showToast('ກະລຸນາໃສ່ຫົວຂໍ້ ແລະ ຂໍ້ຄວາມ', 'error'); return; }
    try {
      const res = await apiCall('send_announcement', { target_agent_id, title, message });
      showToast(`ສົ່ງແຈ້ງເຕືອນສຳເລັດ (${res.sent_to} ຄົນ)`, 'success');
      overlay.remove();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function renderAdminAgents(main) {
  try {
    const agents = await apiCall('get_agents');
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ຈັດການຕົວແທນ</h1>
          <div class="page-subtitle">ສ້າງບັນຊີ, Reset password, ເປີດ/ປິດການໃຊ້ງານ</div>
        </div>
      </div>

      <div class="card" style="max-width:560px;">
        <div style="font-weight:700;margin-bottom:12px;">➕ ສ້າງຕົວແທນໃໝ່</div>
        <form id="new-agent-form">
          <div class="form-row">
            <div class="field"><label>ຊື່ຕົວແທນ / ຊື່ຮ້ານ</label><input type="text" id="agent-name" required></div>
            <div class="field"><label>ເບີໂທ</label><input type="text" id="agent-phone"></div>
          </div>
          <div class="form-row" style="margin-top:12px;">
            <div class="field"><label>Username</label><input type="text" id="agent-username" required></div>
            <div class="field"><label>Password</label><input type="text" id="agent-password" required></div>
          </div>
          <button class="btn btn-accent" style="margin-top:14px;" type="submit">ສ້າງບັນຊີຕົວແທນ</button>
        </form>
      </div>

      <div class="section-title">ລາຍຊື່ຕົວແທນ (${agents.length})</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ຊື່</th><th>Username</th><th>ເບີໂທ</th><th>ສະຖານະ</th><th>ຈັດການ</th></tr></thead>
          <tbody id="agents-tbody">
            ${agents.map((a) => `
              <tr data-id="${a.user_id}">
                <td>${escapeHtml(a.agent_name)}</td>
                <td>${escapeHtml(a.username)}</td>
                <td>${escapeHtml(a.phone || '-')} ${a.phone ? whatsappButtonHtml(a.phone, '') : ''}</td>
                <td>${a.status === 'active' ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>'}</td>
                <td>
                  <button class="btn btn-sm btn-outline toggle-status-btn" data-id="${a.user_id}" data-status="${a.status}">
                    ${a.status === 'active' ? 'ປິດການໃຊ້ງານ' : 'ເປີດການໃຊ້ງານ'}
                  </button>
                  <button class="btn btn-sm btn-outline reset-pw-btn" data-id="${a.user_id}">Reset Password</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    main.querySelector('#new-agent-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const agent_name = document.getElementById('agent-name').value.trim();
      const phone = document.getElementById('agent-phone').value.trim();
      const username = document.getElementById('agent-username').value.trim();
      const password = document.getElementById('agent-password').value;
      try {
        await apiCall('create_agent', { agent_name, phone, username, password });
        showToast('ສ້າງບັນຊີຕົວແທນສຳເລັດ', 'success');
        renderAdminAgents(main);
      } catch (err) { showToast(err.message, 'error'); }
    });

    main.querySelectorAll('.toggle-status-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status === 'active' ? 'disabled' : 'active';
        try {
          await apiCall('update_agent_status', { user_id: btn.dataset.id, status: newStatus });
          showToast('ອັບເດດສະຖານະສຳເລັດ', 'success');
          renderAdminAgents(main);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });

    main.querySelectorAll('.reset-pw-btn').forEach((btn) => {
      btn.addEventListener('click', () => openResetPasswordModal(btn.dataset.id, main));
    });

  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

function openResetPasswordModal(userId, main) {
  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal-box">
        <div class="modal-title">Reset Password ຕົວແທນ</div>
        <div class="field">
          <label>ລະຫັດຜ່ານໃໝ່</label>
          <input type="text" id="new-pw-input" required>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="modal-cancel">ຍົກເລີກ</button>
          <button class="btn btn-primary" id="modal-confirm">ຢືນຢັນ</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
    const newPassword = overlay.querySelector('#new-pw-input').value;
    if (!newPassword) return;
    try {
      await apiCall('reset_agent_password', { user_id: userId, new_password: newPassword });
      showToast('Reset Password ສຳເລັດ', 'success');
      overlay.remove();
      renderAdminAgents(main);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function renderAdminPrices(main) {
  try {
    const prices = await apiCall('get_prices');
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ຕັ້ງລາຄາ</h1>
          <div class="page-subtitle">ລາຄາຂາຍສົ່ງ (ໃຫ້ຕົວແທນ) ແລະ ລາຄາຂາຍປີກ (ໃຫ້ລູກຄ້າ)</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ສິນຄ້າ</th><th>ລາຄາສົ່ງ</th><th>ລາຄາປີກ</th><th>ອັບເດດລ່າສຸດ</th><th>ຈັດການ</th></tr></thead>
          <tbody id="prices-tbody">
            ${prices.map((p) => `
              <tr data-id="${p.product_id}">
                <td>${escapeHtml(p.product_name)}</td>
                <td><input type="number" class="price-wholesale-input" data-id="${p.product_id}" value="${Number(p.wholesale_price)}" style="width:110px;padding:6px 8px;border:1px solid var(--color-border);border-radius:6px;"></td>
                <td><input type="number" class="price-retail-input" data-id="${p.product_id}" value="${Number(p.retail_price)}" style="width:110px;padding:6px 8px;border:1px solid var(--color-border);border-radius:6px;"></td>
                <td>${escapeHtml(p.effective_date)}</td>
                <td><button class="btn btn-sm btn-primary save-price-btn" data-id="${p.product_id}">ບັນທຶກ</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    main.querySelectorAll('.save-price-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const wholesale_price = main.querySelector(`.price-wholesale-input[data-id="${id}"]`).value;
        const retail_price = main.querySelector(`.price-retail-input[data-id="${id}"]`).value;
        try {
          await apiCall('update_price', { product_id: id, wholesale_price, retail_price });
          showToast('ອັບເດດລາຄາສຳເລັດ', 'success');
          renderAdminPrices(main);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

async function renderAdminReports(main) {
  try {
    const txs = await apiCall('get_all_transactions');
    main.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">ລາຍງານທຸລະກຳ</h1>
          <div class="page-subtitle">ປະຫວັດການໂອນ/ຂາຍທັງໝົດໃນລະບົບ (${txs.length} ລາຍການ)</div>
        </div>
      </div>
      ${renderTable(
        ['ວັນທີ-ເວລາ', 'ປະເພດ', 'ຕົວແທນ', 'ສິນຄ້າ', 'ຈຳນວນ', 'ລາຄາ/ໜ່ວຍ', 'ຍອດລວມ'],
        txs.map((t) => [
          escapeHtml(t.timestamp),
          t.type === 'factory_to_agent'
            ? '<span class="badge badge-warning">ໂຮງງານ→ຕົວແທນ</span>'
            : '<span class="badge badge-success">ຕົວແທນ→ລູກຄ້າ</span>',
          escapeHtml(t.agent_name),
          escapeHtml(t.product_name),
          formatNumber(t.quantity),
          formatMoney(t.unit_price),
          formatMoney(t.total_amount)
        ])
      )}
    `;
  } catch (err) {
    main.innerHTML = renderErrorCard(err.message);
  }
}

/* ============================== Agent Portal ============================== */

const AGENT_NAV = [
  { key: 'dashboard', label: 'ພາບລວມ', icon: '📊' },
  { key: 'mystock', label: 'ສະຕັອກ', icon: '📦' },
  { key: 'order', label: 'ສັ່ງເພີ່ມ', icon: '🚚' },
  { key: 'quicksale', label: 'ຂາຍດ່ວນ', icon: '🧾' },
  { key: 'history', label: 'ປະຫວັດ', icon: '🕒' }
];

let agentState = {
  view: 'dashboard', selectedProduct: null, qty: 1, prices: [], stock: [],
  historyFrom: null, historyTo: null
};

function formatDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function renderAgentApp(session) {
  appEl.innerHTML = '';
  const shell = el(`
    <div class="agent-shell">
      <div class="agent-topbar">
        <div class="agent-topbar-row">
          <div>
            <div class="agent-greeting-label">ສະບາຍດີ 👋</div>
            <div class="agent-greeting-name">${escapeHtml(session.agent_name || session.username)}</div>
          </div>
          <div class="topbar-actions">
            <button class="bell-btn" id="agent-bell-btn">
              🔔
              <span class="bell-badge hidden" id="agent-bell-badge">0</span>
            </button>
            <button class="agent-logout-btn" id="agent-logout-btn">ອອກຈາກລະບົບ</button>
          </div>
        </div>
      </div>
      <div class="agent-content" id="agent-content"></div>
      <div class="bottom-nav" id="agent-bottom-nav"></div>
    </div>
  `);
  appEl.appendChild(shell);

  shell.querySelector('#agent-logout-btn').addEventListener('click', logout);
  shell.querySelector('#agent-bell-btn').addEventListener('click', () => openAgentNotificationsModal());
  refreshAgentBellBadge();

  const nav = shell.querySelector('#agent-bottom-nav');
  AGENT_NAV.forEach((item) => {
    const btn = el(`<button class="bottom-nav-item" data-key="${item.key}"><span style="font-size:20px;">${item.icon}</span><span>${item.label}</span></button>`);
    btn.addEventListener('click', () => navigateAgent(item.key));
    nav.appendChild(btn);
  });

  navigateAgent('dashboard');
}

function navigateAgent(view) {
  agentState.view = view;
  document.querySelectorAll('.bottom-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.key === view));
  const content = document.getElementById('agent-content');
  content.innerHTML = '<div class="spinner"></div>';

  const renderers = {
    dashboard: renderAgentDashboard,
    mystock: renderAgentMyStock,
    order: renderAgentOrder,
    quicksale: renderAgentQuickSale,
    history: renderAgentHistory
  };
  renderers[view](content);
}

async function refreshAgentBellBadge() {
  try {
    const res = await apiCall('get_my_unread_count');
    const badge = document.getElementById('agent-bell-badge');
    if (!badge) return;
    if (res.count > 0) {
      badge.textContent = res.count > 99 ? '99+' : res.count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) { /* ບໍ່ຕ້ອງລົບກວນ */ }
}

async function openAgentNotificationsModal() {
  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal-box" style="max-width:460px;max-height:80vh;overflow-y:auto;">
        <div class="modal-title">🔔 ແຈ້ງເຕືອນ</div>
        <div id="agent-notif-list"><div class="spinner"></div></div>
        <div class="modal-actions"><button class="btn btn-outline btn-block" id="notif-close-btn">ປິດ</button></div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);
  overlay.querySelector('#notif-close-btn').addEventListener('click', () => overlay.remove());

  const listEl = overlay.querySelector('#agent-notif-list');
  try {
    const notifs = await apiCall('get_my_notifications');
    listEl.innerHTML = notifs.length === 0
      ? '<div class="empty-state"><div class="icon">🔕</div>ຍັງບໍ່ມີແຈ້ງເຕືອນ</div>'
      : notifs.map((n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
          <span class="notif-type-tag ${n.type}">${n.type === 'announcement' ? 'ແຈ້ງເຕືອນ' : n.type === 'status_update' ? 'ອັບເດດຄຳສັ່ງຊື້' : n.type}</span>
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
          <div class="notif-item-meta">${escapeHtml(n.created_at)}</div>
        </div>
      `).join('');

    // ໝາຍວ່າອ່ານແລ້ວທັງໝົດ ຫຼັງເປີດເບິ່ງ
    await apiCall('mark_all_notifications_read');
    refreshAgentBellBadge();
  } catch (err) {
    listEl.innerHTML = renderErrorCard(err.message);
  }
}

async function renderAgentDashboard(content) {
  try {
    const data = await apiCall('get_my_dashboard');
    content.innerHTML = `
      <div class="agent-page-title">ພາບລວມຂອງຂ້ອຍ</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;">
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍມື້ນີ້ (${formatNumber(data.sales_today_count)} ລາຍການ)</div>
          <div class="stat-value">${formatMoney(data.sales_today)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍ 7 ວັນ</div>
          <div class="stat-value">${formatMoney(data.sales_week)}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-label">ຍອດຂາຍ 30 ວັນ</div>
          <div class="stat-value">${formatMoney(data.sales_month)}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:12.5px;color:var(--color-text-muted);font-weight:600;">ສິນຄ້າທີ່ຖືຢູ່</div>
          <div style="font-size:19px;font-weight:800;color:var(--color-primary-dark);margin-top:2px;">
            ${data.total_products} ລາຍການ • ${formatNumber(data.total_units)} ໜ່ວຍ
          </div>
        </div>
        <div style="font-size:32px;">📦</div>
      </div>

      <div class="section-title" style="margin:18px 0 10px;">ສະຕັອກປັດຈຸບັນ</div>
      ${data.stock_summary.length === 0
        ? '<div class="empty-state"><div class="icon">📦</div>ຍັງບໍ່ມີສະຕັອກ</div>'
        : data.stock_summary.map((s) => `
          <div class="stock-item-card">
            <div>
              <div class="stock-item-name">${escapeHtml(s.product_name)}</div>
              <div class="stock-item-unit">${escapeHtml(s.unit)}</div>
            </div>
            <div class="stock-item-qty">${formatNumber(s.quantity)}</div>
          </div>
        `).join('')
      }
    `;
  } catch (err) {
    content.innerHTML = renderErrorCard(err.message);
  }
}

async function renderAgentMyStock(content) {
  try {
    const stock = await apiCall('get_my_stock');
    content.innerHTML = `
      <div class="agent-page-title">ສະຕັອກທີ່ຂ້ອຍຖືຢູ່</div>
      ${stock.length === 0
        ? '<div class="empty-state"><div class="icon">📦</div>ຍັງບໍ່ມີສະຕັອກ, ລໍຖ້າໂຮງງານໂອນສິນຄ້າໃຫ້ທ່ານ</div>'
        : stock.map((s) => `
          <div class="stock-item-card">
            <div>
              <div class="stock-item-name">${escapeHtml(s.product_name)}</div>
              <div class="stock-item-unit">${escapeHtml(s.unit)} • ອັບເດດ ${escapeHtml(s.last_updated)}</div>
            </div>
            <div class="stock-item-qty">${formatNumber(s.quantity)}</div>
          </div>
        `).join('')
      }
    `;
  } catch (err) {
    content.innerHTML = renderErrorCard(err.message);
  }
}

/* ---------- ສັ່ງເພີ່ມສະຕັອກ (Purchase Request / PR) ---------- */

let orderState = { products: [], rows: [{ product_id: '', qty: '' }] };

async function renderAgentOrder(content) {
  try {
    const [products, myRequests] = await Promise.all([apiCall('get_products'), apiCall('get_my_purchase_requests')]);
    orderState.products = products;
    if (!orderState.rows.length) orderState.rows = [{ product_id: products[0] ? products[0].product_id : '', qty: '' }];
    drawOrderForm(content, myRequests);
  } catch (err) {
    content.innerHTML = renderErrorCard(err.message);
  }
}

function drawOrderForm(content, myRequests) {
  content.innerHTML = `
    <div class="agent-page-title">ສັ່ງເພີ່ມສະຕັອກ</div>
    <div class="quick-sale-card" style="margin-bottom:20px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--color-text-muted);">ລາຍການສິນຄ້າທີ່ຕ້ອງການສັ່ງ</div>
      <div id="order-rows"></div>
      <button class="btn btn-outline btn-sm" id="add-order-row-btn" style="margin-top:6px;">➕ ເພີ່ມລາຍການ</button>

      <div class="field" style="margin-top:16px;">
        <label>ໝາຍເຫດ (ທາງເລືອກ)</label>
        <input type="text" id="order-note" placeholder="ເຊັ່ນ ຢາກໄດ້ດ່ວນພາຍໃນອາທິດນີ້">
      </div>

      <button class="btn btn-success btn-block" id="submit-order-btn" style="margin-top:14px;">📨 ສົ່ງຄຳສັ່ງຊື້</button>
    </div>

    <div class="section-title">ຄຳສັ່ງຊື້ຂອງຂ້ອຍ (${myRequests.length})</div>
    ${myRequests.length === 0
      ? '<div class="empty-state"><div class="icon">📭</div>ຍັງບໍ່ເຄີຍສົ່ງຄຳສັ່ງຊື້</div>'
      : myRequests.map((pr) => `
        <div class="pr-card" style="cursor:default;">
          <div class="pr-card-row">
            <div>
              <div class="pr-card-items">${pr.items.map((it) => `${escapeHtml(it.product_name)} x${formatNumber(it.qty)}`).join(', ')}</div>
            </div>
            <div style="text-align:right;">
              ${statusBadgeHtml(pr.status)}
              <div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">${escapeHtml(pr.created_at)}</div>
            </div>
          </div>
          ${pr.admin_note ? `<div class="history-item-meta" style="margin-top:8px;">💬 ໂຮງງານ: ${escapeHtml(pr.admin_note)}</div>` : ''}
        </div>
      `).join('')
    }
  `;

  drawOrderRows(content);

  content.querySelector('#add-order-row-btn').addEventListener('click', () => {
    orderState.rows.push({ product_id: orderState.products[0] ? orderState.products[0].product_id : '', qty: '' });
    drawOrderRows(content);
  });

  content.querySelector('#submit-order-btn').addEventListener('click', async () => {
    const items = orderState.rows
      .map((r, i) => {
        const qtyInput = content.querySelector(`.order-qty-input[data-idx="${i}"]`);
        const productSelect = content.querySelector(`.order-product-select[data-idx="${i}"]`);
        return { product_id: productSelect ? productSelect.value : r.product_id, qty: qtyInput ? qtyInput.value : r.qty };
      })
      .filter((it) => it.product_id && Number(it.qty) > 0);

    if (items.length === 0) { showToast('ກະລຸນາໃສ່ຢ່າງໜ້ອຍ 1 ລາຍການ ພ້ອມຈຳນວນ', 'error'); return; }

    const note = content.querySelector('#order-note').value.trim();
    const btn = content.querySelector('#submit-order-btn');
    btn.disabled = true;
    btn.textContent = 'ກຳລັງສົ່ງ...';
    try {
      await apiCall('create_purchase_request', { items, note });
      showToast('ສົ່ງຄຳສັ່ງຊື້ສຳເລັດ! ໂຮງງານຈະໄດ້ຮັບແຈ້ງເຕືອນ', 'success');
      orderState.rows = [{ product_id: orderState.products[0] ? orderState.products[0].product_id : '', qty: '' }];
      renderAgentOrder(content);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = '📨 ສົ່ງຄຳສັ່ງຊື້';
    }
  });
}

function drawOrderRows(content) {
  const rowsEl = content.querySelector('#order-rows');
  rowsEl.innerHTML = orderState.rows.map((r, i) => `
    <div class="order-item-row">
      <select class="order-product-select" data-idx="${i}">
        ${orderState.products.map((p) => `<option value="${p.product_id}" ${p.product_id === r.product_id ? 'selected' : ''}>${escapeHtml(p.product_name)}</option>`).join('')}
      </select>
      <input type="number" class="order-qty-input" data-idx="${i}" min="1" placeholder="ຈຳນວນ" value="${escapeHtml(r.qty)}">
      ${orderState.rows.length > 1 ? `<button class="remove-item-btn" data-idx="${i}">✕</button>` : ''}
    </div>
  `).join('');

  rowsEl.querySelectorAll('.remove-item-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      orderState.rows.splice(Number(btn.dataset.idx), 1);
      drawOrderRows(content);
    });
  });

  rowsEl.querySelectorAll('.order-product-select').forEach((sel) => {
    sel.addEventListener('change', () => { orderState.rows[Number(sel.dataset.idx)].product_id = sel.value; });
  });
  rowsEl.querySelectorAll('.order-qty-input').forEach((inp) => {
    inp.addEventListener('input', () => { orderState.rows[Number(inp.dataset.idx)].qty = inp.value; });
  });
}

async function renderAgentQuickSale(content) {
  try {
    const [stock, prices] = await Promise.all([apiCall('get_my_stock'), apiCall('get_prices')]);
    agentState.stock = stock;
    agentState.prices = prices;
    if (!agentState.selectedProduct && stock.length > 0) agentState.selectedProduct = stock[0].product_id;
    agentState.qty = 1;
    drawQuickSale(content);
  } catch (err) {
    content.innerHTML = renderErrorCard(err.message);
  }
}

function drawQuickSale(content) {
  const stock = agentState.stock;
  const priceMap = {};
  agentState.prices.forEach((p) => { priceMap[p.product_id] = p; });

  const selected = stock.find((s) => s.product_id === agentState.selectedProduct);
  const unitPrice = selected ? Number((priceMap[selected.product_id] || {}).retail_price || 0) : 0;
  const total = unitPrice * agentState.qty;

  content.innerHTML = `
    <div class="agent-page-title">ຂາຍດ່ວນ (Quick Sale)</div>
    <div class="quick-sale-card">
      ${stock.length === 0 ? '<div class="empty-state"><div class="icon">🧾</div>ທ່ານຍັງບໍ່ມີສະຕັອກໃຫ້ຂາຍ</div>' : `
        <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--color-text-muted);">1. ເລືອກສິນຄ້າ</div>
        <div id="product-pick-list">
          ${stock.map((s) => `
            <button class="product-pick-btn ${s.product_id === agentState.selectedProduct ? 'selected' : ''}" data-id="${s.product_id}">
              <span>${escapeHtml(s.product_name)}</span>
              <span class="stock-hint">ຄົງເຫຼືອ ${formatNumber(s.quantity)}</span>
            </button>
          `).join('')}
        </div>

        <div style="font-weight:700;font-size:13px;margin:16px 0 4px;color:var(--color-text-muted);">2. ໃສ່ຈຳນວນ</div>
        <div class="qty-stepper">
          <button id="qty-minus">−</button>
          <div class="qty-value" id="qty-value">${agentState.qty}</div>
          <button id="qty-plus">+</button>
        </div>

        <div class="total-preview">
          <div class="label">ຍອດລວມທີ່ຕ້ອງເກັບ</div>
          <div class="value">${formatMoney(total)}</div>
        </div>

        <button class="btn btn-success btn-block" id="confirm-sale-btn" ${!selected || agentState.qty > (selected ? selected.quantity : 0) ? 'disabled' : ''}>
          ✅ ຢືນຢັນການຂາຍ
        </button>
        ${selected && agentState.qty > selected.quantity ? '<div class="error-box" style="margin-top:10px;">ຈຳນວນເກີນສະຕັອກທີ່ມີ</div>' : ''}
      `}
    </div>
  `;

  if (stock.length === 0) return;

  content.querySelectorAll('.product-pick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      agentState.selectedProduct = btn.dataset.id;
      agentState.qty = 1;
      drawQuickSale(content);
    });
  });

  content.querySelector('#qty-minus').addEventListener('click', () => {
    if (agentState.qty > 1) agentState.qty--;
    drawQuickSale(content);
  });
  content.querySelector('#qty-plus').addEventListener('click', () => {
    agentState.qty++;
    drawQuickSale(content);
  });

  const confirmBtn = content.querySelector('#confirm-sale-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'ກຳລັງບັນທຶກ...';
      try {
        const res = await apiCall('agent_sale', { product_id: agentState.selectedProduct, qty: agentState.qty });
        showToast(`ຂາຍສຳເລັດ! ຍອດເງິນ ${formatMoney(res.total_amount)}`, 'success');
        renderAgentQuickSale(content);
      } catch (err) {
        showToast(err.message, 'error');
        drawQuickSale(content);
      }
    });
  }
}

function renderAgentHistory(content) {
  // ຄ່າເລີ່ມຕົ້ນ: 7 ວັນຫຼັງສຸດ (ຕັ້ງພຽງເທື່ອດຽວ, ຄັ້ງຕໍ່ໄປໃຊ້ຄ່າທີ່ຜູ້ໃຊ້ເລືອກໄວ້ຄືເກົ່າ)
  if (agentState.historyFrom === null && agentState.historyTo === null) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    agentState.historyFrom = formatDateInput(weekAgo);
    agentState.historyTo = formatDateInput(today);
  }
  drawHistoryControls(content);
}

function drawHistoryControls(content) {
  content.innerHTML = `
    <div class="agent-page-title">ປະຫວັດການຂາຍ</div>
    <div class="card" style="margin-bottom:14px;">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-outline history-preset-btn" data-preset="today">ມື້ນີ້</button>
        <button class="btn btn-sm btn-outline history-preset-btn" data-preset="week">7 ວັນ</button>
        <button class="btn btn-sm btn-outline history-preset-btn" data-preset="month">30 ວັນ</button>
        <button class="btn btn-sm btn-outline history-preset-btn" data-preset="all">ທັງໝົດ</button>
      </div>
      <div class="form-row">
        <div class="field">
          <label>ຈາກວັນທີ</label>
          <input type="date" id="history-date-from" value="${agentState.historyFrom}">
        </div>
        <div class="field">
          <label>ຫາວັນທີ</label>
          <input type="date" id="history-date-to" value="${agentState.historyTo}">
        </div>
      </div>
      <button class="btn btn-primary btn-block" id="history-search-btn" style="margin-top:12px;">🔍 ຄົ້ນຫາ</button>
    </div>
    <div id="history-summary"></div>
    <div id="history-list"></div>
  `;

  content.querySelectorAll('.history-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const today = new Date();
      if (preset === 'today') {
        agentState.historyFrom = formatDateInput(today);
        agentState.historyTo = formatDateInput(today);
      } else if (preset === 'week') {
        agentState.historyFrom = formatDateInput(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
        agentState.historyTo = formatDateInput(today);
      } else if (preset === 'month') {
        agentState.historyFrom = formatDateInput(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
        agentState.historyTo = formatDateInput(today);
      } else {
        agentState.historyFrom = '';
        agentState.historyTo = '';
      }
      drawHistoryControls(content);
    });
  });

  content.querySelector('#history-search-btn').addEventListener('click', () => {
    agentState.historyFrom = content.querySelector('#history-date-from').value;
    agentState.historyTo = content.querySelector('#history-date-to').value;
    loadAgentHistoryList(content);
  });

  loadAgentHistoryList(content);
}

async function loadAgentHistoryList(content) {
  const listEl = content.querySelector('#history-list');
  const summaryEl = content.querySelector('#history-summary');
  if (!listEl || !summaryEl) return;
  listEl.innerHTML = '<div class="spinner"></div>';
  summaryEl.innerHTML = '';

  try {
    const txs = await apiCall('get_my_transactions', {
      date_from: agentState.historyFrom || null,
      date_to: agentState.historyTo || null
    });

    const salesOnly = txs.filter((t) => t.type === 'agent_sale');
    const totalAmount = salesOnly.reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const totalQty = salesOnly.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);

    summaryEl.innerHTML = `
      <div class="total-preview" style="margin-bottom:14px;">
        <div class="label">ຍອດຂາຍລວມໃນຊ່ວງທີ່ເລືອກ (${salesOnly.length} ລາຍການ, ${formatNumber(totalQty)} ໜ່ວຍ)</div>
        <div class="value">${formatMoney(totalAmount)}</div>
      </div>
    `;

    listEl.innerHTML = txs.length === 0
      ? '<div class="empty-state"><div class="icon">🕒</div>ບໍ່ພົບປະຫວັດໃນຊ່ວງເວລານີ້</div>'
      : txs.map((t) => `
        <div class="history-item">
          <div class="history-item-row">
            <div class="history-item-name">${escapeHtml(t.product_name)}</div>
            <div class="history-item-amount">${formatMoney(t.total_amount)}</div>
          </div>
          <div class="history-item-meta">
            ${t.type === 'factory_to_agent' ? 'ຮັບເຂົ້າຈາກໂຮງງານ' : 'ຂາຍໃຫ້ລູກຄ້າ'} •
            ຈຳນວນ ${formatNumber(t.quantity)} • ${escapeHtml(t.timestamp)}
          </div>
        </div>
      `).join('');
  } catch (err) {
    listEl.innerHTML = renderErrorCard(err.message);
  }
}
