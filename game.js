// Telegram WebApp Initialization
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Game State
let gameState = {
    userId: null,
    username: null,
    balances: {
        common: 0,
        silver: 0,
        gold: 0
    },
    upgrades: {
        shaft: 1,
        elevator: 1,
        storage: 1,
        manager: false
    },
    stats: {
        totalMined: { common: 0, silver: 0, gold: 0 },
        referrals: 0
    },
    lastOnline: Date.now()
};

// Economy Configuration
const ECONOMY = {
    coinRates: {
        common: 20,
        silver: 30,
        gold: 50
    },
    probabilities: {
        common: 0.70,
        silver: 0.25,
        gold: 0.05
    },
    crafting: {
        commonToSilver: { cost: 8, successRate: 0.90 },
        silverToGold: { cost: 4, successRate: 0.90 }
    },
    exchange: {
        silver: 0.001,
        gold: 0.005,
        minAmount: 100
    },
    upgrades: {
        shaft: { baseCost: 100, multiplier: 1.5 },
        elevator: { baseCost: 150, multiplier: 1.6 },
        storage: { baseCost: 200, multiplier: 1.7 },
        manager: { baseCost: 500, multiplier: 2.0 }
    },
    happyHour: {
        active: false,
        commonBonus: 0,
        rareBonus: 0.10,
        speedBonus: 0.15,
        discountBonus: 0.05
    }
};

// API Base URL (replace with your backend)
const API_URL = 'https://your-backend.com/api';

// Initialize Game
async function initGame() {
    // Get user data from Telegram
    const user = tg.initDataUnsafe.user;
    if (user) {
        gameState.userId = user.id;
        gameState.username = user.username || user.first_name;
    }

    // Load game data from backend
    await loadGameData();
    
    // Start game loops
    startMiningLoop();
    startAutoSave();
    
    // Update UI
    updateUI();
    
    // Initialize TON Connect
    initTonConnect();
    
    // Check for happy hour
    checkHappyHour();
}

// Load Game Data from Backend
async function loadGameData() {
    try {
        showLoader(true);
        const response = await fetch(`${API_URL}/player/${gameState.userId}`);
        if (response.ok) {
            const data = await response.json();
            gameState = { ...gameState, ...data };
        } else {
            // Create new player
            await createNewPlayer();
        }
    } catch (error) {
        console.error('Error loading game data:', error);
        showToast('Ошибка загрузки данных', 'error');
    } finally {
        showLoader(false);
    }
}

