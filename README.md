# Catom

## A 0 runtime css in ~~js~~ css tool

### Stage: Pre Alpha ([Caveats](#caveats))

Catom allows you to write CSS in your javascript/typescript file and creates highly optimized CSS out of it.

Each rule creates a unique class definition out of it and it gives you 100% freedom about where to put your generated css bundle.

Your javascript code has 0 references to any styles and all that's left is are the compiled hashed clasnames as a string.

It's framework agnostic as it emits pure CSS and leaves out just the classnames

## Example

somewhere in our App.js

```javascript
import { css } from "catom";

const styledButton = css({
  color: "#ff0000",
  borderRadius: "5px",
  padding: "4px",
});
const styledDiv = css({ color: "blue", borderRadius: "5px", padding: "4px" });

function App() {
  return (
    <div className={styledDiv}>
      <button className={styledButton}>Hi</button>
    </div>
  );
}
```

**Css generated:**

```css
._6da32 {
  color: #ff0000;
}
.quva1q {
  border-radius: 5px;
}
._2rlxtj {
  padding: 4px;
}
._14ksm7b {
  color: blue;
}
```

**App.js:**

```js
const styledButton = "_6da32 quva1q _2rlxtj";
const styledDiv = "_14ksm7b quva1q _2rlxtj";
....
```

As we had only 4 unique rules, catom generated only 4 classes.

Catom also supports media queries and pseudo properties passing them in an object

```javascript
const mediaQuery = css({
  media: { "only screen and (max-width:500px)": { color: "red" } },
});
const pseudoQuery = css({ pseudo: { ":hover": { color: "green" } } });
```

# Installation and Usage

Install using npm or yarn

```
npm i catom -D
```

In your babel config:

```json
{
    "plugins": [
        "catom/babelPlugin"
        `....
    ]

}
```

As catom doesn't really interact with your build tool at all, it's your job to inject the generated style.

Here's an example of how you can use it with HTMLWebpackPlugin.

`webpack.confg.js`

```js
const { emitCSS } = require("catom/css");
// ...
module.exports = {
  plugins: [
    new HtmlWebpackPlugin({
      templateParameters: async function templateParametersGenerator(
        compilation,
        files,
        tags,
        options
      ) {
        return {
          compilation,
          webpackConfig: compilation.options,
          htmlWebpackPlugin: {
            tags,
            files,
            options: Object.assign(options, {
              emitCSS,
            }),
          },
        };
      },
    }),
  ],
};
```

and then inject it using a template parameter.

```html
<head>
  <style>
    <%= htmlWebpackPlugin.options.emitCSS() %>
  </style>
</head>
```

it also allows you to use postCSS plugins by importing the `transformCSS` and/or `autoPrefixCSS` functions

# 0 Runtime

Catom ships with 0 js code in your bundle. In fact the first thing the babel transform does, is to [remove](https://github.com/Hydrophobefireman/catom/blob/378fefef245c399a550edb60916c051f87f671ea/babelPlugin.ts#L17) all imports of the `css` function from your code.

# Caveats

- It's just something I threw together because I wanted it for a project
- Not even close to production ready
- Since it works with AST, it does not allow you to use variable in the values (In work)
- No support for keyframes as of now
