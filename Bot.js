import ethers from "ethers";
import input from "input";
import clear from 'clear';
import ps from 'prompt-sync';
const prompt = ps ({sigint: true});
import dotenv from 'dotenv';
import axios from 'axios';
import {readFile} from 'fs/promises';
import beep from 'beepbeep';
//import 'web3'
import web3 from 'web3';

dotenv.config();
const _abi = JSON.parse(await readFile(new URL('./abi.json', import.meta.url)));
const _pcsAbi = new ethers.utils.Interface(_abi);

const _data = {
    MAIN_ADDR: process.env.ADDR,
    ROUTER_ADDR: process.env.ROUTER_ADDR,
    WSS_NODE: process.env.WSS_NODE,
    WALLET_ADDRESS: process.env.WALLET_ADDRESS,
    WALLET_PRIVATEKEY: process.env.PRIVATEKEY,
    HONEYPOT: process.env.HONEYPOT,
    GWEI_BUY_TOKEN: ethers.utils.parseUnits(process.env.GWEI_BUY_TOKEN, "gwei"),
    GAS_LIMIT_BUY_TOKEN: process.env.GAS_LIMIT_BUY_TOKEN,
    GWEI_APPROVE_TOKEN: ethers.utils.parseUnits(process.env.GWEI_APPROVE_TOKEN, "gwei"),
    GAS_LIMIT_APPROVE_TOKEN: process.env.GAS_LIMIT_APPROVE_TOKEN,
    GWEI_SELL_TOKEN: ethers.utils.parseUnits(process.env.GWEI_SELL_TOKEN, "gwei"),
    GAS_LIMIT_SELL_TOKEN: process.env.GAS_LIMIT_SELL_TOKEN,
    BUY_AMOUNT: ethers.utils.parseUnits(process.env.BUY_AMOUNT, "ether"),
    TOKEN_AMOUNT_TO_SELL: process.env.TOKEN_AMOUNT_TO_SELL,
    PURCHASE_TOKEN_ADDR: process.env.PURCHASE_TOKEN_ADDR,
    SLIPPAGE: process.env.SLIPPAGE
};

var _tradingEnabled = true;
const provider = new ethers.providers.WebSocketProvider(_data.WSS_NODE);
const wallet = new ethers.Wallet(_data.WALLET_PRIVATEKEY);
const account = wallet.connect(provider);

const TransferFunc = new ethers.Contract(
    _data.ROUTER_ADDR,
    _pcsAbi,
    account
);

const CheckFunc = new ethers.Contract(
    _data.PURCHASE_TOKEN_ADDR,
    [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function approve(address spender, uint amount) public returns(bool)',
        'function balanceOf(address account) external view returns (uint256)',
        'function decimals() view returns (uint8)'
    ],
    account
);

const ApproveToken = async() => {
    const symbol =  await CheckFunc.symbol();
    console.log("Approving Token", symbol);

    try{
        const approveToken = await CheckFunc.approve(TransferFunc.address, ethers.constants.MaxUint256, {
            gasLimit: _data.GAS_LIMIT_APPROVE_TOKEN,
            gasPrice: _data.GWEI_APPROVE_TOKEN
        });
        const rec = await approveToken.wait();
        console.log(`Transaction : https://www.bscscan.com/tx/${rec.transactionHash}`);
    }catch(err){
        let error = JSON.parse(JSON.stringify(err));
        console.log(
            `Error caused by :
            {
                reason : ${error.reason},
                transactionHash : ${error.transactionHash}
            }
            `
        );
    }
};

const BuyToken = async (buyAmount) =>{
    buyAmount = ethers.utils.parseUnits(buyAmount, "ether")
    try{
        const amountOut =  await TransferFunc.getAmountsOut(buyAmount, [_data.MAIN_ADDR, _data.PURCHASE_TOKEN_ADDR]);
        const amountOutMin = amountOut[1].sub(amountOut[1].mul(_data.SLIPPAGE).div(100));
        const transaction = await TransferFunc.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            buyAmount,
            "0",
            [_data.MAIN_ADDR, _data.PURCHASE_TOKEN_ADDR],
            _data.WALLET_ADDRESS,
            Date.now() + 1000 * 60 * 5,
            {
                gasLimit: _data.GAS_LIMIT_BUY_TOKEN,
                gasPrice: _data.GWEI_BUY_TOKEN
            }
        );

        const rec = await transaction.wait();
        console.log(`Transaction : https://www.bscscan.com/tx/${rec.transactionHash}`);
        const symb = await CheckFunc.symbol();
        const balance = await CheckFunc.balanceOf(_data.WALLET_ADDRESS);
        const dec = await CheckFunc.decimals();
        const amt = await TransferFunc.getAmountsOut(balance, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);

        console.log("YOUR BALANCE: ", parseFloat(amt[0]/10**dec).toString().substring(0,6), symb, 'WORTH: ', parseFloat(amt[1]/10**18).toString().substring(0,6));


    }catch(err){
        let error = JSON.parse(JSON.stringify(err));
        console.log(
            `Error caused by :
            {
                reason : ${error.reason},
                transactionHash : ${error.transactionHash}
            }
            `
        );
    }
};

