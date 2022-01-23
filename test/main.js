const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SharedWalletRepository", function () {
  let SharedWalletRepository;
  let repository;
  let owner;
  let addr1;
  let addr2;
  let addr3;
  let addrs;

  beforeEach(async function () {
    SharedWalletRepository = await ethers.getContractFactory("SharedWalletRepository");
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    repository = await SharedWalletRepository.deploy();
    await repository.deployed();
  });

  it("Deployment", async function () {
    await repository.deployed();

    expect(repository.wallets.length).to.equal(0);
  });

  describe("createWallet", function () {
    it("Creates a shared wallet", async function () {
      const minDeposit = 1000;
  
      await repository.createWallet(minDeposit);
      const wallet = await repository.getWallet(0);
  
      expect(await wallet.balance).to.eq(0);
      expect(await wallet.minDeposit).to.eq(minDeposit);
    });
  });
  
  describe("joinWallet", function () {
    beforeEach(async function() {
      const minDeposit = 10000;
  
      await repository.connect(owner).createWallet(minDeposit);
    });

    it("Joins wallet", async function () {
      const amount = 20000;
      const walletId = 0;

      expect(await repository.connect(addr1).joinWallet(walletId, { value: amount })).to.changeEtherBalance(addr1, -amount);
      const wallet = await repository.getWallet(walletId);

      expect(await repository.isWalletMember(walletId, addr1.address)).to.eq(true);
      expect(await repository.balanceOf(walletId, addr1.address)).to.eq(amount);
      expect(await wallet.balance).to.eq(amount);
      expect(await wallet.members.length).to.eq(1);
    });

    it("Cannot join wallet if already a member", async function () {
      const amount = 15000;
      const walletId = 0;
      await repository.connect(addr1).joinWallet(walletId, { value: amount });
      await expect(repository.connect(addr1).joinWallet(walletId, { value: amount })).to.be.revertedWith("Address is already a member");
    });

    it("Cannot join wallet if deposit lower than minimum", async function () {
      const amount = 5000;
      const walletId = 0;
      await expect(repository.connect(addr1).joinWallet(walletId, { value: amount })).to.be.revertedWith("Transaction value below wallet minimum deposit");
    });
  });

  describe("fundWallet", function () {
    const initAmount = 2000;
    const walletId = 0;

    beforeEach(async function() {  
      const minDeposit = 1000;
      await repository.connect(owner).createWallet(minDeposit);
      await repository.connect(addr1).joinWallet(walletId, { value: initAmount });
    });

    it("Funds wallet", async function () {
      const amount = 1000;

      expect(await repository.connect(addr1).fundWallet(walletId, { value: amount })).to.changeEtherBalance(addr1, -amount);
      const wallet = await repository.getWallet(walletId);
      expect(await wallet.members.length).to.eq(1);
      expect(await repository.isWalletMember(walletId, addr1.address)).to.eq(true);
      expect(await repository.balanceOf(walletId, addr1.address)).to.eq(amount + initAmount);
      expect(await wallet.balance).to.eq(amount + initAmount);
    });

    it("Cannot fund wallet if not a member", async function () {
      const amount = 1000;
      await expect(repository.connect(addr2).fundWallet(walletId, { value: amount })).to.be.revertedWith("Address is not a member");
    });
  });

  describe("leaveWallet", function () {
    const initAmount = 2000;
    const walletId = 0;

    beforeEach(async function() {
      const minDeposit = 1000;
      await repository.connect(owner).createWallet(minDeposit);
      await repository.connect(addr1).joinWallet(walletId, { value: initAmount });
      await repository.connect(addr2).joinWallet(walletId, { value: initAmount });
    });

    it("Leaves wallet", async function () {
      expect(await repository.connect(addr1).leaveWallet(walletId)).to.changeEtherBalance(addr1, initAmount);
      const wallet = await repository.getWallet(walletId);

      expect(await repository.isWalletMember(walletId, addr1.address)).to.eq(false);
      expect(await repository.balanceOf(walletId, addr1.address)).to.eq(0);
      expect(await wallet.members.length).to.eq(1);
      expect(await wallet.balance).to.eq(initAmount);
    });

    it("Cannot leave wallet if not a member", async function () {
      await expect(repository.connect(addr3).leaveWallet(walletId)).to.be.revertedWith("Address is not a member");
    });
  });

  describe("requestTransaction", function () {
    const initAmount = 2000;
    const walletId = 0;

    beforeEach(async function() {
      const minDeposit = 1000;
      await repository.connect(owner).createWallet(minDeposit);
      await repository.connect(addr1).joinWallet(walletId, { value: initAmount });
    });

    it("Requests transaction", async function () {
      const description = "Dinner at Jimmy's";
      const destination = addr3.address;
      const value = 500;

      await repository.connect(addr1).requestTransaction(walletId, description, destination, value);
      const transaction = await repository.getTransaction(walletId, 0);

      expect(transaction.description).to.eq(description);
      expect(transaction.destination).to.eq(destination);
      expect(transaction.value).to.eq(value);
      expect(transaction.numApprovals).to.eq(0);
      expect(transaction.walletId).to.eq(walletId);
      expect(transaction.requester).to.eq(addr1.address);
      expect(transaction.approved).to.eq(false);
    });

    it("Cannot request transaction if not a member", async function () {
      const description = "Dinner at Jimmy's";
      const destination = addr3.address;
      const value = 500;
      await expect(repository.connect(addr2).requestTransaction(walletId, description, destination, value)).to.be.revertedWith("Address is not a member");
    });
  });

  describe("approveTransaction", function () {
    const initAmount = 1000;
    const walletId = 0;
    const transactionId = 0;
    const transactionValue = 600;

    beforeEach(async function() {
      const minDeposit = 1000;
      const description = "Dinner at Jimmy's";
      const destination = addr3.address;
      await repository.connect(owner).createWallet(minDeposit);
      await repository.connect(owner).joinWallet(walletId, { value: initAmount });
      await repository.connect(addr1).joinWallet(walletId, { value: initAmount });
      await repository.connect(addr2).joinWallet(walletId, { value: initAmount });
      await repository.connect(addr1).requestTransaction(walletId, description, destination, transactionValue);
    });

    it("Approves transaction without sending it", async function () {
      expect(await repository.connect(addr2).approveTransaction(walletId, transactionId)).to.changeEtherBalance(addr3, 0);
      const wallet = await repository.getWallet(walletId);
      const transaction = await repository.getTransaction(walletId, 0);
      expect(await repository.getApproval(transactionId, addr2.address)).to.eq(true);
      expect(wallet.members.length).to.eq(3);
      expect(wallet.balance).to.eq(initAmount * 3);
      expect(transaction.numApprovals).to.eq(1);
      expect(transaction.approved).to.eq(false);
    });

    it("Approves transaction and sends transaction", async function () {
      await repository.connect(owner).approveTransaction(walletId, transactionId);
      expect(await repository.connect(addr1).approveTransaction(walletId, transactionId)).to.changeEtherBalance(addr3, transactionValue);
      const wallet = await repository.getWallet(walletId);
      const transaction = await repository.getTransaction(walletId, 0);
      expect(await repository.getApproval(transactionId, owner.address)).to.eq(true);
      expect(await repository.getApproval(transactionId, addr1.address)).to.eq(true);
      expect(await repository.getApproval(transactionId, addr2.address)).to.eq(false);
      expect(wallet.members.length).to.eq(3);
      expect(wallet.balance).to.eq(initAmount * 3 - transaction.value);
      expect(await repository.balanceOf(walletId, owner.address)).to.eq(initAmount - transaction.value / 3);
      expect(await repository.balanceOf(walletId, addr1.address)).to.eq(initAmount - transaction.value / 3);
      expect(await repository.balanceOf(walletId, addr2.address)).to.eq(initAmount - transaction.value / 3);
      expect(transaction.numApprovals).to.eq(2);
      expect(transaction.approved).to.eq(true);
    });

    it("Cannot approve transaction if already approved by member", async function () {
      await repository.connect(addr2).approveTransaction(walletId, transactionId);
      await expect(repository.connect(addr2).approveTransaction(walletId, transactionId)).to.be.revertedWith("Transaction already approved by member");
    });

    it("Cannot approve transaction if not a member", async function () {
      await expect(repository.connect(addr3).approveTransaction(walletId, transactionId)).to.be.revertedWith("Address is not a member");
    });

    it("Cannot send transaction if wallet balance is too low", async function () {
      await repository.connect(addr1).requestTransaction(walletId, "High value transaction", addr3.address, ethers.utils.parseEther("100"));
      const wallet = await repository.getWallet(walletId);
      const txId = 1;
      expect(wallet.balance).to.eq(initAmount * 3);
      await repository.connect(owner).approveTransaction(walletId, txId);
      await expect(repository.connect(addr1).approveTransaction(walletId, txId)).to.be.revertedWith("Wallet balance too low to send transaction");
    });
  });
});
