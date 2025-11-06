// Base URL for PokeAPI
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// Popular starter Pokémon from different generations
const STARTER_IDS = [
  1, // Bulbasaur
  4, // Charmander
  7, // Squirtle
  25, // Pikachu
  152, // Chikorita
  155, // Cyndaquil
  158, // Totodile
  252, // Treecko
  255, // Torchic
  258, // Mudkip
];

/**
 * Fetch a single Pokémon by ID or name
 * @param {number|string} idOrName - Pokémon ID or name
 * @returns {Promise<Object|null>} Pokémon data or null if error
 */
async function fetchPokemon(idOrName) {
  try {
    const response = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Pokémon ${idOrName}:`, error);
    return null;
  }
}

/**
 * Fetch multiple Pokémon by their IDs
 * @param {Array<number>} ids - Array of Pokémon IDs
 * @returns {Promise<Array<Object>>} Array of Pokémon data
 */
async function fetchMultiplePokemon(ids) {
  try {
    const promises = ids.map((id) => fetchPokemon(id));
    const results = await Promise.all(promises);
    return results.filter((pokemon) => pokemon !== null);
  } catch (error) {
    console.error("Error fetching multiple Pokémon:", error);
    return [];
  }
}

/**
 * Load starter Pokémon and display them in the grid
 */
async function loadStarterPokemon() {
  const grid = document.getElementById("starterGrid");
  const loading = document.getElementById("starterLoading");

  // Clear existing content
  grid.innerHTML = "";

  try {
    // Fetch all starter Pokémon
    const pokemon = await fetchMultiplePokemon(STARTER_IDS);

    // Hide loading, show grid
    loading.classList.add("hidden");
    grid.classList.remove("hidden");

    // Create cards for each Pokémon
    pokemon.forEach((p) => {
      if (p) {
        const card = createPokemonCard(p);
        grid.appendChild(card);
      }
    });
  } catch (error) {
    console.error("Error loading starter Pokémon:", error);
    loading.innerHTML =
      "<p>Error loading Pokémon. Please refresh the page.</p>";
  }
}

/**
 * Create a Pokémon card element with all details
 * @param {Object} pokemon - Pokémon data from PokeAPI
 * @returns {HTMLElement} Card element
 */
function createPokemonCard(pokemon) {
  const card = document.createElement("div");
  card.className = "pokemon-card";
  card.dataset.pokemonId = pokemon.id;

  // Get the best sprite (official artwork or default)
  const sprite =
    pokemon.sprites.other["official-artwork"].front_default ||
    pokemon.sprites.front_default;

  // Create type badges
  const types = pokemon.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");

  // Extract base stats
  const hp = pokemon.stats[0].base_stat;
  const attack = pokemon.stats[1].base_stat;
  const defense = pokemon.stats[2].base_stat;
  const speed = pokemon.stats[5].base_stat;

  // Build card HTML
  card.innerHTML = `
        <img src="${sprite}" alt="${pokemon.name}">
        <h3>${pokemon.name}</h3>
        <div>${types}</div>
        <div class="pokemon-stats">
            <div class="stat">
                <div class="stat-label">HP</div>
                <div class="stat-value">${hp}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Attack</div>
                <div class="stat-value">${attack}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Defense</div>
                <div class="stat-value">${defense}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Speed</div>
                <div class="stat-value">${speed}</div>
            </div>
        </div>
    `;

  // Add click handler for selection
  card.addEventListener("click", () => selectStarter(card, pokemon));

  return card;
}

/**
 * Get a Pokémon's sprite URL
 * @param {Object} pokemon - Pokémon data
 * @param {boolean} front - True for front sprite, false for back
 * @returns {string} Sprite URL
 */
function getPokemonSprite(pokemon, front = true) {
  if (pokemon.sprites.other && pokemon.sprites.other["official-artwork"]) {
    return pokemon.sprites.other["official-artwork"].front_default;
  }
  return front ? pokemon.sprites.front_default : pokemon.sprites.back_default;
}

/**
 * Get Pokémon type effectiveness multiplier
 * @param {string} attackType - Type of the attack
 * @param {Array<string>} defenderTypes - Types of the defending Pokémon
 * @returns {number} Damage multiplier
 */
function getTypeEffectiveness(attackType, defenderTypes) {
  // Simplified type chart (can be expanded)
  const typeChart = {
    fire: { grass: 2, water: 0.5, fire: 0.5 },
    water: { fire: 2, grass: 0.5, water: 0.5 },
    grass: { water: 2, fire: 0.5, grass: 0.5 },
    electric: { water: 2, grass: 0.5, electric: 0.5 },
    normal: {},
  };

  let multiplier = 1;

  if (typeChart[attackType]) {
    defenderTypes.forEach((defType) => {
      if (typeChart[attackType][defType]) {
        multiplier *= typeChart[attackType][defType];
      }
    });
  }

  return multiplier;
}

/**
 * Format Pokémon name for display (capitalize first letter)
 * @param {string} name - Pokémon name
 * @returns {string} Formatted name
 */
function formatPokemonName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Get random Pokémon IDs for opponents or marketplace
 * @param {number} count - Number of random IDs to generate
 * @param {number} maxId - Maximum Pokémon ID (default 898 - Gen 8)
 * @returns {Array<number>} Array of random Pokémon IDs
 */
function getRandomPokemonIds(count, maxId = 898) {
  const ids = new Set();

  while (ids.size < count) {
    const randomId = Math.floor(Math.random() * maxId) + 1;
    ids.add(randomId);
  }

  return Array.from(ids);
}

// Export functions for use in other modules (if using ES6 modules)
// For this implementation, functions are accessible globally
