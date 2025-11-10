// API Key
const API_KEY = '4d21e1c5-e6f4-40f2-8add-5256da04af82';

// Uygulama durumu
const state = {
    allPokemon: [], // Tüm Pokémon listesi
    pokemonCardsMap: new Map(), // pokemonName -> cards[]
    ownedCards: new Map(), // cardId -> card
    currentPage: 1,
    itemsPerPage: 9,
    selectedPokemon: null,
    viewMode: 'pokemon'
};

// LocalStorage'dan veri yükleme
function loadFromStorage() {
    const saved = localStorage.getItem('ornipokedex');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].length === 2) {
                state.ownedCards = new Map(data);
            } else {
                state.ownedCards = new Map();
            }
        } catch (e) {
            console.error('LocalStorage yükleme hatası:', e);
            state.ownedCards = new Map();
        }
    }
}

// LocalStorage'a kaydetme
function saveToStorage() {
    localStorage.setItem('ornipokedex', JSON.stringify([...state.ownedCards]));
}

// Tüm kartları ve Pokémon listesini yükle
async function loadAllData() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = 'Kartlar yükleniyor...';
    
    try {
        // Tüm kartları yükle (birden fazla sayfa)
        const allCards = [];
        for (let page = 1; page <= 5; page++) {
            loading.textContent = `Kartlar yükleniyor... (${page}/5)`;
            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?pageSize=250&page=${page}`,
                { headers: { 'X-Api-Key': API_KEY } }
            );
            
            if (!response.ok) throw new Error(`API hatası: ${response.status}`);
            const data = await response.json();
            
            const cards = data.data.map(card => ({
                id: card.id,
                name: card.name,
                pokemonName: card.name.split(' ')[0].toLowerCase(),
                image: card.images.large,
                smallImage: card.images.small,
                set: card.set.name,
                number: card.number,
                rarity: card.rarity || 'Common',
                price: card.cardmarket?.prices?.averageSellPrice || card.tcgplayer?.prices?.normal?.market || 0
            }));
            
            allCards.push(...cards);
        }
        
        // Kartları Pokémon'lara göre grupla
        allCards.forEach(card => {
            const pokemonName = card.pokemonName;
            if (!state.pokemonCardsMap.has(pokemonName)) {
                state.pokemonCardsMap.set(pokemonName, []);
            }
            state.pokemonCardsMap.get(pokemonName).push(card);
        });
        
        // Pokémon listesini oluştur (kartı olan Pokémon'lar)
        const pokemonNames = [...state.pokemonCardsMap.keys()].sort();
        
        loading.textContent = 'Pokémon bilgileri yükleniyor...';
        
        // Her Pokémon için PokeAPI'den bilgi al
        const pokemonPromises = pokemonNames.map(async (name) => {
            try {
                const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
                if (!response.ok) return null;
                
                const data = await response.json();
                return {
                    id: data.id,
                    name: name,
                    displayName: name.charAt(0).toUpperCase() + name.slice(1),
                    image: data.sprites.other['official-artwork'].front_default || data.sprites.front_default,
                    cardCount: state.pokemonCardsMap.get(name).length
                };
            } catch (e) {
                return null;
            }
        });
        
        const pokemonResults = await Promise.all(pokemonPromises);
        state.allPokemon = pokemonResults
            .filter(p => p !== null)
            .sort((a, b) => a.id - b.id);
        
        displayPokemonList();
        updateStats();
        loading.style.display = 'none';
    } catch (error) {
        console.error('Veri yükleme hatası:', error);
        loading.textContent = 'Yükleme hatası! Lütfen sayfayı yenileyin.';
        loading.style.color = '#f44336';
    }
}

// Pokémon listesini göster
function displayPokemonList() {
    const container = document.getElementById('pokemonList');
    const searchSection = document.querySelector('.search-section');
    
    searchSection.style.display = 'none';
    container.innerHTML = '';
    
    state.allPokemon.forEach(pokemon => {
        const pokemonElement = document.createElement('div');
        pokemonElement.className = 'pokemon-card';
        
        // Bu Pokémon'un kaç kartına sahip olunduğunu hesapla
        const pokemonCards = state.pokemonCardsMap.get(pokemon.name) || [];
        const ownedCount = pokemonCards.filter(card => state.ownedCards.has(card.id)).length;
        
        pokemonElement.innerHTML = `
            <img src="${pokemon.image}" alt="${pokemon.displayName}" loading="lazy">
            <h3>${pokemon.displayName}</h3>
            <p class="pokedex-number">#${String(pokemon.id).padStart(3, '0')}</p>
            <p class="card-count">${pokemon.cardCount} Kart</p>
            ${ownedCount > 0 ? `<span class="owned-badge">${ownedCount} Sahip</span>` : ''}
        `;
        
        pokemonElement.addEventListener('click', () => selectPokemon(pokemon));
        container.appendChild(pokemonElement);
    });
}

// Pokémon seçildiğinde kartlarını göster (ANINDA)
function selectPokemon(pokemon) {
    state.selectedPokemon = pokemon;
    state.viewMode = 'cards';
    
    const pokemonCards = state.pokemonCardsMap.get(pokemon.name) || [];
    displayPokemonCards(pokemonCards);
}

// Seçilen Pokémon'un kartlarını göster
function displayPokemonCards(cards) {
    const container = document.getElementById('pokemonList');
    const searchSection = document.querySelector('.search-section');
    
    searchSection.style.display = 'flex';
    searchSection.innerHTML = `
        <button id="backBtn" style="padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em;">
            ← Pokémon Listesine Dön
        </button>
        <div style="flex: 1; text-align: center; font-size: 1.2em; font-weight: bold; color: #333;">
            ${state.selectedPokemon.displayName} - ${cards.length} Kart
        </div>
    `;
    
    document.getElementById('backBtn').addEventListener('click', () => {
        state.viewMode = 'pokemon';
        state.selectedPokemon = null;
        displayPokemonList();
    });
    
    container.innerHTML = '';
    
    if (cards.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; font-size: 1.2em; color: #666;">Bu Pokémon için kart bulunamadı.</p>';
        return;
    }
    
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        const isOwned = state.ownedCards.has(card.id);
        cardElement.className = `pokemon-card ${isOwned ? 'owned' : ''}`;
        
        const priceText = card.price > 0 ? `$${card.price.toFixed(2)}` : 'N/A';
        
        cardElement.innerHTML = `
            <img src="${card.smallImage}" alt="${card.name}" loading="lazy">
            <h3>${card.name}</h3>
            <p class="set-name">${card.set}</p>
            <p class="card-number">#${card.number}</p>
            <p class="rarity">${card.rarity}</p>
            <p class="price">${priceText}</p>
            ${isOwned ? '<span class="owned-badge">✓ Sahip</span>' : ''}
        `;
        
        cardElement.addEventListener('click', () => toggleCardOwnership(card));
        container.appendChild(cardElement);
    });
}

// Kart sahiplik durumunu değiştir
function toggleCardOwnership(card) {
    if (state.ownedCards.has(card.id)) {
        state.ownedCards.delete(card.id);
    } else {
        state.ownedCards.set(card.id, card);
    }
    
    saveToStorage();
    
    if (state.viewMode === 'cards') {
        const cards = state.pokemonCardsMap.get(state.selectedPokemon.name) || [];
        displayPokemonCards(cards);
    } else {
        displayPokemonList();
    }
    
    updateStats();
    
    if (document.getElementById('binder').classList.contains('active')) {
        displayBinder();
    }
}

// İstatistikleri güncelle
function updateStats() {
    const owned = state.ownedCards.size;
    
    let totalValue = 0;
    state.ownedCards.forEach(card => {
        totalValue += card.price || 0;
    });
    
    const uniquePokemon = new Set();
    state.ownedCards.forEach(card => {
        uniquePokemon.add(card.pokemonName);
    });
    
    const completion = state.allPokemon.length > 0 
        ? Math.round((uniquePokemon.size / state.allPokemon.length) * 100) 
        : 0;
    
    document.getElementById('totalOwned').textContent = owned;
    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('completionRate').textContent = `${completion}%`;
}

// Binder görünümü
function displayBinder() {
    const ownedArray = [...state.ownedCards.values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const totalPages = Math.ceil(ownedArray.length / state.itemsPerPage);
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const currentPageCards = ownedArray.slice(startIndex, endIndex);
    
    const binderGrid = document.getElementById('binderGrid');
    binderGrid.innerHTML = '';
    
    for (let i = 0; i < state.itemsPerPage; i++) {
        const slot = document.createElement('div');
        slot.className = 'binder-slot';
        
        if (currentPageCards[i]) {
            const card = currentPageCards[i];
            slot.classList.add('filled');
            const priceText = card.price > 0 ? `$${card.price.toFixed(2)}` : 'N/A';
            slot.innerHTML = `
                <img src="${card.image}" alt="${card.name}">
                <span class="pokemon-name">${card.name}</span>
                <span class="card-info">${card.set} #${card.number}</span>
                <span class="card-price">${priceText}</span>
            `;
        }
        
        binderGrid.appendChild(slot);
    }
    
    document.getElementById('pageInfo').textContent = `Sayfa ${state.currentPage} / ${Math.max(1, totalPages)}`;
    document.getElementById('prevPage').disabled = state.currentPage === 1;
    document.getElementById('nextPage').disabled = state.currentPage >= totalPages || ownedArray.length === 0;
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
        } else if (tabId === 'collection') {
            state.viewMode = 'pokemon';
            state.selectedPokemon = null;
            displayPokemonList();
        }
    });
});

document.getElementById('prevPage').addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        displayBinder();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const ownedCount = state.ownedCards.size;
    const totalPages = Math.ceil(ownedCount / state.itemsPerPage);
    if (state.currentPage < totalPages) {
        state.currentPage++;
        displayBinder();
    }
});

// Uygulama başlatma
loadFromStorage();
loadAllData();
