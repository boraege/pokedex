// API Key
const API_KEY = '4d21e1c5-e6f4-40f2-8add-5256da04af82';

// Uygulama durumu
const state = {
    allCards: [],
    ownedCards: new Map(), // cardId -> {cardId, name, image, price, set}
    currentPage: 1,
    itemsPerPage: 9,
    filteredCards: [],
    selectedPokemon: null,
    pokemonCards: [] // Seçilen Pokemon'un kartları
};

// LocalStorage'dan veri yükleme
function loadFromStorage() {
    const saved = localStorage.getItem('ornipokedex');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // Eski format kontrolü (array of IDs)
            if (Array.isArray(data) && data.length > 0 && typeof data[0] !== 'object') {
                // Eski format, temizle
                state.ownedCards = new Map();
                localStorage.removeItem('ornipokedex');
            } else {
                // Yeni format (Map entries)
                state.ownedCards = new Map(data);
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

// Pokémon TCG kartlarını API'den çekme
async function fetchCards(page = 1) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    
    try {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?pageSize=250&page=${page}`, {
            headers: {
                'X-Api-Key': API_KEY
            }
        });
        const data = await response.json();
        
        const cards = data.data.map(card => ({
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
        
        if (page === 1) {
            state.allCards = cards;
        } else {
            state.allCards = [...state.allCards, ...cards];
        }
        
        state.filteredCards = [...state.allCards];
        displayCards();
        updateStats();
        
        // Daha fazla sayfa varsa devam et
        if (data.page < data.totalCount / data.pageSize && page < 4) {
            await fetchCards(page + 1);
        }
    } catch (error) {
        console.error('Kart verileri yüklenirken hata:', error);
        loading.textContent = 'Yükleme hatası! Lütfen sayfayı yenileyin.';
    } finally {
        loading.style.display = 'none';
    }
}

// Kart listesini gösterme
function displayCards() {
    const container = document.getElementById('pokemonList');
    container.innerHTML = '';
    
    state.filteredCards.forEach(card => {
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
    displayCards();
    updateStats();
    if (document.getElementById('binder').classList.contains('active')) {
        displayBinder();
    }
}

// İstatistikleri güncelleme
function updateStats() {
    const total = state.allCards.length;
    const owned = state.ownedCards.size;
    const missing = total - owned;
    const completion = total > 0 ? Math.round((owned / total) * 100) : 0;
    
    // Toplam koleksiyon değeri
    let totalValue = 0;
    state.ownedCards.forEach(card => {
        totalValue += card.price || 0;
    });
    
    document.getElementById('totalOwned').textContent = owned;
    document.getElementById('totalMissing').textContent = missing;
    document.getElementById('completionRate').textContent = `${completion}%`;
    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;
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

// Arama fonksiyonu
function searchCards(query) {
    const searchTerm = query.toLowerCase();
    state.filteredCards = state.allCards.filter(card => 
        card.name.toLowerCase().includes(searchTerm) ||
        card.set.toLowerCase().includes(searchTerm) ||
        card.number.includes(searchTerm)
    );
    displayCards();
}

// Set filtreleme
function filterBySet(setName) {
    if (setName === 'all') {
        state.filteredCards = [...state.allCards];
    } else {
        state.filteredCards = state.allCards.filter(card => card.set === setName);
    }
    displayCards();
}

// Nadirlik filtreleme
function filterByRarity(rarity) {
    if (rarity === 'all') {
        state.filteredCards = [...state.allCards];
    } else {
        state.filteredCards = state.allCards.filter(card => card.rarity === rarity);
    }
    displayCards();
}

// Unique setleri al
function getUniqueSets() {
    const sets = new Set(state.allCards.map(card => card.set));
    return [...sets].sort();
}

// Unique nadirlik değerlerini al
function getUniqueRarities() {
    const rarities = new Set(state.allCards.map(card => card.rarity));
    return [...rarities].sort();
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
    searchCards(e.target.value);
});

document.getElementById('setFilter').addEventListener('change', (e) => {
    filterBySet(e.target.value);
});

document.getElementById('rarityFilter').addEventListener('change', (e) => {
    filterByRarity(e.target.value);
});

document.getElementById('showAllBtn').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('setFilter').value = 'all';
    document.getElementById('rarityFilter').value = 'all';
    state.filteredCards = [...state.allCards];
    displayCards();
});

// Filtreleri doldur
function populateFilters() {
    const setFilter = document.getElementById('setFilter');
    const rarityFilter = document.getElementById('rarityFilter');
    
    // Set filtresi
    const sets = getUniqueSets();
    sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.textContent = set;
        setFilter.appendChild(option);
    });
    
    // Nadirlik filtresi
    const rarities = getUniqueRarities();
    rarities.forEach(rarity => {
        const option = document.createElement('option');
        option.value = rarity;
        option.textContent = rarity;
        rarityFilter.appendChild(option);
    });
}

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
fetchCards().then(() => {
    populateFilters();
});
