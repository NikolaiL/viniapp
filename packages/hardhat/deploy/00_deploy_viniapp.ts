import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployViniAppContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` or `yarn account:import` to import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const networkName = hre.network.name;
  let usdcAddress: string;

  // For live networks, use actual USDC addresses
  const usdcAddresses: Record<string, string> = {
    mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };
  usdcAddress = usdcAddresses[networkName] || "";

  if (usdcAddress === "") {
    console.log("👋 No USDC address found, deploying dummy USDC ERC20 contract");
    console.log("👋 Deploying dummy USDC ERC20 contract");
    // deploy a dummy usdc erc20 contract
    const usdcContract = await deploy("DummyUsdcContract", {
      from: deployer,
      args: [deployer, 1000000000000], // 1,000,000 USDC (with 6 decimals)
      log: true,
      autoMine: true,
    });

    usdcAddress = usdcContract.address; // update the usdc address
  }

  console.log("👋 USDC address:", usdcAddress);

  await deploy("ViniApp", {
    from: deployer,
    // Contract constructor arguments: owner address and USDC token address
    args: [deployer, usdcAddress],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const viniAppContract = await hre.ethers.getContract<Contract>("ViniApp", deployer);
  console.log("✅ Contract deployed at:", await viniAppContract.getAddress());
  console.log("✅ Payment token (USDC):", await viniAppContract.paymentToken());
};

export default deployViniAppContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags ViniApp
deployViniAppContract.tags = ["ViniApp"];
