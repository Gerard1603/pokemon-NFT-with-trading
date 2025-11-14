const gameState = {
  walletConnected: false,
  walletAddress: null,
  trainerName: null,
  isRegistered: false,
  selectedStarter: null,
  playerPokemon: null,
  playerTeam: { active: 0, pokemon: [] },
  currentBattle: null,
  wins: 0,
  losses: 0,
  pokemonOwned: [],
  battleHistory: [],
  achievements: {
    FIRST_WIN: false,
    POKEMON_COLLECTOR: false,
    BATTLE_MASTER: false,
    FIRST_CATCH: false,
    LEGENDARY_OWNER: false,
  },
  xp: 0,
  level: 1,
  currency: 1000,
  dailyQuests: [],
  lastPlayed: null,
  playerInventory: { potions: 0, superPotions: 0, revives: 0, pokeballs: 0 },
  aiBattles: [],
  freeReviveUsed: false, // Track if free revive has been used
};

// Authentic battle mechanics constants
const BATTLE_MECHANICS = {
  CRITICAL_HIT_CHANCE: 0.0625, // 1/16 chance
  STAB_MULTIPLIER: 1.5,
  CRITICAL_MULTIPLIER: 1.5, // Gen 6+ uses 1.5
};

const ACHIEVEMENTS_CONFIG = {
  FIRST_WIN: {
    name: "First Victory!",
    description: "Win your first battle",
    reward: { currency: 500 },
  },
  POKEMON_COLLECTOR: {
    name: "Pokémon Collector",
    description: "Own 5 different Pokémon",
    reward: { currency: 1000 },
  },
  BATTLE_MASTER: {
    name: "Battle Master",
    description: "Win 10 battles",
    reward: { currency: 2000 },
  },
  FIRST_CATCH: {
    name: "First Catch!",
    description: "Purchase your first Pokémon from the marketplace",
    reward: { currency: 300 },
  },
  LEGENDARY_OWNER: {
    name: "Legendary Owner!",
    description: "Own a legendary Pokémon",
    reward: { currency: 5000 },
  },
};

const ITEM_CONFIG = {
  potion: {
    name: "Potion",
    key: "potion",
    price: 200,
    effect: "Restores 20 HP",
    icon: "💊",
    type: "healing",
  },
  superPotion: {
    name: "Super Potion",
    key: "superPotion",
    price: 500,
    effect: "Restores 50 HP",
    icon: "🧪",
    type: "healing",
  },
  revive: {
    name: "Revive",
    key: "revive",
    price: 1000,
    effect: "Revives a fainted Pokémon",
    icon: "💫",
    type: "revive",
  },
  pokeball: {
    name: "Poké Ball",
    key: "pokeball",
    price: 300,
    effect: "Capture wild Pokémon",
    icon: "🔴",
    type: "capture",
  },
};

// Default move to pad movesets
const DEFAULT_MOVE = {
  name: "Tackle",
  power: 40,
  accuracy: 100,
  type: "normal",
  damageClass: "physical",
  pp: 35,
  ppCurrent: 35,
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("PokéChain Arena initializing...");
  initializeApp();
});

function initializeApp() {
  setupEventListeners();
  loadGameState(); // Load state *before* checking wallet
  initializeAudio();
  checkDailyQuests();
  setupAuthTabs();

  if (!document.getElementById("toastContainer")) {
    const toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }
}

function setupAuthTabs() {
  const authTabs = document.querySelectorAll(".auth-tab");
  authTabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabName = e.currentTarget?.dataset?.tab;
      if (tabName) switchAuthTab(tabName);
    });
  });

  const registerBtn = document.getElementById("registerWalletBtn");
  if (registerBtn) registerBtn.addEventListener("click", registerTrainer);

  const loginBtn = document.getElementById("connectWalletBtn");
  if (loginBtn) loginBtn.addEventListener("click", connectWallet); // connectWallet from web3.js will trigger loginTrainer

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

function switchAuthTab(tabName) {
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.dataset.tab === tabName) tab.classList.add("active");
  });

  document
    .querySelectorAll(".auth-form")
    .forEach((form) => form.classList.add("hidden"));

  const form = document.getElementById(tabName + "Form");
  if (form) form.classList.remove("hidden");
}

async function registerTrainer() {
  const trainerNameInput = document.getElementById("trainerName");
  const trainerName = trainerNameInput ? trainerNameInput.value.trim() : "";

  if (!trainerName) {
    showNotification("Please enter a trainer name!", "warning");
    return;
  }

  if (typeof isMetaMaskInstalled === "function" && !isMetaMaskInstalled()) {
    showNotification("Please install MetaMask first!", "error");
    return;
  }

  try {
    // Request wallet connection if not already connected
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length > 0) {
      handleWalletConnected(accounts[0]); // Update state and UI

      const registerBtn = document.getElementById("registerWalletBtn");
      const originalText = registerBtn ? registerBtn.textContent : "";
      if (registerBtn) {
        registerBtn.textContent = "Registering...";
        registerBtn.disabled = true;
      }

      try {
        const tx = await registerTrainerOnChain(trainerName, accounts[0]);
        if (tx.success) {
          gameState.trainerName = trainerName;
          gameState.walletAddress = accounts[0];
          gameState.isRegistered = true;
          gameState.walletConnected = true;

          const playerTrainerName =
            document.getElementById("playerTrainerName");
          if (playerTrainerName) playerTrainerName.textContent = trainerName;

          showNotification(
            `Welcome, ${trainerName}! Registration successful.`,
            "success"
          );
          saveGameState(); // Save the new registration
          showGameScreen();
        } else {
          throw new Error("Blockchain registration failed");
        }
      } finally {
        if (registerBtn) {
          registerBtn.textContent = originalText;
          registerBtn.disabled = false;
        }
      }
    }
  } catch (error) {
    console.error("Registration error:", error);
    showNotification("Registration failed. Please try again.", "error");
  }
}

async function loginTrainer() {
  // This function is triggered by web3.js's connectWallet
  if (!gameState.walletConnected || !gameState.walletAddress) {
    showNotification("Please connect your wallet first.", "warning");
    return;
  }

  try {
    const savedState = localStorage.getItem("pokechain_arena_save");
    if (savedState) {
      const loadedState = JSON.parse(savedState);

      // Check if the save file belongs to the connected wallet
      if (
        loadedState.walletAddress === gameState.walletAddress &&
        loadedState.isRegistered
      ) {
        // Load progress
        Object.assign(gameState, {
          ...loadedState,
          walletConnected: true,
          walletAddress: gameState.walletAddress,
          currentBattle: null,
        });

        const playerTrainerName = document.getElementById("playerTrainerName");
        if (playerTrainerName)
          playerTrainerName.textContent = gameState.trainerName;

        showNotification(`Welcome back, ${gameState.trainerName}!`, "success");
        showGameScreen(); // Show the game
      } else {
        // Save file doesn't match wallet
        showNotification(
          "No registered trainer found for this wallet. Please register first.",
          "warning"
        );
        switchAuthTab("register");
      }
    } else {
      // No save file at all
      showNotification(
        "No saved game found. Please register as a new trainer.",
        "warning"
      );
      switchAuthTab("register");
    }
  } catch (error) {
    console.error("Login error:", error);
    showNotification("Login failed. Please try again.", "error");
  }
}

// ===================================
//  FIXED LOGOUT FUNCTION
// ===================================

function logout() {
  // 1. Save all current progress to localStorage
  saveGameState();
  console.log("Progress saved on logout.");

  // 2. Keep wallet info (if still connected) but clear game data
  const wasConnected = gameState.walletConnected;
  const walletAddr = gameState.walletAddress;

  // 3. Reset the in-memory gameState object to its default
  Object.assign(gameState, {
    walletConnected: wasConnected, // Keep wallet status
    walletAddress: walletAddr, // Keep wallet address
    trainerName: null,
    isRegistered: false,
    selectedStarter: null,
    playerPokemon: null,
    playerTeam: { active: 0, pokemon: [] },
    currentBattle: null,
    wins: 0,
    losses: 0,
    pokemonOwned: [],
    battleHistory: [],
    achievements: {
      FIRST_WIN: false,
      POKEMON_COLLECTOR: false,
      BATTLE_MASTER: false,
      FIRST_CATCH: false,
      LEGENDARY_OWNER: false,
    },
    xp: 0,
    level: 1,
    currency: 1000,
    dailyQuests: [],
    lastPlayed: null,
    playerInventory: { potions: 0, superPotions: 0, revives: 0, pokeballs: 0 },
    aiBattles: [],
    freeReviveUsed: false,
  });

  // 4. Hide game screen, show landing page
  const game = document.getElementById("gameScreen");
  const landing = document.getElementById("landingPage");
  if (game) game.classList.add("hidden");
  if (landing) landing.classList.remove("hidden");

  // 5. Reset landing page UI
  switchAuthTab("login");
  const formattedAddress = formatAddress(walletAddr); // formatAddress is from web3.js

  const walletStatus = document.getElementById("walletStatus");
  if (walletStatus) {
    if (wasConnected) {
      walletStatus.innerHTML = `<p>✅ Connected: ${formattedAddress}</p>`;
    } else {
      walletStatus.innerHTML = `🦊 Connect your MetaMask wallet`;
    }
  }
  const registerWalletStatus = document.getElementById("registerWalletStatus");
  if (registerWalletStatus) {
    if (wasConnected) {
      registerWalletStatus.innerHTML = `<p>✅ Connected: ${formattedAddress}</p>`;
    } else {
      registerWalletStatus.innerHTML = `🦊 Connect MetaMask to register`;
    }
  }

  // 6. Show notification
  showNotification("Logged out successfully. Your progress is saved.", "info");
}

// ===================================

function initializeAudio() {
  gameState.audio = { enabled: true, volume: 0.5 };
  console.log("Audio system initialized");
}
function playSound(soundName) {
  if (!gameState.audio?.enabled) return;
  console.log(`Playing sound: ${soundName}`);
  // In a real app, you'd use new Audio(url).play()
}

