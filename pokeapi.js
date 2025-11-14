const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const STARTER_IDS = [1, 4, 7]; // Enforces Bulbasaur, Charmander, Squirtle

const __POKEMON_CACHE = new Map();
const __MOVE_CACHE = new Map();
const __SPECIES_CACHE = new Map();
const __EVOLUTION_CACHE = new Map();

async function fetchPokemon(idOrName) {
  try {
    const key = String(idOrName).toLowerCase();
    if (__POKEMON_CACHE.has(key)) {
      return __POKEMON_CACHE.get(key);
    }

    const response = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Fetch details for the first 4 moves listed
    const movesToFetch = data.moves.slice(0, 4);
    const movesWithDetails = await fetchMoveDetails(movesToFetch);
    data.movesWithDetails = movesWithDetails;

    __POKEMON_CACHE.set(key, data);
    return data;
  } catch (error) {
    console.error(`Error fetching Pokémon ${idOrName}:`, error);
    return null;
  }
}

async function fetchMoveDetails(moves) {
  try {
    const movePromises = moves.map(async (moveData) => {
      try {
        const url = moveData.move.url;
        if (__MOVE_CACHE.has(url)) return __MOVE_CACHE.get(url);

        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();

        // Map to a consistent move object
        const mapped = {
          name: data.name,
          power: data.power || 40, // Default power for status moves if needed
          accuracy: data.accuracy || 100,
          pp: data.pp || 10,
          type: data.type.name,
          damageClass: data.damage_class.name,
          effect: data.effect_entries[0]?.short_effect || "Deals damage",
          // Status effect information
          statusEffect: data.meta?.ailment?.name || null,
          statusChance: data.meta?.ailment_chance || 0,
        };
        __MOVE_CACHE.set(url, mapped);
        return mapped;
      } catch (e) {
        console.error(`Error fetching move: ${moveData.move.url}`, e);
        return null;
      }
    });

    const results = await Promise.all(movePromises);
    // Return only successfully fetched moves, ensuring we have 4
    const finalMoves = results.filter((move) => move !== null);

    // Pad with 'Tackle' if less than 4 moves are fetched (should be rare)
    while (finalMoves.length < 4 && finalMoves.length > 0) {
      finalMoves.push({
        name: "Tackle",
        power: 40,
        accuracy: 100,
        pp: 35,
        type: "normal",
        damageClass: "physical",
        effect: "Deals damage",
      });
    }

    return finalMoves.slice(0, 4);
  } catch (error) {
    console.error("Error fetching move details:", error);
    return [];
  }
}

async function fetchMultiplePokemon(ids) {
  try {
    const unique = Array.from(new Set(ids));
    const promises = unique.map((id) => fetchPokemon(id));
    const results = await Promise.all(promises);
    const mapById = new Map();
    results.forEach((p) => {
      if (p) mapById.set(p.id, p);
    });
    // Return in the order requested by 'ids'
    return ids.map((id) => mapById.get(id)).filter(Boolean);
  } catch (error) {
    console.error("Error fetching multiple Pokémon:", error);
    return [];
  }
}

