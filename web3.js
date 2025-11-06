/* ==================== WEB3.JS - Blockchain Integration ==================== */

/**
 * Module for handling MetaMask wallet connection and blockchain interactions
 * Uses window.ethereum provided by MetaMask extension
 */

// Blockchain configuration
const NETWORK_CONFIG = {
  chainId: "0x1", // Ethereum Mainnet (use 0x89 for Polygon, 0x5 for Goerli testnet)
  chainName: "Ethereum Mainnet",
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
  blockExplorer: "https://etherscan.io",
};

// Smart contract configuration (placeholders - replace with actual deployed contracts)
const CONTRACT_CONFIG = {
  pokemonNFT: {
    address: "0x0000000000000000000000000000000000000000",
    abi: [], // Add your contract ABI here
  },
  marketplace: {
    address: "0x0000000000000000000000000000000000000000",
    abi: [], // Add your marketplace contract ABI here
  },
};

/**
 * Check if MetaMask is installed
 * @returns {boolean} True if MetaMask is available
 */
function isMetaMaskInstalled() {
  return typeof window.ethereum !== "undefined";
}

/**
 * Check if wallet is already connected on page load
 */
async function checkWalletConnection() {
  if (!isMetaMaskInstalled()) {
    console.log("MetaMask is not installed");
    return;
  }

  try {
    // Check if already connected
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length > 0) {
      handleWalletConnected(accounts[0]);
    }
  } catch (error) {
    console.error("Error checking wallet connection:", error);
  }
}

/**
 * Connect to MetaMask wallet
 */
async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    alert("MetaMask is not installed! Please install MetaMask to play.");
    window.open("https://metamask.io/download/", "_blank");
    return;
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length > 0) {
      handleWalletConnected(accounts[0]);

      // Listen for account changes
      window.ethereum.on("accountsChanged", handleAccountsChanged);

      // Listen for chain changes
      window.ethereum.on("chainChanged", handleChainChanged);
    }
  } catch (error) {
    console.error("Error connecting wallet:", error);

    if (error.code === 4001) {
      alert("Please connect to MetaMask to continue.");
    } else {
      alert("Failed to connect wallet. Please try again.");
    }
  }
}

/**
 * Handle successful wallet connection
 * @param {string} address - Wallet address
 */
function handleWalletConnected(address) {
  console.log("Wallet connected:", address);

  // Update game state
  gameState.walletConnected = true;
  gameState.walletAddress = address;

  // Update UI
  document.getElementById("walletStatus").innerHTML = `
        <p>✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}</p>
    `;

  // Show game screen, hide login
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("gameScreen").classList.remove("hidden");

  // Load starter Pokémon
  loadStarterPokemon();
}

/**
 * Handle account changes (user switches accounts in MetaMask)
 * @param {Array<string>} accounts - New accounts array
 */
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // User disconnected wallet
    console.log("Please connect to MetaMask.");
    location.reload(); // Reload page to reset state
  } else if (accounts[0] !== gameState.walletAddress) {
    // User switched accounts
    handleWalletConnected(accounts[0]);
  }
}

/**
 * Handle chain/network changes
 * @param {string} chainId - New chain ID
 */
function handleChainChanged(chainId) {
  console.log("Network changed to:", chainId);
  // Reload page to reset state with new network
  location.reload();
}

/**
 * Disconnect wallet (cleanup)
 */
function disconnectWallet() {
  gameState.walletConnected = false;
  gameState.walletAddress = null;

  // Remove event listeners
  if (window.ethereum) {
    window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    window.ethereum.removeListener("chainChanged", handleChainChanged);
  }
}

/**
 * Get current wallet balance
 * @returns {Promise<string>} Balance in ETH
 */
async function getWalletBalance() {
  if (!gameState.walletAddress) return "0";

  try {
    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [gameState.walletAddress, "latest"],
    });

    // Convert from Wei to ETH
    const ethBalance = parseInt(balance, 16) / 1e18;
    return ethBalance.toFixed(4);
  } catch (error) {
    console.error("Error getting balance:", error);
    return "0";
  }
}

