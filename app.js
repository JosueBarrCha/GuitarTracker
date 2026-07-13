
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

// ================================================================
// DATA READY
// ================================================================
var dataReady = 0;

function onDataReady() {
    dataReady++;
    if (dataReady >= 3) {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('app').classList.add('active');
        render();
    }
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
    else if (currentPage === 'strings') {
        Swal.fire({
            title: 'What do you want to add?',
            showCancelButton: true,
            confirmButtonText: '🎵 String Change',
            cancelButtonText: '📦 String Pack',
            confirmButtonColor: '#ff6b35',
            cancelButtonColor: '#333',
            background: '#1a1a1a',
            color: '#f0f0f0'
        }).then(function(result) {
            if (result.isConfirmed) openSheet('sheet-string');
            else if (result.dismiss === Swal.DismissReason.cancel) openSheet('sheet-inventory');
        });
    }
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

        // Auto-deduct from inventory
        var inv = (window.stringInventory || []).find(function(i) {
            return stringSet.toLowerCase().includes(i.name.toLowerCase()) ||
                   i.name.toLowerCase().includes(stringSet.toLowerCase());
        });
        if (inv && inv.qty > 0) {
            await userCol('stringInventory').doc(inv.id).update({ qty: inv.qty - 1 });
        }

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
// STRING STATUS & ALERTS & TIMER
// ================================================================
function getStringStatus(guitarId) {
    var changes = stringChanges.filter(function(s) { return s.guitarId === guitarId; }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    if (changes.length === 0) return { cls: 'badge-none', text: 'No data', stringSet: null, daysLeft: null, percent: 0, lifespan: 0 };
    var latest = changes[0];
    if (!latest.lifespan) return { cls: 'badge-fresh', text: 'OK', stringSet: latest.stringSet, daysLeft: null, percent: 100, lifespan: 0 };
    var due = new Date(latest.date);
    due.setDate(due.getDate() + latest.lifespan);
    var daysLeft = Math.ceil((due - new Date()) / 86400000);
    var daysUsed = latest.lifespan - daysLeft;
    var percent = Math.max(0, Math.min(100, Math.round((1 - daysUsed / latest.lifespan) * 100)));
    if (daysLeft < 0) return { cls: 'badge-overdue', text: Math.abs(daysLeft) + 'd overdue', stringSet: latest.stringSet, daysLeft: daysLeft, percent: 0, lifespan: latest.lifespan };
    if (daysLeft <= 7) return { cls: 'badge-due', text: daysLeft + 'd left', stringSet: latest.stringSet, daysLeft: daysLeft, percent: percent, lifespan: latest.lifespan };
    return { cls: 'badge-fresh', text: daysLeft + 'd left', stringSet: latest.stringSet, daysLeft: daysLeft, percent: percent, lifespan: latest.lifespan };
}

function getTimerBarHtml(status) {
    if (status.daysLeft === null) return '';
    var barClass = 'timer-bar-fresh';
    if (status.daysLeft <= 7 && status.daysLeft >= 0) barClass = 'timer-bar-due';
    if (status.daysLeft < 0) barClass = 'timer-bar-overdue';
    return '<div class="string-timer">' +
        '<div class="timer-bar-container"><div class="timer-bar ' + barClass + '" style="width:' + status.percent + '%"></div></div>' +
        '<div class="timer-label"><span>Installed</span><span>' + status.text + '</span></div>' +
        '</div>';
}

function getAlerts() {
    var overdue = [];
    var dueSoon = [];
    guitars.forEach(function(g) {
        var status = getStringStatus(g.id);
        if (status.daysLeft !== null && status.daysLeft < 0) {
            overdue.push({ name: g.name, days: Math.abs(status.daysLeft), id: g.id });
        } else if (status.daysLeft !== null && status.daysLeft <= 7) {
            dueSoon.push({ name: g.name, days: status.daysLeft, id: g.id });
        }
    });
    return { overdue: overdue, dueSoon: dueSoon };
}

function renderAlerts() {
    var alerts = getAlerts();
    var html = '';

    if (alerts.overdue.length > 0) {
        html += '<div class="alerts-banner"><h3>⚠️ Strings Overdue</h3>';
        alerts.overdue.forEach(function(a) {
            html += '<div class="alert-item"><span class="guitar">' + a.name + '</span><span class="days">' + a.days + 'd overdue</span></div>';
        });
        html += '</div>';
    }

    if (alerts.dueSoon.length > 0) {
        html += '<div class="alerts-banner alerts-banner-warning"><h3>🔔 Change Soon</h3>';
        alerts.dueSoon.forEach(function(a) {
            html += '<div class="alert-item"><span class="guitar">' + a.name + '</span><span class="days">' + a.days + 'd left</span></div>';
        });
        html += '</div>';
    }

    document.getElementById('m-alerts').innerHTML = html;
    document.getElementById('d-alerts').innerHTML = html;
}

// ================================================================
// CALENDAR REMINDER (.ics file)
// ================================================================
function addCalendarReminder(guitarId) {
    var g = guitars.find(function(x) { return x.id === guitarId; });
    if (!g) return;
    var status = getStringStatus(guitarId);
    var changes = stringChanges.filter(function(s) { return s.guitarId === guitarId; }).sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    if (changes.length === 0 || !changes[0].lifespan) {
        Swal.fire({ icon: 'info', title: 'No lifespan set', text: 'Log a string change with a "Change after" value first.', background: '#1a1a1a', color: '#f0f0f0' });
        return;
    }

    var latest = changes[0];
    var dueDate = new Date(latest.date);
    dueDate.setDate(dueDate.getDate() + latest.lifespan);

    // Format date as YYYYMMDD for .ics
    var year = dueDate.getFullYear();
    var month = String(dueDate.getMonth() + 1).padStart(2, '0');
    var day = String(dueDate.getDate()).padStart(2, '0');
    var dateStr = year + month + day;

    var now = new Date();
    var stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + 'T' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + '00';

    var ics = 'BEGIN:VCALENDAR\r\n' +
        'VERSION:2.0\r\n' +
        'PRODID:-//Guitar Tracker//EN\r\n' +
        'BEGIN:VEVENT\r\n' +
        'DTSTART;VALUE=DATE:' + dateStr + '\r\n' +
        'DTEND;VALUE=DATE:' + dateStr + '\r\n' +
        'DTSTAMP:' + stamp + '\r\n' +
        'SUMMARY:🎸 Change strings - ' + g.name + '\r\n' +
        'DESCRIPTION:Time to change strings on your ' + g.name + '. Current strings: ' + latest.stringSet + '\r\n' +
        'BEGIN:VALARM\r\n' +
        'TRIGGER:-P1D\r\n' +
        'ACTION:DISPLAY\r\n' +
        'DESCRIPTION:String change due tomorrow for ' + g.name + '\r\n' +
        'END:VALARM\r\n' +
        'END:VEVENT\r\n' +
        'END:VCALENDAR';

    var blob = new Blob([ics], { type: 'text/calendar' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'string-change-' + g.name.replace(/\s+/g, '-').toLowerCase() + '.ics';
    a.click();

    Swal.fire({ icon: 'success', title: 'Reminder created!', text: 'Open the downloaded file to add it to your calendar.', timer: 3000, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
}


// ================================================================
// GUITAR DETAIL VIEW
// ================================================================
function openGuitarDetail(guitarId) {
    var g = guitars.find(function(x) { return x.id === guitarId; });
    if (!g) return;

    var ss = getStringStatus(g.id);
    var guitarStrings = stringChanges.filter(function(s) { return s.guitarId === g.id; });
    var guitarSetups = setups.filter(function(s) { return s.guitarId === g.id; });
    var isMobile = window.innerWidth <= 768;

    var photoHtml = g.photoURL
        ? '<img class="detail-photo" src="' + g.photoURL + '" alt="' + g.name + '">'
        : '<div class="detail-photo-placeholder">🎸</div>';

    var specsHtml = '';
    if (g.brand) specsHtml += '<div class="detail-spec"><div class="label">Brand</div><div class="value">' + g.brand + '</div></div>';
    if (g.model) specsHtml += '<div class="detail-spec"><div class="label">Model</div><div class="value">' + g.model + '</div></div>';
    if (g.year) specsHtml += '<div class="detail-spec"><div class="label">Year</div><div class="value">' + g.year + '</div></div>';
    if (g.tuning) specsHtml += '<div class="detail-spec"><div class="label">Tuning</div><div class="value">' + g.tuning + '</div></div>';
    if (ss.stringSet) specsHtml += '<div class="detail-spec"><div class="label">Current Strings</div><div class="value">' + ss.stringSet + '</div></div>';
    specsHtml += '<div class="detail-spec"><div class="label">String Status</div><div class="value"><span class="badge ' + ss.cls + '">' + ss.text + '</span></div></div>';

    var timerHtml = getTimerBarHtml(ss);

    // String history table
    var stringsHtml = '';
    if (guitarStrings.length === 0) {
        stringsHtml = '<p style="color:var(--text-muted);font-size:0.85rem;">No string changes logged.</p>';
    } else {
        guitarStrings.forEach(function(s) {
            stringsHtml += '<div class="history-item">';
            stringsHtml += '<div class="date">' + s.date + '</div>';
            stringsHtml += '<div class="detail">🎵 ' + s.stringSet + '</div>';
            if (s.lifespan) stringsHtml += '<div class="meta">⏱ Change after ' + s.lifespan + ' days</div>';
            if (s.notes) stringsHtml += '<div class="meta">' + s.notes + '</div>';
            stringsHtml += '</div>';
        });
    }

    // Setups history
    var setupsHtml = '';
    if (guitarSetups.length === 0) {
        setupsHtml = '<p style="color:var(--text-muted);font-size:0.85rem;">No setups logged.</p>';
    } else {
        guitarSetups.forEach(function(s) {
            setupsHtml += '<div class="history-item">';
            setupsHtml += '<div class="date">' + s.date + ' · ' + s.type + '</div>';
            if (s.doneBy) setupsHtml += '<div class="meta">Done by: ' + s.doneBy + '</div>';
            setupsHtml += '<div class="detail">' + s.details + '</div>';
            setupsHtml += '</div>';
        });
    }

    var notesHtml = g.notes ? '<div class="detail-section"><div class="detail-section-header"><h3>📝 Notes</h3></div><p style="font-size:0.9rem;color:var(--text-muted);">' + g.notes + '</p></div>' : '';

    var html = '<div class="guitar-detail">' +
        '<button class="detail-back-btn" onclick="closeGuitarDetail()">← Back to guitars</button>' +
        '<div class="detail-hero">' + photoHtml + '</div>' +
        '<div class="detail-title">' + g.name + '</div>' +
        '<div class="detail-subtitle">' + [g.brand, g.model, g.year].filter(Boolean).join(' · ') + '</div>' +
        '<div class="detail-actions">' +
        '<button class="btn btn-primary btn-small" onclick="exportGuitarPDF(\'' + g.id + '\')">📄 Export PDF</button>' +
        '<button class="btn btn-calendar btn-small" onclick="addCalendarReminder(\'' + g.id + '\')">📅 Calendar</button>' +
        '<button class="btn btn-secondary btn-small" onclick="' + (isMobile ? "editGuitarMobile('" + g.id + "')" : "editGuitarDesktop('" + g.id + "')") + '">✏️ Edit</button>' +
        '</div>' +
        '<div class="detail-specs">' + specsHtml + '</div>' +
        timerHtml +
        notesHtml +
        '<div class="detail-section"><div class="detail-section-header"><h3>🎵 String History</h3></div>' + stringsHtml + '</div>' +
        '<div class="detail-section"><div class="detail-section-header"><h3>🔧 Setup History</h3></div>' + setupsHtml + '</div>' +
        '</div>';

    if (isMobile) {
        document.getElementById('m-page-guitars').innerHTML = html;
    } else {
        document.getElementById('d-page-guitars').innerHTML = html;
    }
}

function closeGuitarDetail() {
    renderGuitars();
}

// ================================================================
// EXPORT PDF — Technical Sheet
// ================================================================
function exportGuitarPDF(guitarId) {
    var g = guitars.find(function(x) { return x.id === guitarId; });
    if (!g) return;

    var ss = getStringStatus(g.id);
    var guitarStrings = stringChanges.filter(function(s) { return s.guitarId === g.id; });
    var guitarSetups = setups.filter(function(s) { return s.guitarId === g.id; });

    Swal.fire({ title: 'Generating PDF...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });

    var photoHtml = g.photoURL
       ? '<img style="display:block;margin:0 auto 16px;max-width:60%;max-height:200px;object-fit:contain;border-radius:8px;" src="' + g.photoURL + '">'
        : '';

    var specsHtml = '';
    if (g.brand) specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">Brand</div><div style="font-size:14px;font-weight:600;">' + g.brand + '</div></div>';
    if (g.model) specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">Model</div><div style="font-size:14px;font-weight:600;">' + g.model + '</div></div>';
    if (g.year) specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">Year</div><div style="font-size:14px;font-weight:600;">' + g.year + '</div></div>';
    if (g.tuning) specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">Tuning</div><div style="font-size:14px;font-weight:600;">' + g.tuning + '</div></div>';
    if (ss.stringSet) specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">Current Strings</div><div style="font-size:14px;font-weight:600;">' + ss.stringSet + '</div></div>';
    specsHtml += '<div style="background:#f5f5f5;padding:10px;border-radius:6px;"><div style="font-size:10px;text-transform:uppercase;color:#666;">String Status</div><div style="font-size:14px;font-weight:600;">' + ss.text + '</div></div>';

    var stringsTableHtml = '';
    if (guitarStrings.length > 0) {
        stringsTableHtml = '<div style="margin-bottom:16px;"><h2 style="font-size:14px;text-transform:uppercase;color:#ff6b35;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">🎵 String Change History</h2><table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Date</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">String Set</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Lifespan</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Notes</th></tr>';
        guitarStrings.forEach(function(s) {
            stringsTableHtml += '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + s.date + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + s.stringSet + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + (s.lifespan ? s.lifespan + ' days' : '—') + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + (s.notes || '—') + '</td></tr>';
        });
        stringsTableHtml += '</table></div>';
    }

    var setupsTableHtml = '';
    if (guitarSetups.length > 0) {
        setupsTableHtml = '<div style="margin-bottom:16px;"><h2 style="font-size:14px;text-transform:uppercase;color:#ff6b35;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">🔧 Setup & Service History</h2><table style="width:100%;border-collapse:collapse;font-size:11px;"><tr style="background:#f0f0f0;"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Date</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Type</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Done By</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Details</th></tr>';
        guitarSetups.forEach(function(s) {
            setupsTableHtml += '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + s.date + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + s.type + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + (s.doneBy || '—') + '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;">' + s.details + '</td></tr>';
        });
        setupsTableHtml += '</table></div>';
    }

    var notesHtml = g.notes ? '<div style="margin-bottom:16px;"><h2 style="font-size:14px;text-transform:uppercase;color:#ff6b35;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:8px;">📝 Notes</h2><p style="font-size:12px;color:#333;">' + g.notes + '</p></div>' : '';

    var today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var pdfHtml = '<div style="width:210mm;padding:20mm;background:#ffffff;color:#111111;font-family:Helvetica,Arial,sans-serif;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #ff6b35;padding-bottom:12px;margin-bottom:20px;"><h1 style="font-size:24px;margin:0;">' + g.name + '</h1><div style="font-size:14px;color:#666;">🎸 Guitar Tracker</div></div>' +
        photoHtml +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">' + specsHtml + '</div>' +
        stringsTableHtml +
        setupsTableHtml +
        notesHtml +
        '<div style="margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999;text-align:center;">Generated by Guitar Tracker · ' + today + '</div>' +
        '</div>';

    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-1';
    container.style.opacity = '1';
    container.innerHTML = pdfHtml;
    document.body.appendChild(container);

    var element = container.firstChild;

    var opt = {
        margin: 0,
        filename: g.name.replace(/\s+/g, '-').toLowerCase() + '-technical-sheet.pdf',
        image: { type: 'jpeg', quality: 0.9 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(function() {
        document.body.removeChild(container);
        Swal.fire({ icon: 'success', title: 'PDF exported!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
    }).catch(function(err) {
        document.body.removeChild(container);
        Swal.fire({ icon: 'error', title: 'PDF Error', text: err.message, background: '#1a1a1a', color: '#f0f0f0' });
    });
}


// ================================================================
// EXPORT PDF — Technical Sheet
// ================================================================



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
    var isMobile = window.innerWidth <= 768;

    var html = '';
    if (guitars.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🎸</div><p>No guitars yet. Add one!</p></div>';
    } else {
        guitars.forEach(function(g) {
            var ss = getStringStatus(g.id);
            var lastSetup = setups.filter(function(s) { return s.guitarId === g.id; })[0];
            var photoHtml = g.photoURL
                ? '<img class="guitar-photo" src="' + g.photoURL + '" alt="' + g.name + '">'
                : '<div class="guitar-photo-placeholder">🎸</div>';

            var cardFields = '';
            if (g.brand) cardFields += '<div class="card-field"><span class="label">Brand</span><span class="value">' + g.brand + '</span></div>';
            if (g.model) cardFields += '<div class="card-field"><span class="label">Model</span><span class="value">' + g.model + '</span></div>';
            if (g.tuning) cardFields += '<div class="card-field"><span class="label">Tuning</span><span class="value">' + g.tuning + '</span></div>';
            if (ss.stringSet) cardFields += '<div class="card-field"><span class="label">Current Strings</span><span class="value">' + ss.stringSet + '</span></div>';
            cardFields += '<div class="card-field"><span class="label">Last Setup</span><span class="value">' + (lastSetup ? lastSetup.date + ' · ' + lastSetup.type : '—') + '</span></div>';

            var timerHtml = getTimerBarHtml(ss);
            var editFn = isMobile ? "editGuitarMobile('" + g.id + "')" : "editGuitarDesktop('" + g.id + "')";

            html += '<div class="card">';
            html += '<div class="card-header" style="cursor:pointer" onclick="openGuitarDetail(\'' + g.id + '\')"><span class="card-title">' + g.name + '</span><span class="badge ' + ss.cls + '">' + ss.text + '</span></div>';
            html += '<div class="guitar-card-content">' + photoHtml + '<div class="guitar-card-info"><div class="card-grid">' + cardFields + '</div></div></div>';
            html += timerHtml;
            html += '<div class="actions">';
            html += '<button class="btn btn-secondary btn-small" onclick="' + editFn + '">Edit</button>';
            html += '<button class="btn btn-danger btn-small" onclick="deleteGuitar(\'' + g.id + '\')">Delete</button>';
            html += '<button class="btn btn-calendar btn-small" onclick="addCalendarReminder(\'' + g.id + '\')" title="Add to calendar">📅</button>';
            html += '</div></div>';
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
    var filterHtml = '<div class="filter-bar">' +
        '<label>Filter:</label>' +
        '<select id="filter-strings" onchange="renderStrings()">' +
        '<option value="all">All guitars</option>';
    guitars.forEach(function(g) {
        filterHtml += '<option value="' + g.id + '">' + g.name + '</option>';
    });
    filterHtml += '</select></div>';

    var filterEl = document.getElementById('filter-strings');
    var filterValue = filterEl ? filterEl.value : 'all';

    var filtered = filterValue === 'all'
        ? stringChanges
        : stringChanges.filter(function(s) { return s.guitarId === filterValue; });

    var html = '';
    if (filtered.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🎵</div><p>No string changes logged yet.</p></div>';
    } else {
        filtered.forEach(function(s) {
            var g = guitars.find(function(x) { return x.id === s.guitarId; });
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

    document.getElementById('m-page-strings').innerHTML = filterHtml + html;
    document.getElementById('d-page-strings').innerHTML =
        '<h2>String Changes</h2>' +
        '<p class="subtitle">' + stringChanges.length + ' entries</p>' +
        '<button class="desktop-add-btn" onclick="openModal(\'modal-string\')">+ Log String Change</button>' +
        '<button class="desktop-add-btn" style="background:var(--surface);border:1px solid var(--border);color:var(--text);margin-left:8px;" onclick="openModal(\'modal-inventory\')">📦 Add String Pack</button>' +
        filterHtml + html;

    // Restore filter value after re-render
    var newFilterEl = document.getElementById('filter-strings');
    if (newFilterEl) newFilterEl.value = filterValue;

    // Also update desktop filter
    var allFilters = document.querySelectorAll('#filter-strings');
    allFilters.forEach(function(el) { el.value = filterValue; });

    // Load inventory after strings page is rendered
    loadInventory();
}


function renderSetups() {
    var filterHtml = '<div class="filter-bar">' +
        '<label>Filter:</label>' +
        '<select id="filter-setups" onchange="renderSetups()">' +
        '<option value="all">All guitars</option>';
    guitars.forEach(function(g) {
        filterHtml += '<option value="' + g.id + '">' + g.name + '</option>';
    });
    filterHtml += '</select></div>';

    var filterEl = document.getElementById('filter-setups');
    var filterValue = filterEl ? filterEl.value : 'all';

    var filtered = filterValue === 'all'
        ? setups
        : setups.filter(function(s) { return s.guitarId === filterValue; });

    var html = '';
    if (filtered.length === 0) {
        html = '<div class="empty-state"><div class="big-icon">🔧</div><p>No setups logged yet.</p></div>';
    } else {
        filtered.forEach(function(s) {
            var g = guitars.find(function(x) { return x.id === s.guitarId; });
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

    document.getElementById('m-page-setups').innerHTML = filterHtml + html;
    document.getElementById('d-page-setups').innerHTML =
        '<h2>Setups & Service</h2>' +
        '<p class="subtitle">' + setups.length + ' entries</p>' +
        '<button class="desktop-add-btn" onclick="openModal(\'modal-setup\')">+ Log Setup</button>' +
        filterHtml + html;

    // Restore filter value
    var newFilterEl = document.getElementById('filter-setups');
    if (newFilterEl) newFilterEl.value = filterValue;

    var allFilters = document.querySelectorAll('#filter-setups');
    allFilters.forEach(function(el) { el.value = filterValue; });
}

function renderSettings() {
    var settingsHtml =
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
// STRING INVENTORY
// ================================================================
function loadInventory() {
    userCol('stringInventory').onSnapshot(function(snap) {
        window.stringInventory = snap.docs.map(function(d) { return { id: d.id, ...d.data() }; });
        renderInventory();
    });
}

function renderInventory() {
    var inv = window.stringInventory || [];
    var html = '<div class="detail-section"><div class="detail-section-header"><h3>📦 String Inventory</h3></div>';

    if (inv.length === 0) {
        html += '<p style="color:var(--text-muted);font-size:0.85rem;">No string packs in stock.</p>';
    } else {
        inv.forEach(function(item) {
            html += '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<div><div style="font-weight:600;">' + item.name + '</div><div style="font-size:0.8rem;color:var(--text-muted);">' + item.gauge + '</div></div>';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<button class="btn btn-secondary btn-small" onclick="updateInventoryQty(\'' + item.id + '\', -1)">−</button>';
            html += '<span style="font-size:1.1rem;font-weight:700;min-width:24px;text-align:center;">' + item.qty + '</span>';
            html += '<button class="btn btn-secondary btn-small" onclick="updateInventoryQty(\'' + item.id + '\', 1)">+</button>';
            html += '<button class="btn btn-danger btn-small" onclick="deleteInventoryItem(\'' + item.id + '\')" style="margin-left:8px;">✕</button>';
            html += '</div></div>';
        });
    }

    html += '</div>';

    // Inject into strings page below the filter
    var mPage = document.getElementById('m-page-strings');
    var dPage = document.getElementById('d-page-strings');
    if (mPage && !mPage.querySelector('.inv-section')) {
        var div = document.createElement('div');
        div.className = 'inv-section';
        div.innerHTML = html;
        mPage.appendChild(div);
    } else if (mPage) {
        mPage.querySelector('.inv-section').innerHTML = html;
    }
    if (dPage && !dPage.querySelector('.inv-section')) {
        var div2 = document.createElement('div');
        div2.className = 'inv-section';
        div2.innerHTML = html;
        dPage.appendChild(div2);
    } else if (dPage) {
        dPage.querySelector('.inv-section').innerHTML = html;
    }
}

async function saveInventory() {
    var name = document.getElementById('f-inv-name').value.trim();
    var gauge = document.getElementById('f-inv-gauge').value.trim();
    var qty = parseInt(document.getElementById('f-inv-qty').value) || 1;
    if (!name || !gauge) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill brand and gauge.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });

    // Check if same string already exists, if so add to qty
    var existing = (window.stringInventory || []).find(function(i) { return i.name.toLowerCase() === name.toLowerCase() && i.gauge === gauge; });
    if (existing) {
        await userCol('stringInventory').doc(existing.id).update({ qty: existing.qty + qty });
    } else {
        await userCol('stringInventory').add({ name: name, gauge: gauge, qty: qty });
    }

    closeSheet('sheet-inventory');
    Swal.fire({ icon: 'success', title: 'Added to inventory!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
}

async function saveInventoryDesktop() {
    var name = document.getElementById('mf-inv-name').value.trim();
    var gauge = document.getElementById('mf-inv-gauge').value.trim();
    var qty = parseInt(document.getElementById('mf-inv-qty').value) || 1;
    if (!name || !gauge) return Swal.fire({ icon: 'warning', title: 'Missing fields', text: 'Fill brand and gauge.', background: '#1a1a1a', color: '#f0f0f0' });

    Swal.fire({ title: 'Saving...', background: '#1a1a1a', color: '#f0f0f0', allowOutsideClick: false, didOpen: function() { Swal.showLoading(); } });

    var existing = (window.stringInventory || []).find(function(i) { return i.name.toLowerCase() === name.toLowerCase() && i.gauge === gauge; });
    if (existing) {
        await userCol('stringInventory').doc(existing.id).update({ qty: existing.qty + qty });
    } else {
        await userCol('stringInventory').add({ name: name, gauge: gauge, qty: qty });
    }

    closeModal('modal-inventory');
    Swal.fire({ icon: 'success', title: 'Added to inventory!', timer: 1500, showConfirmButton: false, background: '#1a1a1a', color: '#f0f0f0' });
}

async function updateInventoryQty(id, change) {
    var item = (window.stringInventory || []).find(function(i) { return i.id === id; });
    if (!item) return;
    var newQty = item.qty + change;
    if (newQty <= 0) {
        var result = await Swal.fire({
            title: 'Remove from inventory?',
            text: 'This pack will be removed.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f87171',
            cancelButtonColor: '#333',
            confirmButtonText: 'Yes, remove',
            background: '#1a1a1a',
            color: '#f0f0f0'
        });
        if (result.isConfirmed) await userCol('stringInventory').doc(id).delete();
    } else {
        await userCol('stringInventory').doc(id).update({ qty: newQty });
    }
}

async function deleteInventoryItem(id) {
    var result = await Swal.fire({
        title: 'Delete this item?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f87171',
        cancelButtonColor: '#333',
        confirmButtonText: 'Yes, delete',
        background: '#1a1a1a',
        color: '#f0f0f0'
    });
    if (result.isConfirmed) await userCol('stringInventory').doc(id).delete();
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
