import { Hashable } from "./constants";
import { ObjectExpression, Property, SpreadElement } from "estree";
import { createValueHash } from "./cssTransform";

export function parseObjectExpression(
  object: ObjectExpression,
  retArray: Array<string>,
  hashable?: Hashable
) {
  return object.properties.forEach((p) =>
    handleProperties(p, retArray, hashable)
  );
}

function handleSpread(
  spread: SpreadElement,
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
  propertyOrSpread: Property | SpreadElement,
  retArray: Array<string>,
  hashable: Hashable
) {
  if (propertyOrSpread.type === "SpreadElement") {
    return handleSpread(propertyOrSpread, retArray, hashable);
  }
  const { key, value } = propertyOrSpread;
  let keyName: string;
  if (key.type === "Literal") {
    keyName = key.value as string;
  } else if (key.type === "Identifier") {
    keyName = key.name;
  } else {
    return throwErr();
  }
  const isMedia = keyName === "media";
  const isPseudo = keyName === "pseudo";
  const canAcceptObjectLiteralInValue = isMedia || isPseudo;
  if (value.type === "Literal") {
    if (canAcceptObjectLiteralInValue)
      throwErr("Need an object literal for media query or pseudo selector");
    return retArray.push(
      createValueHash(keyName, value.value as string, hashable)
    );
  }
  if (canAcceptObjectLiteralInValue && value.type === "ObjectExpression") {
    return value.properties.forEach((prop) =>
      handleMediaOrPseudoProperties(
        prop as Property,
        retArray,
        isMedia,
        isPseudo
      )
    );
  }
  throwErr();
}

function handleMediaOrPseudoProperties(
  property: Property | SpreadElement,
  retArray: Array<string>,
  isMedia: boolean,
  isPseudo: boolean
) {
  if (property.type === "Property") {
    const { key, value } = property;
    let keyName: string;
    if (key.type === "Literal") keyName = key.value as string;
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
