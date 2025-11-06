/* ==================== MAIN.JS - Core Application Logic ==================== */

/**
 * Main game controller and state management
 * Coordinates all modules and handles game flow
 */

// ==================== GLOBAL GAME STATE ====================

const gameState = {
  walletConnected: false,
  walletAddress: null,
  selectedStarter: null,
  playerPokemon: null,
  currentBattle: null,
  wins: 0,
  losses: 0,
  pokemonOwned: [],
  battleHistory: [],
};

// ==================== INITIALIZATION ====================

/**
 * Initialize the application
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("PokéChain Arena initializing...");
  initializeApp();
});

function initializeApp() {
  setupEventListeners();
  // Wallet connection check is handled in web3.js
}

// ==================== EVENT LISTENERS ====================

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
  // Wallet connection
  const connectBtn = document.getElementById("connectWalletBtn");
  if (connectBtn) {
    connectBtn.addEventListener("click", connectWallet);
  }

  // Navigation tabs
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });

  // Starter selection
  const confirmStarterBtn = document.getElementById("confirmStarterBtn");
  if (confirmStarterBtn) {
    confirmStarterBtn.addEventListener("click", confirmStarter);
  }

  // Battle controls
  const startBattleBtn = document.getElementById("startBattleBtn");
  if (startBattleBtn) {
    startBattleBtn.addEventListener("click", startBattle);
  }

  const attackBtn = document.getElementById("attackBtn");
  if (attackBtn) {
    attackBtn.addEventListener("click", performAttack);
  }

  const runBtn = document.getElementById("runBtn");
  if (runBtn) {
    runBtn.addEventListener("click", runFromBattle);
  }
}

// ==================== NAVIGATION ====================

/**
 * Switch between different tabs/sections of the game
 * @param {string} tabName - Name of the tab to switch to
 */
function switchTab(tabName) {
  console.log("Switching to tab:", tabName);

  // Update nav tab active state
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.dataset.tab === tabName) {
      tab.classList.add("active");
    }
  });

  // Hide all tab content
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.add("hidden");
  });

  // Show selected tab content
  switch (tabName) {
    case "starter":
      document.getElementById("starterTab").classList.remove("hidden");
      break;
    case "arena":
      document.getElementById("arenaTab").classList.remove("hidden");
      if (!gameState.playerPokemon) {
        alert("Please select a starter Pokémon first!");
        switchTab("starter");
      }
      break;
    case "marketplace":
      document.getElementById("marketplaceTab").classList.remove("hidden");
      loadMarketplace();
      break;
    case "leaderboard":
      document.getElementById("leaderboardTab").classList.remove("hidden");
      loadLeaderboard();
      break;
  }
}

// ==================== STARTER SELECTION ====================

/**
 * Handle starter Pokémon selection
 * @param {HTMLElement} card - The clicked card element
 * @param {Object} pokemon - Pokémon data
 */
function selectStarter(card, pokemon) {
  console.log("Selected starter:", pokemon.name);

  // Remove selection from all cards
  document.querySelectorAll(".pokemon-card").forEach((c) => {
    c.classList.remove("selected");
  });

  // Mark this card as selected
  card.classList.add("selected");

  // Update game state
  gameState.selectedStarter = pokemon;

  // Show confirm button
  document.getElementById("confirmStarterBtn").classList.remove("hidden");
}

/**
 * Confirm starter selection and add to team
 */
async function confirmStarter() {
  if (!gameState.selectedStarter) {
    alert("Please select a Pokémon first!");
    return;
  }

  console.log("Confirming starter:", gameState.selectedStarter.name);

  // Simulate blockchain transaction for minting NFT
  const tx = await mintStarterPokemon(gameState.selectedStarter);

  if (tx.success) {
    // Create player's Pokémon with current HP
    gameState.playerPokemon = {
      ...gameState.selectedStarter,
      currentHp: gameState.selectedStarter.stats[0].base_stat,
      maxHp: gameState.selectedStarter.stats[0].base_stat,
      level: 5,
    };

    // Add to owned Pokémon
    gameState.pokemonOwned.push(gameState.playerPokemon);

    alert(
      `${gameState.selectedStarter.name.toUpperCase()} has joined your team!\n\nTransaction: ${tx.txHash.slice(
        0,
        10
      )}...`
    );

    // Switch to battle arena
    switchTab("arena");
  }
}

// ==================== BATTLE SYSTEM ====================

/**
 * Start a new battle
 */
