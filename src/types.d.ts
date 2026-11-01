declare module 'postcss-less' {
  import { Parser } from 'postcss';
  const syntax: { parse: Parser };
  export default syntax;
}
