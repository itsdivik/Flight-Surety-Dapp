pragma solidity ^0.5.8;
contract Migrations {
 address public owner;
 uint public last_completed_migration;

    //modifier
 
 modifier restricted() {
        if (msg.sender == owner) _;
    }

//constructor

  constructor() public {
        owner = msg.sender;
    }
//complete function

 function setCompleted(uint completed) public restricted {
        last_completed_migration = completed;
    }
//update 
  function upgrade(address new_address) public restricted {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
