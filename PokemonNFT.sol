// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PokemonNFT
 * @dev NFT contract for minting captured Pokemon from the battle game
 */
contract PokemonNFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    // Pokemon struct to store on-chain data
    struct Pokemon {
        string name;
        string pokemonType;
        uint256 level;
        uint256 hp;
        uint256 attack;
        uint256 defense;
        uint256 captureTime;
    }

    // Mapping from token ID to Pokemon data
    mapping(uint256 => Pokemon) public pokemons;

    // Events
    event PokemonMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string pokemonType,
        uint256 level
    );

    constructor() ERC721("PokemonBattleNFT", "PKMN") Ownable(msg.sender) {}

    /**
     * @dev Mint a new Pokemon NFT
     * @param name Pokemon name
     * @param pokemonType Pokemon type (fire, water, grass, etc.)
     * @param level Pokemon level
     * @param hp Pokemon HP stat
     * @param attack Pokemon attack stat
     * @param defense Pokemon defense stat
     * @return tokenId The ID of the newly minted token
     */
    function mintPokemon(
        string memory name,
        string memory pokemonType,
        uint256 level,
        uint256 hp,
        uint256 attack,
        uint256 defense
    ) public returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        _safeMint(msg.sender, newTokenId);

        // Store Pokemon data
        pokemons[newTokenId] = Pokemon({
            name: name,
            pokemonType: pokemonType,
            level: level,
            hp: hp,
            attack: attack,
            defense: defense,
            captureTime: block.timestamp
        });

        emit PokemonMinted(newTokenId, msg.sender, name, pokemonType, level);

        return newTokenId;
    }

    /**
     * @dev Get Pokemon data by token ID
     * @param tokenId The token ID to query
     * @return Pokemon struct with all data
     */
    function getPokemon(uint256 tokenId) public view returns (Pokemon memory) {
        require(_ownerOf(tokenId) != address(0), "Pokemon does not exist");
        return pokemons[tokenId];
    }

    /**
     * @dev Get all Pokemon owned by an address
     * @param owner The address to query
     * @return Array of token IDs owned by the address
     */
    function getOwnerPokemons(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 currentIndex = 0;

        for (uint256 i = 1; i <= _tokenIds.current(); i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[currentIndex] = i;
                currentIndex++;
            }
        }

        return tokenIds;
    }

    /**
     * @dev Get total number of Pokemon minted
     */
    function getTotalMinted() public view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}