async function startBattle() {
  if (!gameState.playerPokemon) {
    alert("Please select a starter Pokémon first!");
    switchTab("starter");
    return;
  }

  const opponentCount =
    parseInt(document.getElementById("opponentCount").value) || 1;

  if (opponentCount < 1 || opponentCount > 5) {
    alert("Please choose between 1 and 5 opponents!");
    return;
  }

  console.log(`Starting battle with ${opponentCount} opponent(s)`);

  // Generate random opponent from PokeAPI
  const randomId = Math.floor(Math.random() * 150) + 1;
  const opponent = await fetchPokemon(randomId);

  if (!opponent) {
    alert("Error loading opponent. Please try again.");
    return;
  }

  // Initialize battle state
  gameState.currentBattle = {
    opponent: {
      ...opponent,
      currentHp: opponent.stats[0].base_stat,
      maxHp: opponent.stats[0].base_stat,
      level: Math.floor(Math.random() * 3) + 4, // Level 4-6
    },
    totalOpponents: opponentCount,
    currentRound: 1,
    defeatedOpponents: 0,
    log: [],
  };

  // Reset player HP for new battle
  gameState.playerPokemon.currentHp = gameState.playerPokemon.maxHp;

  // Show battle arena
  document.getElementById("battleSetup").classList.add("hidden");
  document.getElementById("battleArena").classList.remove("hidden");

  // Update display and add initial log
  updateBattleDisplay();
  addBattleLog(
    `⚔️ Battle started! ${gameState.playerPokemon.name.toUpperCase()} vs ${opponent.name.toUpperCase()}!`
  );
}

/**
 * Update battle UI with current state
 */
function updateBattleDisplay() {
  const battle = gameState.currentBattle;
  const player = gameState.playerPokemon;
  const opponent = battle.opponent;

  // Update round number
  document.getElementById("roundNumber").textContent = battle.currentRound;

  // Update player display
  document.getElementById("playerName").textContent = player.name.toUpperCase();
  document.getElementById("playerSprite").src = getPokemonSprite(player);

  const playerHpPercent = Math.max(0, (player.currentHp / player.maxHp) * 100);
  const playerHealthBar = document.getElementById("playerHealth");
  playerHealthBar.style.width = playerHpPercent + "%";
  playerHealthBar.textContent = `${Math.max(0, Math.floor(player.currentHp))}/${
    player.maxHp
  }`;

  const playerTypes = player.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");
  document.getElementById("playerTypes").innerHTML = playerTypes;

  // Update opponent display
  document.getElementById("opponentName").textContent =
    opponent.name.toUpperCase();
  document.getElementById("opponentSprite").src = getPokemonSprite(opponent);

  const opponentHpPercent = Math.max(
    0,
    (opponent.currentHp / opponent.maxHp) * 100
  );
  const opponentHealthBar = document.getElementById("opponentHealth");
  opponentHealthBar.style.width = opponentHpPercent + "%";
  opponentHealthBar.textContent = `${Math.max(
    0,
    Math.floor(opponent.currentHp)
  )}/${opponent.maxHp}`;

  const opponentTypes = opponent.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");
  document.getElementById("opponentTypes").innerHTML = opponentTypes;
}

/**
 * Add message to battle log
 * @param {string} message - Message to add
 */
function addBattleLog(message) {
  const log = document.getElementById("battleLog");
  const p = document.createElement("p");
  p.textContent = message;
  log.appendChild(p);

  // Auto-scroll to bottom
  log.scrollTop = log.scrollHeight;

  // Keep log in battle state
  if (gameState.currentBattle) {
    gameState.currentBattle.log.push(message);
  }
}

/**
 * Calculate damage for an attack
 * @param {Object} attacker - Attacking Pokémon
 * @param {Object} defender - Defending Pokémon
 * @returns {number} Damage amount
 */
function calculateDamage(attacker, defender) {
  const attackStat = attacker.stats[1].base_stat;
  const defenseStat = defender.stats[2].base_stat;
  const levelModifier = attacker.level || 5;

  // Basic damage formula inspired by Pokémon games
  const baseDamage =
    (((2 * levelModifier) / 5 + 2) * attackStat) / defenseStat / 50 + 2;
  const randomFactor = Math.random() * 0.15 + 0.85; // 85-100% damage

  return Math.max(5, Math.floor(baseDamage * randomFactor));
}

/**
 * Perform attack action
 */
