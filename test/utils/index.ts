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
      const MockERC20 = env.get<any>('MockERC20');

      return {
        env,
        JaccardDiamond,
        MockERC20,
        namedAccounts: env.namedAccounts,
        unnamedAccounts: env.unnamedAccounts,
      };
    },
  };
}

