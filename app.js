
// ================================================================
// CONFIG
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyB4JKtUh1-zCipkUOkBJbulFOXXQdXYJPc",
    authDomain: "guitar-tracker-7cc21.firebaseapp.com",
    projectId: "guitar-tracker-7cc21",
    storageBucket: "guitar-tracker-7cc21.firebasestorage.app",
    messagingSenderId: "928797317201",
    appId: "1:928797317201:web:ea0779530392c8f0fb8070"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();

let currentUser = null;
let guitars = [], stringChanges = [], setups = [];
let currentPage = 'guitars';

// ================================================================
// AUTH
// ================================================================
function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(result => {
        console.log('Sign in success:', result.user.email);
    }).catch(err => {
        console.error('Sign in error:', err);
        alert('Error: ' + err.message);
    });
}

function signOut() {
    if (confirm('¿Sign out?')) auth.signOut();
}

auth.getRedirectResult().then(result => {
    if (result && result.user) {
        console.log('Redirect sign-in successful');
    }
}).catch(err => {
    console.error('Redirect error:', err);
});

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('app').classList.remove('active');
        setupAvatars(user);
        loadData();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').classList.remove('active');
    }
});

function setupAvatars(user) {
    const url = user.photoURL || '';
    const name = user.displayName || user.email;
    document.getElementById('mobile-avatar').src = url;
    document.getElementById('desktop-avatar').src = url;
    document.getElementById('desktop-username').textContent = name;
}

// ================================================================
// FIRESTORE — Real-time listeners
// ================================================================
function userCol(name) {
    return firestore.collection('users').doc(currentUser.uid).collection(name);
}

function loadData() {
    userCol('guitars').onSnapshot(snap => {
        guitars = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        onDataReady();
    });

    userCol('stringChanges').orderBy('date', 'desc').onSnapshot(snap => {
        stringChanges = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        onDataReady();
    });

    userCol('setups').orderBy('date', 'desc').onSnapshot(snap => {
        setups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        onDataReady();
    });
}

function onDataReady() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('app').classList.add('active');
    render();
}

// ================================================================
// PHOTO UPLOAD -- Base64 (no Storage needed)
// ================================================================
let pendingPhotoFile = null;

function previewPhoto(input, mode) {
    const file = input.files[0];
    if (!file) return;
    pendingPhotoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photo-preview-' + mode);
        const placeholder = document.getElementById('photo-placeholder-' + mode);
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function uploadPhoto(guitarId) {
    if (!pendingPhotoFile) return null;
    const compressed = await compressImage(pendingPhotoFile, 600, 0.6);
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingPhotoFile = null;
            resolve(e.target.result);
        };
        reader.readAsDataURL(compressed);
    });
}

function compressImage(file, maxSize, quality) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) { h = (h / w) * maxSize; w = maxSize; }
                else { w = (w / h) * maxSize; h = maxSize; }
            }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = URL.createObjectURL(file);
    });
}

// ================================================================
// NAVIGATION
// ================================================================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPage = btn.dataset.page;
        document.querySelectorAll('.mobile-page').forEach(p => p.classList.remove('active'));
        document.getElementById('m-page-' + currentPage).classList.add('active');
        document.getElementById('m-fab').style.display = currentPage === 'settings' ? 'none' : 'flex';
    });
});

document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPage = btn.dataset.page;
        document.querySelectorAll('.desktop-page').forEach(p => p.classList.remove('active'));
        document.getElementById('d-page-' + currentPage).classList.add('active');
    });
});

function handleFab() {
    if (currentPage === 'guitars') openSheet('sheet-guitar', true);
    else if (currentPage === 'strings') openSheet('sheet-string');
    else if (currentPage === 'setups') openSheet('sheet-setup');
}

