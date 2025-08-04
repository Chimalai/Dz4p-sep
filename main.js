import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import axios from 'axios';
import colors from 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apikeysPath = path.resolve(__dirname, 'apikeys.txt');

let alchemyApiKey = '';
try {
    const apikeysFileContent = fs.readFileSync(apikeysPath, { encoding: 'utf-8' });
    const match = apikeysFileContent.match(/^ALCHEMY_API_KEY=(.*)$/m);
    if (match) {
        alchemyApiKey = match[1].trim();
    }
} catch (error) {
    throw new Error("Failed to read ALCHEMY_API_KEY from apikeys.txt file! Ensure the file exists and contains ALCHEMY_API_KEY=...");
}

const config = {
    sepoliaRpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
    arbitrumSepoliaRpcUrl: `https://arb-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
    ethToArbCount: 3,
    arbToEthCount: 3,
    bridgeAmount: "0.0001",
    delayBetweenTxSeconds: 30,
    loopIntervalMinutes: 300,
};

let privateKeys = [];
try {
    const envPath = path.resolve(__dirname, '.env');
    const envFileContent = fs.readFileSync(envPath, { encoding: 'utf-8' });

    const matches = envFileContent.match(/^PRIVATE_KEY_(\d+)=(.*)$/gm);
    if (matches) {
        privateKeys = matches.map(match => {
            const parts = match.split('=');
            return parts[1].trim();
        });
    }

    if (privateKeys.length === 0) {
        const singleMatch = envFileContent.match(/^PRIVATE_KEY=(.*)$/m);
        if (singleMatch) {
            privateKeys.push(singleMatch[1].trim());
        }
    }
} catch (error) {
    privateKeys = [];
}

if (privateKeys.length === 0) {
    throw new Error("Failed to read PRIVATE_KEY(s) from .env file! Ensure the file exists and contains PRIVATE_KEY=0x... or PRIVATE_KEY_N=0x...");
}

const sepoliaProvider = new ethers.JsonRpcProvider(config.sepoliaRpcUrl);
const arbitrumProvider = new ethers.JsonRpcProvider(config.arbitrumSepoliaRpcUrl);
const chainIds = { sepolia: 11155111, arbitrum: 421614 };

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const randomDelay = (minSeconds, maxSeconds) => {
    const delay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds);
    console.log(colors.gray(`    ... Waiting for random ${delay} seconds before next account ...`));
    return new Promise(resolve => setTimeout(resolve, delay * 1000));
};

const displayBanner = () => {
    console.log(colors.cyan.bold(
`╔═════════════════════════════════════════════╗
║             Dzap-Auto-Bot             ║
║           Created by PetrukStar           ║
╚═════════════════════════════════════════════╝`
    ));
    console.log();
};

const displayBalances = async (accountAddress) => {
    try {
        const [sepoliaWei, arbitrumWei] = await Promise.all([
            sepoliaProvider.getBalance(accountAddress),
            arbitrumProvider.getBalance(accountAddress)
        ]);
        const sepoliaBalance = ethers.formatEther(sepoliaWei);
        const arbitrumBalance = ethers.formatEther(arbitrumWei);

        console.log(`============ Wallet: ${accountAddress.substring(0, 6)}...${accountAddress.substring(accountAddress.length - 4)} ============`);
        console.log(colors.yellow(`   Sepolia ETH: ${parseFloat(sepoliaBalance).toFixed(6)}`));
        console.log(colors.yellow(`   Arbitrum ETH: ${parseFloat(arbitrumBalance).toFixed(6)}`));
        console.log(`===============================================`);
    } catch (error) {
        console.error(colors.red("Failed to get balances:"), error.message);
    }
};

async function performBridge(fromChainName, toChainName, amountInEth, walletInstance, accountAddress) {
    const fromChainId = chainIds[fromChainName];
    const toChainId = chainIds[toChainName];
    const amountInWei = ethers.parseEther(amountInEth).toString();

    const quotePayload = { fromChain: fromChainId, account: accountAddress, data: [{ amount: amountInWei, destDecimals: 18, destToken: "0x0000000000000000000000000000000000000000", slippage: 1, srcDecimals: 18, srcToken: "0x0000000000000000000000000000000000000000", toChain: toChainId }], integratorId: "dzap" };
    const quoteResponse = await axios.post('https://api.dzap.io/v1/bridge/quote', quotePayload);
    const quoteKey = `${fromChainId}_0x0000000000000000000000000000000000000000-${toChainId}_0x0000000000000000000000000000000000000000`;
    if (!quoteResponse.data[quoteKey]?.recommendedSource) throw new Error("Failed to get route from quote API.");
    const recommendedRoute = quoteResponse.data[quoteKey].recommendedSource;

    const buildTxPayload = { fromChain: fromChainId, data: [{ amount: amountInWei, srcToken: "0x0000000000000000000000000000000000000000", destDecimals: 18, srcDecimals: 18, selectedRoute: recommendedRoute, destToken: "0x0000000000000000000000000000000000000000", slippage: 1, permitData: "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000", recipient: accountAddress, toChain: toChainId }], integratorId: "dzap", refundee: accountAddress, sender: accountAddress, publicKey: accountAddress };
    const buildTxResponse = await axios.post('https://api.dzap.io/v1/bridge/buildTx', buildTxPayload);
    const txBuildData = buildTxResponse.data;
    if (txBuildData.status !== 'success') throw new Error(`buildTx API failed: ${JSON.stringify(txBuildData)}`);

    const tx = { to: txBuildData.to, from: txBuildData.from, value: ethers.toBigInt(txBuildData.value), data: txBuildData.data, gasLimit: ethers.toBigInt(txBuildData.gasLimit), chainId: txBuildData.chainId };
    const txResponse = await walletInstance.sendTransaction(tx);
    await txResponse.wait();

    const explorerBaseUrl = fromChainName === 'arbitrum' ? 'https://sepolia.arbiscan.io' : `https://sepolia.etherscan.io`;
    return `${explorerBaseUrl}/tx/${txResponse.hash}`;
}

