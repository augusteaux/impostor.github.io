const IMPOSTOR_PATH = 'impostor/impostor.png';
const AVATAR_PATH = 'foto/';
const extensions = ['jpg', 'png', 'jpeg'];

let currentUser = { 
    nick: '', 
    photo: 'foto/1.jpg', 
    isHost: false, 
    id: Math.random().toString(36).substr(2, 9),
    uploadsCount: 0 
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

window.copyRoomPass = () => {
    if (roomData.pass) {
        navigator.clipboard.writeText(roomData.pass).then(() => {
            alert("Contrasena copiada: " + roomData.pass);
        });
    }
};

window.goBack = async () => {
    if (roomData.pass) {
        if (currentUser.isHost) {
            await window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`));
        } else {
            await window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${currentUser.id}`));
        }
    }
    location.reload();
};

async function accessRoom(isCreating) {
    const pass = document.getElementById('room-pass').value;
    const nick = document.getElementById('nickname').value;
    if (!nick || pass.length < 4) return alert("Nickname y Pass (min 4)");
    
    const roomRef = window.fb.ref(window.fb.db, 'rooms/' + pass);
    const snap = await window.fb.get(roomRef);
    
    if (isCreating) {
        if (snap.exists()) {
            const data = snap.val();
            const players = Object.values(data.players || {});
            const hasActiveHost = players.some(p => p.isHost);
            if (hasActiveHost) return alert("Sala ocupada.");
            await window.fb.remove(roomRef);
        }
        await window.fb.set(roomRef, { pass, status: 'lobby', currentIndex: 0, revealed: false, photoQueue: ["none"] });
    } else {
        if (!snap.exists()) return alert("La sala no existe.");
    }

    currentUser.nick = nick;
    currentUser.isHost = isCreating;
    roomData.pass = pass;

    await window.fb.set(window.fb.ref(window.fb.db, `rooms/${pass}/players/${currentUser.id}`), {
        nick, photo: currentUser.photo, isHost: isCreating, id: currentUser.id, eliminated: false
    });

    window.fb.onValue(roomRef, (s) => {
        const data = s.val();
        if (!data || (data.players && !data.players[currentUser.id])) return location.reload();
        
        if (data.status === 'lobby' && roomData.status === 'playing') {
            currentUser.uploadsCount = 0; 
            document.getElementById('btn-upload-ui').className = "btn-upload-empty";
            document.getElementById('btn-upload-ui').innerText = "CARGAR FOTO";
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
        document.getElementById('player-counter').innerText = players.length;
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
    const targetImg = document.getElementById('target-image');
    const card = document.getElementById('game-card');
    
    if (!roomData.revealed) {
        card.classList.remove('flipped');
    }

    if (isImp) {
        targetImg.src = IMPOSTOR_PATH;
    } else {
        targetImg.src = photo;
    }
    
    document.getElementById('reveal-image').src = photo;
    document.getElementById('role-text').innerText = isImp ? "IMPOSTOR" : "TRIPULANTE";
    document.getElementById('role-text').style.color = isImp ? "#da3633" : "#1f6feb";
    
    if (roomData.revealed) {
        if (isImp) card.classList.add('flipped');
        document.getElementById('revelation-zone').classList.remove('hidden');
        document.getElementById('impostor-announcement').innerText = `IMPOSTOR: ${roomData.players[roomData.impostorId]?.nick}`;
        if (currentUser.isHost) {
            btnNext.disabled = false;
            btnNext.classList.remove('disabled-action');
            btnNext.innerText = roomData.currentIndex >= queue.length - 1 ? "CARGAR" : "SIGUIENTE";
        }
    } else {
        document.getElementById('revelation-zone').classList.add('hidden');
        if (currentUser.isHost) {
            btnNext.disabled = true;
            btnNext.classList.add('disabled-action');
        }
    }
    
    document.getElementById('vote-grid').innerHTML = players.map(p => `
        <div class="player-card ${p.eliminated ? 'eliminated' : ''}" onclick="${currentUser.isHost ? `toggleElim('${p.id}', ${!p.eliminated})` : ''}">
            <img src="${p.photo}"><p>${p.nick}</p>
        </div>
    `).join('');

    if (currentUser.isHost) {
        document.getElementById('admin-game-actions').classList.remove('hidden');
        document.getElementById('image-stats').innerText = `${roomData.currentIndex + 1}/${queue.length}`;
    }
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
    if (currentUser.uploadsCount >= 2) return alert("Maximo 2 fotos.");
    const r = new FileReader();
    r.onload = async (ev) => {
        const snap = await window.fb.get(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/photoQueue`));
        let queue = (snap.val() || []).filter(x => x !== "none");
        queue.push(ev.target.result);
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { photoQueue: queue });
        
        currentUser.uploadsCount++;
        const btn = document.getElementById('btn-upload-ui');
        
        if (currentUser.uploadsCount === 1) {
            btn.innerText = "OTRA (1/2)";
            btn.className = "btn-upload-filled";
        } else {
            btn.innerText = "LISTO (2/2)";
            btn.className = "btn-upload-filled";
        }
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
        status: 'playing', impostorId: p[Math.floor(Math.random() * p.length)].id, revealed: false, currentIndex: 0, photoQueue: shuffledQueue
    });
};

window.revealImpostor = () => window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { revealed: true });

window.handleNextStep = async () => {
    const queue = (roomData.photoQueue || []).filter(x => x !== "none");
    if (roomData.currentIndex < queue.length - 1) {
        const p = Object.values(roomData.players);
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { 
            currentIndex: roomData.currentIndex + 1, revealed: false, impostorId: p[Math.floor(Math.random() * p.length)].id 
        });
    } else {
        await window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}`), { 
            status: 'lobby', revealed: false, photoQueue: ["none"], currentIndex: 0 
        });
    }
};