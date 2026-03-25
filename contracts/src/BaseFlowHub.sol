// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

library SafeTransferLib {
    error ETHTransferFailed();
    error ERC20TransferFailed();
    error ERC20TransferFromFailed();

    function safeTransferETH(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert ETHTransferFailed();
    }

    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ERC20TransferFailed();
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert ERC20TransferFromFailed();
    }
}

contract BaseFlowHub {
    error NotOwner();
    error Reentrancy();
    error EmptyBatch();
    error LengthMismatch();
    error TooManyRecipients();
    error ZeroRecipient();
    error ZeroAmount();
    error WrongValue();
    error InvalidToken();

    uint256 public constant MAX_RECIPIENTS = 500;
    address public immutable owner;
    uint256 private locked = 1;

    event ETHBatchExecuted(address indexed sender, uint256 indexed recipientCount, uint256 totalAmount);
    event ERC20BatchExecuted(address indexed sender, address indexed token, uint256 indexed recipientCount, uint256 totalAmount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address owner_) {
        owner = owner_;
    }

    receive() external payable {
        revert();
    }

    function sendETHStrict(address[] calldata recipients, uint256[] calldata amounts) external payable nonReentrant {
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != amounts.length) revert LengthMismatch();
        if (len > MAX_RECIPIENTS) revert TooManyRecipients();
        uint256 total;
        for (uint256 i = 0; i < len; ++i) {
            if (recipients[i] == address(0)) revert ZeroRecipient();
            if (amounts[i] == 0) revert ZeroAmount();
            total += amounts[i];
        }
        if (msg.value != total) revert WrongValue();
        for (uint256 i = 0; i < len; ++i) {
            SafeTransferLib.safeTransferETH(recipients[i], amounts[i]);
        }
        emit ETHBatchExecuted(msg.sender, len, total);
    }

    function sendERC20Strict(address token, address[] calldata recipients, uint256[] calldata amounts) external nonReentrant {
        if (token == address(0)) revert InvalidToken();
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != amounts.length) revert LengthMismatch();
        if (len > MAX_RECIPIENTS) revert TooManyRecipients();
        uint256 total;
        for (uint256 i = 0; i < len; ++i) {
            if (recipients[i] == address(0)) revert ZeroRecipient();
            if (amounts[i] == 0) revert ZeroAmount();
            total += amounts[i];
        }
        SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), total);
        for (uint256 i = 0; i < len; ++i) {
            SafeTransferLib.safeTransfer(token, recipients[i], amounts[i]);
        }
        emit ERC20BatchExecuted(msg.sender, token, len, total);
    }
}