// Create New Player
async function createNewPlayer() {
    const referrerId = getReferrerFromUrl();
    
    try {
        const response = await fetch(`${API_URL}/player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: gameState.userId,
                username: gameState.username,
                referrerId: referrerId
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            gameState = { ...gameState, ...data };
            showToast('Добро пожаловать в Gifts Tycoon!', 'success');
        }
    } catch (error) {
        console.error('Error creating player:', error);
    }
}

// Get Referrer from URL
function getReferrerFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('start') || null;
}

// Mining Loop
function startMiningLoop() {
    setInterval(() => {
        mineCoins();
    }, 1000);
}

// Mine Coins
function mineCoins() {
    const shaftLevel = gameState.upgrades.shaft;
    const baseRate = 1 + (shaftLevel * 0.5);
    
    // Apply happy hour bonus
    const speedMultiplier = ECONOMY.happyHour.active ? (1 + ECONOMY.happyHour.speedBonus) : 1;
    const finalRate = baseRate * speedMultiplier;
    
    // Determine coin type
    const rand = Math.random();
    let coinType = 'common';
    let cumulativeProb = 0;
    
    for (const [type, prob] of Object.entries(ECONOMY.probabilities)) {
        cumulativeProb += prob;
        if (rand < cumulativeProb) {
            coinType = type;
            break;
        }
    }
    
    // Apply happy hour rare bonus
    if (coinType !== 'common' && ECONOMY.happyHour.active) {
        // Already accounted in probability
    }
    
    // Add coins
    const amount = Math.floor(finalRate);
    gameState.balances[coinType] += amount;
    gameState.stats.totalMined[coinType] += amount;
    
    // Animate
    animateMining(coinType);
    
    // Update UI periodically
    if (gameState.balances[coinType] % 10 === 0) {
        updateUI();
    }
}

// Animate Mining
function animateMining(coinType) {
    const elevator = document.getElementById('elevator');
    const miner = document.getElementById('miner');
    
    // Create coin drop animation
    const coin = document.createElement('div');
    coin.className = 'coin-drop';
    
    const colors = {
        common: '#8B7355',
        silver: '#C0C0C0',
        gold: '#FFD700'
    };
    
    coin.style.background = `radial-gradient(circle, ${colors[coinType]} 0%, ${colors[coinType]}80 100%)`;
    coin.style.left = `${50 + (Math.random() * 20 - 10)}%`;
    coin.style.top = '150px';
    
    document.getElementById('shaftContainer').appendChild(coin);
    
    // Remove after animation
    setTimeout(() => coin.remove(), 1500);
    
    // Elevator animation
    if (!gameState.upgrades.manager) {
        elevator.classList.add('moving');
        setTimeout(() => elevator.classList.remove('moving'), 2000);
    }
}

// Upgrade Functions
async function upgradeShaft() {
    const cost = getUpgradeCost('shaft');
    if (gameState.balances.common >= cost) {
        try {
            const response = await fetch(`${API_URL}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    type: 'shaft'
                })
            });
            
            if (response.ok) {
                gameState.upgrades.shaft++;
                gameState.balances.common -= cost;
                updateUI();
                showToast('Шахта улучшена!', 'success');
            }
        } catch (error) {
            showToast('Ошибка улучшения', 'error');
        }
    } else {
        showToast('Недостаточно монет!', 'error');
    }
}

async function upgradeElevator() {
    const cost = getUpgradeCost('elevator');
    if (gameState.balances.common >= cost) {
        try {
            const response = await fetch(`${API_URL}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    type: 'elevator'
                })
            });
            
            if (response.ok) {
                gameState.upgrades.elevator++;
                gameState.balances.common -= cost;
                updateUI();
                showToast('Лифт улучшен!', 'success');
            }
        } catch (error) {
            showToast('Ошибка улучшения', 'error');
        }
    } else {
        showToast('Недостаточно монет!', 'error');
    }
}

async function hireManager() {
    const cost = getUpgradeCost('manager');
    if (gameState.balances.common >= cost && !gameState.upgrades.manager) {
        try {
            const response = await fetch(`${API_URL}/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    type: 'manager'
                })
            });
            
            if (response.ok) {
                gameState.upgrades.manager = true;
                gameState.balances.common -= cost;
                updateUI();
                showToast('Менеджер нанят!', 'success');
            }
        } catch (error) {
            showToast('Ошибка найма', 'error');
        }
    } else if (gameState.upgrades.manager) {
        showToast('Менеджер уже нанят!', 'error');
    } else {
        showToast('Недостаточно монет!', 'error');
    }
}

// Get Upgrade Cost
function getUpgradeCost(type) {
    const config = ECONOMY.upgrades[type];
    const level = gameState.upgrades[type] || 1;
    const baseCost = config.baseCost;
    const multiplier = config.multiplier;
    
    let cost = Math.floor(baseCost * Math.pow(multiplier, level - 1));
    
    // Apply happy hour discount
    if (ECONOMY.happyHour.active) {
        cost = Math.floor(cost * (1 - ECONOMY.happyHour.discountBonus));
    }
    
    return cost;
}

