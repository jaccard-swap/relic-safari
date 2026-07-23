import { EthereumProvider } from 'hardhat/types/providers';
import { loadAndExecuteDeployments } from '#rocketh';

export function setupFixtures(provider: EthereumProvider) {
  return {
    async deployAll() {
      const env = await loadAndExecuteDeployments({
        provider: provider,
      });

      // Diamond deployment combines all facet ABIs at runtime
      const JaccardDiamond = env.get<any>('JaccardDiamond');
      const Scrip = env.get<any>('Scrip');

      return {
        env,
        JaccardDiamond,
        Scrip,
        namedAccounts: env.namedAccounts,
        unnamedAccounts: env.unnamedAccounts,
      };
    },
  };
}

