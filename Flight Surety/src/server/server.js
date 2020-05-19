import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import 'babel-polyfill';

const STATUS_CODES = [0, 10, 20, 30, 40, 50];

const NUM_ORACLES = 100;

let count = 0;
const OPTIONS = {
    defaultBlock :"latest",
    transactionConfirmationBlocks: 1,
    transactionBlockTimeout: 600
};

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress, OPTIONS);
let flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.dataAddress, OPTIONS);

let accounts;

web3.eth.getAccounts(async (error, a) => {
    accounts = a;
    await init_server();

    await flightSuretyApp.events.OracleRequest({
        fromBlock: 0
    }, request_handler);

    await flightSuretyData.events.InsureeCredited({
        fromBlock: 0
    }, async (error, event) => {
        if(error) console.log(error);
        console.log("%s Credit for %s, new value %d", event.returnValues.credit, event.returnValues.insuree, event.returnValues.total);
    });

});

const app = express();

app.get('/api/count', (req, res) => {
    res.send({
        message: count
    })
});

app.get('/api', (req, res) => {
    res.send({
        message: 'An API for use with your Dapp!'
    })
});

function random(x, y) {
    return Math.floor(Math.random() * (y - x + 1)) + x;
}

async function init_server() {
    const fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    for (let i = 0; i < NUM_ORACLES; i++) {
        console.log(i);
        await flightSuretyApp.methods.registerOracle().send({value: fee, from: accounts[i], gas: 3000000});
    }
}

async function request_handler(error, event) {
    if (error) console.log(error);
    try {
        for (let i = 0; i < NUM_ORACLES; i++) {
            let indexes = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[i]});
            if (indexes.indexOf(event.returnValues.index) >= 0) {
                console.log("Oracle %d, address %s, indexes %d %d %d, select: %s", i, accounts[i], indexes[0], indexes[1], indexes[2], event.returnValues.index);
                const pos = random(0, STATUS_CODES.length - 1);
                ++count;
                await flightSuretyApp.methods
                    .submitOracleResponse(
                        event.returnValues.index,
                        event.returnValues.airline,
                        event.returnValues.flight,
                        event.returnValues.timestamp,
                        STATUS_CODES[pos]
                    )
                    .send({from: accounts[i], gas: 5000000});
            }
        }
    } catch (e) {
        console.log(e);
    }
}

export default app;


