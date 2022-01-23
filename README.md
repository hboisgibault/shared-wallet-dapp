# Shared Wallet dApp

A simple shared/multisig wallet dApp written in Solidity and using hardhat.
This smart contract allows the creation of shared wallets that anyone can join by providing a minimum deposit.
Members of the wallet can request and approve transactions. A transaction is sent when a majority of the members approve it.

## Install and deploy

- Install packages : `npm install`
- Copy the .env.example file, rename it to .env and add your variables
- Run tests : `npx hardhat test`
- Compile contract : `npx hardhat compile`
- Deploy on Rinkeby testnet : `npx hardhat run scripts/deploy.js --network rinkeby`

Contract was deployed on Rinkeby at `0x8f2896a8fc12cb9dcdd915450847c32425872ec7`