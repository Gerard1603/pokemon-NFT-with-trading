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

    // Fetch move details for the first 4 moves
    const movesWithDetails = await fetchMoveDetails(data.moves.slice(0, 4));
    data.movesWithDetails = movesWithDetails;

    return data;
  } catch (error) {
    console.error(`Error fetching Pokémon ${idOrName}:`, error);
    return null;
  }
}

/**
 * Fetch detailed information for moves
 * @param {Array} moves - Array of move objects from Pokemon data
 * @returns {Promise<Array>} Array of move details
 */
async function fetchMoveDetails(moves) {
  try {
    const movePromises = moves.map(async (moveData) => {
      try {
        const response = await fetch(moveData.move.url);
        if (!response.ok) return null;
        const data = await response.json();
        return {
          name: data.name,
          power: data.power || 40,
          accuracy: data.accuracy || 100,
          pp: data.pp || 10,
          type: data.type.name,
          damageClass: data.damage_class.name,
          effect: data.effect_entries[0]?.short_effect || "Deals damage",
        };
      } catch (error) {
        return null;
      }
    });

    const results = await Promise.all(movePromises);
    return results.filter((move) => move !== null).slice(0, 4);
  } catch (error) {
    console.error("Error fetching move details:", error);
    return [];
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
  // Complete type chart based on Pokemon games
  const typeChart = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: {
      fire: 0.5,
      water: 0.5,
      grass: 2,
      ice: 2,
      bug: 2,
      rock: 0.5,
      dragon: 0.5,
      steel: 2,
    },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    grass: {
      fire: 0.5,
      water: 2,
      grass: 0.5,
      poison: 0.5,
      ground: 2,
      flying: 0.5,
      bug: 0.5,
      rock: 2,
      dragon: 0.5,
      steel: 0.5,
    },
    electric: {
      water: 2,
      electric: 0.5,
      grass: 0.5,
      ground: 0,
      flying: 2,
      dragon: 0.5,
    },
    ice: {
      fire: 0.5,
      water: 0.5,
      grass: 2,
      ice: 0.5,
      ground: 2,
      flying: 2,
      dragon: 2,
      steel: 0.5,
    },
    fighting: {
      normal: 2,
      ice: 2,
      poison: 0.5,
      flying: 0.5,
      psychic: 0.5,
      bug: 0.5,
      rock: 2,
      ghost: 0,
      dark: 2,
      steel: 2,
      fairy: 0.5,
    },
    poison: {
      grass: 2,
      poison: 0.5,
      ground: 0.5,
      rock: 0.5,
      ghost: 0.5,
      steel: 0,
      fairy: 2,
    },
    ground: {
      fire: 2,
      electric: 2,
      grass: 0.5,
      poison: 2,
      flying: 0,
      bug: 0.5,
      rock: 2,
      steel: 2,
    },
    flying: {
      electric: 0.5,
      grass: 2,
      fighting: 2,
      bug: 2,
      rock: 0.5,
      steel: 0.5,
    },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: {
      fire: 0.5,
      grass: 2,
      fighting: 0.5,
      poison: 0.5,
      flying: 0.5,
      psychic: 2,
      ghost: 0.5,
      dark: 2,
      steel: 0.5,
      fairy: 0.5,
    },
    rock: {
      fire: 2,
      ice: 2,
      fighting: 0.5,
      ground: 0.5,
      flying: 2,
      bug: 2,
      steel: 0.5,
    },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: {
      fire: 0.5,
      water: 0.5,
      electric: 0.5,
      ice: 2,
      rock: 2,
      steel: 0.5,
      fairy: 2,
    },
    fairy: {
      fire: 0.5,
      fighting: 2,
      poison: 0.5,
      dragon: 2,
      dark: 2,
      steel: 0.5,
    },
  };

  let multiplier = 1;

  if (typeChart[attackType]) {
    defenderTypes.forEach((defType) => {
      if (typeChart[attackType][defType] !== undefined) {
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