// Crafting Functions
async function craftSilver() {
    const cost = ECONOMY.crafting.commonToSilver.cost;
    if (gameState.balances.common >= cost) {
        try {
            const response = await fetch(`${API_URL}/craft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    from: 'common',
                    to: 'silver'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                gameState.balances.common -= cost;
                if (result.success) {
                    gameState.balances.silver += 1;
                    showToast('Успешный крафт! +1 серебряная', 'success');
                } else {
                    showToast('Крафт не удался...', 'error');
                }
                updateUI();
            }
        } catch (error) {
            showToast('Ошибка крафта', 'error');
        }
    } else {
        showToast('Недостаточно обычных монет!', 'error');
    }
}

async function craftGold() {
    const cost = ECONOMY.crafting.silverToGold.cost;
    if (gameState.balances.silver >= cost) {
        try {
            const response = await fetch(`${API_URL}/craft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    from: 'silver',
                    to: 'gold'
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                gameState.balances.silver -= cost;
                if (result.success) {
                    gameState.balances.gold += 1;
                    showToast('Успешный крафт! +1 золотая', 'success');
                } else {
                    showToast('Крафт не удался...', 'error');
                }
                updateUI();
            }
        } catch (error) {
            showToast('Ошибка крафта', 'error');
        }
    } else {
        showToast('Недостаточно серебряных монет!', 'error');
    }
}

// Exchange Coins for TON
async function exchangeCoins() {
    const coinType = document.getElementById('exchangeCoinType').value;
    const amount = parseInt(document.getElementById('exchangeAmount').value);
    
    if (!amount || amount < ECONOMY.exchange.minAmount) {
        showToast(`Минимальная сумма: ${ECONOMY.exchange.minAmount}`, 'error');
        return;
    }
    
    if (gameState.balances[coinType] < amount) {
        showToast('Недостаточно монет!', 'error');
        return;
    }
    
    try {
        showLoader(true);
        const response = await fetch(`${API_URL}/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: gameState.userId,
                coinType: coinType,
                amount: amount
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            gameState.balances[coinType] -= amount;
            showToast(`Обменяно ${amount} на ${result.tonAmount} TON`, 'success');
            updateUI();
        } else {
            showToast('Ошибка обмена', 'error');
        }
    } catch (error) {
        showToast('Ошибка обмена', 'error');
    } finally {
        showLoader(false);
    }
}

// Load Leaderboard
async function loadLeaderboard() {
    const type = document.getElementById('leaderboardType').value;
    
    try {
        const response = await fetch(`${API_URL}/leaderboard/${type}?limit=100`);
        if (response.ok) {
            const data = await response.json();
            renderLeaderboard(data, type);
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Render Leaderboard
function renderLeaderboard(data, type) {
    const container = document.getElementById('leaderboardList');
    container.innerHTML = '';
    
    data.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        let rankClass = '';
        if (index === 0) rankClass = 'gold';
        else if (index === 1) rankClass = 'silver';
        else if (index === 2) rankClass = 'bronze';
        
        const coinNames = { common: 'Обычные', silver: 'Серебряные', gold: 'Золотые' };
        
        item.innerHTML = `
            <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${player.username}</div>
                <div class="leaderboard-value">${player.value.toLocaleString()} ${coinNames[type]}</div>
            </div>
        `;
        
        container.appendChild(item);
    });
}

// Copy Referral Link
function copyReferral() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    showToast('Ссылка скопирована!', 'success');
}

// TON Connect Initialization
function initTonConnect() {
    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: 'https://your-domain.com/tonconnect-manifest.json',
        buttonRootId: 'ton-connect'
    });
    
    tonConnectUI.onStatusChange(wallet => {
        if (wallet) {
            console.log('Wallet connected:', wallet);
            showToast('Кошелек подключен!', 'success');
        }
    });
}

// Topup with Telegram Stars
function topupStars() {
    tg.showPopup({
        title: 'Пополнение',
        message: 'Минимальная сумма: 100 звезд',
        buttons: [
            { id: '100', text: '100 звезд' },
            { id: '500', text: '500 звезд' },
            { id: '1000', text: '1000 звезд' },
            { type: 'cancel' }
        ]
    }, (buttonId) => {
        if (buttonId) {
            tg.showInvoice({
                title: 'Пополнение Gifts Tycoon',
                description: `${buttonId} Telegram Stars`,
                payload: `topup_${gameState.userId}_${buttonId}`,
                provider_token: '', // Your payment provider token
                currency: 'XTR',
                prices: [{ label: 'Stars', amount: parseInt(buttonId) }]
            });
        }
    });
}

// Check Happy Hour
async function checkHappyHour() {
    try {
        const response = await fetch(`${API_URL}/happy-hour`);
        if (response.ok) {
            const data = await response.json();
            if (data.active) {
                ECONOMY.happyHour.active = true;
                document.getElementById('happyHourBanner').classList.add('active');
            }
        }
    } catch (error) {
        console.error('Error checking happy hour:', error);
    }
}

// Auto Save
function startAutoSave() {
    setInterval(async () => {
        try {
            await fetch(`${API_URL}/player/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: gameState.userId,
                    data: gameState
                })
            });
        } catch (error) {
            console.error('Error saving game:', error);
        }
    }, 30000); // Save every 30 seconds
}

