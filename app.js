// -------------------- 1) Firebase init --------------------
// -------------------- 1) Firebase init --------------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Helpers
const $ = (id) => document.getElementById(id);
const nowTs = () => firebase.firestore.FieldValue.serverTimestamp();

// -------------------- 2) AUTH: Register / Login --------------------
async function registerUser() {
  try {
    const name = $('regName').value.trim();
    const aadhaar = $('regAadhaar').value.trim();
    const village = $('regVillage').value.trim();
    const phone = $('regPhone').value.trim();
    const email = $('regEmail').value.trim();
    const pass = $('regPass').value;

    if(!name || !email || !pass) return alert("Fill name, email, password");

    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;

    // default role: user
    await db.collection('users').doc(uid).set({
      uid, name, aadhaar, village, phone, email,
      role: 'user', createdAt: nowTs()
    });

    await logAction(uid, 'register', 'user', uid, {email});
    alert('Registered! Please login.');
  } catch(e) {
    alert(e.message);
  }
}

async function loginUser() {
  try {
    const email = $('loginEmail').value.trim();
    const pass = $('loginPass').value;
    await auth.signInWithEmailAndPassword(email, pass);
    window.location.href = 'app.html';
  } catch(e) {
    alert(e.message);
  }
}

async function logout() {
  await auth.signOut();
  window.location.href = 'index.html';
}

// -------------------- 3) APP BOOT on app.html --------------------
let me = null; // current user document
let myRole = null;
let servicesCache = [];

if (location.pathname.endsWith('app.html')) {
  auth.onAuthStateChanged(async (u) => {
    if (!u) { location.href = 'index.html'; return; }
    const snap = await db.collection('users').doc(u.uid).get();
    me = snap.data();
    myRole = me?.role || 'user';
    setRoleUI();
    loadAll();
  });
}

function setRoleUI() {
  // badge
  if ($('roleBadge')) $('roleBadge').textContent = myRole.toUpperCase();

  // show/hide panels
  toggle('officerServicePanel', myRole === 'officer');
  toggle('officerAppsPanel', myRole === 'officer');

  toggle('staffAppsPanel', myRole === 'staff');

  toggle('userAppsPanel', myRole === 'user');

  // officer tools on profile
  toggle('officerRolePanel', myRole === 'officer');
}

function toggle(id, show=true) {
  const el = $(id);
  if(!el) return;
  el.classList[show ? 'remove' : 'add']('hide');
}

function showTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  $(id).classList.add('active');
}

// -------------------- 4) Services (CRUD + list + search) --------------------
async function addService() {
  try {
    if (myRole !== 'officer') return alert('Only officer can add services');
    const title = $('svcTitle').value.trim();
    const department = $('svcDept').value.trim();
    const description = $('svcDesc').value.trim();
    const eligibility = $('svcElig').value.trim();
    if (!title) return alert('Title required');

    const doc = await db.collection('services').add({
      title, department, description, eligibility,
      active: true,
      createdBy: me.uid, createdAt: nowTs(), updatedAt: nowTs()
    });

    await logAction(me.uid, 'create', 'service', doc.id, { title });
    $('svcTitle').value = $('svcDept').value = $('svcDesc').value = $('svcElig').value = '';
    await loadServices();
  } catch(e) { alert(e.message); }
}

async function updateService(sid, patch) {
  if (myRole !== 'officer') return alert('Only officer');
  await db.collection('services').doc(sid).update({...patch, updatedAt: nowTs()});
  await logAction(me.uid, 'update', 'service', sid, patch);
  await loadServices();
}

async function deleteService(sid) {
  if (myRole !== 'officer') return alert('Only officer');
  if (!confirm('Delete this service?')) return;
  await db.collection('services').doc(sid).delete();
  await logAction(me.uid, 'delete', 'service', sid, {});
  await loadServices();
}

async function loadServices() {
  const q = await db.collection('services').orderBy('title').get();
  servicesCache = q.docs.map(d => ({id:d.id, ...d.data()}));
  renderServices();
}

function renderServices() {
  const term = ($('searchBox')?.value || '').toLowerCase();
  const list = $('servicesList');
  const adminList = $('servicesAdminList');
  if (!list) return;

  const filtered = servicesCache.filter(s =>
    s.title.toLowerCase().includes(term) ||
    (s.department||'').toLowerCase().includes(term)
  );

  // Public list (apply)
  list.innerHTML = filtered.map(s => `
    <div class="service">
      <h3>${s.title}</h3>
      <div class="note">${s.department||''}</div>
      <p>${s.description||''}</p>
      <p><strong>Eligibility:</strong> ${s.eligibility||'-'}</p>
      ${myRole==='user' ? `
      <div>
        <label>Attach file(s): <input type="file" multiple onchange="cacheFiles('${s.id}', this.files)"></label>
        <button onclick="applyForService('${s.id}','${encodeURIComponent(s.title)}')">Apply</button>
      </div>` : ``}
    </div>
  `).join('') || '<p class="note">No services match.</p>';

  // Officer admin list
  if (adminList) {
    adminList.innerHTML = (myRole==='officer' ? filtered.map(s => `
      <div class="service">
        <h3>${s.title}</h3>
        <div class="note">${s.department||''}</div>
        <button onclick="updateService('${s.id}', {active:${!s.active}})">${s.active?'Disable':'Enable'}</button>
        <button onclick="deleteService('${s.id}')">Delete</button>
      </div>
    `).join('') : '');
  }
}

// Cache chosen files per service id before apply
const uploadCache = {};
function cacheFiles(serviceId, fileList) {
  uploadCache[serviceId] = Array.from(fileList);
}

