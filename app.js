// API Key
const API_KEY = '4d21e1c5-e6f4-40f2-8add-5256da04af82';

// Uygulama durumu
const state = {
    allPokemon: [], // Tüm Pokémon listesi (Pokedex numarasına göre)
    allCards: [], // Tüm kartlar
    ownedCards: new Map(), // cardId -> {cardId, name, image, price, set}
    currentPage: 1,
    itemsPerPage: 9,
    selectedPokemon: null, // Seçilen Pokémon
    pokemonCards: [], // Seçilen Pokémon'un kartları
    viewMode: 'pokemon' // 'pokemon' veya 'cards'
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
                localStorage.removeItem('ornipokedex');
            }
        } catch (e) {
            console.error('LocalStorage yükleme hatası:', e);
            state.ownedCards = new Map();
            localStorage.removeItem('ornipokedex');
        }
    }
}

// LocalStorage'a kaydetme
function saveToStorage() {
    localStorage.setItem('ornipokedex', JSON.stringify([...state.ownedCards]));
}

// PokeAPI'den Pokémon listesini çekme
async function fetchPokemonList() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = 'Pokémon listesi yükleniyor...';
    
    try {
        // İlk 151 Pokémon'u çek (Kanto bölgesi)
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151');
        if (!response.ok) throw new Error(`API hatası: ${response.status}`);
        
        const data = await response.json();
        
        // Her Pokémon için detayları çek
        const pokemonPromises = data.results.map(async (pokemon, index) => {
            const detailResponse = await fetch(pokemon.url);
            const detail = await detailResponse.json();
            return {
                id: detail.id,
                name: pokemon.name,
                displayName: pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1),
                image: detail.sprites.other['official-artwork'].front_default || detail.sprites.front_default,
                types: detail.types.map(t => t.type.name)
            };
        });
        
        state.allPokemon = await Promise.all(pokemonPromises);
        state.allPokemon.sort((a, b) => a.id - b.id);
        
        displayPokemonList();
        loading.style.display = 'none';
    } catch (error) {
        console.error('Pokémon listesi yüklenirken hata:', error);
        loading.textContent = 'Yükleme hatası! Lütfen sayfayı yenileyin.';
        loading.style.color = '#f44336';
        setTimeout(() => {
            loading.style.display = 'none';
        }, 5000);
    }
}

// Pokémon listesini gösterme
function displayPokemonList() {
    const container = document.getElementById('pokemonList');
    const searchSection = document.querySelector('.search-section');
    
    // Arama bölümünü gizle
    searchSection.style.display = 'none';
    
    container.innerHTML = '';
    
    state.allPokemon.forEach(pokemon => {
        const pokemonElement = document.createElement('div');
        pokemonElement.className = 'pokemon-card';
        
        // Bu Pokémon'un kaç kartına sahip olduğunu hesapla
        const ownedCount = [...state.ownedCards.values()].filter(card => 
            card.name.toLowerCase().includes(pokemon.name.toLowerCase())
        ).length;
        
        pokemonElement.innerHTML = `
            <img src="${pokemon.image}" alt="${pokemon.displayName}" loading="lazy">
            <h3>${pokemon.displayName}</h3>
            <p class="pokedex-number">#${String(pokemon.id).padStart(3, '0')}</p>
            ${ownedCount > 0 ? `<span class="owned-badge">${ownedCount} Kart</span>` : ''}
        `;
        
        pokemonElement.addEventListener('click', () => selectPokemon(pokemon));
        container.appendChild(pokemonElement);
    });
}

