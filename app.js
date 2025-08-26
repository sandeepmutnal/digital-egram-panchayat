// -------------------- CONFIG --------------------
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

// -------------------- Helpers --------------------
function show(msg) { alert(msg); }
function toggleReset(show) {
  document.getElementById('resetBox').style.display = show ? 'block' : 'none';
}

// -------------------- AUTH LISTENER & PAGE PROTECTION --------------------
auth.onAuthStateChanged(async (user) => {
  const href = window.location.href;
  const onIndex = href.includes('index.html') || href.endsWith('/') || href.includes('file://') && href.toLowerCase().includes('index.html');
  const onUserPage = href.includes('user.html');
  const onStaffPage = href.includes('staff.html');
  const onAdminPage = href.includes('admin.html');

  if (user) {
    // get user's role from users collection
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) {
      // Unexpected: no user doc — sign out
      console.warn('No user doc found for', user.uid);
      await auth.signOut();
      return;
    }
    const role = doc.data().role || 'user';

    // If on index page, redirect to role dashboard
    if (onIndex) {
      if (role === 'user') { window.location.href = 'user.html'; return; }
      if (role === 'staff') { window.location.href = 'staff.html'; return; }
      if (role === 'admin') { window.location.href = 'admin.html'; return; }
    }

    // If on dashboard pages, enforce role
    if (onUserPage && role !== 'user') { // redirect to actual dashboard
      if (role === 'admin') window.location.href = 'admin.html';
      else window.location.href = 'staff.html';
      return;
    }
    if (onStaffPage && role !== 'staff') {
      if (role === 'admin') window.location.href = 'admin.html';
      else window.location.href = 'user.html';
      return;
    }
    if (onAdminPage && role !== 'admin') {
      if (role === 'staff') window.location.href = 'staff.html';
      else window.location.href = 'user.html';
      return;
    }

    // If here, user allowed — initialize page-specific UI
    if (onUserPage) initUserPage(user, doc.data());
    if (onStaffPage) initStaffPage(user, doc.data());
    if (onAdminPage) initAdminPage(user, doc.data());
  } else {
    // Not signed in: if on a dashboard page -> redirect to index.html
    if (!onIndex) {
      window.location.href = 'index.html';
    }
  }
});

// -------------------- REGISTER --------------------
async function register() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;

  if (!name || !email || password.length < 6) { show('Please enter valid name, email and password (6+ chars).'); return; }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;
    await db.collection('users').doc(uid).set({
      name, email, role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    show('Registered successfully! Redirecting...');
    // onAuthStateChanged will redirect
  } catch (err) {
    show(err.message);
  }
}

// -------------------- LOGIN --------------------
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { show('Enter email and password'); return; }
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    // redirect handled in onAuthStateChanged after fetching role
  } catch (err) {
    show(err.message);
  }
}

// -------------------- RESET PASSWORD --------------------
function resetPassword() {
  const email = document.getElementById('resetEmail').value.trim();
  if (!email) { show('Enter your email'); return; }
  auth.sendPasswordResetEmail(email)
    .then(() => show('Password reset email sent. Check your inbox.'))
    .catch(err => show(err.message));
}

// -------------------- LOGOUT --------------------
function logout() {
  auth.signOut().then(() => { window.location.href = 'index.html'; });
}

// -------------------- USER PAGE --------------------
let serviceMap = {}; // serviceId -> name

function initUserPage(user, userDoc) {
  document.getElementById('welcomeUser').innerText = `Hello, ${userDoc.name} (${userDoc.email})`;
  loadServicesForUser();
  loadMyApplications(user.uid);
}

function loadServicesForUser() {
  const sel = document.getElementById('serviceSelect');
  sel.innerHTML = '<option value="">-- Loading services --</option>';
  db.collection('services').orderBy('createdAt', 'desc').onSnapshot(snap => {
    serviceMap = {};
    sel.innerHTML = '<option value="">-- Select service --</option>';
    snap.forEach(doc => {
      const data = doc.data();
      serviceMap[doc.id] = data.name;
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = data.name;
      sel.appendChild(opt);
    });
  });
}

