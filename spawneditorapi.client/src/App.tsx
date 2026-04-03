import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const storageKeys = {
  activeWorldId: "uox3.activeWorldId",
  selectedRegionId: "uox3.selectedRegionId",
  viewState: "uox3.viewState",
  searchText: "uox3.searchText",
  showRegionLabels: "uox3.showRegionLabels",
  activeFileFilters: "uox3.activeFileFilters",
  activeSourceFilePaths: "uox3.activeSourceFilePaths",
  focusedRegionId: "uox3.focusedRegionId",
  editedSourceFilePaths: "uox3.editedSourceFilePaths"
};

type RegionBounds = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type SpawnRegion = {
  id: string;
  regionNum: number;
  sectionHeader: string;
  name: string;
  world: number;
  instanceID: number;
  fileName: string;
  sourceFilePath: string;
  bounds: RegionBounds;
  tags: Record<string, string>;
};

type BootstrapResponse = {
  maps: MapWorldDefinition[];
  sourceFiles: string[];
};

type RegionsResponse = {
  regions: SpawnRegion[];
};

type SaveResponse = {
  files: Array<{
    fileName: string;
    content: string;
  }>;
};

type MapWorldDefinition = {
  id: number;
  name: string;
  width: number;
  height: number;
  imageUrl: string;
};

type ViewState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const defaultViewState: ViewState = {
  zoom: 0.75,
  offsetX: 40,
  offsetY: 40
};

type DragMode = "none" | "pan" | "move-region" | "resize-region";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

type DragState = {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  startBounds?: RegionBounds;
  resizeHandle?: ResizeHandle;
};

type RegionFileFilterDefinition = {
  id: string;
  label: string;
  matchTokens: string[];
};

type PickerOption = {
  value: string;
  label: string;
};

type HistorySnapshot = {
  regions: SpawnRegion[];
  selectedRegionId: string | null;
  activeWorldId: number;
  activeSourceFilePaths: string[];
  focusedRegionId: string | null;
  editedSourceFilePaths: string[];
  filterSourceFilePath: string;
  filterRegionId: string;
};

const maxHistoryEntries = 50;

const fallbackMapWorlds: MapWorldDefinition[] = [
  { id: 0, name: "Felucca", width: 6144, height: 4096, imageUrl: "/api/maps/0.png" },
  { id: 1, name: "Trammel", width: 6144, height: 4096, imageUrl: "/api/maps/1.png" },
  { id: 2, name: "Ilshenar", width: 2304, height: 1600, imageUrl: "/api/maps/2.png" },
  { id: 3, name: "Malas", width: 2560, height: 2048, imageUrl: "/api/maps/3.png" },
  { id: 4, name: "Tokuno", width: 1448, height: 1448, imageUrl: "/api/maps/4.png" },
  { id: 5, name: "Ter Mur", width: 1280, height: 4096, imageUrl: "/api/maps/5.png" }
];

const regionFileFilters: RegionFileFilterDefinition[] = [
  { id: "dungeons", label: "Dungeons", matchTokens: ["dungeon"] },
  { id: "towns", label: "Towns", matchTokens: ["town"] },
  { id: "treasure", label: "Treasure", matchTokens: ["treasure"] },
  { id: "world", label: "World", matchTokens: ["world"] },
  { id: "oceans", label: "Oceans", matchTokens: ["world_oceans", "oceans"] },
  { id: "lostlands", label: "Lost Lands", matchTokens: ["world_lostlands", "lostlands"] },
  { id: "graveyards", label: "Graveyards", matchTokens: ["world_graveyards", "graveyards"] },
  { id: "forts", label: "Forts", matchTokens: ["world_forts", "forts"] },
  { id: "guardposts", label: "Guard Posts", matchTokens: ["world_guardposts", "guardposts"] },
  { id: "lands", label: "Lands", matchTokens: ["world_lands", "lands"] }
];

const defaultActiveFileFilters = regionFileFilters.map((filter) => filter.id);

