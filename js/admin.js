// admin features: create service, load services, manage apps
async function initAdminDashboard(){
  // ensure auth
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location = 'login.html'; return; }

    // check role
    const u = await db.collection('users').doc(user.uid).get();
    if (!u.exists || u.data().role !== 'admin') {
      alert('Access denied');
      await auth.signOut();
      window.location = 'login.html';
      return;
    }

    // handlers
    document.getElementById('createServiceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value.trim();
      const description = document.getElementById('description').value.trim();
      if (!title) return alert('Enter title');
      try {
        await db.collection('services').add({
          title, description,
          createdBy: user.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Logger.info('Service created', { title });
        document.getElementById('createServiceForm').reset();
        loadServicesAdmin();
      } catch (err) {
        Logger.error('Create service failed', { error: err.message });
        alert('Failed to create service: ' + err.message);
      }
    });

    document.getElementById('refreshServices')?.addEventListener('click', loadServicesAdmin);

    loadServicesAdmin();
    loadApplicationsAdmin();
  });
}

async function loadServicesAdmin(){
  const container = document.getElementById('servicesAdminList');
  container.innerHTML = 'Loading...';
  const snap = await db.collection('services').orderBy('createdAt','desc').get();
  container.innerHTML = '';
  snap.forEach(doc => {
    const s = doc.data();
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${escapeHtml(s.title)}</h3>
      <p class="small">${escapeHtml(s.description || '')}</p>
      <div class="row">
        <button class="btn-outline" onclick="editService('${doc.id}')">Edit</button>
        <button class="btn" onclick="deleteService('${doc.id}')">Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function deleteService(id){
  if (!confirm('Delete this service?')) return;
  try {
    await db.collection('services').doc(id).delete();
    Logger.info('Service deleted', { id });
    loadServicesAdmin();
  } catch (e) {
    Logger.error('Delete failed', { error: e.message });
    alert('Delete failed');
  }
}

// edit - simple prompt edit (you can replace with modal)
async function editService(id){
  const doc = await db.collection('services').doc(id).get();
  if (!doc.exists) return alert('Not found');
  const data = doc.data();
  const newTitle = prompt('Service title', data.title);
  if (newTitle === null) return;
  const newDesc = prompt('Service description', data.description || '');
  try {
    await db.collection('services').doc(id).update({
      title: newTitle,
      description: newDesc
    });
    Logger.info('Service edited', { id });
    loadServicesAdmin();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
}

// Applications - admin view & update status
async function loadApplicationsAdmin(){
  const container = document.getElementById('applicationsAdminList');
  container.innerHTML = 'Loading...';
  const snap = await db.collection('applications').orderBy('createdAt','desc').get();
  container.innerHTML = '';
  snap.forEach(async doc => {
    const a = doc.data();
    const serviceDoc = await db.collection('services').doc(a.serviceId).get();
    const svc = serviceDoc.exists ? serviceDoc.data().title : a.serviceId;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <h3>${escapeHtml(svc)}</h3>
      <p class="small">Applicant: ${escapeHtml(a.userName || a.userId)}</p>
      <p class="small">Status: <strong id="status-${doc.id}">${escapeHtml(a.status)}</strong></p>
      <p class="small">Details: ${escapeHtml(a.details || '')}</p>
      <div class="row">
        <select id="sel-${doc.id}">
          <option>Pending</option>
          <option>In Progress</option>
          <option>Approved</option>
          <option>Rejected</option>
        </select>
        <button class="btn" onclick="updateAppStatus('${doc.id}')">Update</button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function updateAppStatus(appId){
  const sel = document.getElementById('sel-' + appId);
  if (!sel) return;
  const newStatus = sel.value;
  try {
    await db.collection('applications').doc(appId).update({ status: newStatus });
    document.getElementById('status-' + appId).textContent = newStatus;
    Logger.info('Application status updated', { appId, newStatus });
    loadApplicationsAdmin();
  } catch (e) {
    Logger.error('Update status failed', { error: e.message });
    alert('Failed to update status');
  }
}

// small helper
function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

window.initAdminDashboard = initAdminDashboard;
window.deleteService = deleteService;
window.editService = editService;
window.updateAppStatus = updateAppStatus;
