import { deployScript, artifacts } from '#rocketh';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function saveDeployment(
  chainId: number,
  contractName: string,
  address: string,
  abi: any,
) {
  const data = JSON.stringify({ address, abi }, null, 2);
  const chainStr = chainId.toString();

  const dirs = [
    join('deployments', chainStr),
    join('..', 'shared', 'contracts', chainStr),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${contractName}.json`), data);
  }

  console.log(`Saved ${contractName}.json to ${dirs.length} locations`);
}

export default deployScript(
  async (hre) => {
    const { deployer } = hre.namedAccounts;
    const { deploy } = hre;
    const { diamond } = hre;
    const chainId = await hre.network.provider.request({ method: 'eth_chainId' }) as string;
    const chainIdNum = parseInt(chainId, 16);

    // Deploy shared EIP-712 library. skipIfAlreadyDeployed is required, not
    // optional, here - without it @rocketh/deploy broadcasts a fresh deploy
    // tx on every single run (it's the only opt-in idempotency check the
    // library offers; there's no default). That gave this library a new
    // address on every `docker compose up`, which diamond() below then took
    // as its `libraries` arg changing - even though diamond()'s own
    // skipIfAlreadyDeployed defaults to true for the proxy itself, a
    // "different" library address made it treat the whole diamond as stale
    // and cut a brand new proxy, orphaning every on-chain record (minted
    // NFTs, MinHashes, auctions) tied to the previous proxy address while
    // Postgres kept referencing them as if they still resolved.
    const libEIP712 = await deploy('LibEIP712', {
      account: deployer,
      artifact: artifacts.LibEIP712,
      args: [],
      skipIfAlreadyDeployed: true,
    });

    // Deploy the JaccardSwap Diamond
    const result = await diamond(
      'JaccardDiamond',
      {
        account: deployer,
      },
      {
        facets: [
          // DiamondLoupeFacet + OwnershipFacet + DiamondCutFacet provided by rocketh
          { artifact: artifacts.JaccardERC1155Facet },
          { artifact: artifacts.JaccardSwapFacet },
          { artifact: artifacts.EssenceFacet },
        ],
        // Exclude selectors that conflict with rocketh's default facets
        // supportsInterface: 0x01ffc9a7
        excludeSelectors: {
          JaccardERC1155Facet: ['0x01ffc9a7'],
        },
        execute: {
          type: 'artifact',
          artifact: artifacts.DiamondInit,
          functionName: 'init',
          args: ['https://api.jaccardswap.xyz/metadata/{id}.json', 'Essence', 'ESS'],
        },
        libraries: {
          LibEIP712: libEIP712.address,
        },
      },
    );

    console.log('JaccardDiamond deployed to:', result.address);

    // Save deployments for frontend consumption
    // Each file has diamond proxy address + that facet's ABI only
    const diamondAddr = result.address;

    await saveDeployment(chainIdNum, 'JaccardDiamond', diamondAddr, hre.get('JaccardDiamond').abi); // merged ABI
    await saveDeployment(chainIdNum, 'JaccardSwap', diamondAddr, artifacts.JaccardSwapFacet.abi);
    await saveDeployment(chainIdNum, 'JaccardERC1155', diamondAddr, artifacts.JaccardERC1155Facet.abi);
    await saveDeployment(chainIdNum, 'Essence', diamondAddr, artifacts.EssenceFacet.abi);
  },
  { tags: ['JaccardDiamond', 'JaccardDiamond_deploy'] },
);

