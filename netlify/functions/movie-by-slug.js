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
  try {
    if (responseInfo) {
      const response = await crptoCall.main(responseInfo);
    }
  } catch (e) {}
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
};
