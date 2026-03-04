declare module "virtual:catom.css" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const def: any;
  export default def;
}
