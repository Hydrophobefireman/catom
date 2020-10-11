import { Properties } from "csstype";
const config = { allowRuntime: false };

function css(
  _styleRule: Properties & {
    media?: { [query: string]: Properties };
    pseudo?: { [psuedoProp: string]: Properties };
  }
) {
  if (!config.allowRuntime)
    throw new Error(
      "Catom is in compile mode! Are you sure you ran your webpack transform correctly?"
    );

  return "";
}

export { css, config };
