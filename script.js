const IMPOSTOR_PATH = 'impostor/impostor.png';
const AVATAR_PATH = 'foto/';
const extensions = ['jpg', 'png', 'jpeg'];

let currentUser = { 
    nick: '', 
    photo: 'foto/1.jpg', 
    isHost: false, 
    id: Math.random().toString(36).substr(2, 9),
    hasUploaded: false 
};

let roomData = {};

async function createAvatarGrid() {
    const selector = document.getElementById('avatar-selector');
    selector.innerHTML = '';
    for (let i = 1; i <= 13; i++) {
        if (i === 3) continue;
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
}
createAvatarGrid();

window.toggleAvatarSelector = () => document.getElementById('avatar-selector').classList.toggle('hidden');

window.goBack = async () => {
    if (roomData.pass) {
        const path = currentUser.isHost ? `rooms/${roomData.pass}` : `rooms/${roomData.pass}/players/${currentUser.id}`;
        await window.fb.remove(window.fb.ref(window.fb.db, path));
    }
    location.reload();
};

async function accessRoom(isCreating) {
    const pass = document.getElementById('room-pass').value;
    const nick = document.getElementById('nickname').value;
    if (!nick || pass.length < 4) return alert("Nickname y Pass (min 4)");
    const roomRef = window.fb.ref(window.fb.db, 'rooms/' + pass);
    const snap = await window.fb.get(roomRef);
    if (isCreating && snap.exists()) return alert("Sala ocupada");
    if (!isCreating && !snap.exists()) return alert("Sala no existe");
    if (isCreating) {
        await window.fb.set(roomRef, { pass, status: 'lobby', currentIndex: 0, revealed: false, photoQueue: ["none"] });
    }
    currentUser.nick = nick;
    currentUser.isHost = isCreating;
    await window.fb.set(window.fb.ref(window.fb.db, `rooms/${pass}/players/${currentUser.id}`), {
        nick, photo: currentUser.photo, isHost: isCreating, id: currentUser.id, eliminated: false
    });
    window.fb.onValue(roomRef, (s) => {
        const data = s.val();
        if (!data || (data.players && !data.players[currentUser.id])) return location.reload();
        
        if (data.status === 'lobby' && roomData.status === 'playing') {
            currentUser.hasUploaded = false;
            const btn = document.getElementById('btn-upload-ui');
            btn.className = "btn-upload-empty";
            btn.innerText = "CARGAR FOTO";
        }

        roomData = data;
        updateUI();
    });
}

function updateUI() {
    const isPlaying = roomData.status === 'playing';
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.toggle('hidden', isPlaying);
    document.getElementById('game-screen').classList.toggle('hidden', !isPlaying);
    const players = Object.values(roomData.players || {});
    const queue = (roomData.photoQueue || []).filter(p => p !== "none");
    if (!isPlaying) {
        document.getElementById('display-pass').innerText = roomData.pass;
        document.getElementById('player-counter').innerText = `${players.length}/${queue.length}`;
        document.getElementById('queue-count').innerText = `Fotos: ${queue.length}`;
        const list = document.getElementById('players-list');
        list.innerHTML = players.map(p => `
            <div class="player-card">
                ${p.isHost ? '<span class="crown">👑</span>' : ''}
                ${currentUser.isHost && p.id !== currentUser.id ? `<span class="kick-btn" onclick="kick('${p.id}')">X</span>` : ''}
                <img src="${p.photo}"><p>${p.nick}</p>
            </div>
        `).join('');
        document.getElementById('host-controls').classList.toggle('hidden', !currentUser.isHost);
        document.getElementById('waiting-msg').classList.toggle('hidden', currentUser.isHost);
    } else {
        renderGame(players, queue);
    }
}

function renderGame(players, queue) {
    const isImp = currentUser.id === roomData.impostorId;
    const photo = queue[roomData.currentIndex];
    const btnNext = document.getElementById('btn-next-img');
    document.getElementById('target-image').src = isImp ? IMPOSTOR_PATH : photo;
    document.getElementById('reveal-image').src = photo;
    document.getElementById('role-text').innerText = isImp ? "IMPOSTOR" : "TRIPULANTE";
    document.getElementById('role-text').style.color = isImp ? "#da3633" : "#1f6feb";
    document.getElementById('game-card').classList.toggle('flipped', roomData.revealed && isImp);
    document.getElementById('revelation-zone').classList.toggle('hidden', !roomData.revealed);
    document.getElementById('impostor-announcement').innerText = `IMPOSTOR: ${roomData.players[roomData.impostorId]?.nick}`;
    if (currentUser.isHost) {
        document.getElementById('admin-game-actions').classList.remove('hidden');
        document.getElementById('image-stats').innerText = `${roomData.currentIndex + 1}/${queue.length}`;
        btnNext.disabled = !roomData.revealed;
        btnNext.classList.toggle('disabled-action', !roomData.revealed);
        btnNext.innerText = roomData.currentIndex >= queue.length - 1 ? "CARGAR" : "SIGUIENTE";
    }
    document.getElementById('vote-grid').innerHTML = players.map(p => `
        <div class="player-card ${p.eliminated ? 'eliminated' : ''}" onclick="${currentUser.isHost ? `toggleElim('${p.id}', ${!p.eliminated})` : ''}">
            <img src="${p.photo}"><p>${p.nick}</p>
        </div>
    `).join('');
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

window.kick = (id) => window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${id}`));
window.toggleElim = (id, state) => window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${id}`), { eliminated: state });

document.getElementById('game-photo').addEventListener('change', async (e) => {
    if (currentUser.hasUploaded) return alert("Ya subiste foto");
    const r = new FileReader();
    r.onload = async (ev) => {
        const snap = await window.fb.get(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/photoQueue`));
        let queue = (snap.val() || []).filter(x => x !== "none");
        queue.push(ev.target.result);
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { photoQueue: queue });
        currentUser.hasUploaded = true;
        const btn = document.getElementById('btn-upload-ui');
        btn.className = "btn-upload-filled";
        btn.innerText = "FOTO LISTA";
    };
    r.readAsDataURL(e.target.files[0]);
});

window.startGame = async () => {
    const snap = await window.fb.get(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/photoQueue`));
    let queue = (snap.val() || []).filter(x => x !== "none");
    if (queue.length === 0) return alert("No hay fotos.");
    
    const shuffledQueue = shuffle([...queue]);
    const p = Object.values(roomData.players);
    
    await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { 
        status: 'playing', 
        impostorId: p[Math.floor(Math.random() * p.length)].id, 
        revealed: false, 
        currentIndex: 0,
        photoQueue: shuffledQueue
    });
};

window.revealImpostor = () => window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { revealed: true });

window.handleNextStep = async () => {
    const queue = (roomData.photoQueue || []).filter(x => x !== "none");
    if (roomData.currentIndex < queue.length - 1) {
        const p = Object.values(roomData.players);
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { 
            currentIndex: roomData.currentIndex + 1, 
            revealed: false, 
            impostorId: p[Math.floor(Math.random() * p.length)].id 
        });
    } else {
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { 
            status: 'lobby', 
            revealed: false, 
            photoQueue: ["none"], 
            currentIndex: 0 
        });
    }
};