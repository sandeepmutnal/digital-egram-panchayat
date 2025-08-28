// staff: view all applications and change status
async function initStaffDashboard(){
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location = 'login.html'; return; }
    const snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists || snap.data().role !== 'staff') {
      alert('Access denied'); await auth.signOut(); window.location = 'login.html'; return;
    }
    loadAllApplicationsForStaff();
  });
}

async function loadAllApplicationsForStaff(){
  const container = document.getElementById('applicationsList');
  container.innerHTML = 'Loading...';
  const snap = await db.collection('applications').orderBy('createdAt','desc').get();
  container.innerHTML = '';
  snap.forEach(async doc => {
    const a = doc.data();
    const svcDoc = await db.collection('services').doc(a.serviceId).get();
    const svc = svcDoc.exists ? svcDoc.data().title : a.serviceId;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${escapeHtml(svc)}</h3>
      <p class="small">User: ${escapeHtml(a.userName || a.userId)}</p>
      <p class="small">Status: <strong id="status-${doc.id}">${escapeHtml(a.status)}</strong></p>
      <p class="small">Details: ${escapeHtml(a.details || '')}</p>
      <div class="row">
        <select id="sel-${doc.id}">
          <option>Pending</option>
          <option>In Progress</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
        <button class="btn" onclick="updateApplicationStatus('${doc.id}')">Update</button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function updateApplicationStatus(appId){
  const sel = document.getElementById('sel-' + appId);
  if (!sel) return;
  const newStatus = sel.value;
  try {
    await db.collection('applications').doc(appId).update({ status: newStatus });
    document.getElementById('status-' + appId).textContent = newStatus;
    Logger.info('Staff updated application', { appId, newStatus });
    loadAllApplicationsForStaff();
  } catch (e) {
    Logger.error('Staff update failed', { error: e.message });
    alert('Update failed');
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

window.initStaffDashboard = initStaffDashboard;
window.updateApplicationStatus = updateApplicationStatus;
