const Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');
const BN = require('bn.js');

let INITIAL_FUND = 0;
let MAX_INSURANCE_POLICY = 0;

contract('Flight Surety Tests', async (accounts) => {

    let config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
        INITIAL_FUND = await config.flightSuretyData.AIRLINE_MIN_FUNDS.call();
        MAX_INSURANCE_POLICY = await config.flightSuretyData.MAX_INSURANCE_POLICY.call();
        await config.flightSuretyApp.sendTransaction({from: config.firstAirline, value: INITIAL_FUND});
        await config.flightSuretyApp.registerAirline('Root Air', config.firstAirline, {from: config.owner});
    });

 
    it(`(multiparty) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });

    it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false, {from: config.testAddresses[2]});
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try {
            await config.flightSuretyData.setOperatingStatus(false);
        } catch (e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");

    });

    it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try {
            await config.flightSurety.setTestingMode(true);
        } catch (e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });

    it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
        let newAirline = accounts[2];
        let failAirline = accounts[99];
        try {
            await config.flightSuretyApp.registerAirline("My Airline", newAirline, {from: config.firstAirline});
        } catch (e) {

        }
        let result = await config.flightSuretyData.isAirlineRegistered.call(newAirline);
        assert.equal(result, true, "Airline should be registered");
        result = await config.flightSuretyData.isAirlineFunded.call(newAirline);
        assert.equal(result, false, "Airline should not be funded");
        try {
            await config.flightSuretyApp.registerAirline("My Airline", failAirline, {from: newAirline});
        } catch (e) {
        }
        result = await config.flightSuretyData.isAirlineRegistered.call(failAirline);
        assert.equal(result, false, "Unfunded airline should not be able to register new airline");
    });

    it("First airline is registered when contract is deployed", async () => {
        let result = await config.flightSuretyData.isAirlineRegistered.call(config.firstAirline);
        assert.equal(result, true, "First Airline should always be registered");
    });

    it("Only existing airline may register a new airline until there are at least four airlines registered", async () => {
        const account_offset = 4; // start with 3 because  1 and 2 are already in use (use clean address)
        const max_airlines = 2; // four minus two which are already registered

        for (let i = 0; i < max_airlines; ++i) {
            try {
                await config.flightSuretyApp.sendTransaction({from: accounts[i + account_offset], value: INITIAL_FUND});
                await config.flightSuretyApp.registerAirline("My Airline", accounts[i + account_offset], {from: config.firstAirline});
            } catch (e) {
                console.log(e)
            }
            let result = await config.flightSuretyData.isAirlineRegistered.call(accounts[i + account_offset]);
            assert.equal(result, i < max_airlines, "Airline should not be able to register another airline until there are at least four airlines registered");
        }
    });

    it("Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines", async () => {
        const account_offset = 6; // account_offset + max_airlines of previous test (aligned)
        const vote_offset = 4; // account_offset of previous test
        const max_airlines = 10;

        for (let i = 0; i < max_airlines; ++i) {
            await config.flightSuretyApp.sendTransaction({from: accounts[i + account_offset], value: INITIAL_FUND});
            let count = new BN(await config.flightSuretyData.getAirlineCount.call());
            let votes_needed = Math.ceil(count / 2);
            for (let k = 0; k < votes_needed; ++k) {
                try {
                    await config.flightSuretyApp.registerAirline("My Airline", accounts[i + account_offset], {from: accounts[k + vote_offset]});
                } catch (e) {
                    console.log(e)
                }
                let result = await config.flightSuretyData.isAirlineRegistered.call(accounts[i + account_offset]);
                assert.equal(result, k === (votes_needed - 1), "multi-party consensus failed");
            }
        }
    });

    it("Airline can be registered, but does not participate in contract until it submits funding of 10 ether", async () => {
        //see previous tests
        let unfunded_airline = accounts[2];
        let new_airline = accounts[97];
        let funded = await config.flightSuretyData.isAirlineFunded.call(unfunded_airline);
        assert.equal(funded, false, "Airline should be unfunded");
        let pass;
        try {
            await config.flightSuretyApp.registerAirline("New airline", new_airline, {from: unfunded_airline});
            pass = true;
        } catch (e) {
            pass = false;
        }
        assert.equal(pass, false, "Airline should not be able to participate without funding");

    });

    it("Register Flight", async () => {

        for (let i = 0; i< 10; ++i) {
            let airline = accounts[i];
            let name = "Flight " + i;
            let timestamp = 12345678;
            await config.flightSuretyApp.sendTransaction({from: airline, value: INITIAL_FUND});
            let funded = await config.flightSuretyData.isAirlineFunded.call(airline);
            assert.equal(funded, true, "Airline should be funded");
            let reg = await config.flightSuretyData.isFlightRegistered(name, timestamp, airline, {from: airline});
            assert.equal(reg, false, "Flight is already registered");
            await config.flightSuretyApp.registerFlight(name, timestamp, airline, {from: airline});
            let pass = await config.flightSuretyData.isFlightRegistered(name, timestamp, airline, {from: airline});
            assert.equal(pass, true, "Airline should be able to Register a flight");
        }


    });

    it("Passengers may pay up to 1 ether for purchasing flight insurance.", async () => {
            let airline = accounts[12];
            let customer = accounts[99];
            let timestamp = 12345678;
            let insurance_values = [
                new BN(web3.utils.toWei('2', "ether")),
                new BN(web3.utils.toWei('0.1', "ether")),
                new BN(web3.utils.toWei('1', "ether")),
                new BN(web3.utils.toWei('20', "ether")),
                new BN(web3.utils.toWei('0.0001', "ether")),
                new BN(web3.utils.toWei('0.0000000000001', "ether")),
                new BN(web3.utils.toWei('1', "wei")),
            ];

            for (var i = 0, len = insurance_values.length; i < len; i++) {
                let name = "Flight " + i;
                let insurance_value = insurance_values[i];
                let overpaid_amount = new BN('0');
                if (insurance_value.gt(MAX_INSURANCE_POLICY)) {
                    overpaid_amount = insurance_value.sub(MAX_INSURANCE_POLICY);
                }
                let tx = await config.flightSuretyApp.buyInsurance(name, timestamp, accounts[i], {
                    from: customer,
                    value: insurance_value
                });
                let newTx = await truffleAssert.createTransactionResult(config.flightSuretyData, tx.tx);

                if (overpaid_amount > 0) {
                    truffleAssert.eventEmitted(newTx, 'InsureeCredited', null, 'InsureeCredited should be emitted at all');
                    truffleAssert.eventEmitted(newTx, 'InsureeCredited', (ev) => {
                        return ev.insuree === customer && ev.credit.eq(overpaid_amount);
                    }, 'InsureeCredit emited wrong parameters');
                } else {
                    truffleAssert.eventNotEmitted(newTx, 'InsureeCredited', null, 'Insuree should not gain any credit');
                }
            }
        }
    );

    it("If flight is delayed due to airline fault, passenger receives credit of 1.5X the amount they paid", async () => {
        let airline = accounts[7];
        let customer = accounts[55];
        let name = "Flight " + 7;
        let timestamp = 12345678;
        let min_responses = await config.flightSuretyApp.MIN_RESPONSES.call();
        let insurance_value = new BN(web3.utils.toWei('10', "ether"));
        let expected_payout;
        if(insurance_value.gt(MAX_INSURANCE_POLICY)) {
            expected_payout = MAX_INSURANCE_POLICY.add(MAX_INSURANCE_POLICY.div(new BN(2)));
        } else {
            expected_payout = insurance_value.add(insurance_value.div(new BN(2)));
        }

        let tx = await config.flightSuretyApp.buyInsurance( name, timestamp, airline, {
            from: customer,
            value: insurance_value
        });

        let TEST_ORACLES_COUNT = 30;

        // ARRANGE
        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

        // ACT
        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
            await config.flightSuretyApp.registerOracle({from: accounts[a], value: fee});
            let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
        }

        tx = await config.flightSuretyApp.fetchFlightStatus(airline, name, timestamp);
        truffleAssert.eventEmitted(tx, 'OracleRequest', {airline: airline, flight: name});

        let success_responses = 0;

        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {

            // Get oracle information
            let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
            for (let idx = 0; idx < 3; idx++) {
                let tx;
                try {
                    // Submit a response...it will only be accepted if there is an Index match
                    tx = await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], airline, name, timestamp, 20, {from: accounts[a]});
                } catch (e) {
                    continue;
                    // Enable this when debugging
                    // console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
                }

                let tx_data = await truffleAssert.createTransactionResult(config.flightSuretyData, tx.tx);
                truffleAssert.eventEmitted(tx, 'OracleReport');
                success_responses += 1;
                console.log("Success Responses: %d",success_responses);
                if (success_responses >= 3) {
                    truffleAssert.eventEmitted(tx, 'FlightStatusInfo');
                    truffleAssert.eventEmitted(tx_data, 'InsureeCredited', null, 'InsureeCredited was not emitted');
                    truffleAssert.eventEmitted(tx_data, 'InsureeCredited', (ev) => {
                        console.log("Event Credit: %d", web3.utils.fromWei(ev.credit.toString(), 'ether'));
                        console.log("Expected Payout: %d", web3.utils.fromWei(expected_payout.toString(), 'ether'));
                        return ev.insuree === customer && ev.credit.eq(expected_payout);
                    }, 'InsureeCredit emited wrong parameters');
                    return;
                }

            }
        }
        assert.equal(false, true, 'Should never reach this');
    });

    it("Passenger can withdraw any funds owed to them as a result of receiving credit for insurance payout", async () => {
        let customer = accounts[55];
        let balance = web3.utils.fromWei(await web3.eth.getBalance(customer), 'ether');
        let funds = web3.utils.fromWei(await config.flightSuretyData.checkFunds(customer), 'ether');
        let tx = await config.flightSuretyApp.getFunds({from: customer});
        let new_balance = web3.utils.fromWei(await web3.eth.getBalance(customer), 'ether');

        console.log("Passenger fund is %d",funds);
        console.log("Balance is %d", balance);
        console.log("New Balance is %d", new_balance);
        console.log("Withdrew %d", new_balance - balance);

        // To compare result, change variable type from string to float so it can return bool properly
        assert.equal(parseFloat(new_balance) > parseFloat(balance), true, 'New balance should be bigger');
    });
});
