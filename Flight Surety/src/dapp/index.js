import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;
    let flights = new Map();
    let contract = new Contract('localhost');
    await contract.initialize();

    {
        let operational = false;
        let error = null;
        try {
            operational = await contract.isOperational();
        } catch (e) {
            error = e;
        }
        display('Operational Status', 'Check if contract is operational', [{
            label: 'Operational Status',
            error: error,
            value: operational
        }]);
    }

    {
        let error = null;
        let f = [];
        try {
            f = await contract.getFlights();
        } catch (e) {
            error = e;
            console.log(error);
        }

        let y = 0;
        const KEY_NAME = '' + y++;
        const KEY_AIRLINE = '' + y++;
        const KEY_TIMESTAMP = '' + y++;

        for (let i = 0; i < f[KEY_NAME].length; ++i) {
            flights.set(''+i, {
                name: f[KEY_NAME][i],
                airline: f[KEY_AIRLINE][i],
                timestamp: f[KEY_TIMESTAMP][i]
            });
        }

        flights.forEach((flight, key) => {
            DOM.elid('flights-select').appendChild(DOM.option({id: key}, flight.name + " - " + flight.timestamp));
            DOM.elid('flights-select2').appendChild(DOM.option({id: key}, flight.name + " - " + flight.timestamp));
        });
    }

    DOM.elid('auth-addr').value = contract.getConfig().appAddress;

    DOM.elid('auth').addEventListener('click', async () => {
        let address = DOM.elid('auth-addr').value;

        let result;
        let error = null;
        try {
            result = await contract.authorizeContract(address);
        } catch (e) {
            error = e;
        }
        display('Auth', 'AuthorizeContract', [{label: 'Auth', error: error, value: JSON.stringify(result)}]);
    });

    DOM.elid('register-airline').addEventListener('click', async () => {
        let name = DOM.elid('airline-name').value;
        let wallet = DOM.elid('airline-wallet-address').value;

        let result;
        let error = null;
        try {
            result = await contract.registerAirline(name, wallet);
        } catch (e) {
            error = e;
        }
        display('Airline', '1.Airline Registration', [{label: 'Airline', error: error, value: JSON.stringify(result)}]);
    });

    DOM.elid('register-flight').addEventListener('click', async () => {
        let name = DOM.elid('text-flight').value;
        let timestamp = DOM.elid('num-timestamp').value;
        let wallet = DOM.elid('wallet-address').value;

        let result;
        let error = null;
        try {
            result = await contract.registerFlight(name, timestamp, wallet);
        } catch (e) {
            error = e;
        }

        flights.set(''+flights.size, {
            name: name,
            airline: 0,
            timestamp: timestamp
        });

        display('Flight', '2.Flight Registration', [{label: 'Flight', error: error, value: JSON.stringify(result)}]);
        DOM.elid('flights-select').appendChild(DOM.option({id: flights.size}, name + " - " + timestamp));
        DOM.elid('flights-select2').appendChild(DOM.option({id: flights.size}, name + " - " + timestamp));
    });

    DOM.elid('submit-insurance').addEventListener('click', async () => {
        let value = DOM.elid('num-value').value;
        let key = DOM.elid('flights-select').selectedIndex;
        let flight = flights.get('' + key);

        if(!flight) {
            console.log("Error with key " + key);
            return
        }
        let result;
        let error = null;
        try {
            result = await contract.buyInsurance(flight.name, flight.timestamp, value);
        } catch (e) {
            error = e;
        }

        display('Insurance', '3.Purchase Flight Insurance', [{label: 'Insurance', error: error, value: JSON.stringify(result)}]);
    });

    DOM.elid('get-flight-status').addEventListener('click', async () => {
        let key = DOM.elid('flights-select2').selectedIndex;
        let flight = flights.get('' + key);

        if(!flight) {
            console.log("Error with key " + key);
            return
        }
        let error = null;
        try {
            await contract.fetchFlightStatus(flight.name, flight.timestamp);
        } catch (e) {
            error = e;
        }
        display('Flight Status', '4.Fetch Flight Status', [{label: 'Flight Status', error: error, value: flight.name + ' ' + flight.timestamp}]);
    });

    DOM.elid('check-funds').addEventListener('click', async () => {
        let result;
        let error = null;
        try {
            result = await contract.checkFunds();
        } catch (e) {
            error = e;
        }
        display('Payout', '5.Claim insurance', [{label: 'Your Funds', error: error, value: JSON.stringify(result)}]);
    });

    DOM.elid('withdraw').addEventListener('click', async () => {
        let result;
        let error = null;
        try {
            result = await contract.withdraw();
        } catch (e) {
            error = e;
        }
        display('Payout', '5.Claim insurance', [{label: 'withdraw', error: error, value: JSON.stringify(result)}]);
    });


})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h3(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({className: 'row'}));
        row.appendChild(DOM.div({className: 'col-sm-4 field'}, result.label));
        row.appendChild(DOM.div({className: 'col-sm-8 field-value'}, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    });
    displayDiv.append(section);

}