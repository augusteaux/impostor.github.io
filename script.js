const IMPOSTOR_PATH = 'impostor/impostor.png';
const AVATAR_PATH = 'foto/';

let currentUser = { 
    nick: '', 
    photo: '', 
    isHost: false, 
    id: Math.random().toString(36).substr(2, 9) 
};

let roomData = { pass: '', players: {}, photoQueue: [], currentIndex: 0, status: 'lobby', impostorId: '', revealed: false };

// --- GENERADOR DE AVATARES (1-13 con extensiones mixtas) ---
const selector = document.getElementById('avatar-selector');
const extensions = ['jpg', 'png', 'jpeg'];

for (let i = 1; i <= 13; i++) {
    const img = document.createElement('img');
    img.className = 'avatar-opt';
    
    let extIdx = 0;
    const tryLoad = () => {
        if (extIdx < extensions.length) {
            img.src = `${AVATAR_PATH}${i}.${extensions[extIdx]}`;
            extIdx++;
        }
    };
    img.onerror = tryLoad;
    tryLoad();

    img.onclick = () => {
        currentUser.photo = img.src;
        document.getElementById('current-avatar').src = img.src;
        selector.classList.add('hidden');
    };
    selector.appendChild(img);
}

// Fallback inicial
setTimeout(() => { if(!currentUser.photo) currentUser.photo = document.getElementById('current-avatar').src; }, 1000);

window.toggleAvatarSelector = () => selector.classList.toggle('hidden');

// --- NAVEGACIÓN ---
window.goBack = () => {
    if (roomData.pass) {
        window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${currentUser.id}`));
    }
    location.reload();
};

// --- LOGICA DE SALA ---
async function accessRoom(isCreating) {
    const pass = document.getElementById('room-pass').value;
    const nick = document.getElementById('nickname').value;
    if (!nick || pass.length < 4) return alert("Completa Nick y Contraseña (min 4)");

    currentUser.nick = nick;
    currentUser.isHost = isCreating;
    roomData.pass = pass;

    const roomRef = window.fb.ref(window.fb.db, 'rooms/' + pass);
    if (isCreating) {
        await window.fb.set(roomRef, { pass, status: 'lobby', currentIndex: 0, revealed: false, photoQueue: ["none"] });
    }

    await window.fb.set(window.fb.ref(window.fb.db, `rooms/${pass}/players/${currentUser.id}`), {
        nick: currentUser.nick, photo: currentUser.photo, isHost: currentUser.isHost, id: currentUser.id, eliminated: false
    });

    listenToRoom(pass);
}

function listenToRoom(pass) {
    window.fb.onValue(window.fb.ref(window.fb.db, 'rooms/' + pass), (snap) => {
        const data = snap.val();
        if (!data) return;
        roomData = data;
        if (data.players && !data.players[currentUser.id]) return location.reload();
        updateUI();
    });
}

function updateUI() {
    if (roomData.status === 'playing') {
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        renderGame();
    } else {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        
        document.getElementById('display-pass').innerText = roomData.pass;
        const players = Object.values(roomData.players || {});
        document.getElementById('player-counter').innerText = `Jugadores: ${players.length}`;
        
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        players.forEach(p => {
            const card = document.createElement('div');
            card.className = "player-card";
            card.innerHTML = `${p.isHost?'<span class="crown">👑</span>':''}${currentUser.isHost && p.id!==currentUser.id?`<span class="kick-btn" onclick="kick('${p.id}')">⋮</span>`:''}<img src="${p.photo}"><p>${p.nick}</p>`;
            list.appendChild(card);
        });

        if (currentUser.isHost) {
            document.getElementById('host-controls').classList.remove('hidden');
            document.getElementById('waiting-msg').classList.add('hidden');
        }
    }
}

// --- JUEGO ---
function renderGame() {
    const isImp = (currentUser.id === roomData.impostorId);
    const queue = (roomData.photoQueue || []).filter(p => p !== "none");
    const photo = queue[roomData.currentIndex];
    
    document.getElementById('target-image').src = isImp ? IMPOSTOR_PATH : photo;
    document.getElementById('reveal-image').src = photo;
    document.getElementById('role-text').innerText = isImp ? "ERES EL IMPOSTOR" : "ERES TRIPULANTE";
    document.getElementById('role-text').style.color = isImp ? "#da3633" : "#1f6feb";
    
    const card = document.getElementById('game-card');
    if (roomData.revealed) {
        if (isImp) card.classList.add('flipped');
        document.getElementById('revelation-zone').classList.remove('hidden');
        document.getElementById('impostor-announcement').innerText = `EL IMPOSTOR ERA: ${roomData.players[roomData.impostorId]?.nick}`;
    } else {
        card.classList.remove('flipped');
        document.getElementById('revelation-zone').classList.add('hidden');
    }
    
    renderVotes();
    if (currentUser.isHost) {
        document.getElementById('admin-game-actions').classList.remove('hidden');
        document.getElementById('image-stats').innerText = `${roomData.currentIndex + 1}/${queue.length}`;
    }
}

function renderVotes() {
    const grid = document.getElementById('vote-grid');
    grid.innerHTML = "";
    Object.values(roomData.players).forEach(p => {
        const div = document.createElement('div');
        div.className = `player-card ${p.eliminated ? 'eliminated' : ''}`;
        div.innerHTML = `<img src="${p.photo}"><p>${p.nick}</p>`;
        if (currentUser.isHost) div.onclick = () => window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${p.id}`), {eliminated: !p.eliminated});
        grid.appendChild(div);
    });
}

window.kick = (id) => window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${id}`));

document.getElementById('game-photo').addEventListener('change', async (e) => {
    const photos = [];
    for (const f of e.target.files) {
        const r = new FileReader();
        const p = new Promise(res => r.onload = ev => res(ev.target.result));
        r.readAsDataURL(f);
        photos.push(await p);
    }
    window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), { photoQueue: [...(roomData.photoQueue||[]).filter(x=>x!=="none"), ...photos] });
});

window.startGame = () => {
    const p = Object.values(roomData.players);
    const q = (roomData.photoQueue||[]).filter(x=>x!=="none");
    if (q.length === 0) return alert("Carga fotos");
    window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), { 
        status: 'playing', 
        impostorId: p[Math.floor(Math.random() * p.length)].id, 
        revealed: false 
    });
};

window.revealImpostor = () => window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), { revealed: true });

window.nextImage = () => {
    const q = (roomData.photoQueue||[]).filter(x=>x!=="none");
    if (roomData.currentIndex < q.length - 1) {
        const p = Object.values(roomData.players);
        window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), { 
            currentIndex: roomData.currentIndex + 1, 
            revealed: false, 
            impostorId: p[Math.floor(Math.random() * p.length)].id 
        });
    }
};