function showNotification(message, type = "info", duration = 3000) {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    console.warn("Toast container not found!");
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = getNotificationIcon(type);
  toast.innerHTML = `<span class.name="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  toastContainer.appendChild(toast);

  // Remove toast after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = "slideInRight 0.3s ease-out reverse"; // Play exit animation
      setTimeout(() => toast.remove(), 300); // Remove from DOM after animation
    }
  }, duration);

  return toast;
}
function getNotificationIcon(type) {
  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  return icons[type] || icons.info;
}

function setupEventListeners() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabName = e.currentTarget?.dataset?.tab;
      if (tabName) switchTab(tabName);
    });
  });

  const confirmStarterBtn = document.getElementById("confirmStarterBtn");
  if (confirmStarterBtn)
    confirmStarterBtn.addEventListener("click", confirmStarter);

  const startBattleBtn = document.getElementById("startBattleBtn");
  if (startBattleBtn) startBattleBtn.addEventListener("click", startBattle);

  const runBtn = document.getElementById("runBtn");
  if (runBtn) runBtn.addEventListener("click", runFromBattle);

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  // Allow move selection with keys 1-4
  switch (e.key) {
    case "1":
    case "2":
    case "3":
    case "4": {
      if (gameState.currentBattle && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // Stop number from being typed elsewhere
        const moveIndex = parseInt(e.key) - 1;
        const moveButtons = document.querySelectorAll(".move-btn");
        if (moveButtons[moveIndex] && !moveButtons[moveIndex].disabled) {
          moveButtons[moveIndex].click();
        }
      }
      break;
    }
    case "Escape":
      // Allow running from battle
      if (gameState.currentBattle) {
        e.preventDefault();
        const runBtn = document.getElementById("runBtn");
        if (runBtn && !runBtn.disabled) runBtn.click();
      }
      break;
  }
}

function loadGameState() {
  try {
    const saved = localStorage.getItem("pokechain_arena_save");
    if (saved) {
      const loadedState = JSON.parse(saved);
      // Merge saved state, but keep transient state (like wallet)
      Object.assign(gameState, {
        ...loadedState,
        walletConnected: false, // Will be set by web3.js
        walletAddress: null, // Will be set by web3.js
        currentBattle: null, // Always reset battle on load
        freeReviveUsed:
          loadedState.freeReviveUsed !== undefined
            ? loadedState.freeReviveUsed
            : false, // Initialize if missing
      });

      console.log("Game state loaded from localStorage");
    }
  } catch (error) {
    console.error("Error loading game state:", error);
    localStorage.removeItem("pokechain_arena_save"); // Clear corrupted state
  }
}

function saveGameState() {
  try {
    // Don't save transient state like the current battle
    const stateToSave = { ...gameState, currentBattle: null };
    localStorage.setItem("pokechain_arena_save", JSON.stringify(stateToSave));
    console.log("Game state saved.");
  } catch (error) {
    console.error("Error saving game state:", error);
    showNotification("Error: Could not save game progress.", "error");
  }
}

function updatePlayerStatsDisplay() {
  const header = document.querySelector(".header");
  if (!header) return;

  let statsElement = header.querySelector(".player-stats");
  if (!statsElement) {
    statsElement = document.createElement("div");
    statsElement.className = "player-stats";
    header.appendChild(statsElement);
  }

  // Calculate total items
  const totalItems = Object.values(gameState.playerInventory).reduce(
    (a, b) => a + b,
    0
  );

  statsElement.innerHTML = `
    <div class="stat-badge" title="Trainer Level">🏅 Level: ${
      gameState.level
    }</div>
    <div class="stat-badge" title="Experience Points">✨ XP: ${
      gameState.xp
    } / ${calculateLevelXP(gameState.level)}</div>
    <div class="stat-badge" title="Battles Won">🏆 Wins: ${gameState.wins}</div>
    <div class="stat-badge" title="Pokémon Owned">🔴 Pokémon: ${
      gameState.pokemonOwned.length
    }</div>
    <div class="stat-badge" title="Game Currency">₽ ${gameState.currency}</div>
    <div class="stat-badge" title="Total Items">🎒 Items: ${totalItems}</div>
  `;
}

function switchTab(tabName) {
  console.log("Switching to tab:", tabName);

  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.dataset.tab === tabName) tab.classList.add("active");
  });

  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.add("hidden"));

  const targetTab = document.getElementById(tabName + "Tab");
  if (targetTab) targetTab.classList.remove("hidden");

  // Handle logic for specific tabs
  switch (tabName) {
    case "starter":
      // Only show starter tab if player hasn't chosen one
      if (
        !gameState.playerPokemon &&
        typeof loadStarterPokemon === "function"
      ) {
        loadStarterPokemon();
      } else if (gameState.playerPokemon) {
        // If they already have a pokemon, redirect to arena
        showNotification("You already have a starter! Go battle!", "info");
        switchTab("arena");
      }
      break;
    case "arena":
      if (!gameState.playerPokemon) {
        showNotification("Please select a starter Pokémon first!", "warning");
        switchTab("starter");
      } else {
        // Refresh team display every time
        updateTeamDisplay();
      }
      break;
    case "marketplace":
      loadMarketplace();
      break;
    case "leaderboard":
      loadLeaderboard();
      break;
    case "achievements":
      loadAchievements();
      break;
  }
}

function selectStarter(card, pokemon) {
  console.log("Selected starter:", pokemon.name);
  playSound("select");

  document
    .querySelectorAll(".pokemon-card")
    .forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");

  gameState.selectedStarter = pokemon;

  const btn = document.getElementById("confirmStarterBtn");
  if (btn) btn.classList.remove("hidden");
}

/**
 * Calculate HP based on base stat and level (Pokemon formula)
 * Formula: ((2 * base_stat + IV + EV/4) * level / 100) + level + 10
 * Simplified: ((2 * base_stat + 31) * level / 100) + level + 10
 */
function calculateHP(baseStat, level, iv = 31, ev = 0) {
  return (
    Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) +
    level +
    10
  );
}

/**
 * Calculate non-HP stat based on base stat and level (Pokemon formula)
 * Formula: ((2 * base_stat + IV + EV/4) * level / 100) + 5
 * Simplified: ((2 * base_stat + 31) * level / 100) + 5
 */
function calculateStat(baseStat, level, iv = 31, ev = 0) {
  return (
    Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5
  );
}

/**
 * Get actual stat value for a Pokemon (level-scaled)
 * @param {Object} pokemon - Pokemon object
 * @param {number} statIndex - Index in stats array (0=HP, 1=Atk, 2=Def, 3=SpAtk, 4=SpDef, 5=Speed)
 * @returns {number} Actual stat value
 */
function getActualStat(pokemon, statIndex) {
  const level = pokemon.level || 5;
  const baseStat = pokemon.stats[statIndex].base_stat;

  // Map stat indices to IV/EV property names
  const statNames = ["", "attack", "defense", "spAttack", "spDefense", "speed"];
  const statName = statIndex === 0 ? "hp" : statNames[statIndex];

  // Get IV (default to 31 for player Pokemon, 15 for opponents)
  let iv = 31;
  if (pokemon.ivs) {
    iv = pokemon.ivs[statName] !== undefined ? pokemon.ivs[statName] : 31;
  }

  // Get EV (default to 0)
  let ev = 0;
  if (pokemon.evs) {
    ev = pokemon.evs[statName] !== undefined ? pokemon.evs[statName] : 0;
  }

  if (statIndex === 0) {
    return calculateHP(baseStat, level, iv, ev);
  } else {
    return calculateStat(baseStat, level, iv, ev);
  }
}

/**
 * Formats an array of moves fetched from pokeapi, ensuring a 4-move-set.
 * @param {Array} apiMoves - Array of move objects from pokeapi (data.movesWithDetails)
 * @returns {Array} A new array of 4 move objects.
 */
function formatAndPadMoves(apiMoves) {
  const formattedMoves = (apiMoves || []).slice(0, 4).map((m) => ({
    name: (m.name || "Struggle")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    power: m.power || 0, // 0 power for status moves
    accuracy: m.accuracy || 100,
    type: m.type || "normal",
    damageClass: m.damageClass || "physical",
    pp: m.pp || 10,
    ppCurrent: m.pp || 10,
    effect: m.effect || "Deals damage",
    statusEffect: m.statusEffect || null,
    statusChance: m.statusChance || 0,
  }));

  // If we don't have 4 moves, pad with Tackle
  while (formattedMoves.length < 4) {
    formattedMoves.push({ ...DEFAULT_MOVE });
  }

  return formattedMoves;
}

async function confirmStarter() {
  if (!gameState.selectedStarter) {
    showNotification("Please select a Pokémon first!", "warning");
    return;
  }

  console.log("Confirming starter:", gameState.selectedStarter.name);
  playSound("confirm");

  const confirmBtn = document.getElementById("confirmStarterBtn");
  const originalText = confirmBtn ? confirmBtn.textContent : "";
  if (confirmBtn) {
    confirmBtn.textContent = "Minting NFT...";
    confirmBtn.disabled = true;
  }

  try {
    // Simulate blockchain transaction
    const tx = await mintStarterPokemon(gameState.selectedStarter);

    if (tx.success) {
      // **FIX: Use helper to ensure 4 moves**
      const formattedMoves = formatAndPadMoves(
        gameState.selectedStarter.movesWithDetails
      );

      const starterLevel = 5;
      const starterIVs = generateIVs();
      const starterMaxHp = calculateHP(
        gameState.selectedStarter.stats[0].base_stat,
        starterLevel,
        starterIVs.hp,
        0
      );

      const starterPokemon = {
        ...gameState.selectedStarter,
        currentHp: starterMaxHp,
        maxHp: starterMaxHp,
        level: starterLevel,
        xp: 0,
        moves: formattedMoves, // Assign the 4 moves
        ivs: starterIVs,
        evs: {
          hp: 0,
          attack: 0,
          defense: 0,
          spAttack: 0,
          spDefense: 0,
          speed: 0,
        },
        status: null, // Status effect: null, 'poison', 'paralyze', etc.
        movesLearned: [], // Track moves learned to avoid duplicates
      };

      gameState.playerPokemon = starterPokemon;
      gameState.playerTeam.pokemon = [starterPokemon];
      gameState.playerTeam.active = 0;
      gameState.pokemonOwned.push(starterPokemon);

      showNotification(
        `${gameState.selectedStarter.name.toUpperCase()} has joined your team!`,
        "success"
      );
      playSound("unlock");

      updatePlayerStatsDisplay();
      saveGameState();

      // Hide starter selection tab and switch to arena
      const starterNavTab = document.querySelector(
        '.nav-tab[data-tab="starter"]'
      );
      if (starterNavTab) starterNavTab.classList.add("hidden");

      setTimeout(() => {
        switchTab("arena");
      }, 800);
    } else {
      throw new Error("Simulated Minting Transaction Failed");
    }
  } catch (error) {
    console.error("Error confirming starter:", error);
    showNotification(
      "Failed to mint starter Pokémon. Please try again.",
      "error"
    );
  } finally {
    if (confirmBtn) {
      confirmBtn.textContent = originalText;
      confirmBtn.disabled = false;
    }
  }
}

function generateIVs() {
  return {
    hp: Math.floor(Math.random() * 32),
    attack: Math.floor(Math.random() * 32),
    defense: Math.floor(Math.random() * 32),
    spAttack: Math.floor(Math.random() * 32),
    spDefense: Math.floor(Math.random() * 32),
    speed: Math.floor(Math.random() * 32),
  };
}

function updateTeamDisplay() {
  const arenaTab = document.getElementById("arenaTab");
  if (!arenaTab) return;

  // Find or create the team management section
  let teamSection = arenaTab.querySelector(".team-management");
  if (!teamSection) {
    teamSection = document.createElement("div");
    teamSection.className = "team-management";
    const battleSetup = arenaTab.querySelector(".battle-setup");
    // Insert team display before the battle setup
    arenaTab.insertBefore(teamSection, battleSetup || arenaTab.firstChild);
  }

  teamSection.innerHTML = `
    <h3>Your Team (Max 6)</h3>
    <div class="team-grid" id="teamGrid"></div>
  `;

  const teamGrid = document.getElementById("teamGrid");
  if (!teamGrid) return;
  teamGrid.innerHTML = ""; // Clear old team

  // Display all Pokémon in the team
  gameState.playerTeam.pokemon.forEach((pokemon, index) => {
    const member = document.createElement("div");
    member.className = `team-member ${
      index === gameState.playerTeam.active ? "active" : ""
    } ${pokemon.currentHp <= 0 ? "fainted" : ""}`;
    member.title = `Switch to ${pokemon.name}`;

    member.innerHTML = `
      <img src="${getPokemonSprite(pokemon)}" alt="${
      pokemon.name
    }" style="width: 60px; height: 60px;">
      <div>${pokemon.name.toUpperCase()} Lv.${pokemon.level}</div>
      <div class="health-bar" style="height: 15px; margin: 5px 0;">
        <div class="health-fill" style="width: ${
          (pokemon.currentHp / pokemon.maxHp) * 100
        }%">
          ${Math.floor(pokemon.currentHp)}/${pokemon.maxHp}
        </div>
      </div>
    `;
    member.addEventListener("click", () => switchActivePokemon(index));
    teamGrid.appendChild(member);
  });
}

function switchActivePokemon(index) {
  if (index === gameState.playerTeam.active) {
    // Don't show notification if in battle, it's confusing
    if (!gameState.currentBattle) {
      showNotification("This Pokémon is already your active one!", "info");
    }
    return;
  }
  if (gameState.playerTeam.pokemon[index].currentHp <= 0) {
    showNotification("This Pokémon has fainted and cannot battle!", "warning");
    return;
  }

  // Logic to handle switching during a battle
  if (gameState.currentBattle && gameState.currentBattle.turn === "player") {
    // This is a "switch" move, which costs a turn
    gameState.playerTeam.active = index;
    gameState.playerPokemon = gameState.playerTeam.pokemon[index];
    updateTeamDisplay();
    updateBattleDisplay();
    addBattleLog(`Go! ${gameState.playerPokemon.name.toUpperCase()}!`);
    // Opponent gets a free turn
    setTimeout(opponentTurn, 1000);
  } else if (!gameState.currentBattle) {
    // If not in battle, just switch the default active Pokémon
    gameState.playerTeam.active = index;
    gameState.playerPokemon = gameState.playerTeam.pokemon[index];
    updateTeamDisplay();
    showNotification(
      `${gameState.playerPokemon.name} is now your active Pokémon.`,
      "success"
    );
    saveGameState(); // Save the new active Pokémon
  }
}

async function startBattle() {
  if (!gameState.playerPokemon) {
    showNotification("Please select a starter Pokémon first!", "warning");
    switchTab("starter");
    return;
  }

  if (gameState.playerPokemon.currentHp <= 0) {
    showNotification(
      "Your active Pokémon has fainted! Please revive it or switch.",
      "error"
    );
    return;
  }

  const select = document.getElementById("opponentCount");
  const opponentCount = parseInt(select?.value) || 1;
  if (opponentCount < 1 || opponentCount > 5) {
    showNotification("Please choose between 1 and 5 opponents!", "warning");
    return;
  }

  console.log(`Starting battle with ${opponentCount} opponent(s)`);
  playSound("battle_start");

  // Restore HP/PP for all team members before battle and clear status
  gameState.playerTeam.pokemon.forEach((p) => {
    p.currentHp = p.maxHp;
    p.status = null; // Clear status effects
    p.moves.forEach((m) => (m.ppCurrent = m.pp));
  });
  // Ensure the active pokemon reference is updated
  gameState.playerPokemon =
    gameState.playerTeam.pokemon[gameState.playerTeam.active];

  const randomId = Math.floor(Math.random() * 150) + 1; // Gen 1 only
  const opponentData = await fetchPokemon(randomId);
  if (!opponentData) {
    showNotification("Error loading opponent. Please try again.", "error");
    return;
  }

  // **FIX: Use helper to ensure 4 moves for opponent**
  const opponentMoves = formatAndPadMoves(opponentData.movesWithDetails);

  // Make opponent level match player level exactly for fair battles
  const opponentLevel = gameState.playerPokemon.level;

  // Generate IVs for opponent (use average IVs for fairness)
  const opponentIVs = {
    hp: 15,
    attack: 15,
    defense: 15,
    spAttack: 15,
    spDefense: 15,
    speed: 15,
  };

  const opponentMaxHp = calculateHP(
    opponentData.stats[0].base_stat,
    opponentLevel,
    opponentIVs.hp,
    0
  );

  gameState.currentBattle = {
    opponent: {
      ...opponentData,
      currentHp: opponentMaxHp,
      maxHp: opponentMaxHp,
      level: opponentLevel,
      moves: opponentMoves, // Assign 4 moves
      ivs: opponentIVs,
      evs: {
        hp: 0,
        attack: 0,
        defense: 0,
        spAttack: 0,
        spDefense: 0,
        speed: 0,
      },
      status: null,
    },
    totalOpponents: opponentCount,
    currentRound: 1,
    defeatedOpponents: 0,
    log: [],
    turn: "player",
  };

  const setup = document.getElementById("battleSetup");
  const arena = document.getElementById("battleArena");
  if (setup) setup.classList.add("hidden");
  if (arena) arena.classList.remove("hidden");

  updateBattleDisplay();
  addBattleLog(
    `⚔️ A wild ${opponentData.name.toUpperCase()} (Lv.${opponentLevel}) appeared!`
  );
  addBattleLog(`Go! ${gameState.playerPokemon.name.toUpperCase()}!`);

  const runBtn = document.getElementById("runBtn");
  if (runBtn) runBtn.disabled = false;

  addItemButtonsToBattle();
}

function updateBattleDisplay() {
  const battle = gameState.currentBattle;
  if (!battle) return;

  const player = gameState.playerPokemon;
  const opponent = battle.opponent;

  // Update round number
  const roundNumber = document.getElementById("roundNumber");
  if (roundNumber)
    roundNumber.textContent = `${battle.currentRound} / ${battle.totalOpponents}`;

  // Player Side
  const playerLevelBadge = document.getElementById("playerLevelBadge");
  const playerName = document.getElementById("playerName");
  const playerSprite = document.getElementById("playerSprite");
  const playerTypes = document.getElementById("playerTypes");
  const playerHealth = document.getElementById("playerHealth");

  if (playerLevelBadge) playerLevelBadge.textContent = `Lv ${player.level}`;
  if (playerName) playerName.textContent = `${player.name.toUpperCase()}`;
  if (playerSprite) {
    playerSprite.src = getPokemonSprite(player, false); // Use back sprite
    playerSprite.parentElement.className = "battle-pokemon player"; // Reset animations
  }
  if (playerTypes) {
    playerTypes.innerHTML = player.types
      .map(
        (t) =>
          `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
      )
      .join("");
  }
  if (playerHealth) {
    const pct = Math.max(0, (player.currentHp / player.maxHp) * 100);
    playerHealth.style.width = pct + "%";
    playerHealth.textContent = `${Math.max(0, Math.floor(player.currentHp))}/${
      player.maxHp
    }`;
    // Change health bar color based on HP
    playerHealth.style.background =
      pct > 50
        ? "linear-gradient(90deg, #00ff00 0%, #ffff00 100%)"
        : pct > 20
        ? "#ffff00"
        : "#ff0000";
  }

  // Opponent Side
  const opponentLevelBadge = document.getElementById("opponentLevelBadge");
  const opponentName = document.getElementById("opponentName");
  const opponentSprite = document.getElementById("opponentSprite");
  const opponentTypes = document.getElementById("opponentTypes");
  const opponentHealth = document.getElementById("opponentHealth");

  if (opponentLevelBadge)
    opponentLevelBadge.textContent = `Lv ${opponent.level}`;
  if (opponentName) opponentName.textContent = `${opponent.name.toUpperCase()}`;
  if (opponentSprite) {
    opponentSprite.src = getPokemonSprite(opponent); // Front sprite
    opponentSprite.parentElement.className = "battle-pokemon opponent"; // Reset animations
  }
  if (opponentTypes) {
    opponentTypes.innerHTML = opponent.types
      .map(
        (t) =>
          `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
      )
      .join("");
  }
  if (opponentHealth) {
    const pct = Math.max(0, (opponent.currentHp / opponent.maxHp) * 100);
    opponentHealth.style.width = pct + "%";
    opponentHealth.textContent = `${Math.max(
      0,
      Math.floor(opponent.currentHp)
    )}/${opponent.maxHp}`;
    // Change health bar color
    opponentHealth.style.background =
      pct > 50
        ? "linear-gradient(90deg, #00ff00 0%, #ffff00 100%)"
        : pct > 20
        ? "#ffff00"
        : "#ff0000";
  }

  // Update move buttons
  updateMoveButtons();
}

function updateMoveButtons() {
  const battleActions = document.getElementById("battleActions");
  if (!battleActions) return;

  // Clear only move buttons, not all buttons (like Run)
  battleActions.querySelectorAll(".move-btn").forEach((btn) => btn.remove());

  const runBtn = document.getElementById("runBtn"); // Find the run button

  if (
    !gameState.playerPokemon.moves ||
    gameState.playerPokemon.moves.length === 0
  ) {
    console.error("No moves available for player Pokémon");
    return;
  }

  // Add 4 move buttons
  gameState.playerPokemon.moves.forEach((move) => {
    const moveBtn = document.createElement("button");
    moveBtn.className = "move-btn";
    moveBtn.innerHTML = `
      <div style="font-weight: bold;">${move.name}</div>
      <div style="font-size: 0.8rem; opacity: 0.8;">
        <span class="type-badge type-${move.type}">${move.type}</span> 
        PWR: ${move.power || "—"} | ACC: ${move.accuracy}%
      </div>
      <div style="font-size: 0.7rem; opacity: 0.7;">PP: ${move.ppCurrent}/${
      move.pp
    }</div>
    `;
    moveBtn.title = move.effect || "Deals damage";

    // Disable button if out of PP
    if (move.ppCurrent <= 0) {
      moveBtn.disabled = true;
      moveBtn.innerHTML += `<div style="color: var(--danger); font-weight: bold; font-size: 0.7rem;">NO PP</div>`;
    }

    moveBtn.addEventListener("click", () => useMove(move));
    // Insert moves *before* the Run button
    battleActions.insertBefore(moveBtn, runBtn);
  });
}

function addItemButtonsToBattle() {
  const battleActions = document.getElementById("battleActions");
  if (!battleActions) return;

  // Find or create the items section
  let itemsSection = battleActions.querySelector(".battle-items");
  if (!itemsSection) {
    itemsSection = document.createElement("div");
    itemsSection.className = "battle-items";
    itemsSection.style.marginTop = "15px";
    itemsSection.style.paddingTop = "15px";
    itemsSection.style.borderTop = "2px solid rgba(255,255,255,0.1)";
    itemsSection.style.width = "100%"; // Make it span full width
    itemsSection.style.textAlign = "center";
    battleActions.appendChild(itemsSection);
  }

  itemsSection.innerHTML = "<h4>Items:</h4>"; // Clear and set header

  let hasItems = false;

  if (gameState.playerInventory.potions > 0) {
    const potionBtn = document.createElement("button");
    potionBtn.className = "btn btn-primary btn-small";
    potionBtn.innerHTML = `💊 Potion (${gameState.playerInventory.potions})`;
    potionBtn.title = "Restore 20 HP";
    potionBtn.addEventListener("click", () => useItem("potion"));
    itemsSection.appendChild(potionBtn);
    hasItems = true;
  }

  if (gameState.playerInventory.superPotions > 0) {
    const superPotionBtn = document.createElement("button");
    superPotionBtn.className = "btn btn-primary btn-small";
    superPotionBtn.innerHTML = `🧪 Super Potion (${gameState.playerInventory.superPotions})`;
    superPotionBtn.title = "Restore 50 HP";
    superPotionBtn.addEventListener("click", () => useItem("superPotion"));
    itemsSection.appendChild(superPotionBtn);
    hasItems = true;
  }

  if (gameState.playerInventory.revives > 0) {
    const reviveBtn = document.createElement("button");
    reviveBtn.className = "btn btn-success btn-small";
    reviveBtn.innerHTML = `💫 Revive (${gameState.playerInventory.revives})`;
    reviveBtn.title = "Revive a fainted Pokémon with 50% HP";
    reviveBtn.addEventListener("click", () => useItem("revive"));
    itemsSection.appendChild(reviveBtn);
    hasItems = true;
  }

  if (!hasItems) {
    itemsSection.innerHTML += `<p style="opacity: 0.7; font-size: 0.9rem;">No items available.</p>`;
  }
}

/**
 * Handle status effects at the start of a turn
 */
async function handleStatusEffects(pokemon, pokemonName) {
  if (!pokemon.status) return false; // No status, can act normally

  switch (pokemon.status) {
    case "poison":
      const poisonDamage = Math.max(1, Math.floor(pokemon.maxHp / 8));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - poisonDamage);
      addBattleLog(`💜 ${pokemonName} is hurt by poison!`);
      updateBattleDisplay();
      await sleep(500);
      if (pokemon.currentHp <= 0) {
        addBattleLog(`✨ ${pokemonName} fainted from poison!`);
        return true; // Pokemon fainted
      }
      return false; // Can still act

    case "paralyze":
      if (Math.random() < 0.25) {
        addBattleLog(`⚡ ${pokemonName} is fully paralyzed! It can't move!`);
        await sleep(500);
        return true; // Skip turn
      }
      return false; // Can act

    case "sleep":
      // Sleep lasts 1-3 turns (simplified: 50% chance to wake up each turn)
      if (Math.random() < 0.5) {
        pokemon.status = null;
        addBattleLog(`😴 ${pokemonName} woke up!`);
        await sleep(500);
        return false; // Can act
      } else {
        addBattleLog(`😴 ${pokemonName} is fast asleep!`);
        await sleep(500);
        return true; // Skip turn
      }

    case "freeze":
      // 20% chance to thaw each turn
      if (Math.random() < 0.2) {
        pokemon.status = null;
        addBattleLog(`❄️ ${pokemonName} thawed out!`);
        await sleep(500);
        return false; // Can act
      } else {
        addBattleLog(`❄️ ${pokemonName} is frozen solid!`);
        await sleep(500);
        return true; // Skip turn
      }

    case "burn":
      const burnDamage = Math.max(1, Math.floor(pokemon.maxHp / 16));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - burnDamage);
      addBattleLog(`🔥 ${pokemonName} is hurt by its burn!`);
      updateBattleDisplay();
      await sleep(500);
      if (pokemon.currentHp <= 0) {
        addBattleLog(`✨ ${pokemonName} fainted from its burn!`);
        return true; // Pokemon fainted
      }
      return false; // Can still act (but damage is halved for physical moves, handled in calculateDamage)
  }

  return false;
}