const npcOptions: PickerOption[] = [{"value":"0x1","label":"Ogre (0x1)"},{"value":"0x2","label":"Ettin (0x2)"},{"value":"0x3","label":"Zombie (0x3)"},{"value":"0x4","label":"Gargoyle (0x4)"},{"value":"0x5","label":"Eagle (0x5)"},{"value":"0x6","label":"Bird (0x6)"},{"value":"0x7","label":"Orc Captain (0x7)"},{"value":"0x8","label":"Corpser (0x8)"},{"value":"0x9","label":"Daemon (0x9)"},{"value":"0xa","label":"Daemon 2 (0xa)"},{"value":"0xb","label":"Dread Spider (0xb)"},{"value":"0xc","label":"Grey Dragon (0xc)"},{"value":"0xd","label":"Air Elemental (0xd)"},{"value":"0xe","label":"Earth Elemental (0xe)"},{"value":"0xf","label":"Fire Elemental (0xf)"},{"value":"0x10","label":"Water Elemental (0x10)"},{"value":"0x11","label":"Orc (0x11)"},{"value":"0x12","label":"Hammer Ettin (0x12)"},{"value":"0x13","label":"Dread Spider (0x13)"},{"value":"0x14","label":"Frost Spider (0x14)"},{"value":"0x15","label":"Giant Snake (0x15)"},{"value":"0x16","label":"Gazer (0x16)"},{"value":"0x17","label":"Dire Wolf (0x17)"},{"value":"0x18","label":"Liche (0x18)"},{"value":"0x19","label":"Grey Wolf (0x19)"},{"value":"0x1a","label":"Spectre/Wraith (0x1a)"},{"value":"0x1b","label":"Grey Wolf (0x1b)"},{"value":"0x1c","label":"Giant Spider (0x1c)"},{"value":"0x1d","label":"Gorilla (0x1d)"},{"value":"0x1e","label":"Harpy (0x1e)"},{"value":"0x1f","label":"Headless (0x1f)"},{"value":"0x21","label":"Lizardman (0x21)"},{"value":"0x22","label":"White Wolf (0x22)"},{"value":"0x23","label":"Spear Lizardman (0x23)"},{"value":"0x24","label":"Mace Lizardman (0x24)"},{"value":"0x25","label":"Timber Wolf (0x25)"},{"value":"0x26","label":"Black Gate Daemon (0x26)"},{"value":"0x27","label":"Mongbat (0x27)"},{"value":"0x28","label":"Balron (0x28)"},{"value":"0x29","label":"Club Orc (0x29)"},{"value":"0x2a","label":"Ratman (0x2a)"},{"value":"0x2b","label":"Ice Fiend (0x2b)"},{"value":"0x2c","label":"Ratman (0x2c)"},{"value":"0x2d","label":"Ratman (0x2d)"},{"value":"0x2e","label":"Ancient Wyrm/Dragon Rust (0x2e)"},{"value":"0x2f","label":"Reaper (0x2f)"},{"value":"0x30","label":"Giant Scorpion (0x30)"},{"value":"0x31","label":"White Wyrm (0x31)"},{"value":"0x32","label":"Skeleton 2 (0x32)"},{"value":"0x33","label":"Slime (0x33)"},{"value":"0x34","label":"Snake (0x34)"},{"value":"0x35","label":"Axe Troll (0x35)"},{"value":"0x36","label":"Troll (0x36)"},{"value":"0x37","label":"Frost Troll (0x37)"},{"value":"0x38","label":"Skeleton 3 (0x38)"},{"value":"0x39","label":"Skeleton 4 (0x39)"},{"value":"0x3a","label":"Wisp (0x3a)"},{"value":"0x3b","label":"Red Dragon (0x3b)"},{"value":"0x3c","label":"Grey Drake (0x3c)"},{"value":"0x3d","label":"Red Drake (0x3d)"},{"value":"0x3e","label":"Wyvern (0x3e)"},{"value":"0x3f","label":"Cougar (0x3f)"},{"value":"0x40","label":"Snow Leopard (0x40)"},{"value":"0x41","label":"Snow Leopard 2 (0x41)"},{"value":"0x42","label":"Swamp Tentacle (0x42)"},{"value":"0x43","label":"Stone Gargoyle (0x43)"},{"value":"0x44","label":"Elder Gazer (0x44)"},{"value":"0x45","label":"Elder Gazer 2 (0x45)"},{"value":"0x46","label":"Terathan Warrior (0x46)"},{"value":"0x47","label":"Terathan Drone (0x47)"},{"value":"0x48","label":"Terathan Matriarch/Queen (0x48)"},{"value":"0x49","label":"Stone Harpy (0x49)"},{"value":"0x4a","label":"Imp (0x4a)"},{"value":"0x4b","label":"Cyclopedian Warrior (0x4b)"},{"value":"0x4c","label":"Titan (0x4c)"},{"value":"0x4d","label":"Kraken (0x4d)"},{"value":"0x4e","label":"Lich Lord (0x4e)"},{"value":"0x4f","label":"Lich Lord (0x4f)"},{"value":"0x50","label":"Giant Toad (0x50)"},{"value":"0x51","label":"Bullfrog (0x51)"},{"value":"0x52","label":"Lich Lord (0x52)"},{"value":"0x53","label":"Ogre Lord (0x53)"},{"value":"0x54","label":"Ogre Lord (0x54)"},{"value":"0x55","label":"Ophidian Apprentice Mage/Shaman (0x55)"},{"value":"0x56","label":"Ophidian Warrior/Enforcer (0x56)"},{"value":"0x57","label":"Ophidian Matriarch (0x57)"},{"value":"0x58","label":"Mountain Goat (0x58)"},{"value":"0x59","label":"Giant Ice Serpent (0x59)"},{"value":"0x5a","label":"Giant Lava Serpent (0x5a)"},{"value":"0x5b","label":"Silver Serpent (0x5b)"},{"value":"0x5c","label":"Silver Serpent (0x5c)"},{"value":"0x5d","label":"Silver Serpent (0x5d)"},{"value":"0x5e","label":"Frost Ooze (0x5e)"},{"value":"0x5F","label":"Turkey (0x5F)"},{"value":"0x60","label":"Frost Ooze (0x60)"},{"value":"0x61","label":"Hell Hound (0x61)"},{"value":"0x62","label":"Hell Hound (0x62)"},{"value":"0x63","label":"Dark Wolf (0x63)"},{"value":"0x64","label":"Silver Wolf (0x64)"},{"value":"0x65","label":"Centaur (0x65)"},{"value":"0x66","label":"Exodus (0x66)"},{"value":"0x67","label":"Serpentine Dragon (0x67)"},{"value":"0x68","label":"Skeletal Dragon (0x68)"},{"value":"0x69","label":"Ancient Wyrm (0x69)"},{"value":"0x6a","label":"Shadow Wyrm (0x6a)"},{"value":"0x6b","label":"Agapite Elemental (0x6b)"},{"value":"0x6c","label":"Bronze Elemental (0x6c)"},{"value":"0x6d","label":"Copper Elemental (0x6d)"},{"value":"0x6e","label":"Dull-Copper Elemental (0x6e)"},{"value":"0x6f","label":"Shadow Iron Elemental (0x6f)"},{"value":"0x70","label":"Valorite Elemental (0x70)"},{"value":"0x71","label":"Verite Elemental (0x71)"},{"value":"0x72","label":"Dark Steed (0x72)"},{"value":"0x73","label":"Ethereal Steed (0x73)"},{"value":"0x74","label":"Nightmare (0x74)"},{"value":"0x75","label":"Silver Steed (0x75)"},{"value":"0x76","label":"True Britannian Warhorse (0x76)"},{"value":"0x77","label":"Circle of Mages Warhorse (0x77)"},{"value":"0x78","label":"Minax Warhorse (0x78)"},{"value":"0x79","label":"Shadowlords Warhorse (0x79)"},{"value":"0x7a","label":"Unicorn (0x7a)"},{"value":"0x7b","label":"Ethereal Warrior (0x7b)"},{"value":"0x7c","label":"Evil Mage (0x7c)"},{"value":"0x7d","label":"Evil Mage Lord (0x7d)"},{"value":"0x7e","label":"Evil Mage Lord (0x7e)"},{"value":"0x7f","label":"Hellcat (0x7f)"},{"value":"0x80","label":"Pixie (0x80)"},{"value":"0x81","label":"Swamp Tentacle (0x81)"},{"value":"0x82","label":"Fire Gargoyle (0x82)"},{"value":"0x83","label":"Efreet (0x83)"},{"value":"0x84","label":"Ki-Rin (0x84)"},{"value":"0x85","label":"Small Alligator (0x85)"},{"value":"0x86","label":"Komodo Dragon (0x86)"},{"value":"0x87","label":"Artic Ogre Lord (0x87)"},{"value":"0x87","label":"Ophidian Arch Mage (0x87)"},{"value":"0x89","label":"Ophidian Knight/Avenger (0x89)"},{"value":"0x8a","label":"Orcish Lord (0x8a)"},{"value":"0x8b","label":"Orcish Lord (0x8b)"},{"value":"0x8c","label":"Orc Mage/Shaman (0x8c)"},{"value":"0x8e","label":"Ratman Archer (0x8e)"},{"value":"0x8f","label":"Ratman Shaman (0x8f)"},{"value":"0x90","label":"Sea Horse (0x90)"},{"value":"0x91","label":"Deep Sea Serpent (0x91)"},{"value":"0x92","label":"Shadowlord (0x92)"},{"value":"0x93","label":"Bone Knight (0x93)"},{"value":"0x94","label":"Bone Magi (0x94)"},{"value":"0x95","label":"Succubus (0x95)"},{"value":"0x96","label":"Sea Serpent (0x96)"},{"value":"0x97","label":"Dolphin (0x97)"},{"value":"0x98","label":"Terathan Avenger (0x98)"},{"value":"0x99","label":"Ghoul (0x99)"},{"value":"0x9a","label":"Mummy (0x9a)"},{"value":"0x9b","label":"Rotting Corpse (0x9b)"},{"value":"0x9d","label":"Black Widow (0x9d)"},{"value":"0x9e","label":"Acid Elemental (0x9e)"},{"value":"0x9f","label":"Blood Elemental (0x9f)"},{"value":"0xa0","label":"Blood Elemental (0xa0)"},{"value":"0xa1","label":"Ice Elemental (0xa1)"},{"value":"0xa2","label":"Poison Elemental (0xa2)"},{"value":"0xa3","label":"Snow Elemental (0xa3)"},{"value":"0xa4","label":"Energy Vortex (0xa4)"},{"value":"0xa5","label":"Shadow Wisp (0xa5)"},{"value":"0xa6","label":"Gold Elemental (0xa6)"},{"value":"0xa7","label":"Brown Bear (0xa7)"},{"value":"0xa8","label":"Shadow Fiend (0xa8)"},{"value":"0xa9","label":"Giant Fire Beetle (0xa9)"},{"value":"0xAA","label":"Etheral Llama (0xAA)"},{"value":"0xAB","label":"Etheral Ostard (0xAB)"},{"value":"0xAC","label":"Dragon (Retro) (0xAC)"},{"value":"0xAD","label":"Black Widow (giant) (0xAD)"},{"value":"0xAE","label":"Succubus (giant) (0xAE)"},{"value":"0xAF","label":"Ethereal Warrior (giant) (0xAF)"},{"value":"0xb0","label":"Large Pixie (0xb0)"},{"value":"0xb1","label":"Dark Nightmare (0xb1)"},{"value":"0xb2","label":"Another Nightmare (0xb2)"},{"value":"0xb3","label":"Nightmare (3D only) (0xb3)"},{"value":"0xb4","label":"White Wyrm (0xb4)"},{"value":"0xb5","label":"Orc Scout (0xb5)"},{"value":"0xb6","label":"Orc Bomber (0xb6)"},{"value":"0xb7","label":"Savage Male (0xb7)"},{"value":"0xb8","label":"Savage Female (0xb8)"},{"value":"0xb9","label":"Savage Male (0xb9)"},{"value":"0xba","label":"Savage Female (0xba)"},{"value":"0xbb","label":"Ridgeback (0xbb)"},{"value":"0xbc","label":"Savage Ridgeback (0xbc)"},{"value":"0xbd","label":"Huge Orcish Lord/Orc Brute (0xbd)"},{"value":"0xbe","label":"Fire Steed (0xbe)"},{"value":"0xbf","label":"Ethereal Kirin (0xbf)"},{"value":"0xc0","label":"Unicorn (0xc0)"},{"value":"0xc1","label":"Ethereal Ridgeback (0xc1)"},{"value":"0xc2","label":"Ethereal Swampdragon (0xc2)"},{"value":"0xc3","label":"Ethereal Giant Beetle (0xc3)"},{"value":"0xc4","label":"Denkou Yajuu (0xc4)"},{"value":"0xc5","label":"Dragon (Chaos) (0xc5)"},{"value":"0xc6","label":"Dragon (Order) (0xc6)"},{"value":"0xc7","label":"Gouzen Ha (0xc7)"},{"value":"0xc8","label":"Equines Horse (dappled brown) (0xc8)"},{"value":"0xc9","label":"Cat (0xc9)"},{"value":"0xca","label":"Alligator (0xca)"},{"value":"0xcb","label":"Small Pig (0xcb)"},{"value":"0xcc","label":"Brown Horse (0xcc)"},{"value":"0xcd","label":"Rabbit (0xcd)"},{"value":"0xce","label":"Lava Lizard (0xce)"},{"value":"0xcf","label":"Wooly Sheep (0xcf)"},{"value":"0xd0","label":"Chicken (0xd0)"},{"value":"0xd1","label":"Goat (0xd1)"},{"value":"0xd2","label":"Desert Ostard (0xd2)"},{"value":"0xd3","label":"Brown Bear (0xd3)"},{"value":"0xd4","label":"Grizzly Bear (0xd4)"},{"value":"0xd5","label":"Polar Bear (0xd5)"},{"value":"0xd6","label":"Panther (0xd6)"},{"value":"0xd7","label":"Giant Rat (0xd7)"},{"value":"0xd8","label":"Cow (0xd8)"},{"value":"0xd9","label":"Dog (0xd9)"},{"value":"0xda","label":"Forest Ostard (0xda)"},{"value":"0xdb","label":"Frenzied Ostard (0xdb)"},{"value":"0xdc","label":"Llama (0xdc)"},{"value":"0xdd","label":"Walrus (0xdd)"},{"value":"0xdf","label":"Lamb / Shorn Sheep (0xdf)"},{"value":"0xe1","label":"Timber Wolf (0xe1)"},{"value":"0xe2","label":"Horse (dappled grey) (0xe2)"},{"value":"0xe4","label":"Horse (tan) (0xe4)"},{"value":"0xe7","label":"Brown Cow (0xe7)"},{"value":"0xe8","label":"Bull (0xe8)"},{"value":"0xe9","label":"Black & White Cow (0xe9)"},{"value":"0xea","label":"Deer (0xea)"},{"value":"0xed","label":"Small Deer (0xed)"},{"value":"0xee","label":"Rat (0xee)"},{"value":"0xf0","label":"Kappa (0xf0)"},{"value":"0xf1","label":"Oni (0xf1)"},{"value":"0xf2","label":"Bimbobushi/Deathwatch Beetle (0xf2)"},{"value":"0xf3","label":"Hiryu (0xf3)"},{"value":"0xf4","label":"Rune Beetle (0xf4)"},{"value":"0xf5","label":"Yomotsu Warrior (0xf5)"},{"value":"0xf6","label":"Bake Kitsun/Tsuki (0xf6)"},{"value":"0xf7","label":"Fan Dancer (0xf7)"},{"value":"0xf8","label":"Gaman/Wild Guar (0xf8)"},{"value":"0xf9","label":"Yamandon (0xf9)"},{"value":"0xfa","label":"Tsuki Wolf (0xfa)"},{"value":"0xfb","label":"Revenant Lion/Vampyric Beast (0xfb)"},{"value":"0xfc","label":"Lady of the Snow (0xfc)"},{"value":"0xfd","label":"Yomotsu Elder/Priest (0xfd)"},{"value":"0xfe","label":"Crane (0xfe)"},{"value":"0xff","label":"Yomotsu Priest (0xff)"},{"value":"0x100","label":"Paroxysmus (0x100)"},{"value":"0x101","label":"Dread Horn (0x101)"},{"value":"0x102","label":"Lady Melisande (0x102)"},{"value":"0x103","label":"Monstrous Interred Grizzle (0x103)"},{"value":"0x105","label":"Shimmering Effusion (0x105)"},{"value":"0x106","label":"Tormented Minotaur (0x106)"},{"value":"0x107","label":"Minotaur (0x107)"},{"value":"0x108","label":"Changling (0x108)"},{"value":"0x109","label":"Hydra (0x109)"},{"value":"0x10a","label":"Dryad (0x10a)"},{"value":"0x10b","label":"Troglodyte (0x10b)"},{"value":"0x10f","label":"Satyr (0x10f)"},{"value":"0x111","label":"Fetid Essence (0x111)"},{"value":"0x114","label":"Chimera/Reptalon (0x114)"},{"value":"0x115","label":"Cu Sidhe (0x115)"},{"value":"0x116","label":"Squirrel (0x116)"},{"value":"0x117","label":"Ferret (0x117)"},{"value":"0x118","label":"Plate-Armoured Minotaur (0x118)"},{"value":"0x119","label":"Leather-Armoured Minotaur (0x119)"},{"value":"0x11a","label":"Parrot (Perched) (0x11a)"},{"value":"0x11b","label":"Crow (Perched) (0x11b)"},{"value":"0x11c","label":"Mondain's Steed/Charger of the Fallen (0x11c)"},{"value":"0x11d","label":"Reaper Form (0x11d)"},{"value":"0x11F","label":"Blood Worm (0x11F)"},{"value":"0x122","label":"Large Pig (0x122)"},{"value":"0x123","label":"Pack Horse (0x123)"},{"value":"0x124","label":"Pack Llama (0x124)"},{"value":"0x125","label":"Gargoyle Pet/Vollum (0x125)"},{"value":"0x12c","label":"Crystal Elemental (0x12c)"},{"value":"0x12d","label":"Treefellow (0x12d)"},{"value":"0x12e","label":"Skittering Hopper (0x12e)"},{"value":"0x12f","label":"Devourer of souls (0x12f)"},{"value":"0x130","label":"Flesh Golem (0x130)"},{"value":"0x131","label":"Gore Fiend (0x131)"},{"value":"0x131","label":"Impaler (0x131)"},{"value":"0x133","label":"Gibberling (0x133)"},{"value":"0x134","label":"Bone Demon (0x134)"},{"value":"0x135","label":"Patchwork Skeleton (0x135)"},{"value":"0x136","label":"Wailing Banshee (0x136)"},{"value":"0x137","label":"Shadow Knight (0x137)"},{"value":"0x138","label":"Abyssmal Horror (0x138)"},{"value":"0x139","label":"Darknight_Creeper (0x139)"},{"value":"0x13a","label":"Ravager (0x13a)"},{"value":"0x13b","label":"Flesh Renderer (0x13b)"},{"value":"0x13c","label":"Wanderer of the Void (0x13c)"},{"value":"0x13d","label":"Vampire Bat (0x13d)"},{"value":"0x13e","label":"Demon Knight (0x13e)"},{"value":"0x13f","label":"Mound of Maggots (0x13f)"},{"value":"0x14e","label":"Grey Goblin (0x14e)"},{"value":"0x190","label":"Human Male (0x190)"},{"value":"0x191","label":"Human Female (0x191)"},{"value":"0x192","label":"Male Ghost (0x192)"},{"value":"0x193","label":"Female Ghost (0x193)"},{"value":"0x1b0","label":"Boura (Ridable) (0x1b0)"},{"value":"0x23d","label":"Death Vortex (0x23d)"},{"value":"0x23e","label":"Blade Spirit (0x23e)"},{"value":"0x23d","label":"Energy Vortex (0x23d)"},{"value":"0x23e","label":"Blade Spirits (0x23e)"},{"value":"0x25d","label":"Elf Male (0x25d)"},{"value":"0x25e","label":"Elf Female (0x25e)"},{"value":"0x25f","label":"Elf Male Ghost (0x25f)"},{"value":"0x260","label":"Elf Female Ghost (0x260)"},{"value":"0x27d","label":"Spectral Armor (0x27d)"},{"value":"0x29a","label":"Gargoyle Male (0x29a)"},{"value":"0x29b","label":"Gargoyle Female (0x29b)"},{"value":"0x2b1","label":"Time Lord (0x2b1)"},{"value":"0x2b6","label":"Gargoyle Male Ghost (0x2b6)"},{"value":"0x2b7","label":"Gargoyle Female Ghost (0x2b7)"},{"value":"0x2c0","label":"Shadowlord, new version (0x2c0)"},{"value":"0x2c1","label":"Stone Form (0x2c1)"},{"value":"0x2c9","label":"Abyssal Infernal (0x2c9)"},{"value":"0x2ca","label":"Beetle Iron (0x2ca)"},{"value":"0x2cb","label":"Boura (0x2cb)"},{"value":"0x2cc","label":"ChickenLizard (0x2cc)"},{"value":"0x2cd","label":"Clockwork Scorpion (0x2cd)"},{"value":"0x2ce","label":"Dragon Faerie (0x2ce)"},{"value":"0x2cf","label":"Dragon Wolf (0x2cf)"},{"value":"0x2d0","label":"Lava Worm (0x2d0)"},{"value":"0x2D1","label":"Flayer/Maddening Horror (0x2D1)"},{"value":"0x2d2","label":"Gargoyle Undead (0x2d2)"},{"value":"0x2d3","label":"Green Goblin (0x2d3)"},{"value":"0x2d4","label":"Gremlin (0x2d4)"},{"value":"0x2d5","label":"Humunculous (0x2d5)"},{"value":"0x2d6","label":"Kepetch (0x2d6)"},{"value":"0x2d7","label":"Kepetch Shorn (0x2d7)"},{"value":"0x2d8","label":"Medusa (0x2d8)"},{"value":"0x2d9","label":"Mimic (0x2d9)"},{"value":"0x2da","label":"Raptor (0x2da)"},{"value":"0x2dc","label":"RotWorm (0x2dc)"},{"value":"0x2dd","label":"Skree (0x2dd)"},{"value":"0x2de","label":"Slith (0x2de)"},{"value":"0x2DF","label":"Spider Female / Navrey Night-Eyes (0x2DF)"},{"value":"0x2E0","label":"Spider Male / Wolf Spider (0x2E0)"},{"value":"0x2e1","label":"Spider Trapdoor (0x2e1)"},{"value":"0x2e2","label":"Trapdoor Creature (0x2e2)"},{"value":"0x2e3","label":"Wolf Leather (0x2e3)"},{"value":"0x2e4","label":"Shadow Dweller (0x2e4)"},{"value":"0x2e5","label":"Slasher of Veils (0x2e5)"},{"value":"0x2E6","label":"Tunnel Spirit Body/Charybdis (0x2E6)"},{"value":"0x2E7","label":"Tunnel Spirit Tentacle/Tentacles of Osiredon the Scalis Enforcer (0x2E7)"},{"value":"0x2e8","label":"Human Male (0x2e8)"},{"value":"0x2e9","label":"Human Female (0x2e9)"},{"value":"0x2ea","label":"Moloch (0x2ea)"},{"value":"0x2eb","label":"Wailing Banshee (0x2eb)"},{"value":"0x2ec","label":"Ghost (0x2ec)"},{"value":"0x2ed","label":"Liche (0x2ed)"},{"value":"0x2ee","label":"Savage Male (0x2ee)"},{"value":"0x2ef","label":"Savage Female (0x2ef)"},{"value":"0x2f0","label":"Golem (0x2f0)"},{"value":"0x2f1","label":"Enslaved Gargoyle (0x2f1)"},{"value":"0x2f2","label":"Gargoyle Enforcer (0x2f2)"},{"value":"0x2f3","label":"Gargoyle Destroyer (0x2f3)"},{"value":"0x2f4","label":"Exodus/Clockwork Overseer (0x2f4)"},{"value":"0x2f5","label":"Exodus/Clockwork Minion (0x2f5)"},{"value":"0x2f6","label":"Gargoyle Alchemist/Stone Worker (0x2f6)"},{"value":"0x2fb","label":"Exodus/Clockwork Minion Lord (0x2fb)"},{"value":"0x2fc","label":"Juka Warrior (0x2fc)"},{"value":"0x2fd","label":"Juka Mage (0x2fd)"},{"value":"0x2fe","label":"Warlord Kabur/Juka Lord (0x2fe)"},{"value":"0x2ff","label":"Blackthorn Cohort/Betrayer (0x2ff)"},{"value":"0x300","label":"Juggernaut (0x300)"},{"value":"0x302","label":"Meer Mage (0x302)"},{"value":"0x303","label":"Meer Warrior (0x303)"},{"value":"0x304","label":"Adranath/Meer Eternal (0x304)"},{"value":"0x305","label":"Captain Dasha/Meer Captain (0x305)"},{"value":"0x306","label":"Dawn (0x306)"},{"value":"0x307","label":"Plague Beast (0x307)"},{"value":"0x308","label":"Horde Minion (0x308)"},{"value":"0x309","label":"Doppleganger (0x309)"},{"value":"0x30a","label":"Gazer Larva/Swarm (0x30a)"},{"value":"0x30b","label":"Bogling (0x30b)"},{"value":"0x30c","label":"Bog Thing (0x30c)"},{"value":"0x30d","label":"Solen Worker/Fire Ant Worker (0x30d)"},{"value":"0x30e","label":"Solen Warrior/Fire Ant Warrior (0x30e)"},{"value":"0x30f","label":"Solen Queen/Fire Ant Queen (0x30f)"},{"value":"0x310","label":"Arcane Daemon (0x310)"},{"value":"0x311","label":"Moloch (0x311)"},{"value":"0x313","label":"Ant Lion (0x313)"},{"value":"0x314","label":"Sphinx (0x314)"},{"value":"0x315","label":"Quagmire (0x315)"},{"value":"0x316","label":"Sand Vortex (0x316)"},{"value":"0x317","label":"Giant Beetle (0x317)"},{"value":"0x318","label":"Chaos Daemon (0x318)"},{"value":"0x319","label":"Skeletal Mount (0x319)"},{"value":"0x31a","label":"Swampdragon (0x31a)"},{"value":"0x31c","label":"Horde Minion Big (0x31c)"},{"value":"0x31d","label":"Dragon, Fire (0x31d)"},{"value":"0x31e","label":"Dragon, Rust (0x31e)"},{"value":"0x31f","label":"Armoured Swampdragon (0x31f)"},{"value":"0x324","label":"Fire Ant/Solen Matriarch (0x324)"},{"value":"0x325","label":"Black Ant/Solen Worker (0x325)"},{"value":"0x326","label":"Black Ant/Solen Warrior (0x326)"},{"value":"0x327","label":"Black Ant/Solen Queen (0x327)"},{"value":"0x328","label":"Black Ant/Solen Matriarch (0x328)"},{"value":"0x33A","label":"Stygian Dragon (0x33A)"},{"value":"0x33D","label":"Rising Colossus 0x657 (0x33D)"},{"value":"0x33E","label":"Primevil Lich (0x33E)"},{"value":"0x33F","label":"Parrot Bird (0x33F)"},{"value":"0x340","label":"Phoenix Bird (0x340)"},{"value":"0x3DB","label":"GameMaster Body (0x3DB)"},{"value":"0x3E6","label":"Kirin (0x3E6)"},{"value":"0x3CA","label":"Human Ghost (0x3CA)"},{"value":"0x3DE","label":"Lord British (0x3DE)"},{"value":"0x3DF","label":"Lord Blackthorn (0x3DF)"},{"value":"0x3E2","label":"Dupre (0x3E2)"},{"value":"0x3E7","label":"Horde Minion Multicolored (0x3E7)"},{"value":"0x402","label":"Uber Turkey (0x402)"},{"value":"0x42C","label":"Oseridon the Scalis Enforcer (0x42C)"},{"value":"0x42D","label":"Ancient HellHound (0x42D)"},{"value":"0x42E","label":"Werewolf (0x42E)"},{"value":"0x42F","label":"Virtue Bane/Minotaur Lord (0x42F)"},{"value":"0x4DC","label":"Water Spirit/Charbydis (0x4DC)"},{"value":"0x4DD","label":"Water Spirit/Charybdis Tentacle (0x4DD)"},{"value":"0x4DE","label":"Surprise 01/Pumpkin Demon (0x4DE)"},{"value":"0x4DF","label":"Surprise 02/Pumpkin Demon (0x4DF)"},{"value":"0x4E0","label":"Clockwork Exodus (0x4E0)"},{"value":"0x4E5","label":"King Blackthorn (0x4E5)"},{"value":"0x4E6","label":"Tiger Mount (0x4E6)"},{"value":"0x4E7","label":"Ethereal Tiger Mount (0x4E7)"},{"value":"0x505","label":"Gargoyle Pet - Dimetrosaur (0x505)"},{"value":"0x506","label":"Reptile Bird - Gallusaurus (0x506)"},{"value":"0x507","label":"Fairy Dragon - Archaeosaurus (0x507)"},{"value":"0x508","label":"Dragon Turtle Boss (0x508)"},{"value":"0x509","label":"Najasaurus (0x509)"},{"value":"0x50a","label":"Allosaurus (0x50a)"},{"value":"0x50b","label":"Saurosaurus (0x50b)"},{"value":"0x50c","label":"Anchisaur (0x50c)"},{"value":"0x50d","label":"Myrmidex Larvae (0x50d)"},{"value":"0x50e","label":"Dragon Turtle Baby/Hatchling (0x50e)"},{"value":"0x51c","label":"Giant Gorilla (0x51c)"},{"value":"0x51d","label":"Tiger Cub (0x51d)"},{"value":"0x578","label":"Tyrannosaurus Rex (0x578)"},{"value":"0x579","label":"Tarantula Mount (0x579)"},{"value":"0x57a","label":"Myrmidex Drone (0x57a)"},{"value":"0x57b","label":"Myrmidex Warrior (0x57b)"},{"value":"0x57c","label":"Myrmidex Queen (0x57c)"},{"value":"0x57d","label":"DrSpecter/Zipactriotl (0x57d)"},{"value":"0x57e","label":"Kotl Automaton (0x57e)"},{"value":"0x57f","label":"Unicorn/Lasher (0x57f)"},{"value":"0x580","label":"Palomino Mount (0x580)"},{"value":"0x581","label":"Dragon_Hildebrandt (0x581)"},{"value":"0x582","label":"Windrunner Mount (0x582)"},{"value":"0x587","label":"Triceratops (0x587)"},{"value":"0x588","label":"Sabertooth Tiger (0x588)"},{"value":"0x589","label":"Dragon Small Platinum (0x589)"},{"value":"0x58a","label":"Dragon Elemental Platinum (0x58a)"},{"value":"0x58f","label":"Blood Fox (0x58f)"},{"value":"0x590","label":"Frost Mite (0x590)"},{"value":"0x591","label":"Ossein Ram/Goat Necromancer (0x591)"},{"value":"0x592","label":"Lion (0x592)"},{"value":"0x593","label":"Titan Water Tentacle/Hydros (0x593)"},{"value":"0x594","label":"Jack in the Box (0x594)"},{"value":"0x597","label":"Titan Earth (0x597)"},{"value":"0x598","label":"Titan Air (0x598)"},{"value":"0x599","label":"Titan Fire (0x599)"},{"value":"0x59a","label":"Serpentine Dragon Mount (Ethereal) (0x59a)"},{"value":"0x5a0","label":"Eowmu mount (0x5a0)"},{"value":"0x5a1","label":"Tiger Undead Mount (0x5a1)"},{"value":"0x5cc","label":"Krumpus (0x5cc)"},{"value":"0x5cd","label":"Krumpus Imp (0x5cd)"},{"value":"0x5c7","label":"Khal Ankur (0x5c7)"},{"value":"0x5e6","label":"Coconut Crab Mount (0x5e6)"},{"value":"0x5e7","label":"Mini Coconut Crab (0x5e7)"},{"value":"0x5e8","label":"Giant Coconut Crab (0x5e8)"},{"value":"0x5f6","label":"Wild boar Mount (0x5f6)"},{"value":"0x5f7","label":"Capybara mount (0x5f7)"},{"value":"0x5f8","label":"Mini Capybara (0x5f8)"},{"value":"0x605","label":"Rabbit Doom (0x605)"},{"value":"0x606","label":"Rabbit Doom Baby (0x606)"},{"value":"0x60a","label":"Newfoundland (0x60a)"},{"value":"0x60b","label":"Alaskan Malamute (0x60b)"},{"value":"0x60c","label":"Great Dane (0x60c)"},{"value":"0x60d","label":"Saint Bernard (0x60d)"},{"value":"0x60f","label":"Black Russian terrier (0x60f)"},{"value":"0x610","label":"Rottweiler (0x610)"},{"value":"0x611","label":"Manticore mount (0x611)"},{"value":"0x625","label":"Manticore Large (0x625)"},{"value":"0x626","label":"Potato Sack (0x626)"},{"value":"0x627","label":"Orc Boss (0x627)"},{"value":"0x628","label":"Orc hellhound (0x628)"},{"value":"0x666","label":"Bear Zombie mount (0x666)"},{"value":"0x669","label":"UOholder_Melee (0x669)"},{"value":"0x66a","label":"UOholder_Magic (0x66a)"},{"value":"0x66b","label":"UOholder_Slug (0x66b)"},{"value":"0x66c","label":"Chula_Large (0x66c)"},{"value":"0x66d","label":"Chula_Small (0x66d)"},{"value":"0x66e","label":"Corrupted_Tree (0x66e)"},{"value":"0x673","label":"Horse_Clydesdale (0x673)"},{"value":"0x674","label":"Horse_Elemental_Earth (0x674)"},{"value":"0x675","label":"Horse_Elemental_Fire (0x675)"},{"value":"0x678","label":"Horse_Elemental_Water (0x678)"},{"value":"0x679","label":"Horse_Elemental_Air (0x679)"}];

