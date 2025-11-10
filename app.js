// Uygulama durumu
const state = {
    allPokemon: [],
    ownedPokemon: new Set(),
    currentPage: 1,
    itemsPerPage: 9,
    filteredPokemon: []
};

// LocalStorage'dan veri yükleme
function loadFromStorage() {
    const saved = localStorage.getItem('ornipokedex');
    if (saved) {
        state.ownedPokemon = new Set(JSON.parse(saved));
    }
}

// LocalStorage'a kaydetme
function saveToStorage() {
    localStorage.setItem('ornipokedex', JSON.stringify([...state.ownedPokemon]));
}

// Pokémon verilerini API'den çekme
async function fetchPokemon(limit = 151) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);
        const data = await response.json();
        
        const pokemonPromises = data.results.map(async (pokemon, index) => {
            const id = index + 1;
            return {
                id: id,
                name: pokemon.name,
                image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
                sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
            };
        });
        
        state.allPokemon = await Promise.all(pokemonPromises);
        state.filteredPokemon = [...state.allPokemon];
        displayPokemon();
        updateStats();
    } catch (error) {
        console.error('Pokémon verileri yüklenirken hata:', error);
        loading.textContent = 'Yükleme hatası! Lütfen sayfayı yenileyin.';
    } finally {
        loading.style.display = 'none';
    }
}

// Pokémon listesini gösterme
function displayPokemon() {
    const container = document.getElementById('pokemonList');
    container.innerHTML = '';
    
    state.filteredPokemon.forEach(pokemon => {
        const card = document.createElement('div');
        card.className = `pokemon-card ${state.ownedPokemon.has(pokemon.id) ? 'owned' : ''}`;
        card.innerHTML = `
            <img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">
            <h3>${pokemon.name}</h3>
            <p class="number">#${String(pokemon.id).padStart(3, '0')}</p>
            ${state.ownedPokemon.has(pokemon.id) ? '<span class="owned-badge">✓ Sahip</span>' : ''}
        `;
        
        card.addEventListener('click', () => toggleOwnership(pokemon.id));
        container.appendChild(card);
    });
}

// Sahiplik durumunu değiştirme
function toggleOwnership(pokemonId) {
    if (state.ownedPokemon.has(pokemonId)) {
        state.ownedPokemon.delete(pokemonId);
    } else {
        state.ownedPokemon.add(pokemonId);
    }
    
    saveToStorage();
    displayPokemon();
    updateStats();
    if (document.getElementById('binder').classList.contains('active')) {
        displayBinder();
    }
}

// İstatistikleri güncelleme
function updateStats() {
    const total = state.allPokemon.length;
    const owned = state.ownedPokemon.size;
    const missing = total - owned;
    const completion = total > 0 ? Math.round((owned / total) * 100) : 0;
    
    document.getElementById('totalOwned').textContent = owned;
    document.getElementById('totalMissing').textContent = missing;
    document.getElementById('completionRate').textContent = `${completion}%`;
}

// Binder görünümünü gösterme
function displayBinder() {
    const ownedArray = [...state.ownedPokemon]
        .map(id => state.allPokemon.find(p => p.id === id))
        .filter(p => p)
        .sort((a, b) => a.id - b.id);
    
    const totalPages = Math.ceil(ownedArray.length / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const currentPagePokemon = ownedArray.slice(startIndex, endIndex);
    
    const binderGrid = document.getElementById('binderGrid');
    binderGrid.innerHTML = '';
    
    for (let i = 0; i < state.itemsPerPage; i++) {
        const slot = document.createElement('div');
        slot.className = 'binder-slot';
        
        if (currentPagePokemon[i]) {
            const pokemon = currentPagePokemon[i];
            slot.classList.add('filled');
            slot.innerHTML = `
                <img src="${pokemon.image}" alt="${pokemon.name}">
                <span class="pokemon-name">#${String(pokemon.id).padStart(3, '0')} ${pokemon.name}</span>
            `;
        }
        
        binderGrid.appendChild(slot);
    }
    
    document.getElementById('pageInfo').textContent = `Sayfa ${state.currentPage} / ${Math.max(1, totalPages)}`;
    document.getElementById('prevPage').disabled = state.currentPage === 1;
    document.getElementById('nextPage').disabled = state.currentPage >= totalPages || ownedArray.length === 0;
}

// Arama fonksiyonu
function searchPokemon(query) {
    const searchTerm = query.toLowerCase();
    state.filteredPokemon = state.allPokemon.filter(pokemon => 
        pokemon.name.toLowerCase().includes(searchTerm) ||
        String(pokemon.id).includes(searchTerm)
    );
    displayPokemon();
}

// Nesil filtreleme
function filterByGeneration(gen) {
    if (gen === 'all') {
        state.filteredPokemon = [...state.allPokemon];
    } else {
        const ranges = {
            '1': [1, 151],
            '2': [152, 251],
            '3': [252, 386],
            '4': [387, 493],
            '5': [494, 649],
            '6': [650, 721],
            '7': [722, 809],
            '8': [810, 905]
        };
        
        const [min, max] = ranges[gen];
        state.filteredPokemon = state.allPokemon.filter(p => p.id >= min && p.id <= max);
    }
    displayPokemon();
}

// Event listeners
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'binder') {
            state.currentPage = 1;
            displayBinder();
        }
    });
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    searchPokemon(e.target.value);
});

document.getElementById('generationFilter').addEventListener('change', (e) => {
    filterByGeneration(e.target.value);
});

document.getElementById('showAllBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('generationFilter').value = 'all';
    state.filteredPokemon = [...state.allPokemon];
    displayPokemon();
});

document.getElementById('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        displayBinder();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const ownedCount = state.ownedPokemon.size;
    const totalPages = Math.ceil(ownedCount / state.itemsPerPage);
    if (state.currentPage < totalPages) {
        state.currentPage++;
        displayBinder();
    }
});

// Uygulama başlatma
loadFromStorage();
fetchPokemon(151);