async function useMove(move) {
  if (!gameState.currentBattle || gameState.currentBattle.turn !== "player")
    return;

  // Handle status effects
  const skipTurn = await handleStatusEffects(
    gameState.playerPokemon,
    gameState.playerPokemon.name.toUpperCase()
  );
  if (skipTurn) {
    // Check if Pokemon fainted from status
    if (gameState.playerPokemon.currentHp <= 0) {
      await handlePlayerFainted();
      return;
    }
    // Status prevented action, now opponent's turn
    await sleep(1000);
    await opponentTurn();
    return;
  }

  // Check for PP
  if (move.ppCurrent <= 0) {
    addBattleLog(`❌ ${move.name} is out of PP!`);
    return;
  }

  // Deduct PP
  move.ppCurrent--;

  playSound("attack");

  // Disable all buttons
  document
    .querySelectorAll("#battleActions button")
    .forEach((btn) => (btn.disabled = true));
  document
    .querySelectorAll(".team-member")
    .forEach((m) => (m.style.pointerEvents = "none"));

  await performAttack(
    gameState.playerPokemon,
    gameState.currentBattle.opponent,
    move,
    "player"
  );

  // Check if battle ended during the attack (e.g., opponent fainted)
  if (!gameState.currentBattle) return;

  // If opponent survived, it's their turn
  if (gameState.currentBattle.opponent.currentHp > 0) {
    await sleep(1000); // Pause before opponent attacks
    await opponentTurn();
  }
}

