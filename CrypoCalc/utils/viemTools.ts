
const IERC20 = require("../artifacts/contracts/IERC20.sol/IERC20.json")
const dec = require('decimal.js');

async function getPoolInfo(Pooladdy, IUniswapPool, client) {

  //Returns

  // (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked
  const poolContract = {
    address: Pooladdy,
    abi: IUniswapPool.abi
  }
  const results = await client.multicall({
    contracts: [
      {
        ...poolContract,
        functionName: 'slot0',
      },

      {
        ...poolContract,
        functionName: 'token0'
      },
      {
        ...poolContract,
        functionName: 'token1'
      }, {
        ...poolContract,
        functionName: 'tickSpacing'
      }
    ]
  })
  const startSlot0Tick = results[0].result[1];
  //Returns token0 address
  const token0Address = results[1].result;
  //Returns token1 address
  const token1Address = results[2].result;
  const tickSpacing = results[3].result;

  console.log(token0Address, token1Address)
  //Returns token0 decimal amount
  let token0Decimal = await client.readContract({
    address: token0Address,
    abi: IERC20.abi,
    functionName: 'decimals',
  })
  //Returns token1 decimal amount
  let token1Decimal = await client.readContract({
    address: token1Address,
    abi: IERC20.abi,
    functionName: 'decimals',
  })



  return {
    startTick: startSlot0Tick,
    token0: token0Address,
    token1: token1Address,
    decimal0: token0Decimal,
    decimal1: token1Decimal,
    tickSpacing: tickSpacing
  };


}
async function getTokenBalances(userAddress, token0Address, token1Address, client) {

  //Returns

  // (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked
  const token0Contract = {
    address: token0Address,
    abi: IERC20.abi
  }
  const token1Contract = {
    address: token1Address,
    abi: IERC20.abi
  }
  const results = await client.multicall({
    contracts: [
      {
        ...token0Contract,
        functionName: 'balanceOf',
        args: [userAddress.toString()]
      },

      {
        ...token1Contract,
        functionName: 'balanceOf',
        args: [userAddress.toString()]
      }

    ]
  })

  const token0Balance = new dec(results[0].result.toString());
  const token1Balance = new dec(results[1].result.toString());


  return {
    token0Balance: token0Balance,
    token1Balance: token1Balance,
  };


}
function getTickBounds(poolInfo, getNearestUsableTick, deltaLow, deltaHigh) {

  let nearestTick = getNearestUsableTick(
    parseInt(poolInfo.startTick),
    poolInfo.tickSpacing
  );

  const lowerTick = nearestTick - poolInfo.tickSpacing * deltaLow;
  const upperTick = nearestTick + poolInfo.tickSpacing * deltaHigh;



  return {
    lowerTick: lowerTick,
    upperTick: upperTick,
  };


}
module.exports = { getPoolInfo, getTickBounds, getTokenBalances };