// -------------------- 5) Applications (create / list / assign / update) --------------------
async function applyForService(serviceId, encodedTitle) {
  try {
    const serviceTitle = decodeURIComponent(encodedTitle);
    const files = uploadCache[serviceId] || [];

    const appRef = await db.collection('applications').add({
      userId: me.uid,
      serviceId,
      serviceTitle,
      status: 'submitted',
      assignedTo: null,
      note: '',
      files: [],
      createdAt: nowTs(),
      updatedAt: nowTs()
    });

    // Upload files (optional)
    const uploaded = [];
    for (const f of files) {
      const path = `applications/${appRef.id}/${Date.now()}_${f.name}`;
      const snap = await storage.ref(path).put(f);
      const url = await snap.ref.getDownloadURL();
      uploaded.push({ name: f.name, path, url });
    }
    if (uploaded.length) {
      await appRef.update({ files: uploaded, updatedAt: nowTs() });
    }

    await logAction(me.uid, 'apply', 'application', appRef.id, { serviceId, serviceTitle });
    alert('Application submitted!');
    loadApplications();
  } catch(e) { alert(e.message); }
}

async function loadApplications() {
  if (!me) return;
  if (myRole === 'user') {
    const q = await db.collection('applications')
      .where('userId','==',me.uid).orderBy('createdAt','desc').get();
    renderAppList('myApps', q.docs);
  }
  if (myRole === 'staff') {
    const q = await db.collection('applications')
      .where('assignedTo','==',me.uid).orderBy('createdAt','desc').get();
    renderAppList('assignedApps', q.docs, true);
  }
  if (myRole === 'officer') {
    const q = await db.collection('applications').orderBy('createdAt','desc').get();
    renderAppList('allApps', q.docs, true, true); // officer can assign + update
  }
}

function renderAppList(containerId, docs, canUpdate=false, canAssign=false) {
  const el = $(containerId); if (!el) return;
  if (!docs.length) { el.innerHTML = '<p class="note">No applications.</p>'; return; }
  el.innerHTML = docs.map(d => {
    const a = d.data();
    const files = (a.files||[]).map(f => `<div><a href="${f.url}" target="_blank">${f.name}</a></div>`).join('');
    return `
      <div class="app">
        <h3>${a.serviceTitle} <small class="note">(${d.id})</small></h3>
        <p>Status: <strong>${a.status}</strong>${a.assignedTo? ` | Assigned to: ${a.assignedTo}`:''}</p>
        ${files? `<div><strong>Files:</strong>${files}</div>`:''}
        ${canAssign ? `
          <div style="margin-top:8px;">
            <input id="assign_${d.id}" placeholder="Assign to staff UID" />
            <button onclick="assignStaff('${d.id}')">Assign</button>
          </div>` : ``}
        ${canUpdate ? `
          <div style="margin-top:8px;">
            <select id="status_${d.id}">
              <option ${a.status==='submitted'?'selected':''}>submitted</option>
              <option ${a.status==='under_review'?'selected':''}>under_review</option>
              <option ${a.status==='approved'?'selected':''}>approved</option>
              <option ${a.status==='rejected'?'selected':''}>rejected</option>
            </select>
            <input id="note_${d.id}" placeholder="Note/Remark" />
            <button onclick="updateApplication('${d.id}')">Update</button>
          </div>` : ``}
      </div>
    `;
  }).join('');
}

async function assignStaff(appId) {
  if (myRole !== 'officer') return alert('Only officer can assign');
  const staffUid = $(`assign_${appId}`).value.trim();
  if (!staffUid) return alert('Enter staff UID');
  await db.collection('applications').doc(appId).update({ assignedTo: staffUid, updatedAt: nowTs() });
  await logAction(me.uid, 'assign', 'application', appId, { assignedTo: staffUid });
  loadApplications();
}

async function updateApplication(appId) {
  if (!(myRole==='officer' || myRole==='staff')) return alert('Only staff/officer can update');
  const status = $(`status_${appId}`).value;
  const note = $(`note_${appId}`).value;
  await db.collection('applications').doc(appId).update({ status, note, updatedAt: nowTs() });
  await logAction(me.uid, 'status_update', 'application', appId, { status, note });
  loadApplications();
}

// -------------------- 6) Profile --------------------
async function fillProfileForm() {
  if (!$('profName')) return;
  $('profName').value = me?.name || '';
  $('profAadhaar').value = me?.aadhaar || '';
  $('profVillage').value = me?.village || '';
  $('profPhone').value = me?.phone || '';
  $('profEmail').value = me?.email || '';
}

async function saveProfile() {
  const patch = {
    name: $('profName').value.trim(),
    aadhaar: $('profAadhaar').value.trim(),
    village: $('profVillage').value.trim(),
    phone: $('profPhone').value.trim(),
    updatedAt: nowTs()
  };
  await db.collection('users').doc(me.uid).update(patch);
  await logAction(me.uid, 'update', 'user', me.uid, patch);
  alert('Profile updated');
}

// -------------------- 7) Logging --------------------
async function logAction(actorUid, action, entityType, entityId, details={}) {
  try {
    const actorSnap = await db.collection('users').doc(actorUid).get();
    const actorRole = actorSnap.exists ? actorSnap.data().role : 'unknown';
    await db.collection('logs').add({
      actorUid, actorRole, action, entityType, entityId, details, ts: nowTs()
    });
  } catch(e) {
    console.warn('logAction failed', e.message);
  }
}

// -------------------- 8) Initial loads --------------------
async function loadAll() {
  await loadServices();
  await loadApplications();
  await fillProfileForm();
}