async function applyService() {
  const sel = document.getElementById('serviceSelect');
  const serviceId = sel.value;
  if (!serviceId) { show('Choose a service'); return; }
  const user = auth.currentUser;
  const userDoc = (await db.collection('users').doc(user.uid).get()).data();
  await db.collection('applications').add({
    userId: user.uid,
    userName: userDoc.name || user.email,
    serviceId,
    serviceName: serviceMap[serviceId] || '',
    status: 'Pending',
    assignedTo: null,
    remarks: '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  show('Application submitted!');
}

function loadMyApplications(uid) {
  const ul = document.getElementById('myApplications');
  db.collection('applications').where('userId', '==', uid).orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      ul.innerHTML = '';
      snap.forEach(doc => {
        const a = doc.data();
        const li = document.createElement('li');
        li.className = 'application';
        li.innerHTML = `<strong>${a.serviceName}</strong> <span class="small">(${a.status})</span>
                        <div class="small">Applied by: ${a.userName} • ${a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleString() : ''}</div>
                        <div>Remarks: ${a.remarks || '-'}</div>`;
        // If pending, allow cancel
        if (a.status === 'Pending') {
          const btn = document.createElement('button');
          btn.textContent = 'Cancel';
          btn.style.marginTop = '8px';
          btn.onclick = () => {
            if (confirm('Cancel this application?')) {
              db.collection('applications').doc(doc.id).update({
                status: 'Cancelled',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            }
          };
          li.appendChild(btn);
        }
        ul.appendChild(li);
      });
    });
}

// -------------------- STAFF PAGE --------------------
function initStaffPage(user, userDoc) {
  document.getElementById('welcomeStaff').innerText = `Hello, ${userDoc.name} (${userDoc.email})`;
  loadStaffApplications();
}

function loadStaffApplications() {
  const ul = document.getElementById('staffApplications');
  db.collection('applications').where('status', '==', 'Pending').orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      ul.innerHTML = '';
      snap.forEach(doc => {
        const a = doc.data();
        const li = document.createElement('li');
        li.className = 'application';
        li.innerHTML = `<strong>${a.serviceName}</strong>
                        <div class="small">From: ${a.userName} • Applied: ${a.createdAt ? new Date(a.createdAt.seconds*1000).toLocaleString() : ''}</div>
                        <div>Remarks: ${a.remarks || '-'}</div>`;

        // Approve button
        const approve = document.createElement('button');
        approve.textContent = 'Approve';
        approve.style.marginRight = '8px';
        approve.onclick = () => updateApplicationStatus(doc.id, 'Approved');

        // Reject button
        const reject = document.createElement('button');
        reject.textContent = 'Reject';
        reject.onclick = () => updateApplicationStatus(doc.id, 'Rejected');

        // Optional: assign to me
        const assign = document.createElement('button');
        assign.textContent = 'Assign to me';
        assign.style.marginLeft = '8px';
        assign.onclick = async () => {
          const user = auth.currentUser;
          await db.collection('applications').doc(doc.id).update({
            assignedTo: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          show('Assigned to you.');
        };

        li.appendChild(approve);
        li.appendChild(reject);
        li.appendChild(assign);
        ul.appendChild(li);
      });
    });
}

async function updateApplicationStatus(appId, status) {
  await db.collection('applications').doc(appId).update({
    status,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  show('Application ' + status);
}

// -------------------- ADMIN PAGE --------------------
function initAdminPage(user, userDoc) {
  document.getElementById('welcomeAdmin').innerText = `Hello, ${userDoc.name} (${userDoc.email})`;
  loadServicesAdmin();
}

function createService() {
  const name = document.getElementById('newService').value.trim();
  if (!name) { show('Enter a service name'); return; }
  const user = auth.currentUser;
  db.collection('services').add({
    name,
    createdBy: user.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    document.getElementById('newService').value = '';
    show('Service created.');
  }).catch(err => show(err.message));
}

function loadServicesAdmin() {
  const ul = document.getElementById('serviceList');
  db.collection('services').orderBy('createdAt','desc').onSnapshot(snap => {
    ul.innerHTML = '';
    snap.forEach(doc => {
      const s = doc.data();
      const li = document.createElement('li');
      li.className = 'application';
      li.innerHTML = `<strong>${s.name}</strong> <div class="small">Created: ${s.createdAt ? new Date(s.createdAt.seconds*1000).toLocaleString() : ''}</div>`;
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.onclick = () => {
        if (confirm('Delete this service? This will not delete existing applications.')) {
          db.collection('services').doc(doc.id).delete();
        }
      };
      li.appendChild(del);
      ul.appendChild(li);
    });
  });
}
