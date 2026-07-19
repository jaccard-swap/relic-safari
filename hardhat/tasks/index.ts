import { task } from "hardhat/config";

export const deployAuctionTask = task("deploy-auction", "Deploys the auction contract.")
    .addFlag({name: "verify", description: "Verifies the contract on the block explorer."})
    .addFlag({name: "noCompile", description: "Does not compile the contract."})
    .addFlag({name: "testTokens", description: "Deploys with Test Tokens"})
    .addFlag({name: "saveDeployments", description: "Writes deployment artifacts to artifacts/{chainId}/"})
    .setAction(() => import("./deploy-auction.js"))
  .build();