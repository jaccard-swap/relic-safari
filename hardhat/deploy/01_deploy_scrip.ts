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

// Scrip isn't referenced by the diamond's init args or any facet constructor
// - it's just an independent ERC20Permit token used as a generic payment
// token in bids/auctions - so it's deployed on its own here rather than
// bundled into 00_deploy_diamond.ts, letting it be redeployed without
// touching (or re-cutting facets on) the diamond.
export default deployScript(
  async (hre) => {
    const { deployer } = hre.namedAccounts;
    const { deploy } = hre;
    const chainId = await hre.network.provider.request({ method: 'eth_chainId' }) as string;
    const chainIdNum = parseInt(chainId, 16);

    const scrip = await deploy('Scrip', {
      account: deployer,
      artifact: artifacts.Scrip,
      args: [],
    });

    console.log('Scrip deployed to:', scrip.address);

    await saveDeployment(chainIdNum, 'Scrip', scrip.address, artifacts.Scrip.abi);
  },
  { tags: ['Scrip', 'Scrip_deploy'] },
);