async function loadStarterPokemon() {
  const grid = document.getElementById("starterGrid");
  const loading = document.getElementById("starterLoading");

  if (!grid || !loading) {
    console.error("Starter grid or loading element not found");
    return;
  }

  grid.innerHTML = "";
  loading.classList.remove("hidden");
  loading.innerHTML = `<div class="spinner"></div><p style="margin-top: 10px">Loading starter Pokémon...</p>`;
  grid.classList.add("hidden");

  try {
    console.log("Fetching starter Pokémon:", STARTER_IDS);
    let pokemon = await fetchMultiplePokemon(STARTER_IDS);

    // Enforce exactly 3 starters (Bulbasaur, Charmander, Squirtle) in correct order
    pokemon = pokemon
      .filter((p) => p && STARTER_IDS.includes(p.id))
      .sort((a, b) => STARTER_IDS.indexOf(a.id) - STARTER_IDS.indexOf(b.id))
      .slice(0, 3);

    if (pokemon.length === 0) {
      throw new Error("No Pokémon data received");
    }

    // This block is crucial for ensuring all 3 are loaded
    if (pokemon.length < 3) {
      console.warn(`Only loaded ${pokemon.length}/3 starters. Retrying...`);
      // Attempt sequential fetch for missing ones
      const loadedIds = pokemon.map((p) => p.id);
      const missingIds = STARTER_IDS.filter((id) => !loadedIds.includes(id));
      for (const id of missingIds) {
        const p = await fetchPokemon(id);
        if (p) pokemon.push(p);
      }
      // Re-sort and slice
      pokemon = pokemon
        .filter((p) => p && STARTER_IDS.includes(p.id))
        .sort((a, b) => STARTER_IDS.indexOf(a.id) - STARTER_IDS.indexOf(b.id))
        .slice(0, 3);
    }

    if (pokemon.length < 3) {
      throw new Error("Failed to load all 3 starter Pokémon after retry.");
    }

    loading.classList.add("hidden");
    grid.classList.remove("hidden");

    pokemon.forEach((p) => {
      if (p) {
        const card = createPokemonCard(p);
        grid.appendChild(card);
      }
    });

    console.log("Starter Pokémon loaded successfully:", pokemon.length);
  } catch (error) {
    console.error("Error loading starter Pokémon:", error);
    loading.classList.remove("hidden");
    loading.innerHTML =
      "<p style='color: var(--danger);'>❌ Error loading Pokémon. Please refresh the page.</p>";
  }
}

