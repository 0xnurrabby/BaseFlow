// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BaseFlowMultisender {
    error EmptyRecipients();
    error LengthMismatch();
    error InvalidMsgValue();
    error InvalidToken();
    error ZeroAmount();
    error ZeroRecipient();
    error ETHTransferFailed(address recipient, uint256 amount);
    error TokenTransferFailed(address token, address recipient, uint256 amount);

    event ETHMultisent(address indexed sender, uint256 recipientCount, uint256 totalAmount);
    event TokenMultisent(address indexed sender, address indexed token, uint256 recipientCount, uint256 totalAmount);

    function multisendETH(address[] calldata recipients, uint256[] calldata amounts) external payable {
        uint256 length = recipients.length;
        if (length == 0) revert EmptyRecipients();
        if (length != amounts.length) revert LengthMismatch();

        uint256 remainingValue = msg.value;

        for (uint256 i; i < length;) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            if (recipient == address(0)) revert ZeroRecipient();
            if (amount == 0) revert ZeroAmount();
            if (amount > remainingValue) revert InvalidMsgValue();

            remainingValue -= amount;

            (bool success,) = recipient.call{value: amount}("");
            if (!success) revert ETHTransferFailed(recipient, amount);

            unchecked {
                ++i;
            }
        }

        if (remainingValue != 0) revert InvalidMsgValue();

        emit ETHMultisent(msg.sender, length, msg.value);
    }

    function multisendToken(address token, address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 length = recipients.length;
        if (token.code.length == 0) revert InvalidToken();
        if (length == 0) revert EmptyRecipients();
        if (length != amounts.length) revert LengthMismatch();

        uint256 totalAmount;

        for (uint256 i; i < length;) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            if (recipient == address(0)) revert ZeroRecipient();
            if (amount == 0) revert ZeroAmount();

            totalAmount += amount;
            _safeTransferFrom(token, msg.sender, recipient, amount);

            unchecked {
                ++i;
            }
        }

        emit TokenMultisent(msg.sender, token, length, totalAmount);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transferFrom.selector, from, to, amount)
        );

        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed(token, to, amount);
        }
    }
}
