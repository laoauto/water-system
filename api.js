// api.js
// ຟັງຊັນກາງສຳລັບເອີ້ນ API ຂອງ Google Apps Script
// ໝາຍເຫດ: ໃຊ້ Content-Type: text/plain ໂດຍຕັ້ງໃຈ ເພື່ອຫຼີກລ້ຽງ CORS Preflight (ເບິ່ງລາຍລະອຽດໃນ Code.gs)

// Cache ຊົ່ວຄາວ ຝັ່ງ Browser ສຳລັບຂໍ້ມູນທີ່ບໍ່ຄ່ອຍປ່ຽນ (ສິນຄ້າ, ລາຄາ, ຄ່າຕັ້ງ) ເພື່ອບໍ່ໃຫ້ຕ້ອງດຶງໃໝ່ທຸກຄັ້ງທີ່ປ່ຽນໜ້າ
const _apiCache = {};
const CACHEABLE_ACTIONS = { get_products: 45000, get_prices: 45000, get_settings: 45000 };
// ຂຽນ Action ໃດ ຈະລຶບ Cache ຂອງ Action ອ່ານທີ່ກ່ຽວຂ້ອງ ໃຫ້ຄັ້ງຕໍ່ໄປດຶງຂໍ້ມູນໃໝ່
const CACHE_INVALIDATES = {
  create_product: ['get_products', 'get_prices'],
  update_price: ['get_prices'],
  update_setting: ['get_settings']
};

async function apiCall(action, payload) {
  const now = Date.now();
  if (CACHEABLE_ACTIONS[action] && _apiCache[action] && (now - _apiCache[action].time) < CACHEABLE_ACTIONS[action]) {
    return _apiCache[action].data;
  }

  const token = localStorage.getItem('watersale_token');
  const body = Object.assign({ action: action, token: token || '' }, payload || {});

  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    throw new Error('ເຊື່ອມຕໍ່ເຄືອຂ່າຍບໍ່ໄດ້, ກະລຸນາກວດສອບອິນເຕີເນັດ');
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw new Error('ຄຳຕອບຈາກ Server ບໍ່ຖືກຕ້ອງ');
  }

  if (!json.ok) {
    // Token ບໍ່ຖືກຕ້ອງ/ໝົດອາຍຸ -> ບັງຄັບ Logout
    if (json.error && json.error.indexOf('Login ໃໝ່') !== -1) {
      clearSession();
      renderLoginView();
    }
    throw new Error(json.error || 'ເກີດຂໍ້ຜິດພາດບໍ່ຮູ້ສາເຫດ');
  }

  if (CACHEABLE_ACTIONS[action]) {
    _apiCache[action] = { data: json.data, time: now };
  }
  if (CACHE_INVALIDATES[action]) {
    CACHE_INVALIDATES[action].forEach((a) => delete _apiCache[a]);
  }

  return json.data;
}

function saveSession(session) {
  localStorage.setItem('watersale_token', session.token);
  localStorage.setItem('watersale_role', session.role);
  localStorage.setItem('watersale_user_id', session.user_id);
  localStorage.setItem('watersale_agent_name', session.agent_name || '');
  localStorage.setItem('watersale_username', session.username || '');
}

function clearSession() {
  localStorage.removeItem('watersale_token');
  localStorage.removeItem('watersale_role');
  localStorage.removeItem('watersale_user_id');
  localStorage.removeItem('watersale_agent_name');
  localStorage.removeItem('watersale_username');
  Object.keys(_apiCache).forEach((k) => delete _apiCache[k]);
}

function getSession() {
  const token = localStorage.getItem('watersale_token');
  if (!token) return null;
  return {
    token: token,
    role: localStorage.getItem('watersale_role'),
    user_id: localStorage.getItem('watersale_user_id'),
    agent_name: localStorage.getItem('watersale_agent_name'),
    username: localStorage.getItem('watersale_username')
  };
}
