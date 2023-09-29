const crptoCall = require("../../CrypoCalc/basic.js");

exports.handler = async (event, context) => {
  const siteReturns = event.queryStringParameters;
  const responseInfo = {
    userAmount: siteReturns.uA, //5
    poolAddress: siteReturns.pA, //4
    goalLeverage: siteReturns.gL, //3
    percision: siteReturns.pN, //1
    checkTarget: siteReturns.cT, //2
    userRoutes: siteReturns.uR,
    lowerTick: siteReturns.lT, //3
    lowerMultiplier: siteReturns.lM, //6
    upperTick: siteReturns.uT, //3
    upperMultiplier: siteReturns.uM, //3
  };
  ///?uA=1000000000000000000&pA=0xa74cd5e13431FF7969F5b8770fC121768b14607e&gL=5.0&pN=9&cT=0.005&uR=0x3AE176C4603C064332A2dcD4AB6323Ed7a722692&lT=0&lM=10&uT=10&uM=10/
  let response = "Nothing Yet";
  try {
    if (responseInfo) {
      const response = await crptoCall.main(responseInfo);
    }
  } catch (e) {}
  return {
    statusCode: 200,
    body: JSON.stringify({ Data: response }),
  };
};
