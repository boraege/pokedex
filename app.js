// API Key
const API_KEY = '4d21e1c5-e6f4-40f2-8add-5256da04af82';

// Uygulama durumu
const state = {
    allPokemon: [],
    pokemonCardsMap: new Map(),
    ownedCards: new Map(),
    currentPage: 1,
    itemsPerPage: 9,
    selectedPokemon: null,
    viewMode: 'pokemon',
    isLoading: false
};

// LocalStorage'dan veri yükleme
function loadFromStorage() {
    const saved = localStorage.getItem('ornipokedex');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0]) && data[0].length === 2) {
                state.ownedCards = new Map(data);
            }
        } catch (e) {
            console.error('LocalStorage yükleme hatası:', e);
            state.ownedCards = new Map();
        }
    }
}

// Cache'den kart verilerini yükle
function loadCardsFromCache() {
    const cached = localStorage.getItem('ornipokedex_cards_cache');
    const cacheTime = localStorage.getItem('ornipokedex_cache_time');
    
    if (cached && cacheTime) {
        const hoursSinceCache = (Date.now() - parseInt(cacheTime)) / (1000 * 60 * 60);
        // Cache 24 saatten eskiyse kullanma
        if (hoursSinceCache < 24) {
            try {
                const data = JSON.parse(cached);
                return data;
            } catch (e) {
                console.error('Cache yükleme hatası:', e);
            }
        }
    }
    return null;
}

// Kartları cache'e kaydet
function saveCardsToCache(cards) {
    try {
        localStorage.setItem('ornipokedex_cards_cache', JSON.stringify(cards));
        localStorage.setItem('ornipokedex_cache_time', Date.now().toString());
    } catch (e) {
        console.error('Cache kaydetme hatası:', e);
    }
}

// LocalStorage'a kaydetme
function saveToStorage() {
    localStorage.setItem('ornipokedex', JSON.stringify([...state.ownedCards]));
}

// Kartları yükle (önce cache'den, sonra API'den)
async function loadAllCards() {
    const loading = document.getElementById('loading');
    
    // Önce cache'den dene
    const cachedCards = loadCardsFromCache();
    if (cachedCards) {
        loading.textContent = 'Cache\'den yükleniyor...';
        processCards(cachedCards);
        await loadPokemonInfo();
        displayPokemonList();
        updateStats();
        loading.style.display = 'none';
        
        // Arka planda güncel verileri yükle
        loadCardsFromAPI(true);
        return;
    }
    
    // Cache yoksa API'den yükle
    await loadCardsFromAPI(false);
}

// API'den kartları yükle
async function loadCardsFromAPI(background = false) {
    const loading = document.getElementById('loading');
    
    if (!background) {
        loading.style.display = 'block';
        loading.textContent = 'Kartlar yükleniyor...';
    }
    
    try {
        const allCards = [];
        
        // İlk sayfayı hızlıca yükle
        const firstResponse = await fetch(
            `https://api.pokemontcg.io/v2/cards?pageSize=250&page=1`,
            { headers: { 'X-Api-Key': API_KEY } }
        );
        
        if (!firstResponse.ok) throw new Error(`API hatası: ${firstResponse.status}`);
        const firstData = await firstResponse.json();
        
        const firstCards = firstData.data.map(card => ({
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
        
        allCards.push(...firstCards);
        
        if (!background) {
            // İlk kartları hemen göster
            processCards(allCards);
            await loadPokemonInfo();
            displayPokemonList();
            updateStats();
            loading.textContent = 'Daha fazla kart yükleniyor...';
        }
        
        // Geri kalan sayfaları yükle
        const remainingPages = [2, 3, 4, 5];
        for (const page of remainingPages) {
            if (!background) {
                loading.textContent = `Kartlar yükleniyor... (${page}/5)`;
            }
            
            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?pageSize=250&page=${page}`,
                { headers: { 'X-Api-Key': API_KEY } }
            );
            
            if (!response.ok) continue;
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
        
        // Tüm kartları işle ve cache'e kaydet
        processCards(allCards);
        saveCardsToCache(allCards);
        
        if (!background) {
            await loadPokemonInfo();
            displayPokemonList();
            updateStats();
            loading.style.display = 'none';
        }
    } catch (error) {
        console.error('Kart yükleme hatası:', error);
        if (!background) {
            loading.textContent = 'Yükleme hatası! Lütfen sayfayı yenileyin.';
            loading.style.color = '#f44336';
        }
    }
}

// Kartları işle ve grupla
function processCards(cards) {
    state.pokemonCardsMap.clear();
    
    cards.forEach(card => {
        const pokemonName = card.pokemonName;
        if (!state.pokemonCardsMap.has(pokemonName)) {
            state.pokemonCardsMap.set(pokemonName, []);
        }
        state.pokemonCardsMap.get(pokemonName).push(card);
    });
}

// Pokémon bilgilerini yükle
async function loadPokemonInfo() {
    const pokemonNames = [...state.pokemonCardsMap.keys()].sort();
    
    // Batch olarak yükle (her seferinde 50 Pokémon)
    const batchSize = 50;
    const allPokemon = [];
    
    for (let i = 0; i < pokemonNames.length; i += batchSize) {
        const batch = pokemonNames.slice(i, i + batchSize);
        
        const pokemonPromises = batch.map(async (name) => {
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
        
        const results = await Promise.all(pokemonPromises);
        allPokemon.push(...results.filter(p => p !== null));
    }
    
    state.allPokemon = allPokemon.sort((a, b) => a.id - b.id);
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

// Pokémon seçildiğinde kartlarını göster
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
loadAllCards();