const itemListOptions: PickerOption[] = [{"value":"1","label":"ITEMLIST 1"},{"value":"2","label":"ITEMLIST 2"},{"value":"3","label":"ITEMLIST 3"},{"value":"4","label":"ITEMLIST 4"},{"value":"6","label":"ITEMLIST 6"},{"value":"7","label":"ITEMLIST 7"},{"value":"8","label":"ITEMLIST 8"},{"value":"9","label":"ITEMLIST 9"},{"value":"10","label":"ITEMLIST 10"},{"value":"11","label":"ITEMLIST 11"},{"value":"12","label":"ITEMLIST 12"},{"value":"13","label":"ITEMLIST 13"},{"value":"14","label":"ITEMLIST 14"},{"value":"15","label":"ITEMLIST 15"},{"value":"20","label":"ITEMLIST 20"},{"value":"21","label":"ITEMLIST 21"},{"value":"22","label":"ITEMLIST 22"},{"value":"23","label":"ITEMLIST 23"},{"value":"24","label":"ITEMLIST 24"},{"value":"25","label":"ITEMLIST 25"},{"value":"26","label":"ITEMLIST 26"},{"value":"30","label":"ITEMLIST 30"},{"value":"31","label":"ITEMLIST 31"},{"value":"32","label":"ITEMLIST 32"},{"value":"33","label":"ITEMLIST 33"},{"value":"34","label":"ITEMLIST 34"},{"value":"35","label":"ITEMLIST 35"},{"value":"36","label":"ITEMLIST 36"},{"value":"40","label":"ITEMLIST 40"},{"value":"41","label":"ITEMLIST 41"},{"value":"42","label":"ITEMLIST 42"},{"value":"43","label":"ITEMLIST 43"},{"value":"44","label":"ITEMLIST 44"},{"value":"45","label":"ITEMLIST 45"},{"value":"46","label":"ITEMLIST 46"},{"value":"50","label":"ITEMLIST 50"},{"value":"51","label":"ITEMLIST 51"},{"value":"52","label":"ITEMLIST 52"},{"value":"53","label":"ITEMLIST 53"},{"value":"54","label":"ITEMLIST 54"},{"value":"55","label":"ITEMLIST 55"},{"value":"56","label":"ITEMLIST 56"},{"value":"57","label":"ITEMLIST 57"},{"value":"58","label":"ITEMLIST 58"},{"value":"59","label":"ITEMLIST 59"},{"value":"60","label":"ITEMLIST 60"},{"value":"61","label":"ITEMLIST 61"},{"value":"69","label":"ITEMLIST 69"},{"value":"70","label":"ITEMLIST 70"},{"value":"71","label":"ITEMLIST 71"},{"value":"72","label":"ITEMLIST 72"},{"value":"73","label":"ITEMLIST 73"},{"value":"74","label":"ITEMLIST 74"},{"value":"swampreagents","label":"ITEMLIST swampreagents"},{"value":"100","label":"ITEMLIST 100"},{"value":"120","label":"ITEMLIST 120"},{"value":"130","label":"ITEMLIST 130"},{"value":"131","label":"ITEMLIST 131"},{"value":"132","label":"ITEMLIST 132"},{"value":"133","label":"ITEMLIST 133"},{"value":"134","label":"ITEMLIST 134"},{"value":"150","label":"ITEMLIST 150"},{"value":"200","label":"ITEMLIST 200"},{"value":"205","label":"ITEMLIST 205"},{"value":"151","label":"ITEMLIST 151"},{"value":"210","label":"ITEMLIST 210"},{"value":"dungeontreasureloot1","label":"ITEMLIST dungeontreasureloot1"},{"value":"dungeontreasureloot2","label":"ITEMLIST dungeontreasureloot2"},{"value":"dungeontreasureloot3","label":"ITEMLIST dungeontreasureloot3"},{"value":"dungeontreasureloot4","label":"ITEMLIST dungeontreasureloot4"},{"value":"dungeon_treasure_1-2","label":"ITEMLIST dungeon_treasure_1-2"},{"value":"dungeon_treasure_1-3","label":"ITEMLIST dungeon_treasure_1-3"},{"value":"dungeon_treasure_1-4","label":"ITEMLIST dungeon_treasure_1-4"},{"value":"dungeon_treasure_2-3","label":"ITEMLIST dungeon_treasure_2-3"},{"value":"dungeon_treasure_2-4","label":"ITEMLIST dungeon_treasure_2-4"},{"value":"dungeon_treasure_3-4","label":"ITEMLIST dungeon_treasure_3-4"},{"value":"treasurechestloot0","label":"ITEMLIST treasurechestloot0"},{"value":"treasurechestloot1","label":"ITEMLIST treasurechestloot1"},{"value":"treasurechestloot2","label":"ITEMLIST treasurechestloot2"},{"value":"treasurechestloot3","label":"ITEMLIST treasurechestloot3"},{"value":"treasurechestloot4","label":"ITEMLIST treasurechestloot4"},{"value":"treasurechestloot5","label":"ITEMLIST treasurechestloot5"},{"value":"treasurechestloot6","label":"ITEMLIST treasurechestloot6"},{"value":"randomgranite","label":"ITEMLIST randomgranite"}];

