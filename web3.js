const NETWORK_CONFIG = {
  chainId: "0x1",
  chainName: "Ethereum Mainnet",
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
  blockExplorer: "https://etherscan.io",
};

const CONTRACT_CONFIG = {
  pokemonNFT: {
    address: "0x0000000000000000000000000000000000000000",
    abi: [],
  },
  marketplace: {
    address: "0x0000000000000000000000000000000000000000",
    abi: [],
  },
};

function isMetaMaskInstalled() {
  return typeof window.ethereum !== "undefined";
}

async function checkWalletConnection() {
  if (!isMetaMaskInstalled()) {
    console.log("MetaMask is not installed");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });

    if (accounts.length > 0) {
      console.log("Found connected wallet:", accounts[0]);

      const savedState = localStorage.getItem("pokechain_arena_save");
      if (savedState) {
        const loadedState = JSON.parse(savedState);
        if (
          loadedState.walletAddress === accounts[0] &&
          loadedState.isRegistered
        ) {
          handleWalletConnected(accounts[0]);
        } else {
          const walletStatus = document.getElementById("walletStatus");
          const registerWalletStatus = document.getElementById(
            "registerWalletStatus"
          );

          if (walletStatus) {
            walletStatus.innerHTML = `<p>✅ Connected: ${accounts[0].slice(
              0,
              6
            )}...${accounts[0].slice(-4)}</p>`;
          }
          if (registerWalletStatus) {
            registerWalletStatus.innerHTML = `<p>✅ Connected: ${accounts[0].slice(
              0,
              6
            )}...${accounts[0].slice(-4)}</p>`;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking wallet connection:", error);
  }
}

async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    alert("MetaMask is not installed! Please install MetaMask to play.");
    window.open("https://metamask.io/download/", "_blank");
    return;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length > 0) {
      await loginTrainer();
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

function handleWalletConnected(address) {
  console.log("Wallet connected:", address);

  gameState.walletConnected = true;
  gameState.walletAddress = address;

  const walletStatus = document.getElementById("walletStatus");
  if (walletStatus) {
    walletStatus.innerHTML = `
      <p>✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}</p>
    `;
  }

  const registerWalletStatus = document.getElementById("registerWalletStatus");
  if (registerWalletStatus) {
    registerWalletStatus.innerHTML = `
      <p>✅ Connected: ${address.slice(0, 6)}...${address.slice(-4)}</p>
    `;
  }

  const savedState = localStorage.getItem("pokechain_arena_save");
  if (savedState) {
    const loadedState = JSON.parse(savedState);
    if (loadedState.walletAddress === address && loadedState.isRegistered) {
      Object.assign(gameState, {
        ...loadedState,
        walletConnected: true,
        walletAddress: address,
        currentBattle: null,
      });

      const playerTrainerName = document.getElementById("playerTrainerName");
      if (playerTrainerName) {
        playerTrainerName.textContent = gameState.trainerName;
      }

      showGameScreen();
    } else {
      showNotification(
        "Wallet connected! Please register or login.",
        "success"
      );
    }
  } else {
    showNotification(
      "Wallet connected! Please register as a new trainer.",
      "success"
    );
  }
}

function showGameScreen() {
  const landingPage = document.getElementById("landingPage");
  const gameScreen = document.getElementById("gameScreen");

  if (landingPage) landingPage.classList.add("hidden");
  if (gameScreen) gameScreen.classList.remove("hidden");

  if (!gameState.playerPokemon) {
    loadStarterPokemon();
  }

  updatePlayerStatsDisplay();
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    console.log("Please connect to MetaMask.");
    location.reload();
  } else if (accounts[0] !== gameState.walletAddress) {
    handleWalletConnected(accounts[0]);
  }
}

function handleChainChanged(chainId) {
  console.log("Network changed to:", chainId);
  location.reload();
}

function disconnectWallet() {
  gameState.walletConnected = false;
  gameState.walletAddress = null;

  if (window.ethereum) {
    window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    window.ethereum.removeListener("chainChanged", handleChainChanged);
  }
}

async function getWalletBalance() {
  if (!gameState.walletAddress) return "0";

  try {
    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [gameState.walletAddress, "latest"],
    });

    const ethBalance = parseInt(balance, 16) / 1e18;
    return ethBalance.toFixed(4);
  } catch (error) {
    console.error("Error getting balance:", error);
    return "0";
  }
}

async function simulateBlockchainTransaction(action, data) {
  return new Promise((resolve) => {
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

async function mintStarterPokemon(pokemon) {
  console.log("Minting starter Pokémon:", pokemon.name);

  return await simulateBlockchainTransaction("mint_starter", {
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    owner: gameState.walletAddress,
    timestamp: Date.now(),
  });
}

async function recordBattleResult(result, opponents) {
  console.log("Recording battle result:", result);

  return await simulateBlockchainTransaction("record_battle", {
    trainer: gameState.walletAddress,
    result: result,
    opponentsDefeated: opponents,
    timestamp: Date.now(),
  });
}

async function buyPokemonFromMarketplace(pokemonName, price) {
  console.log(`Buying ${pokemonName} for ${price} ETH`);

  return await simulateBlockchainTransaction("buy_pokemon", {
    pokemon: pokemonName,
    price: price,
    buyer: gameState.walletAddress,
    seller: "0x" + Math.random().toString(36).substr(2, 40),
    timestamp: Date.now(),
  });
}

async function registerTrainerOnChain(trainerName, walletAddress) {
  return await simulateBlockchainTransaction("register_trainer", {
    trainerName: trainerName,
    walletAddress: walletAddress,
    registrationDate: Date.now(),
  });
}

async function listPokemonForSale(tokenId, price) {
  console.log(`Listing token ${tokenId} for ${price} ETH`);

  return await simulateBlockchainTransaction("list_pokemon", {
    tokenId: tokenId,
    price: price,
    seller: gameState.walletAddress,
    timestamp: Date.now(),
  });
}

async function switchNetwork(chainId) {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainId }],
    });
  } catch (error) {
    if (error.code === 4902) {
      console.log("Network not added to MetaMask");
    } else {
      console.error("Error switching network:", error);
    }
  }
}

function formatAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkWalletConnection);
} else {
  checkWalletConnection();
}
