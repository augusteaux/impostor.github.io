const IMPOSTOR_PATH = 'impostor/impostor.png';
const AVATAR_PATH = 'foto/';

let currentUser = { 
    nick: '', 
    photo: 'foto/1.png', 
    isHost: false, 
    id: Math.random().toString(36).substr(2, 9) 
};

let roomData = { 
    pass: '', 
    players: {}, 
    photoQueue: [], 
    currentIndex: 0, 
    status: 'lobby', 
    impostorId: '', 
    revealed: false 
};

// --- SELECTOR DE AVATAR ---
const selector = document.getElementById('avatar-selector');
for(let i=1; i<=5; i++) {
    const img = document.createElement('img');
    img.src = `${AVATAR_PATH}${i}.png`;
    img.className = 'avatar-opt';
    img.onclick = () => {
        currentUser.photo = img.src;
        document.getElementById('current-avatar').src = img.src;
        selector.classList.add('hidden');
    };
    selector.appendChild(img);
}
window.toggleAvatarSelector = () => selector.classList.toggle('hidden');

// --- ACCESO A SALA ---
async function accessRoom(isCreating) {
    const pass = document.getElementById('room-pass').value;
    const nick = document.getElementById('nickname').value;
    if (!nick || pass.length < 4) return alert("Completa Nick y Contraseña (min 4)");

    currentUser.nick = nick;
    currentUser.isHost = isCreating;
    roomData.pass = pass;

    const roomRef = window.fb.ref(window.fb.db, 'rooms/' + pass);
    
    if (isCreating) {
        await window.fb.set(roomRef, {
            pass: pass,
            status: 'lobby',
            currentIndex: 0,
            revealed: false,
            photoQueue: ["placeholder"]
        });
    }

    const playerRef = window.fb.ref(window.fb.db, `rooms/${pass}/players/${currentUser.id}`);
    await window.fb.set(playerRef, {
        nick: currentUser.nick,
        photo: currentUser.photo,
        isHost: currentUser.isHost,
        eliminated: false,
        id: currentUser.id
    });

    listenToRoom(pass);
}

function listenToRoom(pass) {
    const roomRef = window.fb.ref(window.fb.db, 'rooms/' + pass);
    window.fb.onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        roomData = data;
        
        if (data.players && !data.players[currentUser.id]) {
            alert("Fuiste expulsado");
            location.reload();
            return;
        }
        updateUI();
    });
}

function updateUI() {
    if (roomData.status === 'playing') {
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        setupGameLayout();
    } else {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        
        const list = document.getElementById('players-list');
        list.innerHTML = "";
        const playersArr = Object.values(roomData.players || {});
        document.getElementById('player-counter').innerText = `Jugadores: ${playersArr.length}`;
        document.getElementById('display-pass').innerText = roomData.pass;

        playersArr.forEach(p => {
            const card = document.createElement('div');
            card.className = "player-card";
            card.innerHTML = `
                ${p.isHost ? '<span class="crown">👑</span>' : ''}
                ${currentUser.isHost && p.id !== currentUser.id ? `<span class="kick-btn" onclick="kickPlayer('${p.id}')">⋮</span>` : ''}
                <img src="${p.photo}">
                <p>${p.nick}</p>
            `;
            list.appendChild(card);
        });

        if (currentUser.isHost) {
            document.getElementById('host-controls').classList.remove('hidden');
            document.getElementById('waiting-msg').classList.add('hidden');
        }
    }
}

function setupGameLayout() {
    const targetImg = document.getElementById('target-image');
    const revealImg = document.getElementById('reveal-image');
    const roleText = document.getElementById('role-text');
    const isImpostor = (currentUser.id === roomData.impostorId);
    const actualQueue = (roomData.photoQueue || []).filter(p => p !== "placeholder");
    const currentPhoto = actualQueue[roomData.currentIndex] || "";

    revealImg.src = currentPhoto;

    if (isImpostor) {
        targetImg.src = IMPOSTOR_PATH;
        roleText.innerText = "ERES EL IMPOSTOR";
        roleText.style.color = "#ff4d4d";
    } else {
        targetImg.src = currentPhoto;
        roleText.innerText = "ERES TRIPULANTE";
        roleText.style.color = "#4da6ff";
    }

    const card = document.getElementById('game-card');
    const revZone = document.getElementById('revelation-zone');
    if (roomData.revealed) {
        if (isImpostor) card.classList.add('flipped');
        revZone.classList.remove('hidden');
        const impNick = roomData.players[roomData.impostorId]?.nick || "Desconocido";
        document.getElementById('impostor-announcement').innerText = `EL IMPOSTOR ERA: ${impNick}`;
    } else {
        card.classList.remove('flipped');
        revZone.classList.add('hidden');
    }

    renderVoteGrid();

    if (currentUser.isHost) {
        document.getElementById('admin-game-actions').classList.remove('hidden');
        document.getElementById('image-stats').innerText = `${roomData.currentIndex + 1}/${actualQueue.length}`;
    }
}

window.kickPlayer = (id) => {
    window.fb.remove(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${id}`));
};

document.getElementById('game-photo').addEventListener('change', async function(e) {
    const files = Array.from(e.target.files);
    const newPhotos = [];
    for (const file of files) {
        const reader = new FileReader();
        const promise = new Promise(res => { reader.onload = (ev) => res(ev.target.result); });
        reader.readAsDataURL(file);
        newPhotos.push(await promise);
    }
    const currentQueue = (roomData.photoQueue || []).filter(p => p !== "placeholder");
    window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), {
        photoQueue: [...currentQueue, ...newPhotos]
    });
});

window.startGame = () => {
    const playersArr = Object.values(roomData.players);
    const queue = (roomData.photoQueue || []).filter(p => p !== "placeholder");
    if (queue.length === 0) return alert("Carga al menos una foto");
    
    const impostor = playersArr[Math.floor(Math.random() * playersArr.length)];
    window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), {
        status: 'playing',
        impostorId: impostor.id,
        revealed: false,
        currentIndex: 0
    });
};

window.revealImpostor = () => {
    window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), { revealed: true });
};

window.nextImage = () => {
    const queue = (roomData.photoQueue || []).filter(p => p !== "placeholder");
    if (roomData.currentIndex < queue.length - 1) {
        const playersArr = Object.values(roomData.players);
        const nextImpostor = playersArr[Math.floor(Math.random() * playersArr.length)];
        window.fb.update(window.fb.ref(window.fb.db, 'rooms/' + roomData.pass), {
            currentIndex: roomData.currentIndex + 1,
            revealed: false,
            impostorId: nextImpostor.id
        });
    } else {
        alert("No hay más fotos");
    }
};

function renderVoteGrid() {
    const grid = document.getElementById('vote-grid');
    grid.innerHTML = "";
    Object.values(roomData.players).forEach(p => {
        const div = document.createElement('div');
        div.className = `player-card ${p.eliminated ? 'eliminated' : ''}`;
        div.innerHTML = `<img src="${p.photo}"><p>${p.nick}</p>`;
        if (currentUser.isHost) {
            div.onclick = () => {
                window.fb.update(window.fb.ref(window.fb.db, `rooms/${roomData.pass}/players/${p.id}`), {
                    eliminated: !p.eliminated
                });
            };
        }
        grid.appendChild(div);
    });
}