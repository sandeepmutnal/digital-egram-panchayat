// register, login, logout & role-based redirect

function initRegister(){
  const form = document.getElementById('registerForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    try {
      const res = await auth.createUserWithEmailAndPassword(email, password);
      const uid = res.user.uid;
      await db.collection('users').doc(uid).set({
        name, email, role, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      Logger.info('User registered', { uid, email, role });
      alert('Registered — please login');
      window.location = 'login.html';
    } catch (err) {
      Logger.error('Register failed', { error: err.message });
      alert('Registration failed: ' + err.message);
    }
  });
}

function initLogin(){
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const res = await auth.signInWithEmailAndPassword(email, password);
      const uid = res.user.uid;
      const snap = await db.collection('users').doc(uid).get();
      const data = snap.data();
      Logger.info('Login', { uid, role: data && data.role });
      if (data && data.role === 'admin') window.location = 'admin-dashboard.html';
      else if (data && data.role === 'staff') window.location = 'staff-dashboard.html';
      else window.location = 'user-dashboard.html';
    } catch (err) {
      Logger.error('Login failed', { error: err.message });
      alert('Login failed: ' + err.message);
    }
  });
}

function setupLogout() {
  document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'logoutBtn') {
      auth.signOut().then(() => {
        Logger.info('Logout');
        window.location = 'index.html';
      }).catch(e => {
        Logger.error('Logout failed', { error: e.message });
      });
    }
  });
}

// run anywhere included
setupLogout();

// export
window.initRegister = initRegister;
window.initLogin = initLogin;