async function runSingleAccountProcess(privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    const sepoliaWallet = wallet.connect(sepoliaProvider);
    const arbitrumWallet = wallet.connect(arbitrumProvider);
    const accountAddress = wallet.address;

    console.log(colors.blue(`\n--- Starting process for account: ${accountAddress.substring(0, 6)}...${accountAddress.substring(accountAddress.length - 4)} ---`));
    await displayBalances(accountAddress);

    if (config.ethToArbCount > 0) {
        console.log(`\n--- Starting ${config.ethToArbCount}x SEPOL > ARB ---`);
        for (let i = 1; i <= config.ethToArbCount; i++) {
            try {
                console.log(`▶ [${i}/${config.ethToArbCount}] Bridging ${config.bridgeAmount} ETH...`);
                const link = await performBridge('sepolia', 'arbitrum', config.bridgeAmount, sepoliaWallet, accountAddress);
                console.log(`    ✅ ${link}`);
                console.log(`    ${colors.green('✅')} Claim 5 Points`);
            } catch (error) {
                console.error(`    ❌ [${i}/${config.ethToArbCount}] Failed: ${error.message.substring(0, 120)}...`);
            }
            if (i < config.ethToArbCount) {
                console.log(`    ... Waiting for ${config.delayBetweenTxSeconds} seconds ...`);
                await sleep(config.delayBetweenTxSeconds);
            }
        }
    }

    if (config.arbToEthCount > 0) {
        console.log(`\n--- Starting ${config.arbToEthCount}x ARB > SEPOL ---`);
        for (let i = 1; i <= config.arbToEthCount; i++) {
            try {
                console.log(`▶ [${i}/${config.arbToEthCount}] Bridging ${config.bridgeAmount} ETH...`);
                const link = await performBridge('arbitrum', 'sepolia', config.bridgeAmount, arbitrumWallet, accountAddress);
                console.log(`    ✅ ${link}`);
                console.log(`    ${colors.green('✅')} Claim 5 Points`);
            } catch (error) {
                console.error(`    ❌ [${i}/${config.arbToEthCount}] Failed: ${error.message.substring(0, 120)}...`);
            }
            if (i < config.arbToEthCount) {
                console.log(`    ... Waiting for ${config.delayBetweenTxSeconds} seconds ...`);
                await sleep(config.delayBetweenTxSeconds);
            }
        }
    }

    console.log(colors.blue(`--- Process for ${accountAddress.substring(0, 6)}...${accountAddress.substring(accountAddress.length - 4)} complete ---`));
}

async function runAllAccountsProcess() {
    for (let i = 0; i < privateKeys.length; i++) {
        await runSingleAccountProcess(privateKeys[i]);
        if (i < privateKeys.length - 1) {
            await randomDelay(3, 5);
        }
    }
    console.log("\n--- All accounts processed in this round ---");
}

async function main() {
    displayBanner();
    await runAllAccountsProcess();

    if (privateKeys.length > 0) {
        console.log(colors.blue(`\nThe entire multi-account process will repeat every 5 hours.`));
        setInterval(() => runAllAccountsProcess(), config.loopIntervalMinutes * 60 * 1000);
    } else {
        console.log("\nBot finished because no private keys were found.");
    }
}

main().catch(error => console.error(colors.red("A fatal error occurred:"), error));