// Update UI
function updateUI() {
    // Update balances
    document.getElementById('commonBalance').textContent = Math.floor(gameState.balances.common).toLocaleString();
    document.getElementById('silverBalance').textContent = Math.floor(gameState.balances.silver).toLocaleString();
    document.getElementById('goldBalance').textContent = Math.floor(gameState.balances.gold).toLocaleString();
    
    // Update profile
    document.getElementById('profileCommon').textContent = Math.floor(gameState.balances.common).toLocaleString();
    document.getElementById('profileSilver').textContent = Math.floor(gameState.balances.silver).toLocaleString();
    document.getElementById('profileGold').textContent = Math.floor(gameState.balances.gold).toLocaleString();
    
    // Calculate total in TON
    const totalTON = (gameState.balances.silver * ECONOMY.exchange.silver) + 
                     (gameState.balances.gold * ECONOMY.exchange.gold);
    document.getElementById('totalBalance').textContent = totalTON.toFixed(4) + ' TON';
    
    // Update upgrade costs
    document.getElementById('shaftUpgradeCost').textContent = getUpgradeCost('shaft') + ' $';
    document.getElementById('elevatorUpgradeCost').textContent = getUpgradeCost('elevator') + ' $';
    document.getElementById('managerCost').textContent = getUpgradeCost('manager') + ' $';
    
    // Update crafting availability
    document.getElementById('commonForCraft').textContent = Math.floor(gameState.balances.common / 8);
    document.getElementById('silverForCraft').textContent = Math.floor(gameState.balances.silver / 4);
    
    // Update referral count
    document.getElementById('referralsCount').textContent = gameState.stats.referrals;
    
    // Update shaft level
    document.getElementById('shaftLevel').textContent = `Уровень ${gameState.upgrades.shaft}`;
    
    // Calculate rates
    const shaftRate = (1 + (gameState.upgrades.shaft * 0.5));
    const commonPerSec = (shaftRate * ECONOMY.probabilities.common).toFixed(2);
    const silverPerSec = (shaftRate * ECONOMY.probabilities.silver * 0.1).toFixed(2);
    const goldPerSec = (shaftRate * ECONOMY.probabilities.gold * 0.1).toFixed(2);
    
    document.getElementById('commonRate').textContent = `${commonPerSec}/сек`;
    document.getElementById('silverRate').textContent = `${silverPerSec}/сек`;
    document.getElementById('goldRate').textContent = `${goldPerSec}/сек`;
    
    // Update exchange calculation
    updateExchangeCalculation();
}

// Update Exchange Calculation
function updateExchangeCalculation() {
    const coinType = document.getElementById('exchangeCoinType').value;
    const amount = parseInt(document.getElementById('exchangeAmount').value) || 0;
    
    const rate = ECONOMY.exchange[coinType];
    const tonAmount = (amount * rate).toFixed(4);
    
    document.getElementById('exchangeReceive').textContent = `${tonAmount} TON`;
}

// Modal Functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    
    if (modalId === 'minersModal') {
        loadLeaderboard();
    } else if (modalId === 'craftModal') {
        updateUI();
    } else if (modalId === 'profileModal') {
        updateUI();
    } else if (modalId === 'walletModal') {
        updateUI();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Utility Functions
function showLoader(show) {
    const loader = document.getElementById('loader');
    if (show) {
        loader.classList.add('active');
    } else {
        loader.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Event Listeners
document.getElementById('exchangeAmount').addEventListener('input', updateExchangeCalculation);
document.getElementById('exchangeCoinType').addEventListener('change', updateExchangeCalculation);

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// Initialize on load
window.addEventListener('load', initGame);