const demoRegions: SpawnRegion[] = [
  {
    id: "spawn_felucca_dungeon_britain_sewers.dfn:3950",
    regionNum: 3950,
    sectionHeader: "REGIONSPAWN 3950",
    name: "Sewers test",
    world: 0,
    instanceID: 0,
    fileName: "spawn_felucca_dungeon_britain_sewers.dfn",
    sourceFilePath: "spawn_felucca_dungeon_britain_sewers.dfn",
    bounds: { x1: 6029, y1: 1427, x2: 6125, y2: 1507 },
    tags: {
      NAME: "Sewers test",
      WORLD: "0",
      X1: "6029",
      Y1: "1427",
      X2: "6125",
      Y2: "1507",
      NPCLIST: "BritainSewers",
      MAXNPCS: "50",
      MINTIME: "10",
      MAXTIME: "20",
      CALL: "5"
    }
  }
];

function cloneRegion(region: SpawnRegion): SpawnRegion {
  return {
    ...region,
    bounds: { ...region.bounds },
    tags: { ...region.tags }
  };
}

function mergeRegionsById(currentRegions: SpawnRegion[], incomingRegions: SpawnRegion[]): SpawnRegion[] {
  const regionMap = new Map<string, SpawnRegion>();

  currentRegions.forEach((region) => {
    regionMap.set(region.id, region);
  });

  incomingRegions.forEach((region) => {
    regionMap.set(region.id, region);
  });

  return Array.from(regionMap.values()).sort((firstRegion, secondRegion) => {
    const fileCompare = firstRegion.sourceFilePath.localeCompare(secondRegion.sourceFilePath);
    if (fileCompare !== 0) {
      return fileCompare;
    }

    return firstRegion.regionNum - secondRegion.regionNum;
  });
}

function matchesSearch(region: SpawnRegion, searchText: string): boolean {
  if (!searchText.trim()) {
    return true;
  }

  const searchLower = searchText.toLowerCase();
  const values = [
    region.sectionHeader,
    region.name,
    region.fileName,
    String(region.world),
    ...Object.entries(region.tags).flatMap(([key, value]) => [key, value])
  ];

  return values.some((value) => value.toLowerCase().includes(searchLower));
}

function matchesFileFilter(region: SpawnRegion, filterId: string): boolean {
  const fileFilter = regionFileFilters.find((entry) => entry.id === filterId);
  if (!fileFilter) {
    return false;
  }

  const fileNameLower = region.fileName.toLowerCase();
  return fileFilter.matchTokens.some((token) => fileNameLower.includes(token));
}

function matchesActiveFileFilters(region: SpawnRegion, activeFileFilters: string[]): boolean {
  if (activeFileFilters.length === 0) {
    return false;
  }

  return activeFileFilters.some((filterId) => matchesFileFilter(region, filterId));
}

function getWorldDefinition(mapWorlds: MapWorldDefinition[], worldId: number): MapWorldDefinition {
  return mapWorlds.find((world) => world.id === worldId) ?? mapWorlds[0] ?? fallbackMapWorlds[0];
}

function normalizeBounds(bounds: RegionBounds): RegionBounds {
  return {
    x1: Math.min(bounds.x1, bounds.x2),
    y1: Math.min(bounds.y1, bounds.y2),
    x2: Math.max(bounds.x1, bounds.x2),
    y2: Math.max(bounds.y1, bounds.y2)
  };
}

function clampBoundsToWorld(bounds: RegionBounds, world: MapWorldDefinition): RegionBounds {
  const normalized = normalizeBounds(bounds);

  return {
    x1: Math.max(0, Math.min(world.width, normalized.x1)),
    y1: Math.max(0, Math.min(world.height, normalized.y1)),
    x2: Math.max(0, Math.min(world.width, normalized.x2)),
    y2: Math.max(0, Math.min(world.height, normalized.y2))
  };
}

function getRegionWidth(bounds: RegionBounds): number {
  const normalized = normalizeBounds(bounds);
  return normalized.x2 - normalized.x1;
}

function getRegionHeight(bounds: RegionBounds): number {
  const normalized = normalizeBounds(bounds);
  return normalized.y2 - normalized.y1;
}

function buildRegionId(sourceFilePath: string, regionNum: number): string {
  return `${sourceFilePath}:${regionNum}`;
}

function matchesActiveSourceFiles(region: SpawnRegion, activeSourceFilePaths: string[]): boolean {
  if (activeSourceFilePaths.length === 0) {
    return false;
  }

  return activeSourceFilePaths.includes(region.sourceFilePath);
}

function getDisplayFileName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/");
  return normalizedPath.split("/").pop() ?? filePath;
}

function worldToScreenX(worldX: number, viewState: ViewState, world: MapWorldDefinition, imageWidth: number): number {
  const scaleX = imageWidth / world.width;
  return worldX * scaleX * viewState.zoom + viewState.offsetX;
}

function worldToScreenY(worldY: number, viewState: ViewState, world: MapWorldDefinition, imageHeight: number): number {
  const scaleY = imageHeight / world.height;
  return worldY * scaleY * viewState.zoom + viewState.offsetY;
}

function getRegionScreenRect(
  region: SpawnRegion,
  viewState: ViewState,
  world: MapWorldDefinition,
  imageWidth: number,
  imageHeight: number
) {
  const bounds = normalizeBounds(region.bounds);
  const left = worldToScreenX(bounds.x1, viewState, world, imageWidth);
  const top = worldToScreenY(bounds.y1, viewState, world, imageHeight);
  const right = worldToScreenX(bounds.x2, viewState, world, imageWidth);
  const bottom = worldToScreenY(bounds.y2, viewState, world, imageHeight);

  return {
    left,
    top,
    width: Math.max(2, right - left),
    height: Math.max(2, bottom - top)
  };
}

function rectIntersectsViewport(
  rect: { left: number; top: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number
): boolean {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  return !(
    right < 0 ||
    bottom < 0 ||
    rect.left > viewportWidth ||
    rect.top > viewportHeight
  );
}

function rectIntersectsRect(
  first: { left: number; top: number; width: number; height: number },
  second: { left: number; top: number; width: number; height: number }
): boolean {
  const firstRight = first.left + first.width;
  const firstBottom = first.top + first.height;
  const secondRight = second.left + second.width;
  const secondBottom = second.top + second.height;

  return !(
    firstRight < second.left ||
    firstBottom < second.top ||
    first.left > secondRight ||
    first.top > secondBottom
  );
}

function getSpawnEntryType(region: SpawnRegion | null): "NPCLIST" | "NPC" | "ITEMLIST" | "ITEM" {
  if (!region) {
    return "NPCLIST";
  }

  if ((region.tags.NPC ?? "").trim().length > 0) {
    return "NPC";
  }

  if ((region.tags.ITEMLIST ?? "").trim().length > 0) {
    return "ITEMLIST";
  }

  if ((region.tags.ITEM ?? "").trim().length > 0) {
    return "ITEM";
  }

  return "NPCLIST";
}
export default function App() {
  const mapSurfaceRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredStateRef = useRef(false);
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const lastAutoCenteredSelectionKeyRef = useRef<string>("");
  const skipNextAutoCenterRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartTimeRef = useRef(0);
  const animationDurationRef = useRef(220);
  const animationStartViewRef = useRef<ViewState>(defaultViewState);
  const animationTargetViewRef = useRef<ViewState>(defaultViewState);

  const [regions, setRegions] = useState<SpawnRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusMessage, setStatusMessage] = useState("Loading spawn data from server...");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeWorldId, setActiveWorldId] = useState(0);
  const [viewState, setViewState] = useState<ViewState>(defaultViewState);
  const [dragState, setDragState] = useState<DragState>({
    mode: "none",
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  });
  const [loadedMapImageSizes, setLoadedMapImageSizes] = useState<Record<number, { width: number; height: number }>>({});
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const [mapWorlds, setMapWorlds] = useState<MapWorldDefinition[]>(fallbackMapWorlds);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });
  const [showRegionLabels, setShowRegionLabels] = useState(true);
  const [activeFileFilters, setActiveFileFilters] = useState<string[]>(defaultActiveFileFilters);
  const [showNewRegionChooser, setShowNewRegionChooser] = useState(false);
  const [newRegionTargetSourceFilePath, setNewRegionTargetSourceFilePath] = useState("");
  const [activeSourceFilePaths, setActiveSourceFilePaths] = useState<string[]>([]);
  const [focusedRegionId, setFocusedRegionId] = useState<string | null>(null);
  const [editedSourceFilePaths, setEditedSourceFilePaths] = useState<string[]>([]);
  const [loadedWorldIds, setLoadedWorldIds] = useState<number[]>([]);
  const [loadedSourceFilePaths, setLoadedSourceFilePaths] = useState<string[]>([]);
  const [filterSourceFilePath, setFilterSourceFilePath] = useState("");
  const [filterRegionId, setFilterRegionId] = useState("");

  const selectedRegion = useMemo(() => {
    return regions.find((region) => region.id === selectedRegionId) ?? null;
  }, [regions, selectedRegionId]);

  const selectedRegionWidth = useMemo(() => {
    return selectedRegion ? getRegionWidth(selectedRegion.bounds) : 0;
  }, [selectedRegion]);

  const selectedRegionHeight = useMemo(() => {
    return selectedRegion ? getRegionHeight(selectedRegion.bounds) : 0;
  }, [selectedRegion]);

  const activeWorld = useMemo(() => getWorldDefinition(mapWorlds, activeWorldId), [mapWorlds, activeWorldId]);

  const availableSourceFiles = useMemo(() => {
    const combinedFiles = [
      ...sourceFiles,
      ...regions.map((region) => region.sourceFilePath)
    ].filter((filePath) => filePath && filePath.trim().length > 0);

    return Array.from(new Set(combinedFiles)).sort((firstValue, secondValue) => firstValue.localeCompare(secondValue));
  }, [sourceFiles, regions]);

const regionsForSelectedSourceFile = useMemo(() => {
  if (!filterSourceFilePath) {
    return [];
  }

  return regions
    .filter((region) => region.sourceFilePath === filterSourceFilePath)
    .slice()
    .sort((firstRegion, secondRegion) => firstRegion.regionNum - secondRegion.regionNum);
}, [regions, filterSourceFilePath]);

  const npcListTagOptions = useMemo(() => {
    return Array.from(new Set(
      regions
        .map((region) => (region.tags.NPCLIST ?? '').trim())
        .filter((value) => value.length > 0)
    ))
      .sort((firstValue, secondValue) => firstValue.localeCompare(secondValue))
      .map((value) => ({ value, label: value }));
  }, [regions]);

  const itemTagOptions = useMemo(() => {
    return Array.from(new Set(
      regions
        .map((region) => (region.tags.ITEM ?? '').trim())
        .filter((value) => value.length > 0)
    ))
      .sort((firstValue, secondValue) => firstValue.localeCompare(secondValue))
      .map((value) => ({ value, label: value }));
  }, [regions]);

  const searchFilteredRegions = useMemo(() => {
    return regions.filter((region) => matchesSearch(region, searchText));
  }, [regions, searchText]);

