import { expect } from "chai";
import { ethers } from "hardhat";
import { ViniApp, DummyUsdcContract } from "../typechain-types";

describe("ViniApp", function () {
  // We define a fixture to reuse the same setup in every test.

  let viniAppContract: ViniApp;
  let dummyUsdcContract: DummyUsdcContract;
  let owner: any;
  let user: any;
  before(async () => {
    [owner, user] = await ethers.getSigners();

    const viniAppContractFactory = await ethers.getContractFactory("ViniApp");
    const dummyUsdcContractFactory = await ethers.getContractFactory("DummyUsdcContract");
    const initialSupply = 1000000000000;
    dummyUsdcContract = (await dummyUsdcContractFactory.deploy(owner.address, initialSupply)) as DummyUsdcContract;
    await dummyUsdcContract.waitForDeployment();

    const tokenAddress = await dummyUsdcContract.getAddress();
    console.log("👋 Dummy USDC contract deployed at:", tokenAddress);
    viniAppContract = (await viniAppContractFactory.deploy(owner.address, tokenAddress)) as ViniApp;
    await viniAppContract.waitForDeployment();
    await dummyUsdcContract.mint(user.address, 150000000); // 150 USDC
  });

  describe("Deployment", function () {
    it("Should allow launchin a new viniapp", async function () {
      await dummyUsdcContract.connect(user).approve(viniAppContract.target, 10000000000000);

      await viniAppContract.connect(user).startViniappCreation();
    });
  });

  describe("setViniappCost", function () {
    it("Should allow owner to update the viniapp cost", async function () {
      const initialCost = await viniAppContract.viniappCost();
      const newCost = 20 * 10 ** 6; // 20 USDC

      await expect(viniAppContract.connect(owner).setViniappCost(newCost))
        .to.emit(viniAppContract, "ViniappCostUpdated")
        .withArgs(initialCost, newCost);

      const updatedCost = await viniAppContract.viniappCost();
      expect(updatedCost).to.equal(newCost);
    });

    it("Should not allow non-owner to update the viniapp cost", async function () {
      const newCost = 30 * 10 ** 6; // 30 USDC

      await expect(viniAppContract.connect(user).setViniappCost(newCost)).to.be.revertedWith("Not the Owner");
    });

    it("Should emit ViniappCostUpdated event with correct values", async function () {
      const oldCost = await viniAppContract.viniappCost();
      const newCost = 25 * 10 ** 6; // 25 USDC

      await expect(viniAppContract.connect(owner).setViniappCost(newCost))
        .to.emit(viniAppContract, "ViniappCostUpdated")
        .withArgs(oldCost, newCost);
    });

    it("Should use the updated cost when creating a viniapp", async function () {
      const newCost = 15 * 10 ** 6; // 15 USDC
      await viniAppContract.connect(owner).setViniappCost(newCost);

      // Approve the new cost amount
      await dummyUsdcContract.connect(user).approve(viniAppContract.target, newCost);

      // Create viniapp with the new cost
      await expect(viniAppContract.connect(user).startViniappCreation())
        .to.emit(viniAppContract, "ViniappCreated")
        .withArgs(user.address, newCost);
    });
  });
});
