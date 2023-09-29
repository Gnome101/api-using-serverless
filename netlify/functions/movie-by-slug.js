const movies = require("./data.json");

exports.handler = async (event, context) => {
  const slug = event;

  return {
    statusCode: 200,
    body: JSON.stringify({ info: slug }),
  };
};
