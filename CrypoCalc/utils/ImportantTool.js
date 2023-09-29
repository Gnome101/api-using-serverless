const Decimal = require('decimal.js');
function getRealValue(tick, decimal0, decimal1, percision) {

  const bigPrice = new Decimal(1.0001 ** tick);
  const decimalDiv = new Decimal(10 ** (decimal0 - decimal1));
  const inv = bigPrice.times(decimalDiv);
  const realPrice = new Decimal(1).dividedBy(inv, percision);
  return realPrice;
}
function getCalcRatio(lower, upper, tick, decimal0, decimal1) {
  let lowerPrice = getRealValue(lower, decimal0, decimal1);
  let upperPrice = getRealValue(upper, decimal0, decimal1);
  let price = getRealValue(tick, decimal0, decimal1);
  console.log(lowerPrice.getValue(), upperPrice.getValue(), price.getValue());
  if (lowerPrice.getValue() > upperPrice.getValue()) {
    const low = lowerPrice;
    lowerPrice = upperPrice;
    upperPrice = low;
  }
  const sqrtLower = new bigDecimal.bigDecimal(lowerPrice.getValue() ** (1 / 2));
  const sqrtUpper = new bigDecimal.bigDecimal(upperPrice.getValue() ** (1 / 2));
  const sqrtPrice = new bigDecimal.bigDecimal(price.getValue() ** (1 / 2));

  const num1 = sqrtPrice.multiply(sqrtUpper);
  const num2 = sqrtPrice.subtract(sqrtLower);
  const divisor = sqrtUpper.subtract(sqrtPrice);
  const bigNum = num1.multiply(num2);
  const calcRatio = bigNum.divide(divisor);
  return calcRatio;
}





module.exports = {
  getRealValue,
  getCalcRatio,


};