/**
 * Simulate blockchain transaction (for demo purposes)
 * In production, replace with actual smart contract calls
 * @param {string} action - Action type
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} Transaction result
 */
async function simulateBlockchainTransaction(action, data) {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(() => {
      const txHash = "0x" + Math.random().toString(36).substr(2, 64);

      console.log(`[Blockchain ${action}]`, {
        from: gameState.walletAddress,
        data: data,
        txHash: txHash,
      });

      resolve({
        success: true,
        txHash: txHash,
        blockNumber: Math.floor(Math.random() * 1000000),
        gasUsed: Math.floor(Math.random() * 100000) + 21000,
      });
    }, 1000);
  });
}

/**
 * Mint a starter Pokémon NFT
 * @param {Object} pokemon - Pokémon data
 * @returns {Promise<Object>} Transaction result
 */
async function mintStarterPokemon(pokemon) {
  console.log("Minting starter Pokémon:", pokemon.name);

  // In production, call smart contract mint function:
  // const contract = new ethers.Contract(CONTRACT_CONFIG.pokemonNFT.address, CONTRACT_CONFIG.pokemonNFT.abi, signer);
  // const tx = await contract.mintStarter(pokemon.id);
  // await tx.wait();

  return await simulateBlockchainTransaction("mint_starter", {
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    owner: gameState.walletAddress,
    timestamp: Date.now(),
  });
}

/**
 * Record battle result on blockchain
 * @param {string} result - 'win' or 'loss'
 * @param {number} opponents - Number of opponents defeated
 * @returns {Promise<Object>} Transaction result
 */
async function recordBattleResult(result, opponents) {
  console.log("Recording battle result:", result);

  return await simulateBlockchainTransaction("record_battle", {
    trainer: gameState.walletAddress,
    result: result,
    opponentsDefeated: opponents,
    timestamp: Date.now(),
  });
}

/**
 * Buy Pokémon from marketplace
 * @param {string} pokemonName - Pokémon name
 * @param {number} price - Price in ETH
 * @returns {Promise<Object>} Transaction result
 */
async function buyPokemonFromMarketplace(pokemonName, price) {
  console.log(`Buying ${pokemonName} for ${price} ETH`);

  // In production, call marketplace contract:
  // const contract = new ethers.Contract(CONTRACT_CONFIG.marketplace.address, CONTRACT_CONFIG.marketplace.abi, signer);
  // const tx = await contract.buyPokemon(tokenId, { value: ethers.utils.parseEther(price.toString()) });
  // await tx.wait();

  return await simulateBlockchainTransaction("buy_pokemon", {
    pokemon: pokemonName,
    price: price,
    buyer: gameState.walletAddress,
    seller: "0x" + Math.random().toString(36).substr(2, 40),
    timestamp: Date.now(),
  });
}

/**
 * List Pokémon for sale on marketplace
 * @param {number} tokenId - NFT token ID
 * @param {number} price - Listing price in ETH
 * @returns {Promise<Object>} Transaction result
 */
async function listPokemonForSale(tokenId, price) {
  console.log(`Listing token ${tokenId} for ${price} ETH`);

  return await simulateBlockchainTransaction("list_pokemon", {
    tokenId: tokenId,
    price: price,
    seller: gameState.walletAddress,
    timestamp: Date.now(),
  });
}

/**
 * Switch to specific network
 * @param {string} chainId - Target chain ID
 */
async function switchNetwork(chainId) {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainId }],
    });
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      console.log("Network not added to MetaMask");
      // Could add network here using wallet_addEthereumChain
    } else {
      console.error("Error switching network:", error);
    }
  }
}

/**
 * Format wallet address for display
 * @param {string} address - Full wallet address
 * @returns {string} Shortened address
 */
function formatAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Initialize wallet connection check on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkWalletConnection);
} else {
  checkWalletConnection();
}