/**
 * Generic attack function for player or opponent
 */
async function performAttack(attacker, defender, move, attackerType) {
  const battle = gameState.currentBattle;
  if (!battle) return;

  const isPlayer = attackerType === "player";
  const attackerName = attacker.name.toUpperCase();
  const defenderName = defender.name.toUpperCase();

  const attackerContainer = document.getElementById(
    isPlayer ? "playerSprite" : "opponentSprite"
  )?.parentElement;
  if (attackerContainer) attackerContainer.classList.add("attacking");

  await sleep(500); // Attack animation time

  // 1. Check for miss (Accuracy)
  if (Math.random() * 100 > (move.accuracy || 100)) {
    addBattleLog(
      `💨 ${attackerName} used ${move.name.toUpperCase()} but it missed!`
    );
    if (attackerContainer) attackerContainer.classList.remove("attacking");
    return; // End attack sequence (turn will pass)
  }

  // 2. Calculate Damage
  const { damage, isCritical, effectiveness } = calculateDamage(
    attacker,
    defender,
    move
  );

  // Apply damage
  defender.currentHp = Math.max(0, defender.currentHp - damage);

  // 3. Log results
  let logMessage = `💥 ${attackerName} used ${move.name.toUpperCase()}!`;
  let logType = "normal";

  if (isCritical) {
    logMessage += " A critical hit!";
    logType = "critical";
    playSound("critical");
  }

  if (effectiveness > 1) {
    logMessage += " It's super effective!";
    logType = "super-effective";
  } else if (effectiveness < 1 && effectiveness > 0) {
    logMessage += " It's not very effective...";
    logType = "not-very-effective";
  } else if (effectiveness === 0) {
    logMessage += ` It doesn't affect ${defenderName}...`;
    logType = "not-very-effective";
  }

  addBattleLog(logMessage, logType);

  // 3.5. Apply status effect if move has one
  if (move.statusEffect && move.statusChance > 0 && defender.status === null) {
    if (Math.random() * 100 < move.statusChance) {
      defender.status = move.statusEffect;
      const statusMessages = {
        poison: `💜 ${defenderName} was poisoned!`,
        paralyze: `⚡ ${defenderName} was paralyzed!`,
        sleep: `😴 ${defenderName} fell asleep!`,
        freeze: `❄️ ${defenderName} was frozen solid!`,
        burn: `🔥 ${defenderName} was burned!`,
      };
      const message =
        statusMessages[move.statusEffect] ||
        `${defenderName} was affected by ${move.statusEffect}!`;
      addBattleLog(message);
      await sleep(500);
    }
  }

  // 4. Play animations and update UI
  const defenderContainer = document.getElementById(
    isPlayer ? "opponentSprite" : "playerSprite"
  )?.parentElement;
  if (defenderContainer) defenderContainer.classList.add("taking-damage");

  await sleep(500); // Damage animation time
  updateBattleDisplay(); // Show HP change
  if (isPlayer) updateTeamDisplay(); // Update player team health

  await sleep(500); // Pause to read log

  if (attackerContainer) attackerContainer.classList.remove("attacking");
  if (defenderContainer) defenderContainer.classList.remove("taking-damage");

  // 5. Check for Faint
  if (defender.currentHp <= 0) {
    addBattleLog(`✨ ${defenderName} fainted!`);
    await sleep(1000);

    if (isPlayer) {
      // Player defeated an opponent
      await handleOpponentFainted();
    } else {
      // Opponent defeated player's Pokémon
      await handlePlayerFainted();
    }
  }
  // If no faint, the turn passes
}

async function handleOpponentFainted() {
  const battle = gameState.currentBattle;
  const player = gameState.playerPokemon;
  const opponent = battle.opponent;

  battle.defeatedOpponents++;

  // Grant XP
  const xpGained = Math.floor(opponent.level * 15 * (battle.currentRound / 2));
  await awardXP(player, xpGained);

  await sleep(800);

  if (battle.defeatedOpponents >= battle.totalOpponents) {
    // All opponents defeated, battle won!
    addBattleLog(`🎉 You defeated all ${battle.totalOpponents} opponents!`);
    await endBattle(true);
  } else {
    // Load next opponent
    battle.currentRound++;
    addBattleLog(
      `🔄 Preparing next opponent... (${battle.currentRound}/${battle.totalOpponents})`
    );
    await sleep(1500);
    await loadNextOpponent();
  }
}

async function handlePlayerFainted() {
  const battle = gameState.currentBattle;

  updateTeamDisplay(); // Show fainted status

  // Check if any other Pokémon can fight
  const alivePokemon = gameState.playerTeam.pokemon.filter(
    (p) => p.currentHp > 0
  );

  if (alivePokemon.length > 0) {
    addBattleLog(`Choose your next Pokémon!`);
    // Disable move/run buttons, enable team switching
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = true));
    document.querySelectorAll(".team-member").forEach((m) => {
      m.style.pointerEvents = "auto";
      if (!m.classList.contains("fainted")) {
        m.style.cursor = "pointer";
        // Add a visual cue
        m.style.boxShadow = "0 0 15px var(--success)";
      }
    });
    // The battle will resume when the user clicks a new Pokémon (in switchActivePokemon)
  } else {
    // All Pokémon fainted, show game over screen with revival options
    addBattleLog(`💀 All your Pokémon have fainted!`);
    await sleep(1000);
    await showGameOverScreen();
  }
}

async function loadNextOpponent() {
  const battle = gameState.currentBattle;
  if (!battle) return;

  const randomId = Math.floor(Math.random() * 150) + 1; // Gen 1
  const opponentData = await fetchPokemon(randomId);

  if (!opponentData) {
    showNotification("Error loading next opponent. Ending battle.", "error");
    await endBattle(false);
    return;
  }

  // **FIX: Use helper to ensure 4 moves for opponent**
  const opponentMoves = formatAndPadMoves(opponentData.movesWithDetails);

  // Make opponent level match player level exactly for fair battles
  const opponentLevel = gameState.playerPokemon.level;

  // Generate IVs for opponent (use average IVs for fairness)
  const opponentIVs = {
    hp: 15,
    attack: 15,
    defense: 15,
    spAttack: 15,
    spDefense: 15,
    speed: 15,
  };

  const opponentMaxHp = calculateHP(
    opponentData.stats[0].base_stat,
    opponentLevel,
    opponentIVs.hp,
    0
  );

  battle.opponent = {
    ...opponentData,
    currentHp: opponentMaxHp,
    maxHp: opponentMaxHp,
    level: opponentLevel,
    moves: opponentMoves,
    ivs: opponentIVs,
    evs: { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 },
    status: null,
  };

  battle.turn = "player";

  updateBattleDisplay();
  addBattleLog(
    `⚔️ A new challenger ${opponentData.name.toUpperCase()} (Lv.${opponentLevel}) appeared!`
  );

  // Re-enable controls for the player
  document
    .querySelectorAll("#battleActions button")
    .forEach((btn) => (btn.disabled = false));
  document
    .querySelectorAll(".team-member")
    .forEach((m) => (m.style.pointerEvents = "auto"));
  addItemButtonsToBattle(); // Refresh item counts
}

