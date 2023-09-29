const movies = require("./data.json");

exports.handler = async (event, context) => {
  const slug = event.path.replace("/api/movies/", "");
  console.log(context);
  const movie = movies.find((m) => m.slug === slug);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello World" }),
  };
};
