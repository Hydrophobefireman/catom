import { Hashable } from "./constants";

import { createValueHash } from "./cssTransform";
import * as babel from "@babel/types";

export function parseObjectExpression(
  object: babel.ObjectExpression,
  retArray: Array<string>,
  hashable?: Hashable
) {
  return object.properties.forEach((p) =>
    handleProperties(p as babel.ObjectProperty, retArray, hashable)
  );
}

function handleSpread(
  spread: babel.SpreadElement,
  retArray: Array<string>,
  hashable: Hashable
) {
  const argument = spread.argument;
  if (argument.type === "ObjectExpression") {
    return parseObjectExpression(argument, retArray, hashable);
  }
  throw Error(
    `Cannot parse ${spread.type}. Catom compiler only accepts compile time constant values`
  );
}

function handleProperties(
  propertyOrSpread: babel.ObjectProperty | babel.SpreadElement,
  retArray: Array<string>,
  hashable: Hashable
) {
  if (propertyOrSpread.type === "SpreadElement") {
    return handleSpread(propertyOrSpread, retArray, hashable);
  }
  let { key, value } = propertyOrSpread;
  if (value.type === "TSAsExpression") value = value.expression;
  let keyName: string;
  if (key.type === "StringLiteral") {
    keyName = key.value as string;
  } else if (key.type === "Identifier") {
    keyName = key.name;
  } else {
    return throwErr();
  }
  const isMedia = keyName === "media";
  const isPseudo = keyName === "pseudo";
  const canAcceptObjectLiteralInValue = isMedia || isPseudo;
  if (value.type === "StringLiteral" || value.type === "NumericLiteral") {
    if (canAcceptObjectLiteralInValue)
      throwErr("Need an object literal for media query or pseudo selector");
    return retArray.push(createValueHash(keyName, value.value, hashable));
  }
  if (canAcceptObjectLiteralInValue && value.type === "ObjectExpression") {
    return value.properties.forEach((prop) =>
      handleMediaOrPseudoProperties(
        prop as babel.ObjectProperty,
        retArray,
        isMedia,
        isPseudo
      )
    );
  }
  throwErr();
}

function handleMediaOrPseudoProperties(
  property: babel.ObjectProperty | babel.SpreadElement,
  retArray: Array<string>,
  isMedia: boolean,
  isPseudo: boolean
) {
  if (property.type === "ObjectProperty") {
    const { key, value } = property;
    let keyName: string;
    if (key.type === "StringLiteral") keyName = key.value;
    else if (key.type === "Identifier") keyName = key.name;
    if (value.type === "ObjectExpression") {
      return parseObjectExpression(
        value,
        retArray,
        (isMedia && { media: keyName }) || (isPseudo && { pseudo: keyName })
      );
    }
  }
  throwErr();
}

function throwErr(err?: string) {
  throw TypeError(
    err || "Catom only accepts literals and compile time constant values"
  );
}
