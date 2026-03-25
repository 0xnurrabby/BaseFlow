export const HUB_ABI = [
  "function sendETHStrict(address[] recipients,uint256[] amounts) payable",
  "function sendERC20Strict(address token,address[] recipients,uint256[] amounts)"
];

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) external returns (bool)",
  "function allowance(address owner,address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];