// Pokémon seçildiğinde kartlarını göster
async function selectPokemon(pokemon) {
    state.selectedPokemon = pokemon;
    state.viewMode = 'cards';
    
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = `${pokemon.displayName} kartları yükleniyor...`;
    
    try {
        // Pokémon TCG API'den bu Pokémon'un kartlarını çek
        const response = await fetch(
            `https://api.pokemontcg.io/v2/cards?q=name:"${pokemon.name}"*&pageSize=250`,
            {
                headers: {
                    'X-Api-Key': API_KEY
                }
            }
        );
        
        if (!response.ok) throw new Error(`API hatası: ${response.status}`);
        
        const data = await response.json();
        
        state.pokemonCards = data.data.map(card => ({
            id: card.id,
            name: card.name,
            image: card.images.large,
            smallImage: card.images.small,
            set: card.set.name,
            number: card.number,
            rarity: card.rarity || 'Common',
            price: card.cardmarket?.prices?.averageSellPrice || card.tcgplayer?.prices?.normal?.market || 0,
            types: card.types || []
        }));
        
        displayPokemonCards();
        loading.style.display = 'none';
    } catch (error) {
        console.error('Kart verileri yüklenirken hata:', error);
        loading.textContent = 'Yükleme hatası! Lütfen tekrar deneyin.';
        loading.style.color = '#f44336';
        setTimeout(() => {
            loading.style.display = 'none';
            state.viewMode = 'pokemon';
            displayPokemonList();
        }, 3000);
    }
}

// Seçilen Pokémon'un kartlarını göster
function displayPokemonCards() {
    const container = document.getElementById('pokemonList');
    const searchSection = document.querySelector('.search-section');
    
    // Geri dön butonu ekle
    searchSection.style.display = 'flex';
    searchSection.innerHTML = `
        <button id="backBtn" style="padding: 12px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em;">
            ← ${state.selectedPokemon.displayName} Kartlarından Geri Dön
        </button>
        <div style="flex: 1; text-align: center; font-size: 1.2em; font-weight: bold; color: #333;">
            ${state.pokemonCards.length} Kart Bulundu
        </div>
    `;
    
    document.getElementById('backBtn').addEventListener('click', () => {
        state.viewMode = 'pokemon';
        state.selectedPokemon = null;
        state.pokemonCards = [];
        displayPokemonList();
        updateStats();
    });
    
    container.innerHTML = '';
    
    if (state.pokemonCards.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 40px; font-size: 1.2em; color: #666;">Bu Pokémon için kart bulunamadı.</p>';
        return;
    }
    
    state.pokemonCards.forEach(card => {
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

// Kart sahiplik durumunu değiştirme
function toggleCardOwnership(card) {
    if (state.ownedCards.has(card.id)) {
        state.ownedCards.delete(card.id);
    } else {
        state.ownedCards.set(card.id, {
            id: card.id,
            name: card.name,
            image: card.image,
            smallImage: card.smallImage,
            set: card.set,
            number: card.number,
            rarity: card.rarity,
            price: card.price
        });
    }
    
    saveToStorage();
    
    // Görünümü güncelle
    if (state.viewMode === 'cards') {
        displayPokemonCards();
    } else {
        displayPokemonList();
    }
    
    updateStats();
    
    if (document.getElementById('binder').classList.contains('active')) {
        displayBinder();
    }
}

// İstatistikleri güncelleme
function updateStats() {
    const owned = state.ownedCards.size;
    
    // Toplam koleksiyon değeri
    let totalValue = 0;
    state.ownedCards.forEach(card => {
        totalValue += card.price || 0;
    });
    
    // Kaç farklı Pokémon'a sahip olunduğunu hesapla
    const uniquePokemon = new Set();
    state.ownedCards.forEach(card => {
        // Kart isminden Pokémon ismini çıkar (ilk kelime genelde Pokémon ismi)
        const pokemonName = card.name.split(' ')[0].toLowerCase();
        uniquePokemon.add(pokemonName);
    });
    
    const completion = state.allPokemon.length > 0 
        ? Math.round((uniquePokemon.size / state.allPokemon.length) * 100) 
        : 0;
    
    document.getElementById('totalOwned').textContent = owned;
    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;
    document.getElementById('completionRate').textContent = `${completion}%`;
}

// Binder görünümünü gösterme
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
            // Koleksiyon sekmesine dönüldüğünde Pokémon listesini göster
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
fetchPokemonList();