async function opponentTurn() {
  const battle = gameState.currentBattle;
  if (!battle) return;

  const player = gameState.playerPokemon;
  const opponent = battle.opponent;

  battle.turn = "opponent";
  addBattleLog(`Opponent's turn...`);

  // Handle status effects
  const skipTurn = await handleStatusEffects(
    opponent,
    opponent.name.toUpperCase()
  );
  if (skipTurn) {
    // Check if opponent fainted from status
    if (opponent.currentHp <= 0) {
      await handleOpponentFainted();
      return;
    }
    // Status prevented action, now player's turn
    battle.turn = "player";
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = false));
    document
      .querySelectorAll(".team-member")
      .forEach((m) => (m.style.pointerEvents = "auto"));
    return;
  }

  // Disable player controls during opponent's turn
  document
    .querySelectorAll("#battleActions button")
    .forEach((btn) => (btn.disabled = true));
  document
    .querySelectorAll(".team-member")
    .forEach((m) => (m.style.pointerEvents = "none"));

  if (!opponent.moves || opponent.moves.length === 0) {
    console.error("Opponent has no moves");
    addBattleLog(`${opponent.name.toUpperCase()} is confused and can't move!`);
    battle.turn = "player";
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = false));
    return;
  }

  // Simple AI: Pick a random move
  const availableMoves = opponent.moves.filter((m) => m.ppCurrent > 0);
  let opponentMove;

  if (availableMoves.length > 0) {
    opponentMove =
      availableMoves[Math.floor(Math.random() * availableMoves.length)];
    opponentMove.ppCurrent--; // Deduct PP
  } else {
    opponentMove = { ...DEFAULT_MOVE, name: "Struggle" }; // Use Struggle if out of PP
  }

  await sleep(1000); // Pause for suspense

  await performAttack(opponent, player, opponentMove, "opponent");

  // Check if battle ended
  if (!gameState.currentBattle) return;

  // If player survived, it's their turn
  if (gameState.playerPokemon.currentHp > 0) {
    battle.turn = "player";
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = false));
    document
      .querySelectorAll(".team-member")
      .forEach((m) => (m.style.pointerEvents = "auto"));
  }
  // If player fainted, handlePlayerFainted() was already called inside performAttack
}

function calculateDamage(attacker, defender, move) {
  // 1. Check for 0 power (e.g., status moves)
  if (move.power === 0) {
    return { damage: 0, isCritical: false, effectiveness: 1 };
  }

  const level = attacker.level || 5;

  // 2. Get correct Atk/Def stats (use actual level-scaled stats, not base stats)
  const isPhysical = move.damageClass === "physical";
  const attackStat = isPhysical
    ? getActualStat(attacker, 1) // Actual Attack stat
    : getActualStat(attacker, 3); // Actual Sp.Atk stat
  const defenseStat = isPhysical
    ? getActualStat(defender, 2) // Actual Defense stat
    : getActualStat(defender, 4); // Actual Sp.Def stat

  const power = move.power || 40;

  // 3. Base Damage
  let baseDamage =
    Math.floor(
      (((2 * level) / 5 + 2) * power * attackStat) / defenseStat / 50
    ) + 2;

  // 4. STAB (Same Type Attack Bonus)
  const stab = attacker.types.some((t) => t.type.name === move.type)
    ? BATTLE_MECHANICS.STAB_MULTIPLIER
    : 1;

  // 5. Type Effectiveness
  const defenderTypes = defender.types.map((t) => t.type.name);
  const effectiveness = getTypeEffectiveness(move.type, defenderTypes); // From pokeapi.js

  // 6. Critical Hit
  const isCritical = Math.random() < BATTLE_MECHANICS.CRITICAL_HIT_CHANCE;
  const critical = isCritical ? BATTLE_MECHANICS.CRITICAL_MULTIPLIER : 1;

  // 7. Random variation (0.85 to 1.00)
  const randomFactor = Math.random() * 0.15 + 0.85;

  // 8. Final Damage Calculation
  const finalDamage = Math.floor(
    baseDamage * stab * effectiveness * critical * randomFactor
  );

  return {
    damage: Math.max(1, finalDamage), // Minimum 1 damage
    isCritical: isCritical,
    effectiveness: effectiveness,
  };
}

async function awardXP(pokemon, xpAmount) {
  if (pokemon.currentHp <= 0) return; // Fainted Pokémon don't get XP

  pokemon.xp += xpAmount;
  addBattleLog(`📈 ${pokemon.name.toUpperCase()} gained ${xpAmount} XP!`);

  let xpNeeded = calculateLevelXP(pokemon.level);

  // Handle multiple level-ups
  while (pokemon.xp >= xpNeeded) {
    pokemon.xp -= xpNeeded;
    await levelUpPokemon(pokemon);
    xpNeeded = calculateLevelXP(pokemon.level); // Get XP needed for the *new* level
  }

  updatePlayerStatsDisplay(); // Update header
  saveGameState(); // Save after XP gain
}

function calculateLevelXP(level) {
  // Using a simple cubic formula (medium-slow growth)
  return Math.floor(Math.pow(level + 1, 3));
}

async function levelUpPokemon(pokemon) {
  pokemon.level++;
  addBattleLog(
    `🎉 ${pokemon.name.toUpperCase()} grew to Level ${pokemon.level}!`
  );
  playSound("level_up");

  // Recalculate max HP using proper formula
  const oldMaxHp = pokemon.maxHp;
  pokemon.maxHp = calculateHP(
    pokemon.stats[0].base_stat,
    pokemon.level,
    pokemon.ivs?.hp || 31,
    pokemon.evs?.hp || 0
  );

  // Heal by the amount HP increased, or full heal
  pokemon.currentHp = pokemon.maxHp; // Full heal on level up
  addBattleLog(`${pokemon.name.toUpperCase()}'s HP was fully restored!`);

  await sleep(500); // Pause to read level up message

  // Check for evolution
  const evolution = await getNextEvolution(pokemon.id);
  if (evolution && pokemon.level >= evolution.minLevel) {
    await evolvePokemon(pokemon, evolution.nextEvolutionId);
  }

  // Check for new moves
  await checkNewMoves(pokemon);
}

/**
 * Evolve a Pokemon to its next form
 */
async function evolvePokemon(pokemon, evolutionId) {
  addBattleLog(`✨ ${pokemon.name.toUpperCase()} is evolving!`);
  await sleep(1000);

  const evolvedData = await fetchPokemon(evolutionId);
  if (!evolvedData) {
    addBattleLog(`❌ Evolution failed! Could not load evolved form.`);
    return;
  }

  const oldName = pokemon.name;
  const oldId = pokemon.id;

  // Update Pokemon data
  pokemon.id = evolvedData.id;
  pokemon.name = evolvedData.name;
  pokemon.stats = evolvedData.stats;
  pokemon.types = evolvedData.types;
  pokemon.sprites = evolvedData.sprites;

  // Recalculate HP with new base stats
  pokemon.maxHp = calculateHP(
    pokemon.stats[0].base_stat,
    pokemon.level,
    pokemon.ivs?.hp || 31,
    pokemon.evs?.hp || 0
  );
  pokemon.currentHp = pokemon.maxHp;

  addBattleLog(
    `🌟 ${oldName.toUpperCase()} evolved into ${pokemon.name.toUpperCase()}!`
  );
  playSound("unlock");

  // Update display if in battle
  if (gameState.currentBattle) {
    updateBattleDisplay();
  }
  updateTeamDisplay();
  saveGameState();
}

/**
 * Check if Pokemon learns new moves at current level
 */
async function checkNewMoves(pokemon) {
  if (!pokemon.movesLearned) {
    pokemon.movesLearned = pokemon.moves.map((m) => m.name.toLowerCase());
  }

  const allMoves = await getMovesByLevel(pokemon.id);
  const newMoves = allMoves.filter(
    (move) =>
      move.level === pokemon.level &&
      !pokemon.movesLearned.includes(move.name.toLowerCase())
  );

  for (const newMove of newMoves) {
    // Format move name
    const formattedMove = {
      name: newMove.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      power: newMove.power || 0,
      accuracy: newMove.accuracy || 100,
      type: newMove.type || "normal",
      damageClass: newMove.damageClass || "physical",
      pp: newMove.pp || 10,
      ppCurrent: newMove.pp || 10,
      effect: newMove.effect || "Deals damage",
      statusEffect: newMove.statusEffect || null,
      statusChance: newMove.statusChance || 0,
    };

    pokemon.movesLearned.push(newMove.name.toLowerCase());

    // If Pokemon has less than 4 moves, just add it
    if (pokemon.moves.length < 4) {
      pokemon.moves.push(formattedMove);
      addBattleLog(
        `📚 ${pokemon.name.toUpperCase()} learned ${formattedMove.name}!`
      );
    } else {
      // Prompt user to replace a move
      await promptMoveReplacement(pokemon, formattedMove);
    }
  }
}

/**
 * Prompt user to replace a move when learning a new one
 */
async function promptMoveReplacement(pokemon, newMove) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement("div");
    content.style.cssText = `
      background: var(--card-bg);
      padding: 30px;
      border-radius: 15px;
      max-width: 500px;
      width: 90%;
      border: 2px solid var(--primary-yellow);
      text-align: center;
    `;

    content.innerHTML = `
      <h2 style="color: var(--primary-yellow); margin-bottom: 20px;">
        ${pokemon.name.toUpperCase()} wants to learn ${newMove.name}!
      </h2>
      <p style="margin-bottom: 20px;">Which move should be forgotten?</p>
      <div id="moveReplacementOptions" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
      </div>
      <button id="cancelMoveBtn" class="btn btn-secondary">Cancel</button>
    `;

    const optionsDiv = content.querySelector("#moveReplacementOptions");
    pokemon.moves.forEach((move, index) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.innerHTML = `${move.name} (Power: ${move.power || 0}, Type: ${
        move.type
      })`;
      btn.addEventListener("click", () => {
        pokemon.moves[index] = newMove;
        addBattleLog(
          `${pokemon.name.toUpperCase()} forgot ${move.name} and learned ${
            newMove.name
          }!`
        );
        document.body.removeChild(modal);
        resolve();
      });
      optionsDiv.appendChild(btn);
    });

    const cancelBtn = content.querySelector("#cancelMoveBtn");
    cancelBtn.addEventListener("click", () => {
      addBattleLog(
        `${pokemon.name.toUpperCase()} did not learn ${newMove.name}.`
      );
      document.body.removeChild(modal);
      resolve();
    });

    modal.appendChild(content);
    document.body.appendChild(modal);
  });
}