const filteredRegions = useMemo(() => {
  return searchFilteredRegions.filter((region) => {
    return (
      matchesActiveFileFilters(region, activeFileFilters) &&
      matchesActiveSourceFiles(region, activeSourceFilePaths) &&
      (!focusedRegionId || region.id === focusedRegionId)
    );
  });
}, [searchFilteredRegions, activeFileFilters, activeSourceFilePaths, focusedRegionId]);

  const dirtySourceFilePaths = useMemo(() => {
    return Array.from(new Set(editedSourceFilePaths.filter((sourceFilePath) => !!sourceFilePath)));
  }, [editedSourceFilePaths]);

  const dirtyFileNames = useMemo(() => {
    return Array.from(new Set(dirtySourceFilePaths.map((sourceFilePath) => getDisplayFileName(sourceFilePath))));
  }, [dirtySourceFilePaths]);

  const visibleRegions = useMemo(() => {
    return filteredRegions.filter((region) => region.world === activeWorldId);
  }, [filteredRegions, activeWorldId]);

  useEffect(() => {
    if (!hasRestoredStateRef.current || isBusy) {
      return;
    }

    setStatusMessage(
      `Loaded ${visibleRegions.length} region(s) for world ${activeWorldId} from ${sourceFiles.length} total file(s).`
    );
  }, [activeWorldId, visibleRegions.length, sourceFiles.length, isBusy]);

  const activeImageSize = useMemo(() => {
    return loadedMapImageSizes[activeWorld.id] ?? { width: activeWorld.width, height: activeWorld.height };
  }, [loadedMapImageSizes, activeWorld]);

  const mapImageScreenRect = useMemo(() => {
    return {
      left: viewState.offsetX,
      top: viewState.offsetY,
      width: activeImageSize.width * viewState.zoom,
      height: activeImageSize.height * viewState.zoom
    };
  }, [viewState, activeImageSize]);

  const renderedMapRegions = useMemo(() => {
    if (mapViewportSize.width <= 0 || mapViewportSize.height <= 0) {
      return [];
    }

    return visibleRegions
      .map((region) => {
        const screenRect = getRegionScreenRect(
          region,
          viewState,
          activeWorld,
          activeImageSize.width,
          activeImageSize.height
        );

        return {
          region,
          screenRect
        };
      })
      .filter(({ region, screenRect }) => {
        const insideViewport = rectIntersectsViewport(
          screenRect,
          mapViewportSize.width,
          mapViewportSize.height
        );

        const insideMapImage = rectIntersectsRect(screenRect, mapImageScreenRect);

        const isSelected = region.id === selectedRegionId;
        const isPanning = dragState.mode === "pan";
        const isLargeEnough =
          screenRect.width >= 6 ||
          screenRect.height >= 6 ||
          (screenRect.width * screenRect.height) >= 36;

        if (isPanning) {
          return false;
        }

        return insideViewport && insideMapImage && (isSelected || isLargeEnough);
      });
  }, [
    visibleRegions,
    viewState,
    activeWorld,
    activeImageSize,
    mapViewportSize,
    mapImageScreenRect,
    selectedRegionId,
    dragState.mode
  ]);

  const shouldShowRegionLabels = showRegionLabels && viewState.zoom >= 0.35 && dragState.mode !== "pan";

  const mapGridStyle = useMemo(() => {
    const gridSize = Math.max(16, 64 * viewState.zoom);
    return {
      backgroundSize: `${gridSize}px ${gridSize}px`,
      backgroundPosition: `${viewState.offsetX}px ${viewState.offsetY}px`
    };
  }, [viewState]);

  function easeInOutCubic(progress: number): number {
    return progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  function cancelViewAnimation(): void {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }

  function animateToViewState(targetViewState: ViewState, durationMs = 220): void {
    cancelViewAnimation();

    animationStartTimeRef.current = performance.now();
    animationDurationRef.current = durationMs;
    animationStartViewRef.current = viewState;
    animationTargetViewRef.current = targetViewState;

    const step = (timestamp: number): void => {
      const elapsed = timestamp - animationStartTimeRef.current;
      const progress = Math.max(0, Math.min(1, elapsed / animationDurationRef.current));
      const easedProgress = easeInOutCubic(progress);
      const startViewState = animationStartViewRef.current;
      const target = animationTargetViewRef.current;

      setViewState({
        zoom: startViewState.zoom + ((target.zoom - startViewState.zoom) * easedProgress),
        offsetX: startViewState.offsetX + ((target.offsetX - startViewState.offsetX) * easedProgress),
        offsetY: startViewState.offsetY + ((target.offsetY - startViewState.offsetY) * easedProgress)
      });

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  }

  function getZoomToFitRegion(region: SpawnRegion, paddingPixels = 100, maxPreferredZoom = 3): number {
    const targetWorld = getWorldDefinition(mapWorlds, region.world);
    const targetImageSize = loadedMapImageSizes[targetWorld.id] ?? {
      width: targetWorld.width,
      height: targetWorld.height
    };

    if (mapViewportSize.width <= 0 || mapViewportSize.height <= 0) {
      return viewState.zoom;
    }

    const availableWidth = Math.max(100, mapViewportSize.width - (paddingPixels * 2));
    const availableHeight = Math.max(100, mapViewportSize.height - (paddingPixels * 2));
    const scaleX = targetImageSize.width / targetWorld.width;
    const scaleY = targetImageSize.height / targetWorld.height;
    const regionPixelWidth = Math.max(1, getRegionWidth(region.bounds) * scaleX);
    const regionPixelHeight = Math.max(1, getRegionHeight(region.bounds) * scaleY);
    const fitZoomX = availableWidth / regionPixelWidth;
    const fitZoomY = availableHeight / regionPixelHeight;
    const fitZoom = Math.min(fitZoomX, fitZoomY);

    return Math.max(0.75, Math.min(5, Math.min(maxPreferredZoom, fitZoom)));
  }

  function centerViewOnRegion(region: SpawnRegion, requestedZoom?: number, smoothAnimation = true): void {
    const targetWorld = getWorldDefinition(mapWorlds, region.world);
    const targetImageSize = loadedMapImageSizes[targetWorld.id] ?? {
      width: targetWorld.width,
      height: targetWorld.height
    };

    if (mapViewportSize.width <= 0 || mapViewportSize.height <= 0) {
      return;
    }

    const bounds = normalizeBounds(region.bounds);
    const regionCenterX = (bounds.x1 + bounds.x2) / 2;
    const regionCenterY = (bounds.y1 + bounds.y2) / 2;

    const nextZoom = requestedZoom ?? viewState.zoom;
    const scaleX = targetImageSize.width / targetWorld.width;
    const scaleY = targetImageSize.height / targetWorld.height;

    const targetViewState: ViewState = {
      zoom: nextZoom,
      offsetX: (mapViewportSize.width / 2) - (regionCenterX * scaleX * nextZoom),
      offsetY: (mapViewportSize.height / 2) - (regionCenterY * scaleY * nextZoom)
    };

    if (smoothAnimation) {
      animateToViewState(targetViewState);
    } else {
      cancelViewAnimation();
      setViewState(targetViewState);
    }
  }

function centerSelectedRegion(optionalZoom?: number): void {
  if (!selectedRegion) {
    return;
  }

  centerViewOnRegion(selectedRegion, optionalZoom);
}

  function createHistorySnapshot(): HistorySnapshot {
    return {
      regions: regions.map((region) => cloneRegion(region)),
      selectedRegionId,
      activeWorldId,
      activeSourceFilePaths: [...activeSourceFilePaths],
      focusedRegionId,
      editedSourceFilePaths: [...editedSourceFilePaths],
      filterSourceFilePath,
      filterRegionId
    };
  }

  function restoreHistorySnapshot(snapshot: HistorySnapshot): void {
    setRegions(snapshot.regions.map((region) => cloneRegion(region)));
    setSelectedRegionId(snapshot.selectedRegionId);
    setActiveWorldId(snapshot.activeWorldId);
    setActiveSourceFilePaths([...snapshot.activeSourceFilePaths]);
    setFocusedRegionId(snapshot.focusedRegionId);
    setEditedSourceFilePaths([...snapshot.editedSourceFilePaths]);
    setFilterSourceFilePath(snapshot.filterSourceFilePath);
    setFilterRegionId(snapshot.filterRegionId);
  }

  function pushUndoSnapshot(): void {
    const snapshot = createHistorySnapshot();
    undoStackRef.current.push(snapshot);

    if (undoStackRef.current.length > maxHistoryEntries) {
      undoStackRef.current.shift();
    }

    redoStackRef.current = [];
  }

  function handleUndo(): void {
    if (undoStackRef.current.length === 0) {
      setStatusMessage("Nothing to undo.");
      return;
    }

    const currentSnapshot = createHistorySnapshot();
    const previousSnapshot = undoStackRef.current.pop();

    if (!previousSnapshot) {
      setStatusMessage("Nothing to undo.");
      return;
    }

    redoStackRef.current.push(currentSnapshot);
    restoreHistorySnapshot(previousSnapshot);
    setStatusMessage("Undo complete.");
  }

  function handleRedo(): void {
    if (redoStackRef.current.length === 0) {
      setStatusMessage("Nothing to redo.");
      return;
    }

    const currentSnapshot = createHistorySnapshot();
    const nextSnapshot = redoStackRef.current.pop();

    if (!nextSnapshot) {
      setStatusMessage("Nothing to redo.");
      return;
    }

    undoStackRef.current.push(currentSnapshot);
    restoreHistorySnapshot(nextSnapshot);
    setStatusMessage("Redo complete.");
  }

  function markSourceFilePathEdited(sourceFilePath: string): void {
    if (!sourceFilePath) {
      return;
    }

    setEditedSourceFilePaths((currentSourceFilePaths) => {
      if (currentSourceFilePaths.includes(sourceFilePath)) {
        return currentSourceFilePaths;
      }

      return [...currentSourceFilePaths, sourceFilePath];
    });
  }

  function updateRegion(updater: (region: SpawnRegion) => SpawnRegion): void {
    if (!selectedRegionId) {
      return;
    }

    pushUndoSnapshot();

    setRegions((currentRegions) =>
      currentRegions.map((region) => {
        if (region.id !== selectedRegionId) {
          return region;
        }

        const updatedRegion = updater(cloneRegion(region));
        markSourceFilePathEdited(updatedRegion.sourceFilePath);
        return updatedRegion;
      })
    );
  }

  function replaceRegionById(regionId: string, updater: (region: SpawnRegion) => SpawnRegion): void {
    setRegions((currentRegions) =>
      currentRegions.map((region) => {
        if (region.id !== regionId) {
          return region;
        }

        const updatedRegion = updater(cloneRegion(region));
        markSourceFilePathEdited(updatedRegion.sourceFilePath);
        return updatedRegion;
      })
    );
  }

  function applyBoundsToRegion(region: SpawnRegion, nextBounds: RegionBounds): SpawnRegion {
    const world = getWorldDefinition(mapWorlds, region.world);
    const clampedBounds = clampBoundsToWorld(nextBounds, world);
    region.bounds = clampedBounds;
    region.tags.X1 = String(clampedBounds.x1);
    region.tags.Y1 = String(clampedBounds.y1);
    region.tags.X2 = String(clampedBounds.x2);
    region.tags.Y2 = String(clampedBounds.y2);
    return region;
  }

  function updateSelectedTag(tagName: string, tagValue: string): void {
    updateRegion((region) => {
      region.tags[tagName] = tagValue;

      if (tagName === "NAME") {
        region.name = tagValue;
      } else if (tagName === "WORLD") {
        const parsedWorld = Number(tagValue);
        if (!Number.isNaN(parsedWorld)) {
          region.world = parsedWorld;
          if (region.id === selectedRegionId) {
            setActiveWorldId(parsedWorld);
          }
        }
      } else if (tagName === "X1") {
        return applyBoundsToRegion(region, { ...region.bounds, x1: Number(tagValue) || 0 });
      } else if (tagName === "Y1") {
        return applyBoundsToRegion(region, { ...region.bounds, y1: Number(tagValue) || 0 });
      } else if (tagName === "X2") {
        return applyBoundsToRegion(region, { ...region.bounds, x2: Number(tagValue) || 0 });
      } else if (tagName === "Y2") {
        return applyBoundsToRegion(region, { ...region.bounds, y2: Number(tagValue) || 0 });
      }

      return region;
    });
  }

  function updateSelectedRegionWidth(widthText: string): void {
    const parsedWidth = Number(widthText);
    if (Number.isNaN(parsedWidth)) {
      return;
    }

    updateRegion((region) => {
      const normalized = normalizeBounds(region.bounds);
      const nextWidth = Math.max(1, Math.round(parsedWidth));
      return applyBoundsToRegion(region, {
        x1: normalized.x1,
        y1: normalized.y1,
        x2: normalized.x1 + nextWidth,
        y2: normalized.y2
      });
    });
  }

  function updateSelectedRegionHeight(heightText: string): void {
    const parsedHeight = Number(heightText);
    if (Number.isNaN(parsedHeight)) {
      return;
    }

    updateRegion((region) => {
      const normalized = normalizeBounds(region.bounds);
      const nextHeight = Math.max(1, Math.round(parsedHeight));
      return applyBoundsToRegion(region, {
        x1: normalized.x1,
        y1: normalized.y1,
        x2: normalized.x2,
        y2: normalized.y1 + nextHeight
      });
    });
  }

  function handleStartCreateRegion(): void {
    const defaultSourceFilePath = selectedRegion?.sourceFilePath ?? availableSourceFiles[0] ?? "";
    setNewRegionTargetSourceFilePath(defaultSourceFilePath);
    setShowNewRegionChooser(true);
  }

  function handleCancelCreateRegion(): void {
    setShowNewRegionChooser(false);
  }

  function handleCreateNewRegion(): void {
    const targetSourceFilePath = newRegionTargetSourceFilePath.trim();
    if (!targetSourceFilePath) {
      setErrorMessage("Select a DFN file for the new region.");
      return;
    }

    pushUndoSnapshot();

    const siblingRegions = regions.filter((region) => region.sourceFilePath === targetSourceFilePath);
    const nextRegionNum = siblingRegions.reduce((highestRegionNum, region) => {
      return Math.max(highestRegionNum, region.regionNum);
    }, 0) + 1;

    const baseRegion = selectedRegion ?? regions.find((region) => region.world === activeWorldId) ?? regions[0] ?? null;
    const targetWorldId = baseRegion ? baseRegion.world : activeWorldId;
    const targetWorld = getWorldDefinition(mapWorlds, targetWorldId);
    const baseBounds = baseRegion
      ? normalizeBounds(baseRegion.bounds)
      : { x1: 100, y1: 100, x2: 140, y2: 140 };

    const nextBounds = clampBoundsToWorld({
      x1: baseBounds.x1 + 8,
      y1: baseBounds.y1 + 8,
      x2: baseBounds.x2 + 8,
      y2: baseBounds.y2 + 8
    }, targetWorld);

    const targetFileName = getDisplayFileName(targetSourceFilePath);
    const nextRegionName = `New Region ${nextRegionNum}`;
    const baseTags = baseRegion ? { ...baseRegion.tags } : {};

    const createdRegion: SpawnRegion = {
      id: buildRegionId(targetSourceFilePath, nextRegionNum),
      regionNum: nextRegionNum,
      sectionHeader: `REGIONSPAWN ${nextRegionNum}`,
      name: nextRegionName,
      world: targetWorldId,
      instanceID: baseRegion?.instanceID ?? 0,
      fileName: targetFileName,
      sourceFilePath: targetSourceFilePath,
      bounds: nextBounds,
      tags: {
        ...baseTags,
        NAME: nextRegionName,
        WORLD: String(targetWorldId),
        X1: String(nextBounds.x1),
        Y1: String(nextBounds.y1),
        X2: String(nextBounds.x2),
        Y2: String(nextBounds.y2),
        NPCLIST: ""
      }
    };

    markSourceFilePathEdited(targetSourceFilePath);

    if (selectedRegion) {
      markSourceFilePathEdited(selectedRegion.sourceFilePath);
    }

    setRegions((currentRegions) => {
      const insertAfterRegion = selectedRegion && selectedRegion.sourceFilePath === targetSourceFilePath
        ? selectedRegion
        : currentRegions.filter((region) => region.sourceFilePath === targetSourceFilePath).slice(-1)[0] ?? null;

      if (!insertAfterRegion) {
        return [...currentRegions, createdRegion];
      }

      const insertAtIndex = currentRegions.findIndex((region) => region.id === insertAfterRegion.id);
      if (insertAtIndex < 0) {
        return [...currentRegions, createdRegion];
      }

      const nextRegions = [...currentRegions];
      nextRegions.splice(insertAtIndex + 1, 0, createdRegion);
      return nextRegions;
    });

    setActiveSourceFilePaths((currentSourceFilePaths) => {
      if (currentSourceFilePaths.includes(targetSourceFilePath)) {
        return currentSourceFilePaths;
      }

      return [...currentSourceFilePaths, targetSourceFilePath];
    });
    setSelectedRegionId(createdRegion.id);
    setActiveWorldId(createdRegion.world);
    setShowNewRegionChooser(false);
    setErrorMessage("");
    setStatusMessage(`Created region ${createdRegion.regionNum} in ${createdRegion.fileName}.`);
  }

  function handleCloneSelectedRegion(): void {
    if (!selectedRegion) {
      return;
    }

    pushUndoSnapshot();

    const siblingRegions = regions.filter((region) => region.sourceFilePath === selectedRegion.sourceFilePath);
    const nextRegionNum = siblingRegions.reduce((highestRegionNum, region) => {
      return Math.max(highestRegionNum, region.regionNum);
    }, 0) + 1;

    const nextBounds = clampBoundsToWorld({
      x1: selectedRegion.bounds.x1 + 5,
      y1: selectedRegion.bounds.y1 + 5,
      x2: selectedRegion.bounds.x2 + 5,
      y2: selectedRegion.bounds.y2 + 5
    }, getWorldDefinition(mapWorlds, selectedRegion.world));

    const clonedRegion: SpawnRegion = {
      ...cloneRegion(selectedRegion),
      id: buildRegionId(selectedRegion.sourceFilePath, nextRegionNum),
      regionNum: nextRegionNum,
      sectionHeader: `REGIONSPAWN ${nextRegionNum}`,
      name: selectedRegion.name ? `${selectedRegion.name} Copy` : `Region ${nextRegionNum}`,
      bounds: nextBounds,
      tags: {
        ...selectedRegion.tags,
        NAME: selectedRegion.name ? `${selectedRegion.name} Copy` : `Region ${nextRegionNum}`,
        X1: String(nextBounds.x1),
        Y1: String(nextBounds.y1),
        X2: String(nextBounds.x2),
        Y2: String(nextBounds.y2)
      }
    };

    setRegions((currentRegions) => {
      const insertAtIndex = currentRegions.findIndex((region) => region.id === selectedRegion.id);
      if (insertAtIndex < 0) {
        return [...currentRegions, clonedRegion];
      }

      const nextRegions = [...currentRegions];
      nextRegions.splice(insertAtIndex + 1, 0, clonedRegion);
      return nextRegions;
    });
    setSelectedRegionId(clonedRegion.id);
    setActiveWorldId(clonedRegion.world);
    setStatusMessage(`Cloned region ${selectedRegion.regionNum} to ${clonedRegion.regionNum}.`);
  }

  function handleDeleteSelectedRegion(): void {
    if (!selectedRegionId) {
      return;
    }

    const deleteIndex = regions.findIndex((region) => region.id === selectedRegionId);
    if (deleteIndex < 0) {
      return;
    }

    pushUndoSnapshot();

    const deletedRegion = regions[deleteIndex];
    const nextSelectedRegion = regions[deleteIndex + 1] ?? regions[deleteIndex - 1] ?? null;

    markSourceFilePathEdited(deletedRegion.sourceFilePath);
    setRegions((currentRegions) => currentRegions.filter((region) => region.id !== selectedRegionId));
    setSelectedRegionId(nextSelectedRegion ? nextSelectedRegion.id : null);
    setStatusMessage(`Deleted region ${deletedRegion.regionNum}.`);
  }

function handleToggleFileFilter(filterId: string): void {
    setActiveSourceFilePaths(availableSourceFiles);

    setActiveFileFilters((currentFilters) => {
      if (currentFilters.includes(filterId)) {
        return currentFilters.filter((entry) => entry !== filterId);
      }

      return [...currentFilters, filterId];
    });

    setStatusMessage("Updated file filters.");
  }

  async function handleShowAllFileFilters(): Promise<void> {
    if (!loadedWorldIds.includes(activeWorldId)) {
      await loadRegionsFromServer({ worldId: activeWorldId });
    }

    setFocusedRegionId(null);
    setActiveFileFilters(defaultActiveFileFilters);
    setActiveSourceFilePaths(availableSourceFiles);
    setStatusMessage("Showing all regions.");
  }

  function handleHideAllFileFilters(): void {
    setFocusedRegionId(null);
    setActiveFileFilters([]);
    setActiveSourceFilePaths(availableSourceFiles);
    setStatusMessage("All category filters hidden.");
  }

  async function handleShowSelectedSourceFile(): Promise<void> {
    if (!filterSourceFilePath) {
      return;
    }

    let fileRegion = regions.find((region) => region.sourceFilePath === filterSourceFilePath);

    if (!fileRegion) {
      const loadedRegions = await loadRegionsFromServer({ sourceFilePath: filterSourceFilePath });
      fileRegion = loadedRegions.find((region) => region.sourceFilePath === filterSourceFilePath) ?? null;
    }

    setFocusedRegionId(null);
    setActiveSourceFilePaths([filterSourceFilePath]);

    if (fileRegion) {
      const matchingFilterIds = regionFileFilters
        .filter((filter) => matchesFileFilter(fileRegion!, filter.id))
        .map((filter) => filter.id);

      if (matchingFilterIds.length > 0) {
        setActiveFileFilters(matchingFilterIds);
      }

      setActiveWorldId(fileRegion.world);
      setSelectedRegionId(fileRegion.id);
      centerViewOnRegion(fileRegion, getZoomToFitRegion(fileRegion, 120, 2));
    }

    setStatusMessage(`Showing only file ${getDisplayFileName(filterSourceFilePath)}.`);
  }

  function handleHideSelectedSourceFile(): void {
    if (!filterSourceFilePath) {
      return;
    }

    if (focusedRegionId) {
      const focusedRegion = regions.find((region) => region.id === focusedRegionId);
      if (focusedRegion && focusedRegion.sourceFilePath === filterSourceFilePath) {
        setFocusedRegionId(null);
      }
    }

    setActiveSourceFilePaths((currentSourceFilePaths) =>
      currentSourceFilePaths.filter((entry) => entry !== filterSourceFilePath)
    );

    setStatusMessage(`Hid file ${getDisplayFileName(filterSourceFilePath)}.`);
  }

  async function handleShowSelectedRegion(): Promise<void> {
    if (!filterRegionId) {
      return;
    }

    let targetRegion = regions.find((region) => region.id === filterRegionId) ?? null;

    if (!targetRegion && filterSourceFilePath) {
      const loadedRegions = await loadRegionsFromServer({ sourceFilePath: filterSourceFilePath });
      targetRegion = loadedRegions.find((region) => region.id === filterRegionId) ?? null;
    }

    if (!targetRegion) {
      return;
    }

    const matchingFilterIds = regionFileFilters
      .filter((filter) => matchesFileFilter(targetRegion!, filter.id))
      .map((filter) => filter.id);

    setActiveSourceFilePaths([targetRegion.sourceFilePath]);

    if (matchingFilterIds.length > 0) {
      setActiveFileFilters(matchingFilterIds);
    }

    setFocusedRegionId(targetRegion.id);
    setSelectedRegionId(targetRegion.id);
    setActiveWorldId(targetRegion.world);
    centerViewOnRegion(targetRegion, getZoomToFitRegion(targetRegion, 100, 3));

    setStatusMessage(`Showing only region ${targetRegion.regionNum}.`);
  }

  function handleHideSelectedRegion(): void {
    if (!filterRegionId) {
      return;
    }

    const targetRegion = regions.find((region) => region.id === filterRegionId);
    if (!targetRegion) {
      return;
    }

    if (focusedRegionId === filterRegionId) {
      setFocusedRegionId(null);
    }

    setActiveSourceFilePaths((currentSourceFilePaths) =>
      currentSourceFilePaths.filter((entry) => entry !== targetRegion.sourceFilePath)
    );

    if (selectedRegionId === filterRegionId) {
      setSelectedRegionId(null);
    }

    setStatusMessage("Region hidden.");
  }

  async function loadRegionsFromServer(options: { worldId?: number; sourceFilePath?: string; replaceAll?: boolean }): Promise<SpawnRegion[]> {
    const query = new URLSearchParams();

    if (typeof options.worldId === "number") {
      query.set("world", String(options.worldId));
    }

    if (options.sourceFilePath) {
      query.set("sourceFilePath", options.sourceFilePath);
    }

    const response = await fetch(`/api/spawn/regions?${query.toString()}`, {
      method: "GET"
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to load regions from server.");
    }

    const result: RegionsResponse = await response.json();
    const incomingRegions = result.regions ?? [];

    setRegions((currentRegions) => {
      if (options.replaceAll) {
        return incomingRegions;
      }

      return mergeRegionsById(currentRegions, incomingRegions);
    });

    if (typeof options.worldId === "number") {
      setLoadedWorldIds((currentWorldIds) => currentWorldIds.includes(options.worldId!) ? currentWorldIds : [...currentWorldIds, options.worldId!]);
    }

    if (options.sourceFilePath) {
      setLoadedSourceFilePaths((currentSourceFilePaths) =>
        currentSourceFilePaths.includes(options.sourceFilePath!)
          ? currentSourceFilePaths
          : [...currentSourceFilePaths, options.sourceFilePath!]
      );
    }

    return incomingRegions;
  }

  async function loadServerData(preferredWorldId?: number): Promise<void> {
    setIsBusy(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/spawn/bootstrap", {
        method: "GET"
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to load spawn data from server.");
      }

      const result: BootstrapResponse = await response.json();
      const nextMapWorlds = result.maps.length > 0 ? result.maps : fallbackMapWorlds;
      const nextSourceFiles = Array.from(new Set(result.sourceFiles ?? []));

      const savedActiveSourceFilePathsText = localStorage.getItem(storageKeys.activeSourceFilePaths);
      const savedFocusedRegionIdText = localStorage.getItem(storageKeys.focusedRegionId);
      const savedEditedSourceFilePathsText = localStorage.getItem(storageKeys.editedSourceFilePaths);

      let restoredActiveSourceFilePaths: string[] = [];
      let restoredFocusedRegionId: string | null = null;
      let restoredEditedSourceFilePaths: string[] = [];

      if (savedActiveSourceFilePathsText) {
        const parsedSourceFilePaths = JSON.parse(savedActiveSourceFilePathsText) as string[];
        const validSourceFilePaths = parsedSourceFilePaths.filter((filePath) => nextSourceFiles.includes(filePath));
        restoredActiveSourceFilePaths = validSourceFilePaths;
      }

      if (savedFocusedRegionIdText) {
        restoredFocusedRegionId = savedFocusedRegionIdText;
      }

      if (savedEditedSourceFilePathsText) {
        const parsedEditedSourceFilePaths = JSON.parse(savedEditedSourceFilePathsText) as string[];
        restoredEditedSourceFilePaths = parsedEditedSourceFilePaths.filter((filePath) => nextSourceFiles.includes(filePath));
      }

      const nextWorldId = typeof preferredWorldId === "number" ? preferredWorldId : activeWorldId;

      setMapWorlds(nextMapWorlds);
      setRegions([]);
      setSourceFiles(nextSourceFiles);
      setActiveSourceFilePaths(restoredActiveSourceFilePaths);
      setFocusedRegionId(restoredFocusedRegionId);
      setEditedSourceFilePaths(restoredEditedSourceFilePaths);
      setLoadedWorldIds([]);
      setLoadedSourceFilePaths([]);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setFilterSourceFilePath(restoredActiveSourceFilePaths[0] ?? nextSourceFiles[0] ?? "");
      setFilterRegionId("");
      setSelectedRegionId(null);
      setActiveWorldId(nextWorldId);

      const loadedRegions = await loadRegionsFromServer({ worldId: nextWorldId, replaceAll: true });
      const selectedRegionFromFocusedId = restoredFocusedRegionId
        ? loadedRegions.find((region) => region.id === restoredFocusedRegionId) ?? null
        : null;
      const selectedRegionFromStorage = localStorage.getItem(storageKeys.selectedRegionId);

	  	const shouldSkipAutoCenter = sessionStorage.getItem("uox3.skipNextAutoCenter") === "true";

	if (shouldSkipAutoCenter) {
		skipNextAutoCenterRef.current = true;
		sessionStorage.removeItem("uox3.skipNextAutoCenter");
      cancelViewAnimation();
      setViewState(defaultViewState);
	}

const nextSelectedRegionId =
  selectedRegionFromStorage && loadedRegions.some((region) => region.id === selectedRegionFromStorage)
    ? selectedRegionFromStorage
    : selectedRegionFromFocusedId?.id ?? (shouldSkipAutoCenter ? null : loadedRegions[0]?.id ?? null);

      setSelectedRegionId(nextSelectedRegionId);
      setStatusMessage(`Loaded ${loadedRegions.length} region(s) for world ${nextWorldId} from ${nextSourceFiles.length} file(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown server load error.";
      setMapWorlds(fallbackMapWorlds);
      setRegions(demoRegions);
      setSourceFiles([]);
      setActiveSourceFilePaths([]);
      setFocusedRegionId(null);
      setEditedSourceFilePaths([]);
      setLoadedWorldIds([]);
      setLoadedSourceFilePaths([]);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setFilterSourceFilePath("");
      setFilterRegionId("");
      setSelectedRegionId(demoRegions[0]?.id ?? null);
      setErrorMessage(message);
      setStatusMessage("Server load failed. Demo data was restored.");
    } finally {
      setIsBusy(false);
      hasRestoredStateRef.current = true;
    }
  }

  async function handleSave(): Promise<void> {
    setIsBusy(true);
    setErrorMessage("");

    try {
      if (dirtySourceFilePaths.length === 0) {
        setStatusMessage("No edited files to save.");
        return;
      }

      const dirtyRegions = regions.filter((region) => dirtySourceFilePaths.includes(region.sourceFilePath));

      const response = await fetch("/api/spawn/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceFilePaths: dirtySourceFilePaths,
          regions: dirtyRegions
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to save updated spawn files.");
      }

      const result: SaveResponse = await response.json();
      const changedFiles = result.files.filter((file) => dirtyFileNames.includes(file.fileName));

      const savedFileNames = changedFiles.map((file) => file.fileName);
      setEditedSourceFilePaths((currentSourceFilePaths) => currentSourceFilePaths.filter((sourceFilePath) => !savedFileNames.includes(getDisplayFileName(sourceFilePath))));
      setStatusMessage(`Saved ${changedFiles.length} edited file(s) to the server.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown save error.";
      setErrorMessage(message);
      setStatusMessage("Save failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReloadFromServer(): Promise<void> {
    await loadServerData(activeWorldId);
  }

  function handleMapMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    cancelViewAnimation();

    setDragState({
      mode: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewState.offsetX,
      startOffsetY: viewState.offsetY
    });
  }

  function handleRegionMouseDown(event: React.MouseEvent<HTMLDivElement>, region: SpawnRegion): void {
    event.stopPropagation();
    cancelViewAnimation();
    pushUndoSnapshot();
    skipNextAutoCenterRef.current = true;
    setSelectedRegionId(region.id);

    setDragState({
      mode: "move-region",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewState.offsetX,
      startOffsetY: viewState.offsetY,
      startBounds: { ...region.bounds }
    });
  }

  function handleResizeHandleMouseDown(
    event: React.MouseEvent<HTMLDivElement>,
    region: SpawnRegion,
    resizeHandle: ResizeHandle
  ): void {
    event.stopPropagation();
    event.preventDefault();
    cancelViewAnimation();
    pushUndoSnapshot();
    skipNextAutoCenterRef.current = true;
    setSelectedRegionId(region.id);

    setDragState({
      mode: "resize-region",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: viewState.offsetX,
      startOffsetY: viewState.offsetY,
      startBounds: { ...region.bounds },
      resizeHandle
    });
  }

  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent): void {
      if (dragState.mode === "none") {
        return;
      }

      if (dragState.mode === "pan") {
        const deltaX = event.clientX - dragState.startClientX;
        const deltaY = event.clientY - dragState.startClientY;

        setViewState((currentViewState) => ({
          ...currentViewState,
          offsetX: dragState.startOffsetX + deltaX,
          offsetY: dragState.startOffsetY + deltaY
        }));
        return;
      }

      if ((dragState.mode === "move-region" || dragState.mode === "resize-region") && selectedRegionId && dragState.startBounds) {
        const scaleX = activeImageSize.width / activeWorld.width;
        const scaleY = activeImageSize.height / activeWorld.height;
        const deltaWorldX = Math.round((event.clientX - dragState.startClientX) / (viewState.zoom * scaleX));
        const deltaWorldY = Math.round((event.clientY - dragState.startClientY) / (viewState.zoom * scaleY));

        if (dragState.mode === "move-region") {
          replaceRegionById(selectedRegionId, (region) => {
            return applyBoundsToRegion(region, {
              x1: dragState.startBounds!.x1 + deltaWorldX,
              y1: dragState.startBounds!.y1 + deltaWorldY,
              x2: dragState.startBounds!.x2 + deltaWorldX,
              y2: dragState.startBounds!.y2 + deltaWorldY
            });
          });
          return;
        }

        replaceRegionById(selectedRegionId, (region) => {
          const startBounds = normalizeBounds(dragState.startBounds!);
          const nextBounds = { ...startBounds };

          switch (dragState.resizeHandle) {
            case "nw":
              nextBounds.x1 = startBounds.x1 + deltaWorldX;
              nextBounds.y1 = startBounds.y1 + deltaWorldY;
              break;
            case "ne":
              nextBounds.x2 = startBounds.x2 + deltaWorldX;
              nextBounds.y1 = startBounds.y1 + deltaWorldY;
              break;
            case "sw":
              nextBounds.x1 = startBounds.x1 + deltaWorldX;
              nextBounds.y2 = startBounds.y2 + deltaWorldY;
              break;
            case "se":
            default:
              nextBounds.x2 = startBounds.x2 + deltaWorldX;
              nextBounds.y2 = startBounds.y2 + deltaWorldY;
              break;
          }

          return applyBoundsToRegion(region, nextBounds);
        });
      }
    }

    function handleWindowMouseUp(): void {
      setDragState({
        mode: "none",
        startClientX: 0,
        startClientY: 0,
        startOffsetX: 0,
        startOffsetY: 0
      });
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [dragState, selectedRegionId, viewState.zoom, activeWorld, activeImageSize]);

  useEffect(() => {
    if (focusedRegionId) {
      const focusedRegion = regions.find((region) => region.id === focusedRegionId);
      if (focusedRegion && focusedRegion.world !== activeWorldId) {
        setFocusedRegionId(null);
      }
    }

    const selectedRegionInActiveWorld = regions.find(
      (region) => region.id === selectedRegionId && region.world === activeWorldId
    );

    if (selectedRegionId && !selectedRegionInActiveWorld) {
      const firstVisibleRegionInWorld = visibleRegions[0] ?? null;
      setSelectedRegionId(firstVisibleRegionInWorld ? firstVisibleRegionInWorld.id : null);
    }
  }, [activeWorldId, selectedRegionId, focusedRegionId, regions, visibleRegions]);

  useEffect(() => {
    if (regions.length === 0) {
      if (selectedRegionId !== null) {
        setSelectedRegionId(null);
      }
      return;
    }

    if (selectedRegionId === null) {
      return;
    }

    const selectedStillExists = regions.some((region) => region.id === selectedRegionId);
    if (!selectedStillExists) {
      const firstVisibleRegion = visibleRegions[0] ?? null;
      setSelectedRegionId(firstVisibleRegion ? firstVisibleRegion.id : null);
    }
  }, [regions, selectedRegionId, visibleRegions]);

  useEffect(() => {
    if (!selectedRegion || selectedRegion.world !== activeWorldId) {
      lastAutoCenteredSelectionKeyRef.current = "";
      return;
    }

    if (mapViewportSize.width <= 0 || mapViewportSize.height <= 0) {
      return;
    }

    const selectionKey = [
      selectedRegion.id,
      activeWorldId,
      activeImageSize.width,
      activeImageSize.height,
      mapViewportSize.width,
      mapViewportSize.height
    ].join("|");

    if (lastAutoCenteredSelectionKeyRef.current === selectionKey) {
      return;
    }

    lastAutoCenteredSelectionKeyRef.current = selectionKey;

    if (skipNextAutoCenterRef.current) {
      skipNextAutoCenterRef.current = false;
      return;
    }

    centerSelectedRegion();
  }, [
    selectedRegion,
    activeWorldId,
    activeImageSize.width,
    activeImageSize.height,
    mapViewportSize.width,
    mapViewportSize.height
  ]);

  useEffect(() => {
    if (!filterSourceFilePath && availableSourceFiles.length > 0) {
      setFilterSourceFilePath(availableSourceFiles[0]);
    } else if (filterSourceFilePath && !availableSourceFiles.includes(filterSourceFilePath)) {
      setFilterSourceFilePath(availableSourceFiles[0] ?? "");
    }
  }, [availableSourceFiles, filterSourceFilePath]);

  useEffect(() => {
    if (!filterRegionId) {
      return;
    }

    const selectedStillExists = regionsForSelectedSourceFile.some((region) => region.id === filterRegionId);
    if (!selectedStillExists) {
      setFilterRegionId("");
    }
  }, [regionsForSelectedSourceFile, filterRegionId]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    if (!loadedWorldIds.includes(activeWorldId)) {
      void loadRegionsFromServer({ worldId: activeWorldId });
    }
  }, [activeWorldId, loadedWorldIds]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    if (filterSourceFilePath && !loadedSourceFilePaths.includes(filterSourceFilePath)) {
      void loadRegionsFromServer({ sourceFilePath: filterSourceFilePath });
    }
  }, [filterSourceFilePath, loadedSourceFilePaths]);

  useEffect(() => {
    function updateMapViewportSize(): void {
      if (!mapSurfaceRef.current) {
        return;
      }

      setMapViewportSize({
        width: mapSurfaceRef.current.clientWidth,
        height: mapSurfaceRef.current.clientHeight
      });
    }

    updateMapViewportSize();
    window.addEventListener("resize", updateMapViewportSize);

    return () => {
      window.removeEventListener("resize", updateMapViewportSize);
    };
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("uox3.skipNextAutoCenter") === "true") {
      skipNextAutoCenterRef.current = true;
      sessionStorage.removeItem("uox3.skipNextAutoCenter");
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelViewAnimation();
    };
  }, []);

  useEffect(() => {
    try {
      const savedActiveWorldIdText = localStorage.getItem(storageKeys.activeWorldId);
      const savedSelectedRegionIdText = localStorage.getItem(storageKeys.selectedRegionId);
      const savedViewStateText = localStorage.getItem(storageKeys.viewState);
      const savedSearchText = localStorage.getItem(storageKeys.searchText);
      const savedShowRegionLabelsText = localStorage.getItem(storageKeys.showRegionLabels);
      const savedActiveFileFiltersText = localStorage.getItem(storageKeys.activeFileFilters);
      const savedFocusedRegionIdText = localStorage.getItem(storageKeys.focusedRegionId);

      let restoredActiveWorldId = 0;
      let restoredSelectedRegionId: string | null = null;
      let restoredViewState: ViewState = defaultViewState;
      let restoredSearchText = "";
      let restoredShowRegionLabels = true;
      let restoredActiveFileFilters: string[] = [];
      let restoredFocusedRegionId: string | null = null;

      if (savedActiveWorldIdText) {
        const parsedWorldId = Number(savedActiveWorldIdText);
        if (!Number.isNaN(parsedWorldId)) {
          restoredActiveWorldId = parsedWorldId;
        }
      }

      if (savedSelectedRegionIdText) {
        restoredSelectedRegionId = savedSelectedRegionIdText;
      }

      if (savedViewStateText) {
        const parsedViewState = JSON.parse(savedViewStateText) as Partial<ViewState>;
        if (
          typeof parsedViewState.zoom === "number" &&
          typeof parsedViewState.offsetX === "number" &&
          typeof parsedViewState.offsetY === "number"
        ) {
          restoredViewState = parsedViewState as ViewState;
        }
      }

      if (savedSearchText) {
        restoredSearchText = savedSearchText;
      }

      if (savedShowRegionLabelsText) {
        restoredShowRegionLabels = savedShowRegionLabelsText === "true";
      }

      if (savedActiveFileFiltersText) {
        const parsedFilters = JSON.parse(savedActiveFileFiltersText) as string[];
        const validFilters = parsedFilters.filter((filterId) => regionFileFilters.some((entry) => entry.id === filterId));
        restoredActiveFileFilters = validFilters;
      }

      if (savedFocusedRegionIdText) {
        restoredFocusedRegionId = savedFocusedRegionIdText;
      }

      setActiveWorldId(restoredActiveWorldId);
      setSelectedRegionId(restoredSelectedRegionId);
      setViewState(restoredViewState);
      setSearchText(restoredSearchText);
      setShowRegionLabels(restoredShowRegionLabels);
      setActiveFileFilters(restoredActiveFileFilters);
      setFocusedRegionId(restoredFocusedRegionId);
    } catch (error) {
      console.error("Restore failed", error);
    }
  }, []);

  useEffect(() => {
    loadServerData(Number(localStorage.getItem(storageKeys.activeWorldId) ?? activeWorldId));
  }, []);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.activeWorldId, String(activeWorldId));
  }, [activeWorldId]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    if (selectedRegionId) {
      localStorage.setItem(storageKeys.selectedRegionId, selectedRegionId);
    } else {
      localStorage.removeItem(storageKeys.selectedRegionId);
    }
  }, [selectedRegionId]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.viewState, JSON.stringify(viewState));
  }, [viewState]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.searchText, searchText);
  }, [searchText]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.showRegionLabels, String(showRegionLabels));
  }, [showRegionLabels]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.activeFileFilters, JSON.stringify(activeFileFilters));
  }, [activeFileFilters]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.activeSourceFilePaths, JSON.stringify(activeSourceFilePaths));
  }, [activeSourceFilePaths]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    if (focusedRegionId) {
      localStorage.setItem(storageKeys.focusedRegionId, focusedRegionId);
    } else {
      localStorage.removeItem(storageKeys.focusedRegionId);
    }
  }, [focusedRegionId]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) {
      return;
    }

    localStorage.setItem(storageKeys.editedSourceFilePaths, JSON.stringify(editedSourceFilePaths));
  }, [editedSourceFilePaths]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isControlPressed = event.ctrlKey || event.metaKey;

      if (!isControlPressed) {
        return;
      }

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [regions, selectedRegionId, activeWorldId, activeSourceFilePaths, focusedRegionId, editedSourceFilePaths, filterSourceFilePath, filterRegionId, isBusy]);

  function getPickerOptionsForTag(tagName: string): PickerOption[] {
    switch (tagName) {
      case "NPCLIST":
        return npcListTagOptions;
      case "NPC":
        return npcOptions;
      case "ITEMLIST":
        return itemListOptions;
      case "ITEM":
        return itemTagOptions;
      default:
        return [];
    }
  }

  function setSelectedSpawnEntryType(nextSpawnEntryType: "NPCLIST" | "NPC" | "ITEMLIST" | "ITEM"): void {
    updateRegion((region) => {
      const nextTags = { ...region.tags };
      const previousValues = {
        NPCLIST: nextTags.NPCLIST ?? "",
        NPC: nextTags.NPC ?? "",
        ITEMLIST: nextTags.ITEMLIST ?? "",
        ITEM: nextTags.ITEM ?? ""
      };

      nextTags.NPCLIST = "";
      nextTags.NPC = "";
      nextTags.ITEMLIST = "";
      nextTags.ITEM = "";
      nextTags[nextSpawnEntryType] = previousValues[nextSpawnEntryType];
      region.tags = nextTags;
      return region;
    });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    cancelViewAnimation();

    const zoomMultiplier = event.deltaY < 0 ? 1.1 : 1 / 1.1;

    setViewState((currentViewState) => {
      const nextZoom = Math.max(0.75, Math.min(5, currentViewState.zoom * zoomMultiplier));

      return {
        ...currentViewState,
        zoom: nextZoom
      };
    });
  }

  const selectedSpawnEntryType = getSpawnEntryType(selectedRegion);
  const selectedSpawnEntryOptions = getPickerOptionsForTag(selectedSpawnEntryType);
  const selectedSpawnEntryValue = selectedRegion ? (selectedRegion.tags[selectedSpawnEntryType] ?? "") : "";

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <h1>UOX3 Spawn Editor - Phase 3 (Server + Lazy Load)</h1>
          <p>Browse server-backed spawn data, edit tags, move spawn regions on the map, and save changes directly to the shard data folder.</p>
        </div>

        <div className="toolbar">

          <button onClick={handleUndo} disabled={isBusy || undoStackRef.current.length === 0}>
            Undo
          </button>

          <button onClick={handleRedo} disabled={isBusy || redoStackRef.current.length === 0}>
            Redo
          </button>

          <button onClick={handleReloadFromServer} disabled={isBusy}>
            Reload From Server
          </button>

          <button onClick={handleSave} disabled={isBusy || regions.length === 0 || dirtySourceFilePaths.length === 0}>
            Save To Server
          </button>

          <button
            onClick={() => {
              Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
              cancelViewAnimation();
              setSelectedRegionId(null);
              setFocusedRegionId(null);
              setActiveFileFilters([]);
              setActiveSourceFilePaths([]);
              setViewState(defaultViewState);
              sessionStorage.setItem("uox3.skipNextAutoCenter", "true");
              window.location.reload();
            }}
            disabled={isBusy}
          >
            Clear Cache
          </button>
        </div>
      </header>

      <div className="status-bar">
        <span>{statusMessage}</span>
        {sourceFiles.length > 0 ? <span>Source Files: {sourceFiles.length}</span> : null}
        <span>Edited Files: {dirtySourceFilePaths.length}</span>
        {errorMessage ? <span className="error-text">{errorMessage}</span> : null}
      </div>

      <div className="world-toolbar">
        <div className="world-buttons">
          {mapWorlds.map((world) => (
            <button
              key={world.id}
              className={world.id === activeWorldId ? "world-button active" : "world-button"}
              onClick={() => {
  setFocusedRegionId(null);
  setFilterRegionId("");
  setActiveWorldId(world.id);
}}
              type="button"
            >
              {world.name}
            </button>
          ))}
        </div>

        <div className="map-actions">
          <button
            type="button"
            onClick={() => {
              cancelViewAnimation();
              setViewState((current) => ({ ...current, zoom: Math.min(5, current.zoom * 1.2) }));
            }}
          >
            Zoom In
          </button>
          <button
            type="button"
            onClick={() => {
              cancelViewAnimation();
              setViewState((current) => ({ ...current, zoom: Math.max(0.75, current.zoom / 1.2) }));
            }}
          >
            Zoom Out
          </button>
          <button
            type="button"
            onClick={() => {
              cancelViewAnimation();
              animateToViewState(defaultViewState, 180);
            }}
          >
            Reset View
          </button>
          <button type="button" onClick={() => setShowRegionLabels((current) => !current)}>
            {showRegionLabels ? "Hide Labels" : "Show Labels"}
          </button>
          <span className="map-readout">World: {activeWorld.name} ({activeWorld.width} x {activeWorld.height})</span>
          <span className="map-readout">Image: {activeImageSize.width} x {activeImageSize.height}</span>
          <span className="map-readout">Zoom: {viewState.zoom.toFixed(2)}x</span>
          <span className="map-readout">Rendered: {renderedMapRegions.length}</span>
          <span className="map-readout">Labels: {shouldShowRegionLabels ? "Visible" : "Hidden"}</span>
        </div>
      </div>

      <div className="layout map-layout">
        <aside className="panel left-panel">
          <h2>Search</h2>
          <input
            type="text"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by name, file, tag, or value"
          />

          <div className="file-filter-panel">
            <div className="file-filter-header">
              <h3>File Filters</h3>
              <div className="file-filter-actions">
                <button type="button" onClick={handleShowAllFileFilters}>
                  Show All
                </button>
                <button type="button" onClick={handleHideAllFileFilters}>
                  Hide All
                </button>
              </div>
            </div>

            <div className="file-filter-grid">
              {regionFileFilters.map((filter) => {
                const isActive = activeFileFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    type="button"
                    className={isActive ? "file-filter-button active" : "file-filter-button"}
                    onClick={() => handleToggleFileFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="source-file-dropdown-panel">
            <div className="file-filter-header">
              <h3>DFN Files</h3>
            </div>

            <label>
              <span>Target DFN File</span>
              <select
                value={filterSourceFilePath}
                onChange={(event) => {
                  setFilterSourceFilePath(event.target.value);
                  setFilterRegionId("");
                }}
              >
                <option value="">Select a DFN file</option>
                {availableSourceFiles.map((filePath) => (
                  <option key={filePath} value={filePath}>
                    {filePath}
                  </option>
                ))}
              </select>
            </label>

            <div className="new-region-panel-actions">
              <button type="button" onClick={handleShowSelectedSourceFile} disabled={!filterSourceFilePath}>
                Show File
              </button>
              <button type="button" className="secondary-button" onClick={handleHideSelectedSourceFile} disabled={!filterSourceFilePath}>
                Hide File
              </button>
            </div>

            <label>
              <span>Region In File</span>
              <select
                value={filterRegionId}
                onChange={(event) => setFilterRegionId(event.target.value)}
              >
                <option value="">Select a region</option>
                {regionsForSelectedSourceFile.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.regionNum} - {region.name || region.sectionHeader}
                  </option>
                ))}
              </select>
            </label>

            <div className="new-region-panel-actions">
              <button type="button" onClick={handleShowSelectedRegion} disabled={!filterRegionId}>
                Show Region
              </button>
              <button type="button" className="secondary-button" onClick={handleHideSelectedRegion} disabled={!filterRegionId}>
                Hide Region
              </button>
            </div>
          </div>

          <div className="stats-box">
            <div>Total Regions: {regions.length}</div>
            <div>Filtered: {filteredRegions.length}</div>
            <div>Visible On Map: {visibleRegions.length}</div>
            <div>Rendered On Map: {renderedMapRegions.length}</div>
            <div>Labels: {showRegionLabels ? "On" : "Off"}</div>
          </div>

          <div className="region-list region-list-side compact-region-list">
            {visibleRegions.map((region) => (
              <button
                key={region.id}
                className={region.id === selectedRegionId ? "region-item compact selected" : "region-item compact"}
                onClick={() => {
                  setSelectedRegionId(region.id);
                  centerViewOnRegion(region, getZoomToFitRegion(region, 100, 2.5));
                }}
                title={`${region.regionNum} ${region.name || region.sectionHeader}\n${region.fileName}\n(${region.bounds.x1}, ${region.bounds.y1}) - (${region.bounds.x2}, ${region.bounds.y2})`}
              >
                <div className="compact-region-line">
                  <span className="compact-region-id">{region.regionNum}</span>
                  <span className="compact-region-name">{region.name || region.sectionHeader}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="panel center-panel map-panel">
          <h2>Map View</h2>
          <div className="map-help-text">
            Mouse wheel zooms. Drag empty map to pan. Drag a selected region box to move it. Drag the blue corner handles to resize it. Hover a region to see its number and source file. Region overlays are fully hidden while panning for smoother movement.
          </div>

          <div
            ref={mapSurfaceRef}
            className="map-surface"
            onWheel={handleWheel}
            onMouseDown={handleMapMouseDown}
          >
            <div className="map-grid" style={mapGridStyle} />

            <img
              className="map-image"
              src={activeWorld.imageUrl}
              alt={activeWorld.name}
              draggable={false}
              onLoad={(event) => {
                const imageElement = event.currentTarget;
                setLoadedMapImageSizes((current) => ({
                  ...current,
                  [activeWorld.id]: {
                    width: imageElement.naturalWidth,
                    height: imageElement.naturalHeight
                  }
                }));
              }}
              style={{
                width: activeImageSize.width * viewState.zoom,
                height: activeImageSize.height * viewState.zoom,
                transform: `translate(${viewState.offsetX}px, ${viewState.offsetY}px)`
              }}
            />

            <div
              className="world-outline"
              style={{
                width: activeImageSize.width * viewState.zoom,
                height: activeImageSize.height * viewState.zoom,
                transform: `translate(${viewState.offsetX}px, ${viewState.offsetY}px)`
              }}
            />

            {renderedMapRegions.map(({ region, screenRect }) => {
              const isSelected = region.id === selectedRegionId;

              return (
                <div
                  key={region.id}
                  className={isSelected ? "map-region selected" : "map-region"}
                  style={{
                    left: screenRect.left,
                    top: screenRect.top,
                    width: screenRect.width,
                    height: screenRect.height
                  }}
                  onMouseDown={(event) => handleRegionMouseDown(event, region)}
                  title={`Region ${region.regionNum}\nFile: ${region.fileName}\n${region.name} (${region.bounds.x1}, ${region.bounds.y1}) - (${region.bounds.x2}, ${region.bounds.y2})`}
                >
                  {shouldShowRegionLabels ? (
                    <div className="map-region-label">{region.name}</div>
                  ) : null}

                  {isSelected ? (
                    <>
                      <div
                        className="map-region-resize-handle handle-nw"
                        onMouseDown={(event) => handleResizeHandleMouseDown(event, region, "nw")}
                        title="Resize from top left"
                      />
                      <div
                        className="map-region-resize-handle handle-ne"
                        onMouseDown={(event) => handleResizeHandleMouseDown(event, region, "ne")}
                        title="Resize from top right"
                      />
                      <div
                        className="map-region-resize-handle handle-sw"
                        onMouseDown={(event) => handleResizeHandleMouseDown(event, region, "sw")}
                        title="Resize from bottom left"
                      />
                      <div
                        className="map-region-resize-handle handle-se"
                        onMouseDown={(event) => handleResizeHandleMouseDown(event, region, "se")}
                        title="Resize from bottom right"
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </main>

        <aside className="panel right-panel">
          <h2>Region Editor</h2>

          {selectedRegion ? (
            <div className="editor-form">
              <div className="editor-action-row editor-action-row-three">
                <button type="button" onClick={handleStartCreateRegion}>
                  New Region
                </button>
                <button type="button" onClick={handleCloneSelectedRegion}>
                  Clone Region
                </button>
                <button type="button" className="danger-button" onClick={handleDeleteSelectedRegion}>
                  Delete Region
                </button>
              </div>

              {showNewRegionChooser ? (
                <div className="new-region-panel">
                  <label>
                    <span>Target DFN File</span>
                    <select
                      value={newRegionTargetSourceFilePath}
                      onChange={(event) => setNewRegionTargetSourceFilePath(event.target.value)}
                    >
                      <option value="">Select a DFN file</option>
                      {availableSourceFiles.map((filePath) => (
                        <option key={filePath} value={filePath}>
                          {filePath}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="new-region-panel-actions">
                    <button type="button" onClick={handleCreateNewRegion} disabled={!newRegionTargetSourceFilePath}>
                      Create Region
                    </button>
                    <button type="button" className="secondary-button" onClick={handleCancelCreateRegion}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={selectedRegion.tags.NAME ?? selectedRegion.name ?? ""}
                  onChange={(event) => updateSelectedTag("NAME", event.target.value)}
                />
              </label>

              <label>
                <span>World</span>
                <select
                  value={selectedRegion.tags.WORLD ?? String(selectedRegion.world)}
                  onChange={(event) => updateSelectedTag("WORLD", event.target.value)}
                >
                  {mapWorlds.map((world) => (
                    <option key={world.id} value={String(world.id)}>
                      {world.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid-two">
                <label>
                  <span>Width</span>
                  <input
                    type="number"
                    value={selectedRegionWidth}
                    onChange={(event) => updateSelectedRegionWidth(event.target.value)}
                  />
                </label>

                <label>
                  <span>Height</span>
                  <input
                    type="number"
                    value={selectedRegionHeight}
                    onChange={(event) => updateSelectedRegionHeight(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid-two">
                <label>
                  <span>X1</span>
                  <input
                    type="text"
                    value={selectedRegion.tags.X1 ?? String(selectedRegion.bounds.x1)}
                    onChange={(event) => updateSelectedTag("X1", event.target.value)}
                  />
                </label>

                <label>
                  <span>Y1</span>
                  <input
                    type="text"
                    value={selectedRegion.tags.Y1 ?? String(selectedRegion.bounds.y1)}
                    onChange={(event) => updateSelectedTag("Y1", event.target.value)}
                  />
                </label>

                <label>
                  <span>X2</span>
                  <input
                    type="text"
                    value={selectedRegion.tags.X2 ?? String(selectedRegion.bounds.x2)}
                    onChange={(event) => updateSelectedTag("X2", event.target.value)}
                  />
                </label>

                <label>
                  <span>Y2</span>
                  <input
                    type="text"
                    value={selectedRegion.tags.Y2 ?? String(selectedRegion.bounds.y2)}
                    onChange={(event) => updateSelectedTag("Y2", event.target.value)}
                  />
                </label>
              </div>

              <label>
                <span>Spawn Entry Type</span>
                <select
                  value={selectedSpawnEntryType}
                  onChange={(event) => setSelectedSpawnEntryType(event.target.value as "NPCLIST" | "NPC" | "ITEMLIST" | "ITEM")}
                >
                  <option value="NPCLIST">NPCLIST</option>
                  <option value="NPC">NPC</option>
                  <option value="ITEMLIST">ITEMLIST</option>
                  <option value="ITEM">ITEM</option>
                </select>
              </label>

              <label>
                <span>{selectedSpawnEntryType}</span>
                <input
                  type="text"
                  value={selectedSpawnEntryValue}
                  onChange={(event) => updateSelectedTag(selectedSpawnEntryType, event.target.value)}
                />
                {selectedSpawnEntryOptions.length > 0 ? (
                  <div className="tag-picker-row">
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          updateSelectedTag(selectedSpawnEntryType, event.target.value);
                          event.target.selectedIndex = 0;
                        }
                      }}
                    >
                      <option value="">Select {selectedSpawnEntryType}</option>
                      {selectedSpawnEntryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </label>

              {Object.entries(selectedRegion.tags)
                .filter(([tagName]) => !["NAME", "WORLD", "X1", "Y1", "X2", "Y2", "NPCLIST", "NPC", "ITEMLIST", "ITEM"].includes(tagName))
                .map(([tagName, tagValue]) => {
                  const pickerOptions = getPickerOptionsForTag(tagName);

                  return (
                    <label key={tagName}>
                      <span>{tagName}</span>
                      <input
                        type="text"
                        value={tagValue}
                        onChange={(event) => updateSelectedTag(tagName, event.target.value)}
                      />
                      {pickerOptions.length > 0 ? (
                        <div className="tag-picker-row">
                          <select
                            defaultValue=""
                            onChange={(event) => {
                              if (event.target.value) {
                                updateSelectedTag(tagName, event.target.value);
                                event.target.selectedIndex = 0;
                              }
                            }}
                          >
                            <option value="">Select {tagName}</option>
                            {pickerOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </label>
                  );
                })}
            </div>
          ) : (
            <div>Select a region to edit.</div>
          )}
        </aside>
      </div>
    </div>
  );
}