const { BigNumber } = require("bignumber.js");

const Q192 = BigNumber(2).exponentiatedBy(192);

module.exports = {
  getPercentDifference: (price, price2) => {
    let higherPrice = price >= price2 ? price : price2;
    let lowerPrice = price < price2 ? price : price2;
    return 100 - (lowerPrice / higherPrice) * 100;
  },

  sendToken: async (amount, to, fromAccount, tokenContract) => {
    await tokenContract.methods
      .transfer(to, web3.utils.toWei(amount.toString(), "ether"))
      .send({ from: fromAccount });
  },

  /**
   * Gets the native token amount balance of the
   * address.
   * @param {*} address
   * @returns
   */
  getWalletEthBalance: async (address) => {
    let balance = await web3.eth.getBalance(address);
    return web3.utils.fromWei(wei, "ether");
  },

  /**
   * Gets Polygon Gas Price from Polygon's GAS API.
   * Takes in a speed parameter than can be set to
   * safeLow, standard, or fast.
   * @param {*} speed
   * @returns
   */
  getPolygonGasPrice: async (speed) => {
    // documentation can be found https://docs.polygon.technology/docs/develop/tools/polygon-gas-station
    // acceptable speeds are: safeLow, standard, fast
    let results = await axios.get(
      "https://gasstation-mainnet.matic.network/v2"
    );
    return Web3.utils.toWei(
      results.data[speed].maxPriorityFee.toFixed(9),
      "gwei"
    );
  },

  sleep: (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },

  calculateSqrtPriceX96: (price, token0Dec, token1Dec) => {
    price = BigNumber(price).shiftedBy(token1Dec - token0Dec);
    ratioX96 = price.multipliedBy(Q192);
    sqrtPriceX96 = ratioX96.sqrt();
    return sqrtPriceX96;
  },

  calculatePriceFromX96: (sqrtPriceX96, token0Dec, token1Dec) => {
    let ratioX96 = BigNumber(sqrtPriceX96).exponentiatedBy(2);
    //Get token0 by dividing ratioX96 / Q192 and shifting decimal
    //values of the coins to put in human readable format.
    let price = ratioX96.dividedBy(Q192);
    price = price.shiftedBy(token0Dec - token1Dec);
    return price;
  },

  getNearestUsableTick: (currentTick, space) => {
    // 0 is always a valid tick
    if (currentTick == 0) {
      return 0;
    }
    // Determines direction
    direction = currentTick >= 0 ? 1 : -1;
    // Changes direction
    currentTick *= direction;
    // Calculates nearest tick based on how close the current tick remainder is to space / 2
    nearestTick =
      currentTick % space <= space / 2
        ? currentTick - (currentTick % space)
        : currentTick + (space - (currentTick % space));
    // Changes direction back
    nearestTick *= direction;

    return nearestTick;
  },
};