// ================================================================
// SHEETS & MODALS
// ================================================================
function openSheet(id, isNew) {
    pendingPhotoFile = null;
    if (id === 'sheet-guitar' && isNew) {
        document.getElementById('sheet-guitar-title').textContent = 'Add Guitar';
        document.getElementById('edit-guitar-id').value = '';
        document.getElementById('edit-guitar-photo-url').value = '';
        document.getElementById('photo-preview-mobile').style.display = 'none';
        document.getElementById('photo-placeholder-mobile').style.display = '';
        document.getElementById('f-guitar-photo').value = '';
        ['f-guitar-name','f-guitar-brand','f-guitar-model','f-guitar-year','f-guitar-tuning','f-guitar-notes'].forEach(x => document.getElementById(x).value = '');
    }
    if (id === 'sheet-string') { populateSelect('f-str-guitar'); document.getElementById('f-str-date').value = todayStr(); ['f-str-set','f-str-life','f-str-notes'].forEach(x => document.getElementById(x).value = ''); }
    if (id === 'sheet-setup') { populateSelect('f-setup-guitar'); document.getElementById('f-setup-date').value = todayStr(); ['f-setup-by','f-setup-details'].forEach(x => document.getElementById(x).value = ''); document.getElementById('f-setup-type').value = 'Full Setup'; }
    document.getElementById(id).classList.add('active');
}

function closeSheet(id) { document.getElementById(id).classList.remove('active'); }

