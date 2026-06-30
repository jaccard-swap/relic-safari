// ------------------------------------------------------------------------------------------------
// Typed Config
// ------------------------------------------------------------------------------------------------
import { UserConfig } from "rocketh";
export const config = {
  accounts: {
    deployer: {
      default: 0,
    },
  },
} as const satisfies UserConfig;

// ------------------------------------------------------------------------------------------------
// Imports and Re-exports
// ------------------------------------------------------------------------------------------------
// We regroup all what is needed for the deploy scripts
// so that they just need to import this file
// we add here the extension we need, so that they are available in the deploy scripts
// extensions are simply function that accept as their first argument the Environment
// by passing them to the setup function (see below) you get to access them through the environment object with type-safety
import * as deployExtensions from '@rocketh/deploy'; // this one provide a deploy function
import * as readExecuteFunctions from '@rocketh/read-execute'; // this one provide read,execute functions
import {diamond} from '@rocketh/diamond'; // this one provide extensions to deploy diamonds declaratively
const extensions = {...deployExtensions, ...readExecuteFunctions, diamond};
// ------------------------------------------------------------------------------------------------
// we re-export the artifacts, so they are easily available from the alias
import * as artifacts from './generated/artifacts/index.js';
export {artifacts};
// ------------------------------------------------------------------------------------------------
// we create the rocketh function we need by passing the extensions
import {setupDeployScripts} from 'rocketh';
const {deployScript} = setupDeployScripts<typeof extensions, typeof config.accounts, typeof config.data>(extensions);
import {setupEnvironmentFromFiles} from '@rocketh/node';
const {loadAndExecuteDeploymentsFromFiles: loadAndExecuteDeployments} = setupEnvironmentFromFiles<typeof extensions, typeof config.accounts, typeof config.data>(extensions);
// ------------------------------------------------------------------------------------------------
// we do the same for hardhat-deploy
import {setupHardhatDeploy} from 'hardhat-deploy/helpers';
const {loadEnvironmentFromHardhat} = setupHardhatDeploy(extensions);
// ------------------------------------------------------------------------------------------------
// finally we export them
export {loadAndExecuteDeployments, deployScript, loadEnvironmentFromHardhat};