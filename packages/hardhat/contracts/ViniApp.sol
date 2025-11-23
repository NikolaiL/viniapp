//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// Useful for debugging. Remove when deploying to a live network.
import "hardhat/console.sol";

// Use openzeppelin to inherit battle-tested implementations (ERC20, ERC721, etc)
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * A smart contract that allows creating viniapps by paying with USDC tokens
 * It also allows the owner to withdraw the tokens in the contract
 * @author BuidlGuidl
 */
contract ViniApp {
    // State Variables
    address public immutable owner;
    IERC20 public immutable paymentToken; // USDC token address
    uint256 public viniappCost = 0.01 * 10**6; // 0.01 USDC (6 decimals for USDC)

    // Events: a way to emit log statements from smart contract that can be listened to by external parties
    event ViniappCreated(address indexed viniappUser, uint256 viniappCost);
    event ViniappCostUpdated(uint256 oldCost, uint256 newCost);

    // Constructor: Called once on contract deployment
    // Check packages/hardhat/deploy/00_deploy_your_contract.ts
    constructor(address _owner, address _paymentToken) {
        owner = _owner;
        paymentToken = IERC20(_paymentToken);
    }

    // Modifier: used to define a set of rules that must be met before or after a function is executed
    // Check the withdraw() function
    modifier isOwner() {
        // msg.sender: predefined variable that represents address of the account that called the current function
        require(msg.sender == owner, "Not the Owner");
        _;
    }

    function startViniappCreation() public {
        // Print data to the hardhat chain console. Remove when deploying to a live network.
        console.log("Starting viniapp creation from %s", msg.sender);

        // Transfer USDC tokens from user to contract
        require(
            paymentToken.transferFrom(msg.sender, address(this), viniappCost),
            "Token transfer failed"
        );


        // emit: keyword used to trigger an event
        emit ViniappCreated(msg.sender, viniappCost);
    }

    /**
     * Function that allows the owner to withdraw all the tokens in the contract
     * The function can only be called by the owner of the contract as defined by the isOwner modifier
     */
    function withdraw() public isOwner {
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(paymentToken.transfer(owner, balance), "Token transfer failed");
    }

    function withdrawTokensTo(address _to, uint256 _amount) public isOwner {
        require(paymentToken.transfer(_to, _amount), "Token transfer failed");
    }

    function withdrawTokens(uint256 _amount) public isOwner {
        require(paymentToken.transfer(owner, _amount), "Token transfer failed");
    }

    /**
     * Function that allows the owner to update the viniapp creation cost
     * The function can only be called by the owner of the contract as defined by the isOwner modifier
     */
    function setViniappCost(uint256 _newCost) public isOwner {
        uint256 oldCost = viniappCost;
        viniappCost = _newCost;
        emit ViniappCostUpdated(oldCost, _newCost);
    }

    /**
     * View function to check if a user has approved enough tokens
     */
    function isApproved(address _user) public view returns (bool) {
        uint256 allowance = paymentToken.allowance(_user, address(this));
        return allowance >= viniappCost;
    }
}
