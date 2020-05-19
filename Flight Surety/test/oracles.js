var Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');
const BN = require('bn.js');

contract('Oracles', async (accounts) => {

    const TEST_ORACLES_COUNT = 20;
    const STATUS_CODE_UNKNOWN = 0;
    const STATUS_CODE_ON_TIME = 10;
    const STATUS_CODE_LATE_AIRLINE = 20;
    const STATUS_CODE_LATE_WEATHER = 30;
    const STATUS_CODE_LATE_TECHNICAL = 40;
    const STATUS_CODE_LATE_OTHER = 50;

    var config;
    before('setup contract', async () => {
        config = await Test.Config(accounts);
    });


    it('can register oracles', async () => {

        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

        for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
            await config.flightSuretyApp.registerOracle({from: accounts[a], value: fee});
            let result = await config.flightSuretyApp.getMyIndexes.call({from: accounts[a]});
            console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
        }
    });

    it('can request flight status', async () => {
    
      
        let flight = 'ND1309'; 
        let timestamp = Math.floor(Date.now() / 1000);
    
        
        await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, flight, timestamp);
        
    
        
        for(let a=1; a<TEST_ORACLES_COUNT; a++) {
          
          let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[a]});
          for(let idx=0;idx<3;idx++) {
              console.log(a);
            try {
              
              tx = await config.flightSuretyApp.submitOracleResponse(oracleIndexes[idx], config.firstAirline, flight, timestamp, STATUS_CODE_ON_TIME, { from: accounts[a] });
              console.log('success', tx) ;
            }
            catch(e) {
              
               console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
            }
    
          }
        }
    });
});
