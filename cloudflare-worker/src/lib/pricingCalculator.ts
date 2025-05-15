export interface PricingConfig {
  basePrice: number;
  increasePerUsers: number;
  userGroupSize: number;
}

export interface PricingResult {
  basePrice: number;
  currentPrice: number;
  message: string;
}

const DEFAULT_CONFIG: PricingConfig = {
  basePrice: 9.15,
  increasePerUsers: 0.30,
  userGroupSize: 10
};

export function calculatePrice(activeUsers: number, config: PricingConfig = DEFAULT_CONFIG): PricingResult {
  const userGroups = Math.floor(activeUsers / config.userGroupSize);
  const priceIncrease = userGroups * config.increasePerUsers;
  const currentPrice = config.basePrice + priceIncrease;

  return {
    basePrice: config.basePrice,
    currentPrice,
    message: `Price is ${currentPrice.toFixed(3)}€ due to ${activeUsers} active users!`
  };
}
