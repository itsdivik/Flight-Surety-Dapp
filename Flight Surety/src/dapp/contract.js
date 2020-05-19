import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network) {
        this.config = Config[network];
        this.web3 = new Web3(new Web3.providers.WebsocketProvider(this.config.url.replace('http', 'ws')));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, this.config.appAddress, {
            gas: 4712388,
            gasPrice: 100000000000
        });
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, this.config.dataAddress, 2);
        this.airlines = [];
        this.passengers = [];
        this.owner = null;
    }

    async initialize() {
        console.log("initializing");
        await this.web3.eth.getAccounts(async (error, accts) => {

            this.owner = accts[0];

            let counter = 1;

            while (this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while (this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }


            await this.flightSuretyApp.events.allEvents({ fromBlock: 'latest' })
                .on('data', console.log)
                .on('changed', console.log)
                .on('error', console.log);

            await this.flightSuretyData.events.allEvents({ fromBlock: 'latest' })
                .on('data', console.log)
                .on('changed', console.log)
                .on('error', console.log);

        });
    }

    getConfig() {
        return this.config;
    }

    async isOperational() {
        let self = this;
        return await self.flightSuretyApp.methods
            .isOperational()
            .call({from: self.owner, gas: 4712388, gasPrice: 100000000000});
    }
    
    async authorizeContract(address) {
        let self = this;
        let payload = {
            address: address
        };
        return await self.flightSuretyData.methods
            .authorizeCaller(payload.address)
            .send({from: self.owner});
    }

    async getFlights() {
        let self = this;
        return await self.flightSuretyData.methods
            .getFlights()
            .call({from: self.owner});
    }

    async fetchFlightStatus(flight, timestamp) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp
        };
        return await self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .call({from: self.owner});
    }

    async buyInsurance(flight, timestamp, value) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: timestamp
        };
        return await self.flightSuretyApp.methods
            .buyInsurance(payload.flight, payload.timestamp, payload.airline)
            .send({from: self.owner, value: value, gas: 4712388, gasPrice: 100000000000});
    }

    async registerAirline(flight, wallet) {
        let self = this;
        let payload = {
            name: flight,
            airline: wallet
        };
        return await self.flightSuretyApp.methods
            .registerAirline(payload.name, payload.airline)
            .send({from: self.owner, gas: 4712388, gasPrice: 100000000000});
    }

    async registerFlight(flight, timestamp, wallet) {
        let self = this;
        let payload = {
            name: flight,
            timestamp: timestamp,
            airline: wallet
        };
        return await self.flightSuretyApp.methods
            .registerFlight(payload.name, payload.timestamp, payload.airline)
            .send({from: self.owner, gas: 4712388, gasPrice: 100000000000});
    }
    async checkFunds() {
        let self = this;
        return await self.flightSuretyData.methods
            .checkFunds(self.owner)
            .send({from: self.owner, gas: 4712388, gasPrice: 100000000000});
    }
    async withdraw() {
        let self = this;
        return await self.flightSuretyApp.methods
            .getFunds()
            .send({from: self.owner, gas: 4712388, gasPrice: 100000000000});
    }
}