async function performAttack() {
  const battle = gameState.currentBattle;
  const player = gameState.playerPokemon;
  const opponent = battle.opponent;

  // Disable buttons during attack sequence
  document.getElementById("attackBtn").disabled = true;
  document.getElementById("runBtn").disabled = true;

  // Player attacks first (can be modified based on speed stat)
  const playerDamage = calculateDamage(player, opponent);
  opponent.currentHp -= playerDamage;

  addBattleLog(
    `💥 ${player.name.toUpperCase()} attacks for ${playerDamage} damage!`
  );
  updateBattleDisplay();

  await sleep(1000);

  // Check if opponent fainted
  if (opponent.currentHp <= 0) {
    addBattleLog(`✨ ${opponent.name.toUpperCase()} fainted!`);
    battle.defeatedOpponents++;
    gameState.wins++;

    await sleep(1500);

    // Check if more opponents remain
    if (battle.currentRound < battle.totalOpponents) {
      addBattleLog(`🔄 Preparing next opponent...`);
      battle.currentRound++;

      await sleep(1000);

      // Load next opponent
      await startBattle();
    } else {
      // Battle complete - player wins
      await endBattle(true);
    }
    return;
  }

  // Opponent's turn to attack
  const opponentDamage = calculateDamage(opponent, player);
  player.currentHp -= opponentDamage;

  addBattleLog(
    `💢 ${opponent.name.toUpperCase()} counterattacks for ${opponentDamage} damage!`
  );
  updateBattleDisplay();

  await sleep(1000);

  // Check if player fainted
  if (player.currentHp <= 0) {
    addBattleLog(`💀 ${player.name.toUpperCase()} fainted!`);
    gameState.losses++;

    await sleep(1500);
    await endBattle(false);
    return;
  }

  // Re-enable buttons for next turn
  document.getElementById("attackBtn").disabled = false;
  document.getElementById("runBtn").disabled = false;
}

/**
 * Run from battle
 */
function runFromBattle() {
  addBattleLog("🏃 You ran from the battle!");
  gameState.losses++;
  endBattle(false);
}

/**
 * End the current battle
 * @param {boolean} victory - True if player won
 */
async function endBattle(victory) {
  const battle = gameState.currentBattle;

  if (victory) {
    alert(
      `🎉 VICTORY!\n\nYou defeated ${battle.defeatedOpponents} opponent(s)!`
    );

    // Record win on blockchain
    await recordBattleResult("win", battle.defeatedOpponents);
  } else {
    alert(`😔 Defeat!\n\nBetter luck next time, trainer!`);

    // Record loss on blockchain
    await recordBattleResult("loss", battle.defeatedOpponents);
  }

  // Save battle history
  gameState.battleHistory.push({
    result: victory ? "win" : "loss",
    opponents: battle.defeatedOpponents,
    timestamp: Date.now(),
  });

  // Reset battle UI
  document.getElementById("battleArena").classList.add("hidden");
  document.getElementById("battleSetup").classList.remove("hidden");
  document.getElementById("battleLog").innerHTML = "";

  // Clear battle state
  gameState.currentBattle = null;
}

/**
 * Utility function to pause execution
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== MARKETPLACE ====================

/**
 * Load marketplace listings
 */
async function loadMarketplace() {
  const grid = document.getElementById("marketplaceGrid");
  const loading = document.getElementById("marketLoading");

  // Show loading
  loading.classList.remove("hidden");
  grid.classList.add("hidden");
  grid.innerHTML = "";

  await sleep(800);

  // Generate 8 random marketplace listings
  const marketIds = getRandomPokemonIds(8, 150);

  try {
    const pokemon = await fetchMultiplePokemon(marketIds);

    loading.classList.add("hidden");
    grid.classList.remove("hidden");

    pokemon.forEach((p) => {
      if (p) {
        const card = createMarketCard(p);
        grid.appendChild(card);
      }
    });
  } catch (error) {
    console.error("Error loading marketplace:", error);
    loading.innerHTML =
      "<p>❌ Error loading marketplace. Please try again.</p>";
  }
}

/**
 * Create marketplace card for a Pokémon
 * @param {Object} pokemon - Pokémon data
 * @returns {HTMLElement} Market card element
 */