function openModal(id, isNew) {
    pendingPhotoFile = null;
    if (id === 'modal-guitar' && isNew) {
        document.getElementById('modal-guitar-title').textContent = 'Add Guitar';
        document.getElementById('mf-guitar-id').value = '';
        document.getElementById('mf-guitar-photo-url').value = '';
        document.getElementById('photo-preview-desktop').style.display = 'none';
        document.getElementById('photo-placeholder-desktop').style.display = '';
        document.getElementById('mf-guitar-photo').value = '';
        ['mf-guitar-name','mf-guitar-brand','mf-guitar-model','mf-guitar-year','mf-guitar-tuning','mf-guitar-notes'].forEach(x => document.getElementById(x).value = '');
    }
    if (id === 'modal-string') { populateSelect('mf-str-guitar'); document.getElementById('mf-str-date').value = todayStr(); ['mf-str-set','mf-str-life','mf-str-notes'].forEach(x => document.getElementById(x).value = ''); }
    if (id === 'modal-setup') { populateSelect('mf-setup-guitar'); document.getElementById('mf-setup-date').value = todayStr(); ['mf-setup-by','mf-setup-details'].forEach(x => document.getElementById(x).value = ''); document.getElementById('mf-setup-type').value = 'Full Setup'; }
    document.getElementById(id).classList.add('active');
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function todayStr() { return new Date().toISOString().split('T')[0]; }

function populateSelect(selId) {
    const sel = document.getElementById(selId);
    sel.innerHTML = guitars.length === 0
        ? '<option value="">No guitars</option>'
        : guitars.map(g => '<option value="' + g.id + '">' + g.name + '</option>').join('');
}

// ================================================================
// SAVE — MOBILE
// ================================================================
async function saveGuitar() {
    const name = document.getElementById('f-guitar-name').value.trim();
    if (!name) return Swal.fire({ icon: 'warning', title: 'Missing name', text: 'Enter a guitar name.', background: '#1a1a1a', color: '#f0f0f0' });
    const editId = document.getElementById('edit-guitar-id').value;
    const guitarId = editId || userCol('guitars').doc().id;

    let photoURL = document.getElementById('edit-guitar-photo-url').value || null;

    if (pendingPhotoFile) {
        Swal.fire({ title: 'Uploading photo...', text: 'Compressing and saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        photoURL = await uploadPhoto(guitarId);
        Swal.fire({ title: 'Saving guitar...', text: 'Almost done...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    } else {
        Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    }

    const data = {
        name: name,
        brand: document.getElementById('f-guitar-brand').value.trim(),
        model: document.getElementById('f-guitar-model').value.trim(),
        year: document.getElementById('f-guitar-year').value.trim(),
        tuning: document.getElementById('f-guitar-tuning').value.trim(),
        notes: document.getElementById('f-guitar-notes').value.trim(),
        photoURL: photoURL
    };

    try {
        await userCol('guitars').doc(guitarId).set(data);
        closeSheet('sheet-guitar');
        Swal.fire({ icon: 'success', title: 'Guitar saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

async function saveStringChange() {
    const guitarId = document.getElementById('f-str-guitar').value;
    const date = document.getElementById('f-str-date').value;
    const stringSet = document.getElementById('f-str-set').value.trim();
    if (!guitarId || !date || !stringSet) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill all required fields.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await userCol('stringChanges').add({
            guitarId: guitarId,
            date: date,
            stringSet: stringSet,
            lifespan: parseInt(document.getElementById('f-str-life').value) || null,
            notes: document.getElementById('f-str-notes').value.trim()
        });
        closeSheet('sheet-string');
        Swal.fire({ icon: 'success', title: 'String change saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

async function saveSetup() {
    const guitarId = document.getElementById('f-setup-guitar').value;
    const date = document.getElementById('f-setup-date').value;
    const details = document.getElementById('f-setup-details').value.trim();
    if (!guitarId || !date || !details) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill all required fields.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await userCol('setups').add({
            guitarId: guitarId,
            date: date,
            type: document.getElementById('f-setup-type').value,
            doneBy: document.getElementById('f-setup-by').value.trim(),
            details: details
        });
        closeSheet('sheet-setup');
        Swal.fire({ icon: 'success', title: 'Setup saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

// ================================================================
// SAVE — DESKTOP
// ================================================================
async function saveGuitarDesktop() {
    const name = document.getElementById('mf-guitar-name').value.trim();
    if (!name) return Swal.fire({ icon: 'warning', title: 'Missing name', text: 'Enter a guitar name.', background: '#1a1a1a', color: '#f0f0f0' });
    const editId = document.getElementById('mf-guitar-id').value;
    const guitarId = editId || userCol('guitars').doc().id;

    let photoURL = document.getElementById('mf-guitar-photo-url').value || null;

    if (pendingPhotoFile) {
        Swal.fire({ title: 'Uploading photo...', text: 'Compressing and saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
        photoURL = await uploadPhoto(guitarId);
        Swal.fire({ title: 'Saving guitar...', text: 'Almost done...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    } else {
        Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    }

    const data = {
        name: name,
        brand: document.getElementById('mf-guitar-brand').value.trim(),
        model: document.getElementById('mf-guitar-model').value.trim(),
        year: document.getElementById('mf-guitar-year').value.trim(),
        tuning: document.getElementById('mf-guitar-tuning').value.trim(),
        notes: document.getElementById('mf-guitar-notes').value.trim(),
        photoURL: photoURL
    };

    try {
        await userCol('guitars').doc(guitarId).set(data);
        closeModal('modal-guitar');
        Swal.fire({ icon: 'success', title: 'Guitar saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

async function saveStringDesktop() {
    const guitarId = document.getElementById('mf-str-guitar').value;
    const date = document.getElementById('mf-str-date').value;
    const stringSet = document.getElementById('mf-str-set').value.trim();
    if (!guitarId || !date || !stringSet) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill all required fields.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await userCol('stringChanges').add({
            guitarId: guitarId,
            date: date,
            stringSet: stringSet,
            lifespan: parseInt(document.getElementById('mf-str-life').value) || null,
            notes: document.getElementById('mf-str-notes').value.trim()
        });
        closeModal('modal-string');
        Swal.fire({ icon: 'success', title: 'String change saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

async function saveSetupDesktop() {
    const guitarId = document.getElementById('mf-setup-guitar').value;
    const date = document.getElementById('mf-setup-date').value;
    const details = document.getElementById('mf-setup-details').value.trim();
    if (!guitarId || !date || !details) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill all required fields.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await userCol('setups').add({
            guitarId: guitarId,
            date: date,
            type: document.getElementById('mf-setup-type').value,
            doneBy: document.getElementById('mf-setup-by').value.trim(),
            details: details
        });
        closeModal('modal-setup');
        Swal.fire({ icon: 'success', title: 'Setup saved!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}


// ================================================================
// DELETE — con SweetAlert2 confirmación
// ================================================================
async function deleteGuitar(id) {
    const result = await Swal.fire({
        title: 'Delete guitar?',
        text: 'This will delete the guitar and all its history.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#333',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        background: '#1a1a1a',
        color: '#f0f0f0'
    });
    if (!result.isConfirmed) return;

    Swal.fire({ title: 'Deleting...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
        await userCol('guitars').doc(id).delete();
        const strSnap = await userCol('stringChanges').where('guitarId', '==', id).get();
        const setupSnap = await userCol('setups').where('guitarId', '==', id).get();
        const batch = firestore.batch();
        strSnap.docs.forEach(d => batch.delete(d.ref));
        setupSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    }
}

async function deleteStringChange(id) {
    const result = await Swal.fire({
        title: 'Delete this entry?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#333',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        background: '#1a1a1a',
        color: '#f0f0f0'
    });
    if (!result.isConfirmed) return;
    await userCol('stringChanges').doc(id).delete();
    Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
}

async function deleteSetup(id) {
    const result = await Swal.fire({
        title: 'Delete this entry?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#333',
        confirmButtonText: 'Yes, delete',
        cancelButtonText: 'Cancel',
        background: '#1a1a1a',
        color: '#f0f0f0'
    });
    if (!result.isConfirmed) return;
    await userCol('setups').doc(id).delete();
    Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
}


// ================================================================
// EDIT GUITAR
// ================================================================
function editGuitarMobile(id) {
    const g = guitars.find(x => x.id === id);
    if (!g) return;
    pendingPhotoFile = null;
    document.getElementById('sheet-guitar-title').textContent = 'Edit Guitar';
    document.getElementById('edit-guitar-id').value = g.id;
    document.getElementById('edit-guitar-photo-url').value = g.photoURL || '';
    document.getElementById('f-guitar-name').value = g.name;
    document.getElementById('f-guitar-brand').value = g.brand || '';
    document.getElementById('f-guitar-model').value = g.model || '';
    document.getElementById('f-guitar-year').value = g.year || '';
    document.getElementById('f-guitar-tuning').value = g.tuning || '';
    document.getElementById('f-guitar-notes').value = g.notes || '';
    document.getElementById('f-guitar-photo').value = '';

    const preview = document.getElementById('photo-preview-mobile');
    const placeholder = document.getElementById('photo-placeholder-mobile');
    if (g.photoURL) {
        preview.src = g.photoURL;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = '';
    }
    document.getElementById('sheet-guitar').classList.add('active');
}

function editGuitarDesktop(id) {
    const g = guitars.find(x => x.id === id);
    if (!g) return;
    pendingPhotoFile = null;
    document.getElementById('modal-guitar-title').textContent = 'Edit Guitar';
    document.getElementById('mf-guitar-id').value = g.id;
    document.getElementById('mf-guitar-photo-url').value = g.photoURL || '';
    document.getElementById('mf-guitar-name').value = g.name;
    document.getElementById('mf-guitar-brand').value = g.brand || '';
    document.getElementById('mf-guitar-model').value = g.model || '';
    document.getElementById('mf-guitar-year').value = g.year || '';
    document.getElementById('mf-guitar-tuning').value = g.tuning || '';
    document.getElementById('mf-guitar-notes').value = g.notes || '';
    document.getElementById('mf-guitar-photo').value = '';

    const preview = document.getElementById('photo-preview-desktop');
    const placeholder = document.getElementById('photo-placeholder-desktop');
    if (g.photoURL) {
        preview.src = g.photoURL;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        preview.style.display = 'none';
        placeholder.style.display = '';
    }
    document.getElementById('modal-guitar').classList.add('active');
}

// ================================================================
// STRING STATUS & ALERTS
// ================================================================
function getStringStatus(guitarId) {
    const changes = stringChanges.filter(s => s.guitarId === guitarId).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (changes.length === 0) return { cls: 'badge-none', text: 'No data', stringSet: null, daysLeft: null };
    const latest = changes[0];
    if (!latest.lifespan) return { cls: 'badge-fresh', text: 'OK', stringSet: latest.stringSet, daysLeft: null };
    const due = new Date(latest.date);
    due.setDate(due.getDate() + latest.lifespan);
    const daysLeft = Math.ceil((due - new Date()) / 86400000);
    if (daysLeft < 0) return { cls: 'badge-overdue', text: Math.abs(daysLeft) + 'd overdue', stringSet: latest.stringSet, daysLeft: daysLeft };
    if (daysLeft <= 7) return { cls: 'badge-due', text: daysLeft + 'd left', stringSet: latest.stringSet, daysLeft: daysLeft };
    return { cls: 'badge-fresh', text: daysLeft + 'd left', stringSet: latest.stringSet, daysLeft: daysLeft };
}

function getAlerts() {
    const overdue = [];
    const dueSoon = [];
    guitars.forEach(g => {
        const status = getStringStatus(g.id);
        if (status.daysLeft !== null && status.daysLeft < 0) {
            overdue.push({ name: g.name, days: Math.abs(status.daysLeft), id: g.id });
        } else if (status.daysLeft !== null && status.daysLeft <= 7) {
            dueSoon.push({ name: g.name, days: status.daysLeft, id: g.id });
        }
    });
    return { overdue: overdue, dueSoon: dueSoon };
}

function renderAlerts() {
    const alerts = getAlerts();
    let html = '';

    if (alerts.overdue.length > 0) {
        html += '<div class="alerts-banner"><h3>⚠️ Strings Overdue</h3>';
        alerts.overdue.forEach(a => {
            html += '<div class="alert-item"><span class="guitar">' + a.name + '</span><span class="days">' + a.days + 'd overdue</span></div>';
        });
        html += '</div>';
    }

    if (alerts.dueSoon.length > 0) {
        html += '<div class="alerts-banner alerts-banner-warning"><h3>🔔 Change Soon</h3>';
        alerts.dueSoon.forEach(a => {
            html += '<div class="alert-item"><span class="guitar">' + a.name + '</span><span class="days">' + a.days + 'd left</span></div>';
        });
        html += '</div>';
    }

    document.getElementById('m-alerts').innerHTML = html;
    document.getElementById('d-alerts').innerHTML = html;
}

// ================================================================
// RENDER
// ================================================================
function render() {
    renderAlerts();
    renderGuitars();
    renderStrings();
    renderSetups();
    renderSettings();
}

function renderGuitars() {
    const isMobile = window.innerWidth <= 768;

    let html = '';
    if (guitars.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🎸</div><p>No guitars yet. Add one!</p></div>';
    } else {
        guitars.forEach(g => {
            const ss = getStringStatus(g.id);
            const lastSetup = setups.filter(s => s.guitarId === g.id)[0];
            const photoHtml = g.photoURL
                ? '<img class="guitar-photo" src="' + g.photoURL + '" alt="' + g.name + '">'
                : '<div class="guitar-photo-placeholder">🎸</div>';

            let cardFields = '';
            if (g.brand) cardFields += '<div class="card-field"><span class="label">Brand</span><span class="value">' + g.brand + '</span></div>';
            if (g.model) cardFields += '<div class="card-field"><span class="label">Model</span><span class="value">' + g.model + '</span></div>';
            if (g.tuning) cardFields += '<div class="card-field"><span class="label">Tuning</span><span class="value">' + g.tuning + '</span></div>';
            if (ss.stringSet) cardFields += '<div class="card-field"><span class="label">Current Strings</span><span class="value">' + ss.stringSet + '</span></div>';
            cardFields += '<div class="card-field"><span class="label">Last Setup</span><span class="value">' + (lastSetup ? lastSetup.date + ' · ' + lastSetup.type : '—') + '</span></div>';

            const editFn = isMobile ? "editGuitarMobile('" + g.id + "')" : "editGuitarDesktop('" + g.id + "')";

            html += '<div class="card">';
            html += '<div class="card-header"><span class="card-title">' + g.name + '</span><span class="badge ' + ss.cls + '">' + ss.text + '</span></div>';
            html += '<div class="guitar-card-content">' + photoHtml + '<div class="guitar-card-info"><div class="card-grid">' + cardFields + '</div></div></div>';
            html += '<div class="actions"><button class="btn btn-secondary btn-small" onclick="' + editFn + '">Edit</button>';
            html += '<button class="btn btn-danger btn-small" onclick="deleteGuitar(\'' + g.id + '\')">Delete</button></div>';
            html += '</div>';
        });
    }

    document.getElementById('m-page-guitars').innerHTML = html;
    document.getElementById('d-page-guitars').innerHTML =
        '<h2>My Guitars</h2>' +
        '<p class="subtitle">' + guitars.length + ' guitar' + (guitars.length !== 1 ? 's' : '') + ' in your collection</p>' +
        '<button class="desktop-add-btn" onclick="openModal(\'modal-guitar\', true)">+ Add Guitar</button>' +
        html;
}

function renderStrings() {
    let html = '';
    if (stringChanges.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🎵</div><p>No string changes logged yet.</p></div>';
    } else {
        stringChanges.forEach(s => {
            const g = guitars.find(x => x.id === s.guitarId);
            html += '<div class="history-item">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center">';
            html += '<span class="guitar-name">' + (g ? g.name : 'Unknown') + '</span>';
            html += '<button class="btn btn-danger btn-small" onclick="deleteStringChange(\'' + s.id + '\')">✕</button></div>';
            html += '<div class="date">' + s.date + '</div>';
            html += '<div class="detail">🎵 ' + s.stringSet + '</div>';
            if (s.lifespan) html += '<div class="meta">⏱ Change after ' + s.lifespan + ' days</div>';
            if (s.notes) html += '<div class="meta">' + s.notes + '</div>';
            html += '</div>';
        });
    }

    document.getElementById('m-page-strings').innerHTML = html;
    document.getElementById('d-page-strings').innerHTML =
        '<h2>String Changes</h2>' +
        '<p class="subtitle">' + stringChanges.length + ' entries</p>' +
        '<button class="desktop-add-btn" onclick="openModal(\'modal-string\')">+ Log String Change</button>' +
        html;
}

function renderSetups() {
    let html = '';
    if (setups.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🔧</div><p>No setups logged yet.</p></div>';
    } else {
        setups.forEach(s => {
            const g = guitars.find(x => x.id === s.guitarId);
            html += '<div class="history-item">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center">';
            html += '<span class="guitar-name">' + (g ? g.name : 'Unknown') + '</span>';
            html += '<button class="btn btn-danger btn-small" onclick="deleteSetup(\'' + s.id + '\')">✕</button></div>';
            html += '<div class="date">' + s.date + ' · ' + s.type + '</div>';
            if (s.doneBy) html += '<div class="meta">Done by: ' + s.doneBy + '</div>';
            html += '<div class="detail">' + s.details + '</div>';
            html += '</div>';
        });
    }

 document.getElementById('m-page-setups').innerHTML = html;
    document.getElementById('d-page-setups').innerHTML =
        '<h2>Setups & Service</h2>' +
        '<p class="subtitle">' + setups.length + ' entries</p>' +
        '<button class="desktop-add-btn" onclick="openModal(\'modal-setup\')">+ Log Setup</button>' +
        html;
}

function renderSettings() {
    const settingsHtml =
        '<div class="settings-section">' +
        '<h3>Data</h3>' +
        '<button class="settings-btn" onclick="exportData()"><span class="s-icon">📤</span> Export Backup (JSON)</button>' +
        '<button class="settings-btn" onclick="document.getElementById(\'import-input\').click()"><span class="s-icon">📥</span> Import Backup</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<h3>Account</h3>' +
        '<button class="settings-btn" onclick="signOut()"><span class="s-icon">🚪</span> Sign Out</button>' +
        '</div>';

    document.getElementById('m-page-settings').innerHTML = settingsHtml;
    document.getElementById('d-page-settings').innerHTML = '<h2>Settings</h2><p class="subtitle">Manage your data and account</p>' + settingsHtml;
}

// ================================================================
// EXPORT / IMPORT
// ================================================================
function exportData() {
    const data = { guitars: guitars, stringChanges: stringChanges, setups: setups, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'guitar-tracker-' + todayStr() + '.json';
    a.click();
}

document.getElementById('import-input').addEventListener('change', async (e) => {
    const file = e.target.files;
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm('Import ' + (data.guitars ? data.guitars.length : 0) + ' guitars, ' + (data.stringChanges ? data.stringChanges.length : 0) + ' string changes, ' + (data.setups ? data.setups.length : 0) + ' setups? This REPLACES current data.')) return;

        const gSnap = await userCol('guitars').get();
        const sSnap = await userCol('stringChanges').get();
        const uSnap = await userCol('setups').get();
        const batch = firestore.batch();
        gSnap.docs.forEach(d => batch.delete(d.ref));
        sSnap.docs.forEach(d => batch.delete(d.ref));
        uSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

        for (const g of (data.guitars || [])) { const id = g.id; delete g.id; await userCol('guitars').add(g); }
        for (const s of (data.stringChanges || [])) { const id = s.id; delete s.id; await userCol('stringChanges').add(s); }
        for (const s of (data.setups || [])) { const id = s.id; delete s.id; await userCol('setups').add(s); }
        alert('Import complete!');
    } catch (err) { alert('Import failed: ' + err.message); }
    e.target.value = '';
});

// ================================================================
// SERVICE WORKER
// ================================================================
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