function addBattleLog(message, type = "normal") {
  const log = document.getElementById("battleLog");
  if (!log) return;

  const p = document.createElement("p");
  p.innerHTML = message; // Use innerHTML to support simple formatting if needed
  if (type !== "normal") p.className = type;

  log.appendChild(p);
  log.scrollTop = log.scrollHeight; // Auto-scroll to bottom

  if (gameState.currentBattle) {
    gameState.currentBattle.log.push(message);
  }
}

async function runFromBattle() {
  if (!gameState.currentBattle) return;

  // Disable buttons
  document
    .querySelectorAll("#battleActions button")
    .forEach((btn) => (btn.disabled = true));

  addBattleLog("Trying to escape...");
  await sleep(1000);

  if (Math.random() < 0.8) {
    // 80% chance to escape
    addBattleLog("🏃 You successfully ran from the battle!");
    await endBattle(false); // End battle, no victory (but no loss recorded)
  } else {
    addBattleLog("💥 Couldn't escape!");
    await sleep(500);
    // Opponent gets to attack
    await opponentTurn();
  }
}

/**
 * Auto-item system: Automatically purchase/use revives if possible
 */
async function tryAutoRevive() {
  // First, try to use existing revives
  if (gameState.playerInventory.revives > 0) {
    const faintedPokemon = gameState.playerTeam.pokemon.find(
      (p) => p.currentHp <= 0
    );
    if (faintedPokemon) {
      gameState.playerInventory.revives--;
      faintedPokemon.currentHp = Math.floor(faintedPokemon.maxHp / 2);
      faintedPokemon.status = null;
      addBattleLog(
        `💫 Auto-used Revive! ${faintedPokemon.name.toUpperCase()} was revived to 50% HP!`
      );
      updateTeamDisplay();
      saveGameState();
      return true;
    }
  }

  // If no revives, try to buy one
  const reviveCost = ITEM_CONFIG.revive.price;
  if (gameState.currency >= reviveCost) {
    const faintedPokemon = gameState.playerTeam.pokemon.find(
      (p) => p.currentHp <= 0
    );
    if (faintedPokemon) {
      gameState.currency -= reviveCost;
      faintedPokemon.currentHp = Math.floor(faintedPokemon.maxHp / 2);
      faintedPokemon.status = null;
      addBattleLog(
        `💫 Auto-purchased and used Revive! ${faintedPokemon.name.toUpperCase()} was revived to 50% HP!`
      );
      updateTeamDisplay();
      updatePlayerStatsDisplay();
      saveGameState();
      return true;
    }
  }

  return false;
}

/**
 * Show Game Over screen with multiple revival options
 */
async function showGameOverScreen() {
  // Ensure battle state exists
  if (!gameState.currentBattle) {
    await endBattle(false);
    return;
  }

  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.id = "gameOverModal";
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in;
    `;

    const content = document.createElement("div");
    content.style.cssText = `
      background: linear-gradient(135deg, var(--card-bg) 0%, #0f3460 100%);
      padding: 40px;
      border-radius: 20px;
      max-width: 600px;
      width: 90%;
      border: 3px solid var(--danger);
      text-align: center;
      box-shadow: 0 20px 60px rgba(255, 0, 0, 0.5);
    `;

    const hasRevives = gameState.playerInventory.revives > 0;
    const canBuyRevive = gameState.currency >= ITEM_CONFIG.revive.price;
    const canUseFreeRevive = !gameState.freeReviveUsed;
    const pokemonCenterCost = 500;

    content.innerHTML = `
      <h1 style="color: var(--danger); font-size: 2.5rem; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
        💀 GAME OVER 💀
      </h1>
      <p style="font-size: 1.2rem; margin-bottom: 30px; color: var(--text-light);">
        All your Pokémon have fainted!
      </p>
      <p style="margin-bottom: 30px; color: var(--text-light); opacity: 0.9;">
        Choose a revival option to continue:
      </p>
      <div id="revivalOptions" style="display: flex; flex-direction: column; gap: 15px;">
      </div>
    `;

    const optionsDiv = content.querySelector("#revivalOptions");

    // Option 1: Free Auto-Revive (One-time)
    if (canUseFreeRevive) {
      const freeBtn = document.createElement("button");
      freeBtn.className = "btn btn-success";
      freeBtn.style.cssText = "width: 100%; padding: 15px; font-size: 1.1rem;";
      freeBtn.innerHTML = `🆓 Free Auto-Revive (One-time)<br><small>Revive first Pokémon to 50% HP</small>`;
      freeBtn.addEventListener("click", async () => {
        gameState.freeReviveUsed = true;
        const firstFainted = gameState.playerTeam.pokemon.find(
          (p) => p.currentHp <= 0
        );
        if (firstFainted) {
          firstFainted.currentHp = Math.floor(firstFainted.maxHp / 2);
          firstFainted.status = null;
          addBattleLog(
            `🆓 Free Revive used! ${firstFainted.name.toUpperCase()} was revived to 50% HP!`
          );
        }
        gameState.playerTeam.active =
          gameState.playerTeam.pokemon.indexOf(firstFainted);
        gameState.playerPokemon = firstFainted;
        updateTeamDisplay();
        updateBattleDisplay();
        saveGameState();
        document.body.removeChild(modal);
        addBattleLog(`Continue the battle!`);
        // Re-enable battle controls
        document
          .querySelectorAll("#battleActions button")
          .forEach((btn) => (btn.disabled = false));
        document
          .querySelectorAll(".team-member")
          .forEach((m) => (m.style.pointerEvents = "auto"));
        resolve();
      });
      optionsDiv.appendChild(freeBtn);
    }

    // Option 2: Auto-Item System (Use/Purchase Revive)
    if (hasRevives || canBuyRevive) {
      const autoBtn = document.createElement("button");
      autoBtn.className = "btn btn-primary";
      autoBtn.style.cssText = "width: 100%; padding: 15px; font-size: 1.1rem;";
      const costText = hasRevives
        ? "Use existing Revive"
        : `Auto-buy & use Revive (${ITEM_CONFIG.revive.price} coins)`;
      autoBtn.innerHTML = `💫 ${costText}<br><small>Revive first Pokémon to 50% HP</small>`;
      autoBtn.addEventListener("click", async () => {
        const success = await tryAutoRevive();
        if (success) {
          // Find the revived Pokemon and set it as active
          const revived = gameState.playerTeam.pokemon.find(
            (p) => p.currentHp > 0
          );
          if (revived) {
            gameState.playerTeam.active =
              gameState.playerTeam.pokemon.indexOf(revived);
            gameState.playerPokemon = revived;
          }
          updateTeamDisplay();
          updateBattleDisplay();
          document.body.removeChild(modal);
          addBattleLog(`Continue the battle!`);
          // Re-enable battle controls
          document
            .querySelectorAll("#battleActions button")
            .forEach((btn) => (btn.disabled = false));
          document
            .querySelectorAll(".team-member")
            .forEach((m) => (m.style.pointerEvents = "auto"));
          resolve();
        } else {
          showNotification(
            "Could not auto-revive. Not enough resources.",
            "error"
          );
        }
      });
      optionsDiv.appendChild(autoBtn);
    }

    // Option 3: Emergency Pokémon (Backup Pidgey)
    const emergencyBtn = document.createElement("button");
    emergencyBtn.className = "btn btn-secondary";
    emergencyBtn.style.cssText =
      "width: 100%; padding: 15px; font-size: 1.1rem;";
    emergencyBtn.innerHTML = `🐦 Emergency Pidgey<br><small>Add a level 5 Pidgey to continue</small>`;
    emergencyBtn.addEventListener("click", async () => {
      const pidgeyData = await fetchPokemon(16); // Pidgey ID
      if (pidgeyData) {
        const pidgeyMoves = formatAndPadMoves(pidgeyData.movesWithDetails);
        const pidgeyLevel = 5;
        const pidgeyIVs = generateIVs();
        const pidgeyMaxHp = calculateHP(
          pidgeyData.stats[0].base_stat,
          pidgeyLevel,
          pidgeyIVs.hp,
          0
        );

        const emergencyPidgey = {
          ...pidgeyData,
          currentHp: pidgeyMaxHp,
          maxHp: pidgeyMaxHp,
          level: pidgeyLevel,
          xp: 0,
          moves: pidgeyMoves,
          ivs: pidgeyIVs,
          evs: {
            hp: 0,
            attack: 0,
            defense: 0,
            spAttack: 0,
            spDefense: 0,
            speed: 0,
          },
          status: null,
          movesLearned: pidgeyMoves.map((m) => m.name.toLowerCase()),
        };

        // Add Pidgey to team and set as active
        gameState.playerTeam.pokemon.push(emergencyPidgey);
        gameState.playerTeam.active = gameState.playerTeam.pokemon.length - 1;
        gameState.playerPokemon = emergencyPidgey;
        gameState.pokemonOwned.push(emergencyPidgey);

        addBattleLog(
          `🐦 Emergency Pidgey (Lv.${pidgeyLevel}) has joined the battle!`
        );
        updateTeamDisplay();
        updateBattleDisplay();
        saveGameState();
        document.body.removeChild(modal);
        addBattleLog(`Continue the battle!`);
        // Re-enable battle controls
        document
          .querySelectorAll("#battleActions button")
          .forEach((btn) => (btn.disabled = false));
        document
          .querySelectorAll(".team-member")
          .forEach((m) => (m.style.pointerEvents = "auto"));
        resolve();
      } else {
        showNotification("Failed to load emergency Pidgey!", "error");
      }
    });
    optionsDiv.appendChild(emergencyBtn);

    // Option 4: Pokémon Center (Heal all to full)
    if (gameState.currency >= pokemonCenterCost) {
      const centerBtn = document.createElement("button");
      centerBtn.className = "btn btn-primary";
      centerBtn.style.cssText =
        "width: 100%; padding: 15px; font-size: 1.1rem;";
      centerBtn.innerHTML = `🏥 Pokémon Center (${pokemonCenterCost} coins)<br><small>Fully heal all Pokémon</small>`;
      centerBtn.addEventListener("click", async () => {
        if (gameState.currency >= pokemonCenterCost) {
          gameState.currency -= pokemonCenterCost;
          gameState.playerTeam.pokemon.forEach((p) => {
            p.currentHp = p.maxHp;
            p.status = null;
            p.moves.forEach((m) => (m.ppCurrent = m.pp));
          });
          gameState.playerTeam.active = 0;
          gameState.playerPokemon = gameState.playerTeam.pokemon[0];
          addBattleLog(
            `🏥 All Pokémon were fully healed at the Pokémon Center!`
          );
          updateTeamDisplay();
          updateBattleDisplay();
          updatePlayerStatsDisplay();
          saveGameState();
          document.body.removeChild(modal);
          addBattleLog(`Continue the battle!`);
          // Re-enable battle controls
          document
            .querySelectorAll("#battleActions button")
            .forEach((btn) => (btn.disabled = false));
          document
            .querySelectorAll(".team-member")
            .forEach((m) => (m.style.pointerEvents = "auto"));
          resolve();
        } else {
          showNotification("Not enough coins!", "error");
        }
      });
      optionsDiv.appendChild(centerBtn);
    }

    // Option 5: Accept Defeat
    const defeatBtn = document.createElement("button");
    defeatBtn.className = "btn btn-danger";
    defeatBtn.style.cssText = "width: 100%; padding: 15px; font-size: 1.1rem;";
    defeatBtn.innerHTML = `😔 Accept Defeat<br><small>End battle and return to arena</small>`;
    defeatBtn.addEventListener("click", async () => {
      document.body.removeChild(modal);
      await endBattle(false);
      resolve();
    });
    optionsDiv.appendChild(defeatBtn);

    modal.appendChild(content);
    document.body.appendChild(modal);
  });
}

async function endBattle(victory) {
  const battle = gameState.currentBattle;
  if (!battle) return;

  // Prevent multiple calls
  gameState.currentBattle = null;

  playSound(victory ? "victory" : "defeat");

  // Disable all controls
  document
    .querySelectorAll("#battleActions button")
    .forEach((btn) => (btn.disabled = true));
  document
    .querySelectorAll(".team-member")
    .forEach((m) => (m.style.pointerEvents = "none"));

  if (victory) {
    const currencyGained = battle.defeatedOpponents * 100 * gameState.level;
    showNotification(
      `🎉 VICTORY! You defeated ${battle.defeatedOpponents} opponent(s) and earned ${currencyGained} coins!`,
      "success",
      5000
    );
    gameState.currency += currencyGained;
    gameState.wins++;

    // Simulate recording the battle on-chain
    await recordBattleResult("win", battle.defeatedOpponents);
    checkAchievements();

    // Start a background AI battle for leaderboard movement
    setTimeout(() => simulateAIBattle(), 1500);
  } else {
    // Check if player ran
    if (battle.log.includes("🏃 You successfully ran from the battle!")) {
      showNotification(`You escaped safely!`, "info");
    } else {
      showNotification(`😔 Defeat! Better luck next time, trainer!`, "warning");
      gameState.losses++;
      await recordBattleResult("loss", battle.defeatedOpponents);
    }
  }

  gameState.battleHistory.push({
    result: victory ? "win" : "loss",
    opponents: battle.defeatedOpponents,
    timestamp: Date.now(),
  });

  // Save game state *after* all updates
  saveGameState();

  // Wait a bit before resetting UI so user can read log
  setTimeout(resetBattleUI, 3000);
}

function addRetryButton() {
  const battleSetup = document.getElementById("battleSetup");
  if (!battleSetup) return;

  // Find start button
  const startBtn = document.getElementById("startBattleBtn");

  // Check if retry button already exists
  let retryBtn = battleSetup.querySelector(".try-again-btn");
  if (!retryBtn) {
    retryBtn = document.createElement("button");
    retryBtn.className = "btn try-again-btn"; // Use CSS class for styling
    retryBtn.textContent = "🔄 Rematch!";
    retryBtn.addEventListener("click", startBattle);
    // Insert *after* the original start button
    if (startBtn && startBtn.nextSibling) {
      battleSetup.insertBefore(retryBtn, startBtn.nextSibling);
    } else {
      battleSetup.appendChild(retryBtn);
    }
  }
}

function resetBattleUI() {
  const arena = document.getElementById("battleArena");
  const setup = document.getElementById("battleSetup");
  const log = document.getElementById("battleLog");

  if (arena) arena.classList.add("hidden");
  if (setup) setup.classList.remove("hidden");
  if (log) log.innerHTML = ""; // Clear the log

  addRetryButton(); // Add a "Try Again" button

  // gameState.currentBattle was already set to null in endBattle
  updatePlayerStatsDisplay();
  updateTeamDisplay(); // Refresh team to show HP
}

function useItem(itemKey) {
  const item = ITEM_CONFIG[itemKey];
  if (!item) return;

  // Check if item can be used
  if (gameState.playerInventory[item.key + "s"] <= 0) {
    showNotification(`You don't have any ${item.name}s!`, "error");
    return;
  }

  // Item use logic
  switch (item.type) {
    case "healing":
      useHealingItem(item);
      break;
    case "revive":
      useReviveItem(item);
      break;
    case "capture":
      useCaptureItem(item);
      break;
  }

  // Refresh item buttons
  addItemButtonsToBattle();
  // Save game state after using an item
  saveGameState();
}

