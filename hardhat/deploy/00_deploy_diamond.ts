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
    join('..', 'farcaster', 'src', 'assets', chainStr),
    join('..', 'api', 'src', 'artifacts', chainStr),
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

    // Deploy MockERC20 for testing (payment token)
    const mockERC20 = await deploy('MockERC20', {
      account: deployer,
      artifact: artifacts.MockERC20,
      args: [],
    });

    // Deploy shared EIP-712 library
    const libEIP712 = await deploy('LibEIP712', {
      account: deployer,
      artifact: artifacts.LibEIP712,
      args: [],
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
    console.log('MockERC20 deployed to:', mockERC20.address);

    // Save deployments for frontend consumption
    // Each file has diamond proxy address + that facet's ABI only
    const diamondAddr = result.address;

    await saveDeployment(chainIdNum, 'JaccardDiamond', diamondAddr, hre.get('JaccardDiamond').abi); // merged ABI
    await saveDeployment(chainIdNum, 'JaccardSwap', diamondAddr, artifacts.JaccardSwapFacet.abi);
    await saveDeployment(chainIdNum, 'JaccardERC1155', diamondAddr, artifacts.JaccardERC1155Facet.abi);
    await saveDeployment(chainIdNum, 'Essence', diamondAddr, artifacts.EssenceFacet.abi);
    await saveDeployment(chainIdNum, 'MockERC20', mockERC20.address, artifacts.MockERC20.abi);
  },
  { tags: ['JaccardDiamond', 'JaccardDiamond_deploy'] },
);

