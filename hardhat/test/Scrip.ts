import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { network } from 'hardhat';
import { parseEther } from 'viem';
import { EIP712_DOMAINS, ERC20PermitTypes } from '@shared/constants';
import { setupFixtures } from './utils/index.js';

const { provider, networkHelpers } = await network.connect();
const { deployAll } = setupFixtures(provider);

// Exercises Scrip's EIP-2612 permit() using the *actual* shared domain/type
// definitions the frontend signs with (@shared/constants), rather than
// hardcoding them locally - a hardcoded copy here would have passed right
// through the "Scrip" vs "MockERC20" domain-name mismatch that made every
// real permit signature fail ECDSA recovery in production (see
// JaccardSwapFacet's NoValidBids(PaymentDeclined)). If shared/constants and
// the deployed contract's real name/version ever drift again, this test -
// not just the live app - should be what catches it.
describe('Scrip ECDSA permit', () => {
  const value = parseEther('1');
  const oneHour = 3600;

  it('accepts a permit signed with the shared frontend domain/types', async () => {
    const { env, Scrip, unnamedAccounts } = await networkHelpers.loadFixture(deployAll);
    const owner = unnamedAccounts[0];
    const spender = unnamedAccounts[1];

    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const ownerWallet = walletClients.find(w => w.account?.address === owner);
    if (!ownerWallet) throw new Error('Could not find owner wallet client');

    const chainId = await publicClient.getChainId();
    const tokenAddr = Scrip.address as `0x${string}`;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);

    const nonce = await env.read(Scrip, {
      functionName: 'nonces',
      args: [owner],
    }) as bigint;

    const signature = await ownerWallet.signTypedData({
      account: ownerWallet.account!,
      domain: {
        name: EIP712_DOMAINS.SCRIP,
        version: '1',
        chainId,
        verifyingContract: tokenAddr,
      },
      types: ERC20PermitTypes,
      primaryType: 'Permit',
      message: { owner, spender, value, nonce, deadline },
    });

    const r = signature.slice(0, 66) as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await env.execute(Scrip, {
      functionName: 'permit',
      args: [owner, spender, value, deadline, v, r, s],
      account: owner,
    });

    const allowance = await env.read(Scrip, {
      functionName: 'allowance',
      args: [owner, spender],
    }) as bigint;

    assert.equal(allowance, value, 'Allowance should equal the permitted value');
  });

  it('rejects a permit signed against a mismatched domain name', async () => {
    const { env, Scrip, unnamedAccounts } = await networkHelpers.loadFixture(deployAll);
    const owner = unnamedAccounts[0];
    const spender = unnamedAccounts[1];

    const { viem } = await network.connect();
    const publicClient = await viem.getPublicClient();
    const walletClients = await viem.getWalletClients();
    const ownerWallet = walletClients.find(w => w.account?.address === owner);
    if (!ownerWallet) throw new Error('Could not find owner wallet client');

    const chainId = await publicClient.getChainId();
    const tokenAddr = Scrip.address as `0x${string}`;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + oneHour);

    const nonce = await env.read(Scrip, {
      functionName: 'nonces',
      args: [owner],
    }) as bigint;

    // Deliberately wrong domain name - reproduces the exact class of bug
    // that made every real permit fail: a well-formed signature that
    // recovers to an unrelated address because the signed domain doesn't
    // match the contract's actual EIP-712 domain.
    const signature = await ownerWallet.signTypedData({
      account: ownerWallet.account!,
      domain: {
        name: 'NotScrip',
        version: '1',
        chainId,
        verifyingContract: tokenAddr,
      },
      types: ERC20PermitTypes,
      primaryType: 'Permit',
      message: { owner, spender, value, nonce, deadline },
    });

    const r = signature.slice(0, 66) as `0x${string}`;
    const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await assert.rejects(
      env.execute(Scrip, {
        functionName: 'permit',
        args: [owner, spender, value, deadline, v, r, s],
        account: owner,
      }),
    );
  });
});
