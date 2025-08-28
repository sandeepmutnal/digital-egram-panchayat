// user.js

// user: show services, apply, show my applications, profile
async function initUserDashboard() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { 
      window.location = 'login.html'; 
      return; 
    }
    // show profile
    const snap = await db.collection('users').doc(user.uid).get();
    const ud = snap.exists ? snap.data() : {};
    renderProfile(ud);
    renderServices();
    renderMyApplications(user.uid);
  });
}

async function renderServices() {
  const container = document.getElementById('servicesList');
  container.innerHTML = 'Loading...';
  const snap = await db.collection('services').orderBy('createdAt', 'desc').get();
  container.innerHTML = '';
  snap.forEach(doc => {
    const s = doc.data();
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h3>${escapeHtml(s.title)}</h3>
      <p class="small">${escapeHtml(s.description || '')}</p>
      <button class="btn" onclick="openApplyModal('${doc.id}')">Apply</button>`;
    container.appendChild(div);
  });
}

function openApplyModal(serviceId) {
  const details = prompt('Enter details for application (address / description):');
  if (!details) return;
  submitApplication(serviceId, details);
}

async function submitApplication(serviceId, details) {
  const user = auth.currentUser;
  if (!user) { alert('Login first'); return; }
  try {
    const userSnap = await db.collection('users').doc(user.uid).get();
    await db.collection('applications').add({
      serviceId,
      userId: user.uid,
      userName: userSnap.exists ? userSnap.data().name : user.email,
      details,
      status: 'Pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert('Application submitted');
    renderMyApplications(user.uid);
  } catch (e) {
    alert('Failed to submit application: ' + e.message);
  }
}

async function renderMyApplications(uid) {
  const container = document.getElementById('myApplications');
  container.innerHTML = 'Loading...';
  const snap = await db.collection('applications').where('userId', '==', uid).orderBy('createdAt','desc').get();
  container.innerHTML = '';
  if (snap.empty) { 
    container.innerHTML = '<p class="small">No applications yet.</p>'; 
    return; 
  }
  snap.forEach(async doc => {
    const a = doc.data();
    const svcDoc = await db.collection('services').doc(a.serviceId).get();
    const svc = svcDoc.exists ? svcDoc.data().title : a.serviceId;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${escapeHtml(svc)}</h3>
      <p class="small">Status: <strong>${escapeHtml(a.status)}</strong></p>
      <p class="small">Details: ${escapeHtml(a.details || '')}</p>
      <p class="small">Applied: ${a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleString() : '—'}</p>
    `;
    container.appendChild(div);
  });
}

function renderProfile(userData) {
  const container = document.getElementById('myProfile');
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `<p><strong>Name:</strong> ${escapeHtml(userData.name || '')}</p>
    <p><strong>Email:</strong> ${escapeHtml(userData.email || '')}</p>
    <p><strong>Role:</strong> ${escapeHtml(userData.role || 'user')}</p>`;
  container.appendChild(div);
}

function escapeHtml(s = '') { 
  return String(s).replace(/[&<>"']/g, c => ({ 
    '&': '&amp;', 
    '<': '&lt;', 
    '>': '&gt;', 
    '"': '&quot;', 
    "'": '&#39;' 
  }[c])); 
}

window.initUserDashboard = initUserDashboard;
window.openApplyModal = openApplyModal;
