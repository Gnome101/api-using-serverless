const movies = require("./data.json");

exports.handler = async (event, context) => {
  const siteReturns = event.queryStringParameters;

  return {
    statusCode: 200,
    body: JSON.stringify({ info: siteReturns, FirstValue: siteReturns.A }),
  };
};
