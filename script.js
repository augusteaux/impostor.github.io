const IMPOSTOR_PATH = 'impostor/impostor.png';
const AVATAR_PATH = 'foto/';

let currentUser = { nick: '', photo: 'foto/1.png', isHost: false };
let roomData = { 
    pass: '', 
    players: [], 
    photoQueue: [], 
    currentIndex: 0, 
    impostorNick: '',
    status: 'lobby'
};

// Generar selectores de avatar
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

function toggleAvatarSelector() { selector.classList.toggle('hidden'); }

// Manejo de fotos del juego (Cola de imágenes)
document.getElementById('game-photo').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            roomData.photoQueue.push(event.target.result);
            updatePhotoStats();
        };
        reader.readAsDataURL(file);
    });
});

function updatePhotoStats() {
    document.getElementById('queue-count').innerText = `Fotos en cola: ${roomData.photoQueue.length}`;
    document.getElementById('image-stats').innerText = `${roomData.currentIndex + 1}/${roomData.photoQueue.length}`;
}

// Acceso a Sala
function accessRoom(isCreating) {
    const pass = document.getElementById('room-pass').value;
    const nick = document.getElementById('nickname').value;
    if (!nick || pass.length < 4) return alert("Nick y Password (4+ caracteres) obligatorios");
    
    currentUser.nick = nick;
    currentUser.isHost = isCreating;
    roomData.pass = pass;
    
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    document.getElementById('display-pass').innerText = pass;
    
    if (isCreating) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('waiting-msg').classList.add('hidden');
    }

    addPlayer(currentUser);
}

function addPlayer(player) {
    roomData.players.push({ ...player, eliminated: false });
    refreshLobby();
}

function refreshLobby() {
    const list = document.getElementById('players-list');
    list.innerHTML = "";
    document.getElementById('player-counter').innerText = `Jugadores: ${roomData.players.length}`;
    
    roomData.players.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = "player-card";
        card.innerHTML = `
            ${p.isHost ? '<span class="crown">👑</span>' : ''}
            ${currentUser.isHost && !p.isHost ? `<span class="kick-btn" onclick="kickPlayer(${idx})">⋮</span>` : ''}
            <img src="${p.photo}">
            <p>${p.nick}</p>
        `;
        list.appendChild(card);
    });
}

function kickPlayer(idx) {
    roomData.players.splice(idx, 1);
    refreshLobby();
}

// Lógica de Juego
function startGame() {
    if (roomData.photoQueue.length === 0) return alert("Carga al menos una foto");
    
    const idx = Math.floor(Math.random() * roomData.players.length);
    roomData.impostorNick = roomData.players[idx].nick;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Reset de carta y revelación
    document.getElementById('game-card').classList.remove('flipped');
    document.getElementById('revelation-zone').classList.add('hidden');

    const targetImg = document.getElementById('target-image');
    const revealImg = document.getElementById('reveal-image');
    const roleText = document.getElementById('role-text');

    revealImg.src = roomData.photoQueue[roomData.currentIndex];

    if (currentUser.nick === roomData.impostorNick) {
        targetImg.src = IMPOSTOR_PATH;
        roleText.innerText = "ERES EL IMPOSTOR";
        roleText.style.color = "#ff4d4d";
    } else {
        targetImg.src = roomData.photoQueue[roomData.currentIndex];
        roleText.innerText = "ERES TRIPULANTE";
        roleText.style.color = "#4da6ff";
    }

    if (currentUser.isHost) document.getElementById('admin-game-actions').classList.remove('hidden');
    renderVoteGrid();
    updatePhotoStats();
}

function renderVoteGrid() {
    const grid = document.getElementById('vote-grid');
    grid.innerHTML = "";
    roomData.players.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = `player-card ${p.eliminated ? 'eliminated' : ''}`;
        div.innerHTML = `<img src="${p.photo}"><p>${p.nick}</p>`;
        if (currentUser.isHost) div.onclick = () => { p.eliminated = !p.eliminated; renderVoteGrid(); };
        grid.appendChild(div);
    });
}

function revealImpostor() {
    // Si el usuario es impostor, gira su carta para mostrar la real
    if(currentUser.nick === roomData.impostorNick) {
        document.getElementById('game-card').classList.add('flipped');
    }
    
    // Para todos, mostrar quién era
    const zone = document.getElementById('revelation-zone');
    zone.classList.remove('hidden');
    document.getElementById('impostor-announcement').innerText = `EL IMPOSTOR ERA: ${roomData.impostorNick}`;
}

function nextImage() {
    if (roomData.currentIndex < roomData.photoQueue.length - 1) {
        roomData.currentIndex++;
        startGame();
    } else {
        alert("No hay más imágenes en la cola.");
    }
}