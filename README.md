# Ticketa

Your ticket. Your wallet. Your proof.

A wallet-gated event ticketing DApp on BOT Chain Testnet. The public landing page explains the service; all app pages require a real EVM wallet connection on chain ID 968. Events, tiers, ownership, transfers, check-in, staff permissions, sales, and proceeds come from the deployed contract. No sample events, fabricated balances, local tickets, or simulated transactions are included.

## Run

```sh
npm install
npm run dev
npm run build
```

Open `http://localhost:5173`. Connect an EVM wallet and approve the switch to BOT Chain Testnet. Get testnet BOT from [the faucet](https://faucet.botchain.ai). On mobile, open the site inside your wallet's browser. An account change ends the app session; disconnect returns to the landing page. A network change pauses the app until the wallet switches back.

## Contract deployment

Deployed and verified on BOT Chain Testnet: [0x0d7cf9AB07C417f28d5B872F39eD83E78c73c89c](https://scan.bohr.life/address/0x0d7cf9AB07C417f28d5B872F39eD83E78c73c89c?tab=contract). Deployment transaction: [0x67c5a71f7c115bb736271637420423acea7ce10647f73d6ace9a5433e91eea4e](https://scan.bohr.life/tx/0x67c5a71f7c115bb736271637420423acea7ce10647f73d6ace9a5433e91eea4e).

`.env` must contain `PRIVATE_KEY` and `BLOCKSCOUT_API_KEY`. Neither value uses a `VITE_` prefix and neither is included in the browser build. Only the server-side scripts read deployment credentials. `.env` is ignored by Git.

```sh
npm run deploy:testnet
npm run verify:testnet
```

The deployment script verifies chain ID 968, estimates the deployment fee, sends the contract transaction, waits for confirmation, and writes public deployment metadata to `src/contracts/deployment.json`. It reuses an existing deployment only when its bytecode hash matches. Verification submits the complete Solidity standard JSON compiler input to the testnet Blockscout API using the environment API key. Rebuild the website after deployment or verification to include the updated public contract configuration.

## Pages

- Landing: `#/`
- Wallet overview: `#/app`
- Events and event details: `#/app/events` and `#/app/events/:id`
- Owned tickets and signed QR codes: `#/app/tickets`
- Transfers and paginated on-chain history: `#/app/transfers`
- Organizer, creation, management, and editing: `#/app/organizer`, `#/app/organizer/create`, `#/app/organizer/:id`, `#/app/organizer/:id/edit`
- Authorized check-in: `#/app/check-in`
- Wallet, network, explorer, and disconnect: `#/app/account`
- Usage instructions: `#/app/help`

Reads refresh every ten seconds and after transaction confirmation. The UI shows the last loaded block and stale-data errors. A submitted transaction with unknown confirmation status stays locked until its status is checked, preventing duplicate submissions. Transfer history loads recent block ranges first, with earlier records available on demand.

## Ticket check-in

Ticket owners explicitly sign an EIP-712 `CheckIn` proof bound to the chain, contract, ticket ID, transfer nonce, and expiration. QR codes expire after ten minutes and previous signatures become invalid when ownership changes. Authorized organizer or staff wallets verify and submit the proof during the event window. Used tickets cannot be transferred. Contract-wallet signatures use ERC-1271 via OpenZeppelin SignatureChecker.

Check-in supports camera scanning, image upload, and pasting decoded QR contents. Camera access requires HTTPS in a hosted deployment (localhost is supported). A ticket number alone cannot authorize entry. Signed QR codes should be shown only to event staff; possession of a valid signed code allows staff to admit its holder.

Ticket sales remain open before and during the event, until its end time (or until the tier sells out). The event page displays the sale deadline.

Event dates and tier terms are fixed at publication. The organizer can edit descriptive event details before the start, manage staff access, and withdraw proceeds. The contract does not implement cancellations or refunds.

## Validation

```sh
npm run test:ui
node scripts/check-live.mjs
npm run contract:test
```

UI checks require the dev server and Microsoft Edge. They verify the public landing, favicon, required BOT Chain links, mobile layout, missing-wallet guidance, and every wallet-gated route without injecting a fake wallet or replacing network responses. Live checks read the actual deployed testnet contract and inspect `dist` to ensure environment credentials are absent.

Contract tests run only on an isolated local chain (1337 or 31337), never the public deployment. Start Anvil or another development node with mnemonic `test test test test test test test test test test test junk`, then run `npm run contract:test`. `TEST_RPC_URL` can override localhost port 8545. Tests deploy their own fixture and verify tier payments, limits, NFT ownership, authorized transfers, QR signatures and expiration, nonce invalidation, chain binding, staff access, single-use admission, withdrawals, metadata, and event pagination.

## Public website

`dist/` is an independent static website. Vercel and Netlify configuration files are included; build with `npm run build` and publish `dist` over HTTPS. No blockchain secrets are needed by the hosting provider or public website. Hash routes work on ordinary static hosts without server rewrites. A hosting account/domain is needed to publish a public URL.

Both the landing and app footer display **BOT Chain** with links to [botchain.ai](https://botchain.ai) and [scan.botchain.ai](https://scan.botchain.ai), plus the actual deployed testnet contract.

References: [BOT Chain network configuration](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [Blockscout verification API](https://docs.blockscout.com/devs/verification/blockscout-smart-contract-verification-api), [OpenZeppelin ERC-721](https://docs.openzeppelin.com/contracts/5.x/erc721), [ethers providers](https://docs.ethers.org/v6/api/providers/).

## Sales cutoff revision

Version 2 references the original deployment at `0x1b2615E2f5596b70Dee522a8d558ddc3f284C10e`. The original contract closed purchases at the event start time; version 2 closes them at the end time. The real Sparks event was migrated using its organizer wallet, preserving its original start/end times, event details, and ticket tiers. It had no issued tickets. Original deployment source, ABI, compiler input, and configuration are archived under `deployments/0x1b2615E2f5596b70Dee522a8d558ddc3f284C10e/`.

The restricted `importLegacyEvent` method accepts only the original event organizer, refuses events with issued tickets or an elapsed end time, and prevents duplicate imports. The one-time `scripts/upgrade-sales-testnet.mjs` script checks the exact original state, verifies the imported data and live purchase availability, and activates the new configuration only after those checks pass. No ticket purchase or mock data is created during migration.

Redeploy the updated project on Vercel to publish the new address and cutoff logic. Use the same `npm run build` command, `dist` output directory, and no hosting environment variables.
