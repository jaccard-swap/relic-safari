import { task } from "hardhat/config";

export const changeOwnershipTask = task("change-ownership", "Transfers ownership of the JaccardDiamond to a new address.")
    .addPositionalArgument({name: "newOwner", description: "Address of the new owner"})
    .setAction(() => import("./change-ownership.js"))
  .build();
