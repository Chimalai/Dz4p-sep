
# Dzap-Auto-Bot

This is a Node.js script for automating the bridging of ETH between Sepolia (Ethereum Testnet) and Arbitrum Sepolia, leveraging the Dzap API to get quotes and build transactions. The bot is designed to run continuously, managing multiple wallets and performing customizable transaction cycles.

## Features

-   **Automated Bridging:** Performs configurable cycles of ETH bridging from Sepolia to Arbitrum Sepolia and back.
-   **Multi-Wallet Support:** Easily manage multiple wallets by adding private keys to the `.env` file.
-   **Configurable Cycles:** Set the number of bridge transactions for each direction (`ethToArbCount`, `arbToEthCount`).
-   **Customizable Amounts:** Adjust the ETH amount for each bridge transaction.
-   **Scheduled Automation:** Runs continuously with a configurable loop interval.
-   **Real-time Logging:** Provides detailed terminal output for balances, transaction statuses, and links.
-   **Automatic Points Claiming:** The bot is configured to trigger a point-claiming mechanism with each successful transaction.

## Prerequisites

-   Node.js (v18 or higher recommended)
-   npm (Node Package Manager)

## Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/Chimalai/Dz4p-sep.git
    cd Dz4p-sep
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```
    This will install `ethers`, `axios`, and `colors`.

3.  **Configure Environment Variables & API Keys**
    * Create a `.env` file in the root directory and add your private keys:

        ```
        # Add multiple private keys as needed
        PRIVATE_KEY_1=0x...
        PRIVATE_KEY_2=0x...
        # Or for a single key
        PRIVATE_KEY=0x...
        ```
    * Create an `apikeys.txt` file and add your Alchemy API key. You can get an API key from the official [Alchemy website](https://www.alchemy.com/).

        ```
        ALCHEMY_API_KEY=YOUR_ALCHEMY_API_KEY_HERE
        ```

## Configuration

You can customize the bot's behavior by editing the `config` object at the top of the `Dzap-Auto-Bot.js` file:

-   `ethToArbCount` & `arbToEthCount`: Number of bridge transactions per loop for each direction.
-   `bridgeAmount`: The amount of ETH to bridge in each transaction.
-   `delayBetweenTxSeconds`: Delay between individual transactions within a loop.
-   `loopIntervalMinutes`: The interval (in minutes) for the bot to repeat the process.

## Usage

To start the bot, run the following command in your terminal:

```bash
node main.js
```
##Dev
Created by PetrukStar

## Community
Join now with VIP room
https://t.me/SatpolPProbot
Created by: https://t.me/PetrukStar
Channel: https://t.me/SeputarNewAirdropp