const SellToken = async (sellAmount) =>{
    try{
        const dec = await CheckFunc.decimals();
        const purchaseAmount = ethers.utils.parseUnits(sellAmount, dec);
        const amountOut =  await TransferFunc.getAmountsOut(purchaseAmount, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);
        const amountOutMin = amountOut[1].sub(amountOut[1].mul(_data.SLIPPAGE).div(100));
       
        const transaction = await TransferFunc.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            purchaseAmount,
            "0",
            [ _data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR],
            _data.WALLET_ADDRESS,
            Date.now() + 1000 * 60 * 5,
            {
                gasLimit: _data.GAS_LIMIT_SELL_TOKEN,
                gasPrice: _data.GWEI_SELL_TOKEN
            }
        );

        const rec = await transaction.wait();
        console.log(`Transaction : https://www.bscscan.com/tx/${rec.transactionHash}`);
        const symb = await CheckFunc.symbol();
        const balance = await CheckFunc.balanceOf(_data.WALLET_ADDRESS);       
        const amt = await TransferFunc.getAmountsOut(balance, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);

        console.log("YOUR BALANCE: ", parseFloat(amt[0]/10**dec).toString().substring(0,6), symb);


    }catch(err){
        let error = JSON.parse(JSON.stringify(err));
        console.log(
            `Error caused by :
            {
                reason : ${error.reason},
                transactionHash : ${error.transactionHash}
            }
            `
        );
    }
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const TokenPrice = async () =>{
    const dec = await CheckFunc.decimals();
    const purchaseAmount = ethers.utils.parseUnits("1", dec);
    const amountOut =  await TransferFunc.getAmountsOut(purchaseAmount, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);
    let val = parseFloat(amountOut[1]/10**18).toString().substring(0,6)
    return val;
}

const MyUSDTEquivalent = async () =>{
    const balance = await CheckFunc.balanceOf(_data.WALLET_ADDRESS);
    const dec = await CheckFunc.decimals();
    const amt = await TransferFunc.getAmountsOut(balance, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);
    const value = parseFloat(amt[1]/10**18).toString().substring(0,6)
    return value;
}

const MyTokenBalance = async () =>{
    const balance = await CheckFunc.balanceOf(_data.WALLET_ADDRESS);
    const dec = await CheckFunc.decimals();
    const amt = await TransferFunc.getAmountsOut(balance, [_data.PURCHASE_TOKEN_ADDR, _data.MAIN_ADDR]);
    const TokenValue = parseFloat(amt[0]/10**dec).toString().substring(0,6)
    return TokenValue;
}

const begin = async() => {
    clear();

    ApproveToken();

    let value = 1
    var buyOrder = true;
    let iter = 1
    var priceToday= []

    // Infinite Loop
    while(value < 2){
        const current = new Date();
        const date = `${current.getDate()}/${current.getMonth()+1}/${current.getFullYear()}`;
        const time = current.getHours() + ':' + current.getMinutes() + ':' + current.getSeconds();
        (async () => {
            let tokenPrice = await TokenPrice() // query pancakeswap to get the price in USDT
            let tokenValue = await MyTokenBalance()
            let usdtValue = await MyUSDTEquivalent()
            var currentPrice = parseFloat(tokenPrice)
            priceToday = priceToday.concat(currentPrice)
            let minPrice = Math.min(...priceToday)
            let maxPrice = Math.max(...priceToday)
            console.log("=====================================================")
            console.log("       ")
            console.log("#####################################################")
            console.log("ITERATION ", iter, "DATE:", date, "TIME:", time)
            console.log("#####################################################")
            console.log("       ")
            console.log("*****************************************************")
            console.log("TOKEN VALUE IN USDT IS ", usdtValue)
            console.log("TOKEN IPC TOKEN IN WALLET IS ", tokenValue)
            console.log("MINIMUM PRICE", minPrice)
            console.log(`CURRENT IPC PRICE: ${tokenPrice}`);
            console.log("MAXIMUM PRICE", maxPrice)
            console.log("       ")
            usdtValue > 1 ? console.log("CURRENT PROFIT IS ", usdtValue - 100): "";
            
            if(!buyOrder && usdtValue > 110){
                beep()
                if (tokenValue > 1){
                    console.log("SELL TOKEN! SELL TOKEN!! SELL TOKEN!!!")
                    SellToken(tokenValue);
                    buyOrder = true
                }
            } 
            
            if (buyOrder && tokenPrice < 0.4200 ){
                beep()
                if (usdtValue < 1){
                    console.log("BUY TOKEN! BUY TOKEN!! BUY TOKEN!!!")
                    BuyToken("100");
                    buyOrder = false
                }
            }
            
            console.log("*****************************************************")
            console.log("       ")
            console.log("=====================================================")
            console.log("       ")
            console.log("       ")
        })();

        await timeout(3600)//timeout(1800 * 5) === 2 * 5 seconds
        iter +=1;
    }
};

begin();