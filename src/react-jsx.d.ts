/**
 * The repo builds without `@types/react`, so `React` resolves to `any` and no
 * JSX namespace is published. This ambient declaration restores just enough for
 * our own components to be type-checked on their props (including `key`) while
 * DOM elements stay permissive — matching how the app is actually compiled.
 */
export {};

declare global {
  namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute {
      children: unknown;
    }
    interface IntrinsicAttributes {
      key?: string | number;
    }
    interface IntrinsicElements {
      [elementName: string]: any;
    }
  }
}
