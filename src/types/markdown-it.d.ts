declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
    breaks?: boolean;
    [key: string]: unknown;
  }

  class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    render(md: string): string;
    use(plugin: unknown, ...args: unknown[]): MarkdownIt;
  }

  export default MarkdownIt;
}

