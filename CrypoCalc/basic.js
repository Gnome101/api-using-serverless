const Decimal = require("decimal.js");

const { createPublicClient, http, createWalletClient } = require("viem");
const { arbitrumGoerli } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const IUniswapPool = require("./artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json");
const TokenAmountTools = require("./artifacts/contracts/Facets/TokenToolFacet/TokenToolFacet.json");
const addresses = require("./Addresses.json");
const lendingFacet = require("./artifacts/contracts/Facets/LendingFacet/LendingFacet.json");
const routeFacet = require("./artifacts/contracts/Facets/RouteFacet/RouteFacet.json");

const {
  calculateSqrtPriceX96,
  calculatePriceFromX96,
  getNearestUsableTick,
  getWalletEthBalance,
  sleep,
} = require("./utils/TokenUtil");
const IERC20 = require("./artifacts/contracts/IERC20.sol/IERC20.json");
const primeNumberFacet = require("./artifacts/contracts/Facets/PrimeNumberFacet/PrimeNumberFacet.json");

const borrowFacet = require("./artifacts/contracts/Facets/BorrowFacet/BorrowFacet.json");
const {
  getRealValue,
  getCalcRatio,
  getWeth,
} = require("./utils/ImportantTool.js");
require("dotenv").config();
const viemTools = require("./utils/viemTools.ts");
async function main(responseInfo) {
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  const poolAdy = responseInfo.poolAddress;
  // const percision = 9;
  const percision = responseInfo.percision;
  const checkTarget = new Decimal(responseInfo.checkTarget);
  const ARBGOERLI_RPC_URL = process.env.ARBGOERLI_RPC_URL;
  const client = createPublicClient({
    chain: arbitrumGoerli,
    transport: http(ARBGOERLI_RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: arbitrumGoerli,
    transport: http(ARBGOERLI_RPC_URL),
  });
  const startSlot0 = await client.readContract({
    address: poolAdy,
    abi: IUniswapPool.abi,
    functionName: "slot0",
  });

  console.log(startSlot0[0].toString());
  const poolContract = {
    address: poolAdy,
    abi: IUniswapPool.abi,
  };
  const userRoutePP = await client.readContract({
    address: addresses.arbGoerli.Diamond,
    abi: primeNumberFacet.abi,
    functionName: "createRoutePrimeProduct",
    args: [[responseInfo.userRoutes]],
  });
  const poolInfo = await viemTools.getPoolInfo(poolAdy, IUniswapPool, client);
  const token0Address = poolInfo.token0;
  const token1Address = poolInfo.token1;

  console.log(poolInfo);
  let startPrice = getRealValue(
    poolInfo.startTick.toString(),
    poolInfo.decimal0.toString(),
    poolInfo.decimal1.toString(),
    percision.toString()
  );
  console.log("Start price:", startPrice);

  let decimalAdj0Num = 10 ** (18 - poolInfo.decimal0.toString());
  let decimalAdj0 = new Decimal(decimalAdj0Num);

  let decimalAdj1Num = 10 ** (18 - poolInfo.decimal1.toString());
  let decimalAdj1 = new Decimal(decimalAdj1Num);

  let leveragedPositonTotalToken0 = new Decimal("0");
  const userToken = token0Address;
  const userAmount = new Decimal(responseInfo.userAmount);
  const goalLeverage = new Decimal(responseInfo.goalLeverage);
  if (userToken !== token0Address) {
    leveragedPositonTotalToken0 = userAmount.times(startPrice);
    leveragedPositonTotalToken0 =
      leveragedPositonTotalToken0.times(decimalAdj1);
  } else {
    leveragedPositonTotalToken0 = userAmount;
    leveragedPositonTotalToken0 =
      leveragedPositonTotalToken0.times(decimalAdj0);
  }
  leveragedPositonTotalToken0 = leveragedPositonTotalToken0.times(goalLeverage);

  console.log(
    "Leveraged Positon Total:",
    leveragedPositonTotalToken0.toFixed()
  );
  const lM = parseInt(responseInfo.lowerMultiplier);
  const uM = parseInt(responseInfo.upperMultiplier);
  const tickInfo = viemTools.getTickBounds(
    poolInfo,
    getNearestUsableTick,
    lM === -1 ? 10 : lM,
    uM === -1 ? 10 : uM
  );
  if (lM == -1) {
    tickInfo.lowerTick = parseInt(responseInfo.lowerTick);
  }
  if (uM == -1) {
    tickInfo.upperTick = parseInt(responseInfo.upperTick);
  }
  let positionInfo = {
    lowerBound: tickInfo.lowerTick,
    upperBound: tickInfo.upperTick,
    token0Amount: leveragedPositonTotalToken0.toFixed(),
    token0Addy: token0Address,
    token1Addy: token1Address,
  };
  console.log("Bounds:", tickInfo.lowerTick, tickInfo.upperTick);
  const lowerBound = new Decimal(tickInfo.lowerTick.toString());
  const upperBound = new Decimal(tickInfo.upperTick.toString());

  let token0Only, token1Only;
  let exactOut = true;
  let userGaveMore = false;
  const baseMultiplier = new Decimal("1.00");
  let switchLevel = checkTarget.times(new Decimal("0"));
  let adjuster = new Decimal("0.04");
  let bigAdjuster = new Decimal("1.15");
  let fin = false;
  let results;

  // return startSlot0.toString();
  let tokenPath =
    userToken === token0Address
      ? [token1Address, token0Address]
      : [token0Address, token1Address];

  let userAmountToken0;
  const tokenBal = await viemTools.getTokenBalances(
    addresses.arbGoerli.Diamond,
    token0Address,
    token1Address,
    client
  );
  let swapAmount;
  let currentTick = new Decimal(poolInfo.startTick.toString());
  let multiplier = new Decimal("1");
  let token0Amount;
  let token1Amount;
  const five = new Decimal("5");
  const zero = new Decimal("0");
  swapAmount = userAmount.dividedBy(five).round();
  const amountApproved = await client.readContract({
    address: tokenPath[0],
    abi: IERC20.abi,
    functionName: "allowance",
    args: [account.address, addresses.arbGoerli.Diamond],
  });
  console.log("Approved Amount:", amountApproved.toString());
  while (!fin) {
    const fee = await client.readContract({
      address: poolAdy,
      abi: IUniswapPool.abi,
      functionName: "fee",
    });

    let data = await client.simulateContract({
      account,
      address: addresses.arbGoerli.Diamond,
      abi: TokenAmountTools.abi,
      functionName: "swapAndCheck",
      args: [
        addresses.arbGoerli.V3RouteManager,
        tokenPath[0] === token0Address //Max In
          ? tokenBal.token0Balance.toFixed()
          : tokenBal.token1Balance.toFixed(),
        swapAmount.round().toFixed(),
        tokenPath,
        poolAdy,
        exactOut,
      ],
    });
    results = data.result;

    const endingTick = results[2];
    currentTick = new Decimal(endingTick.toString());
    endingPrice = getRealValue(
      currentTick.toFixed(),
      poolInfo.decimal0.toString(),
      poolInfo.decimal1.toString(),
      percision
    );

    if (currentTick.greaterThan(lowerBound) === false) {
      console.log("Position should be only token0");
      tokenPath = [token1Address, token0Address];
      swapAmount =
        userToken === token0Address
          ? userAmount.times(goalLeverage).minus(userAmount).times(multiplier)
          : userAmount;

      //Exact out is false if the userToken is not token0 because we want to swap it all to token0
      exactOut = userToken === token0Address ? true : false;
      token0Amount =
        userToken === token0Address
          ? userAmount.times(goalLeverage)
          : userAmount.times(endingPrice).times(goalLeverage).times(multiplier);

      token1Amount = new Decimal("0");
      if (!token0Only) {
        token0Only = true;
        //sleep(1000);
        continue;
      }
    } else {
      if (token0Only) {
        token1Only = false;
        exactOut = !exactOut;
        console.log("No longer0");
        //sleep(1000);

        // tokenPath =
        //   userToken === token0Address
        //     ? [token1Address, token0Address]
        //     : [token0Address, token1Address];
        swapAmount = userAmount.dividedBy(two).round();

        continue;
      }
    }
    if (currentTick.greaterThan(upperBound) === true) {
      console.log("Position should be only token1");
      console.log("Swap Amount Before:", swapAmount.toFixed());
      tokenPath = [token0Address, token1Address];
      //If the userToken is token0 then we want to swap it tall to token1
      swapAmount =
        userToken === token0Address
          ? userAmount
          : userAmount.times(goalLeverage).minus(userAmount).times(multiplier);

      //Exact out is false if the userToken is token0 because we want to swap it all to token1
      exactOut = userToken === token0Address ? false : true;
      //If the userToken is token0 then we need to convert it to token1 and times by leverage
      token1Amount =
        userToken === token0Address
          ? userAmount
              .dividedBy(endingPrice)
              .times(goalLeverage)
              .times(multiplier)
          : userAmount.times(goalLeverage);
      console.log("Swap Amount After:", swapAmount.toFixed());

      token0Amount = new Decimal("0");
      if (!token1Only) {
        token1Only = true;
        continue;
      }
    } else {
      if (token1Only) {
        token1Only = false;
        exactOut = !exactOut;
        console.log("No longer1");
        // tokenPath =
        //   userToken === token0Address
        //     ? [token1Address, token0Address]
        //     : [token0Address, token1Address];
        swapAmount = userAmount.dividedBy(two).round();
        //sleep(4000);
        continue;
      }
    }
    if (!token0Only && !token1Only) {
      if (userToken === token0Address) {
        token0Amount = !userGaveMore
          ? swapAmount.add(userAmount)
          : userAmount.minus(swapAmount);
        //Read function here:

        // token1Amount = await TokenAmountTools.calculateOtherTokenAmount(
        //   lowerTick.toString(),
        //   upperTick.toString(),
        //   currentTick.toFixed(),
        //   token0Amount.toFixed(),
        //   token0Address,
        //   Pool.address
        // );
        token1Amount = await client.readContract({
          address: addresses.arbGoerli.Diamond,
          abi: TokenAmountTools.abi,
          functionName: "calculateOtherTokenAmount",
          args: [
            lowerBound.toFixed(),
            upperBound.toFixed(),
            currentTick.toFixed(),
            token0Amount.toFixed(),
            token0Address,
            poolAdy,
          ],
        });
        token1Amount = new Decimal(token1Amount.toString());
      } else {
        token1Amount = !userGaveMore
          ? swapAmount.add(userAmount)
          : userAmount.minus(swapAmount);
        //Already confirmed that this works when userToken is token1
        token0Amount = await client.readContract({
          address: addresses.arbGoerli.Diamond,
          abi: TokenAmountTools.abi,
          functionName: "calculateOtherTokenAmount",
          args: [
            lowerBound.toFixed(),
            upperBound.toFixed(),
            currentTick.toFixed(),
            token1Amount.toFixed(),
            token1Address,
            poolAdy,
          ],
        });
        // token0Amount = await TokenAmountTools.calculateOtherTokenAmount(
        //   lowerTick.toString(),
        //   upperTick.toString(),
        //   currentTick.toFixed(),
        //   token1Amount.toFixed(),
        //   token1Address,
        //   Pool.address
        // );

        token0Amount = new Decimal(token0Amount.toString());
      }
    }
    token0Amount = token0Amount.round();
    token1Amount = token1Amount.round();
    userAmountToken0 =
      userToken === token0Address ? userAmount : userAmount.times(endingPrice);

    let fakePosInfo = {
      lowerBound: lowerBound.toFixed(),
      upperBound: upperBound.toFixed(),
      desiredPool: poolAdy,
      takeLossProfit: [20, 30],
      existLowerUpper: [-8388608, 8388607],
      ltv: 0,
    };
    const providedToken =
      token0Address === userToken ? token1Address : token0Address;

    const preFoundInfo = {
      userAmount: userAmount.toFixed(),
      userToken: userToken,
      tokenProvided: providedToken,
      goalToken0: token0Amount.round().toFixed(),
      goalToken1: token1Amount.round().toFixed(),
      guideSwapAmount: swapAmount.round().toFixed(),
      userGaveMore: userGaveMore,
      exactOut: exactOut,
      tokenPath: tokenPath,
      userRoutePrimeProduct: userRoutePP,
      chosenRoute: addresses.arbGoerli.V3RouteManager,
    };
    let posRealInfo;
    lenderInfo1 = await client.readContract({
      address: addresses.arbGoerli.Diamond,
      abi: lendingFacet.abi,
      functionName: "getPoolInfo",
      args: [0],
    });
    lenderInfo2 = await client.readContract({
      address: addresses.arbGoerli.Diamond,
      abi: lendingFacet.abi,
      functionName: "getPoolInfo",
      args: [1],
    });

    let lenders = [1];
    const amountApprovedA = await client.readContract({
      address: userToken,
      abi: IERC20.abi,
      functionName: "allowance",
      args: [account.address, addresses.arbGoerli.Diamond],
    });

    try {
      data = await client.simulateContract({
        account,
        address: addresses.arbGoerli.Diamond,
        abi: borrowFacet.abi,
        functionName: "createPosition",
        args: [lenders, fakePosInfo, preFoundInfo],
      });
      posRealInfo = data.result;
    } catch (error) {
      const reducer = new Decimal("0.9");
      console.log(multiplier);
      const newMult = multiplier.minus(one).absoluteValue().dividedBy(two);
      if (multiplier.greaterThan(one) == true) {
        multiplier = baseMultiplier.add(newMult);
      } else {
        multiplier = baseMultiplier.minus(newMult);
      }
      console.log(multiplier);
      console.log("BIG SWITCH");

      continue;
    }

    const token0Value = new Decimal(posRealInfo[0].toString());
    const token1Value = new Decimal(posRealInfo[1].toString());

    const realPositionValueToken0 = token0Value.add(
      token1Value.times(endingPrice)
    );
    currentRatio = realPositionValueToken0.dividedBy(
      userAmountToken0,
      percision
    );

    const diff = goalLeverage.minus(currentRatio);
    console.log("Diff:", diff.toFixed());
    //sleep(1000);
    if (diff.absoluteValue().greaterThan(switchLevel) === true) {
      if (!userGaveMore) {
        const div = goalLeverage.dividedBy(currentRatio, percision);
        multiplier = div;
      } else {
        const div = currentRatio.dividedBy(goalLeverage, percision);
        multiplier = div;
      }
    } else {
      if (!userGaveMore) {
        console.log("Adjusting now");
        const adjustedDiff = diff.times(adjuster);
        multiplier = baseMultiplier.add(adjustedDiff);
      } else {
        const adjustedDiff = diff.times(adjuster);
        multiplier = baseMultiplier.minus(adjustedDiff);
      }
    }
    if (!token0Only && !token1Only) {
      swapAmount = swapAmount.times(multiplier).absoluteValue().round();
    }
    // console.log(multiplier.toFixed());
    // console.log(swapAmount.toFixed());

    if (
      !userGaveMore &&
      currentRatio.greaterThan(goalLeverage) === true &&
      diff.greaterThan(zero) === false &&
      prevDiff.greaterThan(zero) === false &&
      diff.absoluteValue().greaterThan(new Decimal("0.4")) === true
    ) {
      console.log("Only user");
      userGaveMore = true;
      if (userToken === token0Address) {
        //User Token is token0
        //If the user gave more, then first should be token0
        tokenPath = userGaveMore
          ? [token0Address, token1Address]
          : [token1Address, token0Address];
      } else {
        tokenPath = userGaveMore
          ? [token1Address, token0Address]
          : [token0Address, token1Address];
      }
      swapAmount = userAmount.dividedBy(five).round();
      //two = two.add(new bigDecimal("1"));

      exactOut = false;
    }
    if (
      userGaveMore &&
      currentRatio.greaterThan(goalLeverage) === false &&
      diff.greaterThan(zero) === true &&
      prevDiff.greaterThan(zero) === true &&
      diff.absoluteValue().greaterThan(new Decimal("0.4")) === true
    ) {
      console.log("Other way");

      userGaveMore = false;
      if (userToken === token0Address) {
        //User Token is token0
        //If the user gave more, then first should be token0
        tokenPath = userGaveMore
          ? [token0Address, token1Address]
          : [token1Address, token0Address];
      } else {
        tokenPath = userGaveMore
          ? [token1Address, token0Address]
          : [token0Address, token1Address];
      }
      swapAmount = userAmount.dividedBy(two).round();
      //two = two.add(new bigDecimal("1"));
      exactOut = true;
    }

    prevDiff = diff;

    if (
      currentRatio
        .minus(goalLeverage)
        .absoluteValue()
        .greaterThan(checkTarget) == false &&
      !(currentRatio.greaterThan(goalLeverage) === true)
    ) {
      console.log("Finished!");
      console.log("Swap Amount:", swapAmount.toFixed());
      console.log("Using ExactOut:", exactOut);
      console.log("User Gave More:", userGaveMore);
      fin = true;

      console.log({
        TotalToken0Value: leveragedPositonTotalToken0,
        Token0Goal: token0Amount,
        Token1Goal: token1Amount,
        endingLeverageRatio: currentRatio,
        swapAmount: swapAmount,
        userGaveMore: userGaveMore,
        exactOut: exactOut,
        tokenPath: tokenPath,
      });
      return {
        TotalToken0Value: leveragedPositonTotalToken0,
        Token0Goal: token0Amount,
        Token1Goal: token1Amount,
        endingLeverageRatio: currentRatio,
        swapAmount: swapAmount,
        userGaveMore: userGaveMore,
        exactOut: exactOut,
        tokenPath: tokenPath,
      };
    }
  }
}
module.exports = { main };
// main().catch((error) => {
//   console.error(error);
//   process.exit(1);
// });