function useHealingItem(item) {
  const pokemon = gameState.playerPokemon;
  const healAmount = item.name === "Potion" ? 20 : 50;

  if (pokemon.currentHp <= 0) {
    showNotification(`You must revive ${pokemon.name} first!`, "warning");
    return;
  }
  if (pokemon.currentHp >= pokemon.maxHp) {
    showNotification(`${pokemon.name} is already at full health!`, "warning");
    return;
  }

  // Use the item
  pokemon.currentHp = Math.min(pokemon.currentHp + healAmount, pokemon.maxHp);
  gameState.playerInventory[item.key + "s"]--;
  playSound("heal");

  addBattleLog(
    `💊 Used ${item.name}! ${pokemon.name} recovered ${healAmount} HP!`
  );
  updateBattleDisplay();
  updateTeamDisplay(); // Update team sidebar

  // Using an item costs a turn
  if (gameState.currentBattle) {
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = true));
    setTimeout(opponentTurn, 1000);
  }
}

function useReviveItem(item) {
  // Revives can be used on any fainted Pokémon in the team
  const faintedPokemon = gameState.playerTeam.pokemon.find(
    (p) => p.currentHp <= 0
  );
  if (!faintedPokemon) {
    showNotification("No fainted Pokémon to revive!", "warning");
    return;
  }

  // Use the item
  faintedPokemon.currentHp = Math.floor(faintedPokemon.maxHp / 2); // Revive to 50% HP
  gameState.playerInventory[item.key + "s"]--;
  playSound("heal");

  addBattleLog(`💫 Used ${item.name}! ${faintedPokemon.name} was revived!`);
  updateTeamDisplay(); // Update team sidebar

  // Using an item costs a turn
  if (gameState.currentBattle) {
    document
      .querySelectorAll("#battleActions button")
      .forEach((btn) => (btn.disabled = true));
    setTimeout(opponentTurn, 1000);
  }
}

function useCaptureItem() {
  showNotification("You can't catch another trainer's Pokémon!", "info");
}

async function simulateAIBattle() {
  const aiTrainers = [
    { name: "Youngster Joey", level: Math.max(1, gameState.level - 2) },
    { name: "Bug Catcher", level: gameState.level },
    { name: "Rival Gary", level: gameState.level + 2 },
  ];

  // Pick one AI trainer to simulate a battle with
  const trainer = aiTrainers[Math.floor(Math.random() * aiTrainers.length)];

  // Simulate a win/loss for the AI
  const aiVictory = Math.random() > 0.4; // 60% win chance for AI
  const opponentsDefeated = Math.floor(Math.random() * 3) + 1;

  if (aiVictory) {
    // Add a win to the AI's battle history
    gameState.aiBattles.push({
      trainer: trainer.name,
      result: "win",
      opponents: opponentsDefeated,
      timestamp: Date.now(),
    });
    console.log(`AI Battle Simulated: ${trainer.name} won.`);
    // No need to notify user, it just updates leaderboard
  }

  // Refresh leaderboard if it's currently active
  if (!document.getElementById("leaderboardTab").classList.contains("hidden")) {
    loadLeaderboard();
  }
}

function checkAchievements() {
  const newAchievements = [];

  if (!gameState.achievements.FIRST_WIN && gameState.wins >= 1) {
    gameState.achievements.FIRST_WIN = true;
    newAchievements.push("FIRST_WIN");
  }

  if (
    !gameState.achievements.POKEMON_COLLECTOR &&
    gameState.pokemonOwned.length >= 5
  ) {
    gameState.achievements.POKEMON_COLLECTOR = true;
    newAchievements.push("POKEMON_COLLECTOR");
  }

  if (!gameState.achievements.BATTLE_MASTER && gameState.wins >= 10) {
    gameState.achievements.BATTLE_MASTER = true;
    newAchievements.push("BATTLE_MASTER");
  }

  if (
    !gameState.achievements.FIRST_CATCH &&
    gameState.pokemonOwned.length > 1 // Simpler check
  ) {
    gameState.achievements.FIRST_CATCH = true;
    newAchievements.push("FIRST_CATCH");
  }

  const hasLegendary = gameState.pokemonOwned.some((p) =>
    isLegendaryPokemon(p.id)
  );
  if (!gameState.achievements.LEGENDARY_OWNER && hasLegendary) {
    gameState.achievements.LEGENDARY_OWNER = true;
    newAchievements.push("LEGENDARY_OWNER");
  }

  newAchievements.forEach((achievementId) => {
    const achievement = ACHIEVEMENTS_CONFIG[achievementId];
    if (achievement.reward.currency)
      gameState.currency += achievement.reward.currency;

    showNotification(
      `🏆 Achievement Unlocked: ${achievement.name}! (Reward: ₽${achievement.reward.currency})`,
      "success",
      5000
    );
    playSound("achievement");
  });

  if (newAchievements.length > 0) {
    updatePlayerStatsDisplay(); // Show new currency
    saveGameState();
  }
}

function loadAchievements() {
  const grid = document.getElementById("achievementsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  Object.entries(ACHIEVEMENTS_CONFIG).forEach(([key, achievement]) => {
    const unlocked = gameState.achievements[key];
    const card = document.createElement("div");
    card.className = `achievement-card ${unlocked ? "unlocked" : "locked"}`;

    card.innerHTML = `
      <div class="achievement-icon">${unlocked ? "🏆" : "🔒"}</div>
      <h3>${achievement.name}</h3>
      <p>${achievement.description}</p>
      <div class="achievement-reward" style="font-weight: bold; color: var(--primary-yellow);">Reward: ₽${
        achievement.reward.currency
      }</div>
      ${
        unlocked
          ? '<div class="achievement-status" style="color: var(--success); font-weight: bold;">✅ UNLOCKED</div>'
          : ""
      }
    `;

    grid.appendChild(card);
  });
}

function checkDailyQuests() {
  const today = new Date().toDateString();
  if (gameState.lastPlayed !== today) {
    gameState.dailyQuests = generateDailyQuests();
    gameState.lastPlayed = today;
    saveGameState();
    showNotification("📋 New daily quests available!", "info");
  }
}

function generateDailyQuests() {
  // This is a placeholder. A real system would be more complex.
  return [
    {
      id: 1,
      type: "battle",
      target: 3,
      progress: 0,
      reward: 500,
      description: "Win 3 battles",
    },
    {
      id: 2,
      type: "catch",
      target: 1,
      progress: 0,
      reward: 300,
      description: "Buy 1 Pokémon from the market",
    },
  ];
}

async function loadMarketplace() {
  const grid = document.getElementById("marketplaceGrid");
  const loading = document.getElementById("marketLoading");
  if (!grid || !loading) return;

  loading.classList.remove("hidden");
  grid.classList.add("hidden");
  grid.innerHTML = "";

  await sleep(400); // Simulate network latency

  // Get 6 random Gen 1 Pokémon
  const regularIds = getRandomPokemonIds(6, 150);
  // Get 1-2 random legendaries
  const legendaryIds = getRandomLegendaryIds(Math.random() > 0.5 ? 2 : 1);
  const marketIds = [...regularIds, ...legendaryIds];

  try {
    const pokemonList = await fetchMultiplePokemon(marketIds);

    loading.classList.add("hidden");
    grid.classList.remove("hidden");

    pokemonList.forEach((p) => {
      if (p) {
        const isLegendary = isLegendaryPokemon(p.id);
        const card = createMarketCard(p, isLegendary);
        grid.appendChild(card);
      }
    });

    // Also load the item shop at the bottom
    loadItemsShop();
  } catch (error) {
    console.error("Error loading marketplace:", error);
    loading.innerHTML =
      "<p>❌ Error loading marketplace. Please try again.</p>";
  }
}