function createMarketCard(pokemon) {
  const card = document.createElement("div");
  card.className = "market-card";

  const types = pokemon.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");

  // Generate random price between 0.1 and 0.6 ETH
  const price = (Math.random() * 0.5 + 0.1).toFixed(3);

  card.innerHTML = `
        <img src="${getPokemonSprite(pokemon)}" 
             alt="${pokemon.name}" 
             style="width: 150px; height: 150px; object-fit: contain;">
        <h3 style="text-transform: capitalize; margin: 10px 0;">${
          pokemon.name
        }</h3>
        <div>${types}</div>
        <div class="price-tag">💎 ${price} ETH</div>
        <div class="pokemon-stats" style="margin-top: 10px;">
            <div class="stat">
                <div class="stat-label">HP</div>
                <div class="stat-value">${pokemon.stats[0].base_stat}</div>
            </div>
            <div class="stat">
                <div class="stat-label">ATK</div>
                <div class="stat-value">${pokemon.stats[1].base_stat}</div>
            </div>
            <div class="stat">
                <div class="stat-label">DEF</div>
                <div class="stat-value">${pokemon.stats[2].base_stat}</div>
            </div>
        </div>
        <button class="btn btn-success" 
                style="margin-top: 15px; padding: 10px 20px; font-size: 0.9rem;" 
                onclick="buyPokemon('${pokemon.name}', ${price}, ${
    pokemon.id
  })">
            Buy Now
        </button>
    `;

  return card;
}

/**
 * Buy a Pokémon from the marketplace
 * @param {string} name - Pokémon name
 * @param {number} price - Price in ETH
 * @param {number} id - Pokémon ID
 */
async function buyPokemon(name, price, id) {
  if (!confirm(`Buy ${name.toUpperCase()} for ${price} ETH?`)) {
    return;
  }

  // Simulate blockchain transaction
  const tx = await buyPokemonFromMarketplace(name, price);

  if (tx.success) {
    alert(
      `✅ Successfully purchased ${name.toUpperCase()}!\n\nTransaction: ${tx.txHash.slice(
        0,
        10
      )}...\nGas Used: ${tx.gasUsed}`
    );

    // Add to owned Pokémon
    const pokemon = await fetchPokemon(id);
    if (pokemon) {
      gameState.pokemonOwned.push({
        ...pokemon,
        currentHp: pokemon.stats[0].base_stat,
        maxHp: pokemon.stats[0].base_stat,
        level: 5,
      });
    }

    // Refresh marketplace
    loadMarketplace();
  }
}

// Make buyPokemon globally accessible for onclick handlers
window.buyPokemon = buyPokemon;

// ==================== LEADERBOARD ====================

/**
 * Load and display leaderboard
 */
function loadLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");

  // Generate sample leaderboard data (in production, fetch from blockchain/backend)
  const leaderboardData = [
    {
      address: gameState.walletAddress,
      wins: gameState.wins,
      owned: gameState.pokemonOwned.length,
    },
    {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      wins: 47,
      owned: 23,
    },
    {
      address: "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0",
      wins: 42,
      owned: 19,
    },
    {
      address: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
      wins: 38,
      owned: 17,
    },
    {
      address: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
      wins: 35,
      owned: 15,
    },
    {
      address: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
      wins: 31,
      owned: 14,
    },
    {
      address: "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
      wins: 28,
      owned: 12,
    },
    {
      address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
      wins: 24,
      owned: 11,
    },
    {
      address: "0xbe862AD9AbFe6f22BCb087716c7D89a26051f74C",
      wins: 20,
      owned: 9,
    },
    {
      address: "0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69",
      wins: 15,
      owned: 7,
    },
  ];

  // Sort by wins (descending)
  leaderboardData.sort((a, b) => b.wins - a.wins);

  // Clear existing rows
  tbody.innerHTML = "";

  // Create rows for each trainer
  leaderboardData.forEach((trainer, index) => {
    const totalBattles = trainer.wins + 10; // Simulate total battles
    const winRate =
      trainer.wins > 0
        ? ((trainer.wins / totalBattles) * 100).toFixed(1)
        : "0.0";
    const isCurrentUser = trainer.address === gameState.walletAddress;

    const row = document.createElement("tr");
    row.style.background = isCurrentUser ? "rgba(255, 222, 0, 0.2)" : "";

    row.innerHTML = `
            <td><span class="rank-badge">${index + 1}</span></td>
            <td>
                ${trainer.address.slice(0, 6)}...${trainer.address.slice(-4)}
                ${
                  isCurrentUser
                    ? ' <strong style="color: var(--primary-yellow);">(You)</strong>'
                    : ""
                }
            </td>
            <td><strong style="color: var(--success);">${
              trainer.wins
            }</strong></td>
            <td>${trainer.owned}</td>
            <td>${winRate}%</td>
        `;

    tbody.appendChild(row);
  });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Show notification to user
 * @param {string} message - Notification message
 * @param {string} type - Type: 'success', 'error', 'info'
 */
function showNotification(message, type = "info") {
  // Could implement a toast notification system here
  console.log(`[${type.toUpperCase()}]`, message);
}

// Log initial state
console.log("PokéChain Arena loaded successfully!");
console.log("Game state initialized:", gameState);