function createPokemonCard(pokemon) {
  const card = document.createElement("div");
  card.className = "pokemon-card";
  card.dataset.pokemonId = pokemon.id;

  const sprite = getPokemonSprite(pokemon);

  const types = pokemon.types
    .map(
      (t) =>
        `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
    )
    .join("");

  const hp = pokemon.stats[0].base_stat;
  const attack = pokemon.stats[1].base_stat;
  const defense = pokemon.stats[2].base_stat;
  const speed = pokemon.stats[5]?.base_stat ?? 0;

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

  card.addEventListener("click", () => {
    if (typeof selectStarter === "function") {
      selectStarter(card, pokemon);
    }
  });

  return card;
}

function getPokemonSprite(pokemon, front = true) {
  const id = pokemon?.id;
  if (id) {
    // Use animated GIFs from Gen 5
    const base =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated";
    if (front) {
      // Use animated front sprite
      return `${base}/${id}.gif`;
    } else {
      // Use animated back sprite
      return `${base}/back/${id}.gif`;
    }
  }
  // Fallback to official-artwork
  const base =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
  if (front) {
    return (
      pokemon?.sprites?.other?.["official-artwork"]?.front_default ||
      `${base}/other/official-artwork/${pokemon?.id || 1}.png`
    );
  } else {
    // Use default static back sprite as fallback
    return (
      pokemon?.sprites?.back_default || `${base}/back/${pokemon?.id || 1}.png`
    );
  }
}

function getTypeEffectiveness(attackType, defenderTypes) {
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

function formatPokemonName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getRandomPokemonIds(count, maxId = 151) {
  // Limit to Gen 1 for consistency
  const ids = new Set();
  while (ids.size < count) {
    const randomId = Math.floor(Math.random() * maxId) + 1;
    ids.add(randomId);
  }
  return Array.from(ids);
}

function isLegendaryPokemon(pokemonId) {
  const legendaryIds = [
    144,
    145,
    146,
    150,
    151, // Gen 1 Legendaries/Mythicals
  ];
  return legendaryIds.includes(pokemonId);
}

/**
 * Fetch Pokemon species data (contains evolution chain URL)
 */
async function fetchPokemonSpecies(pokemonId) {
  try {
    const key = `species-${pokemonId}`;
    if (__SPECIES_CACHE.has(key)) {
      return __SPECIES_CACHE.get(key);
    }

    const response = await fetch(`${POKEAPI_BASE}/pokemon-species/${pokemonId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    __SPECIES_CACHE.set(key, data);
    return data;
  } catch (error) {
    console.error(`Error fetching species for ${pokemonId}:`, error);
    return null;
  }
}

/**
 * Fetch evolution chain and find next evolution
 * Returns { nextEvolutionId: number, minLevel: number } or null
 */
async function getNextEvolution(pokemonId) {
  try {
    const key = `evolution-${pokemonId}`;
    if (__EVOLUTION_CACHE.has(key)) {
      return __EVOLUTION_CACHE.get(key);
    }

    const species = await fetchPokemonSpecies(pokemonId);
    if (!species || !species.evolution_chain) return null;

    const evolutionResponse = await fetch(species.evolution_chain.url);
    if (!evolutionResponse.ok) return null;
    const evolutionData = await evolutionResponse.json();

    // Find current Pokemon in chain
    function findPokemonInChain(chain, targetId) {
      if (parseInt(chain.species.url.split('/').slice(-2, -1)[0]) === targetId) {
        return chain;
      }
      for (const evolvesTo of chain.evolves_to || []) {
        const found = findPokemonInChain(evolvesTo, targetId);
        if (found) return found;
      }
      return null;
    }

    const currentChain = findPokemonInChain(evolutionData.chain, pokemonId);
    if (!currentChain || currentChain.evolves_to.length === 0) {
      __EVOLUTION_CACHE.set(key, null);
      return null;
    }

    // Get first evolution (most Pokemon only have one)
    const nextEvolution = currentChain.evolves_to[0];
    const nextEvolutionId = parseInt(nextEvolution.species.url.split('/').slice(-2, -1)[0]);
    
    // Check evolution trigger (level-up is most common)
    const minLevel = nextEvolution.evolution_details.find(d => d.min_level)?.min_level || null;
    
    const result = minLevel ? { nextEvolutionId, minLevel } : null;
    __EVOLUTION_CACHE.set(key, result);
    return result;
  } catch (error) {
    console.error(`Error fetching evolution for ${pokemonId}:`, error);
    return null;
  }
}

/**
 * Fetch all moves a Pokemon can learn with their level requirements
 */
async function getMovesByLevel(pokemonId) {
  try {
    const pokemon = await fetchPokemon(pokemonId);
    if (!pokemon || !pokemon.moves) return [];

    const movesWithLevels = [];
    
    for (const moveData of pokemon.moves) {
      // Check version group details for level learned
      for (const versionGroup of moveData.version_group_details || []) {
        if (versionGroup.move_learn_method.name === 'level-up' && versionGroup.level_learned_at) {
          const moveUrl = moveData.move.url;
          let moveDetails = __MOVE_CACHE.get(moveUrl);
          
          if (!moveDetails) {
            try {
              const response = await fetch(moveUrl);
              if (response.ok) {
                const data = await response.json();
                moveDetails = {
                  name: data.name,
                  power: data.power || 0,
                  accuracy: data.accuracy || 100,
                  pp: data.pp || 10,
                  type: data.type.name,
                  damageClass: data.damage_class.name,
                  effect: data.effect_entries[0]?.short_effect || "Deals damage",
                  // Check for status effects
                  statusEffect: data.effect_chances && data.effect_chances[0] > 0 
                    ? data.meta?.ailment?.name || null 
                    : null,
                  statusChance: data.effect_chances?.[0] || 0,
                };
                __MOVE_CACHE.set(moveUrl, moveDetails);
              }
            } catch (e) {
              console.error(`Error fetching move ${moveUrl}:`, e);
            }
          }
          
          if (moveDetails) {
            movesWithLevels.push({
              ...moveDetails,
              level: versionGroup.level_learned_at,
            });
          }
        }
      }
    }

    // Sort by level
    movesWithLevels.sort((a, b) => a.level - b.level);
    return movesWithLevels;
  } catch (error) {
    console.error(`Error fetching moves by level for ${pokemonId}:`, error);
    return [];
  }
}

window.fetchPokemon = fetchPokemon;
window.fetchMultiplePokemon = fetchMultiplePokemon;
window.getPokemonSprite = getPokemonSprite;
window.getRandomPokemonIds = getRandomPokemonIds;
window.isLegendaryPokemon = isLegendaryPokemon;
window.loadStarterPokemon = loadStarterPokemon;
window.getTypeEffectiveness = getTypeEffectiveness;
window.formatPokemonName = formatPokemonName;
window.getNextEvolution = getNextEvolution;
window.getMovesByLevel = getMovesByLevel;

console.log("PokeAPI helpers loaded successfully");