function getRandomLegendaryIds(count) {
  const legendaryIds = [144, 145, 146, 150, 151]; // Gen 1 only
  const ids = new Set();
  while (ids.size < count && ids.size < legendaryIds.length) {
    const randomIndex = Math.floor(Math.random() * legendaryIds.length);
    ids.add(legendaryIds[randomIndex]);
  }
  return Array.from(ids);
}

function createMarketCard(pokemon, isLegendary = false) {
  const card = document.createElement("div");
  card.className = `market-card ${isLegendary ? "legendary" : ""}`;

  const types = pokemon.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");

  // Calculate price
  const basePrice = isLegendary ? 2.0 : 0.1;
  const statTotal = pokemon.stats.reduce(
    (sum, stat) => sum + stat.base_stat,
    0
  );
  const statMultiplier = statTotal / 400; // ~1.0 for average Gen 1
  const price = (
    basePrice *
    statMultiplier *
    (Math.random() * 0.4 + 0.8)
  ).toFixed(3); // Add 20% variance

  card.innerHTML = `
    ${isLegendary ? '<div class="legendary-badge">🌟 LEGENDARY</div>' : ""}
    <img src="${getPokemonSprite(pokemon)}" alt="${
    pokemon.name
  }" style="width: 150px; height: 150px; object-fit: contain; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));">
    <h3 style="text-transform: capitalize; margin: 10px 0;">${pokemon.name}</h3>
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
    <button class="btn btn-success" style="margin-top: 15px; padding: 10px 20px; font-size: 0.9rem;"
            onclick="buyPokemon('${pokemon.name}', ${price}, ${pokemon.id})">
        Buy Now
    </button>
  `;

  return card;
}

function loadItemsShop() {
  const marketplaceTab = document.getElementById("marketplaceTab");
  if (!marketplaceTab) return;

  // Find or create the items shop section
  let itemsShop = marketplaceTab.querySelector(".items-shop");
  if (!itemsShop) {
    itemsShop = document.createElement("div");
    itemsShop.className = "items-shop";
    itemsShop.style.marginTop = "40px"; // Add space above
    marketplaceTab.appendChild(itemsShop);
  }

  itemsShop.innerHTML = `
    <hr style="border-color: rgba(255,222,0,0.3); margin: 30px 0;">
    <h2>🛒 Battle Items Shop</h2>
    <p style="text-align: center; opacity: 0.8; margin-bottom: 20px;">Use your earned ₽ to buy items!</p>
    <div class="items-grid" id="itemsGrid"></div>
  `;

  const itemsGrid = document.getElementById("itemsGrid");
  if (!itemsGrid) return;
  itemsGrid.innerHTML = ""; // Clear old items

  Object.entries(ITEM_CONFIG).forEach(([key, item]) => {
    const itemCard = document.createElement("div");
    itemCard.className = "item-card";
    itemCard.innerHTML = `
      <div class="item-icon">${item.icon}</div>
      <h4>${item.name}</h4>
      <p style="font-size: 0.9rem; opacity: 0.8; margin: 5px 0;">${item.effect}</p>
      <div class="item-price">₽${item.price}</div>
      <button class="btn btn-primary btn-small" onclick="buyItem('${key}')">Buy</button>
    `;
    itemsGrid.appendChild(itemCard);
  });
}

async function buyItem(itemKey) {
  const item = ITEM_CONFIG[itemKey];
  if (!item) return;

  if (gameState.currency < item.price) {
    showNotification(`Not enough currency! Need ₽${item.price}`, "error");
    return;
  }

  // Confirm purchase
  if (!confirm(`Buy ${item.name} for ₽${item.price}?`)) {
    return;
  }

  // Process purchase
  gameState.currency -= item.price;
  const inventoryKey = item.key + "s"; // e.g., "potions"
  gameState.playerInventory[inventoryKey] =
    (gameState.playerInventory[inventoryKey] || 0) + 1;

  showNotification(`✅ Purchased 1 ${item.name}!`, "success");
  updatePlayerStatsDisplay(); // Update currency
  saveGameState();
}

async function buyPokemon(name, price, id) {
  if (
    !confirm(
      `Buy ${name.toUpperCase()} for ${price} ETH? This is a simulated transaction.`
    )
  ) {
    return;
  }

  // Simulate blockchain transaction
  const tx = await buyPokemonFromMarketplace(name, price);
  if (tx.success) {
    showNotification(
      `✅ Successfully purchased ${name.toUpperCase()}! (Tx: ${tx.txHash.slice(
        0,
        10
      )}...)`,
      "success"
    );
    playSound("purchase");

    const pokemonData = await fetchPokemon(id);
    if (pokemonData) {
      // **FIX: Use helper to ensure 4 moves**
      const formattedMoves = formatAndPadMoves(pokemonData.movesWithDetails);

      const purchaseLevel = 5;
      const purchaseIVs = generateIVs();
      const purchaseMaxHp = calculateHP(
        pokemonData.stats[0].base_stat,
        purchaseLevel,
        purchaseIVs.hp,
        0
      );

      const newPokemon = {
        ...pokemonData,
        currentHp: purchaseMaxHp,
        maxHp: purchaseMaxHp,
        level: purchaseLevel, // All purchased Pokémon start at Lvl 5
        xp: 0,
        moves: formattedMoves,
        ivs: purchaseIVs,
        evs: {
          hp: 0,
          attack: 0,
          defense: 0,
          spAttack: 0,
          spDefense: 0,
          speed: 0,
        },
        status: null,
        movesLearned: formattedMoves.map((m) => m.name.toLowerCase()),
      };

      gameState.pokemonOwned.push(newPokemon);

      // Add to team if there's space (max 6)
      if (gameState.playerTeam.pokemon.length < 6) {
        gameState.playerTeam.pokemon.push(newPokemon);
        updateTeamDisplay();
        showNotification(`${newPokemon.name} was added to your team!`, "info");
      } else {
        showNotification(
          `${newPokemon.name} was sent to your PC (storage).`,
          "info"
        );
      }

      // Check achievements
      if (!gameState.achievements.FIRST_CATCH) {
        gameState.achievements.FIRST_CATCH = true;
        checkAchievements(); // Run check to award
      } else {
        checkAchievements(); // Check for collector achievements
      }
    }

    loadMarketplace(); // Refresh marketplace listings
    updatePlayerStatsDisplay(); // Update pokemon count
    saveGameState();
  } else {
    showNotification(`Purchase failed. Please try again.`, "error");
  }
}

// Make functions globally accessible from HTML
window.buyPokemon = buyPokemon;
window.buyItem = buyItem;
window.useItem = useItem;

function loadLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody) return;

  // 1. Get player data
  const playerData = {
    address: gameState.walletAddress,
    name: gameState.trainerName,
    wins: gameState.wins,
    owned: gameState.pokemonOwned.length,
    level: gameState.level,
    isPlayer: true,
  };

  // 2. Get AI data
  // Consolidate AI battle results
  const aiTrainerWins = {};
  gameState.aiBattles.forEach((battle) => {
    if (battle.result === "win") {
      aiTrainerWins[battle.trainer] =
        (aiTrainerWins[battle.trainer] || 0) + battle.opponents;
    }
  });

  // Map to leaderboard format
  const aiData = Object.entries(aiTrainerWins).map(([name, wins]) => ({
    address: `ai_${name.replace(/\s+/g, "_").toLowerCase()}`,
    name: name,
    wins: wins,
    owned: Math.floor(wins * 1.5) + 3,
    level: Math.floor(wins * 2) + 5,
    isPlayer: false,
    isAI: true,
  }));

  // 3. Add static "pro" trainers for show
  const staticAITrainers = [
    {
      address: "0xELIT3...F0UR",
      name: "Champion Lance",
      wins: 150,
      owned: 30,
      level: 55,
      isPlayer: false,
      isAI: true,
    },
    {
      address: "0xR1V4L...G4RY",
      name: "Rival Gary",
      wins: gameState.wins + Math.floor(Math.random() * 5) + 1, // Always slightly ahead
      owned: gameState.pokemonOwned.length + 1,
      level: gameState.level + 3,
      isPlayer: false,
      isAI: true,
    },
  ];

  // 4. Combine and sort
  let leaderboardData = [playerData, ...aiData, ...staticAITrainers];

  // Remove duplicate trainer names, keeping the one with more wins
  const trainerMap = new Map();
  leaderboardData.forEach((trainer) => {
    if (
      !trainerMap.has(trainer.name) ||
      trainer.wins > trainerMap.get(trainer.name).wins
    ) {
      trainerMap.set(trainer.name, trainer);
    }
  });
  const uniqueData = Array.from(trainerMap.values());

  uniqueData.sort((a, b) => b.wins - a.wins); // Sort by wins

  tbody.innerHTML = ""; // Clear old data

  // 5. Render
  uniqueData.forEach((trainer, index) => {
    const totalBattles =
      trainer.wins + Math.floor(trainer.wins * (Math.random() * 0.5 + 0.2)); // Simulate losses
    const winRate =
      trainer.wins > 0
        ? ((trainer.wins / Math.max(1, totalBattles)) * 100).toFixed(1)
        : "0.0";

    const row = document.createElement("tr");
    if (trainer.isPlayer) {
      row.style.background = "rgba(255, 222, 0, 0.2)";
      row.style.fontWeight = "bold";
    }

    const displayName = trainer.name || "Unknown Trainer";

    row.innerHTML = `
      <td><span class="rank-badge">${index + 1}</span></td>
      <td>${displayName}${
      trainer.isPlayer
        ? ' <strong style="color: var(--primary-yellow);">(You)</strong>'
        : trainer.isAI
        ? ' <em style="color: var(--success); font-size: 0.8rem;">(AI)</em>'
        : ""
    }</td>
      <td>${trainer.level}</td>
      <td><strong style="color: var(--success);">${trainer.wins}</strong></td>
      <td>${trainer.owned}</td>
      <td>${winRate}%</td>
    `;

    tbody.appendChild(row);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showGameScreen() {
  const landingPage = document.getElementById("landingPage");
  const gameScreen = document.getElementById("gameScreen");

  if (landingPage) landingPage.classList.add("hidden");
  if (gameScreen) gameScreen.classList.remove("hidden");

  // If user is registered and has a starter, hide starter tab
  if (gameState.playerPokemon) {
    const starterNavTab = document.querySelector(
      '.nav-tab[data-tab="starter"]'
    );
    if (starterNavTab) starterNavTab.classList.add("hidden");
    // Default to arena tab
    switchTab("arena");
  } else {
    // If no starter, default to starter tab
    const starterNavTab = document.querySelector(
      '.nav-tab[data-tab="starter"]'
    );
    if (starterNavTab) starterNavTab.classList.remove("hidden");
    switchTab("starter");
  }

  updatePlayerStatsDisplay();
}

console.log("PokéChain Arena loaded successfully!");
console.log("Game state initialized:", gameState);

// Make key functions globally available for HTML onclick=""
window.switchTab = switchTab;
window.selectStarter = selectStarter;
