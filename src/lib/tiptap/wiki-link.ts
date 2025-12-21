import { Mark, mergeAttributes, markInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// Input rule regex: matches [[text]] and captures the text inside
const wikiLinkInputRuleRegex = /\[\[([^\]]+)\]\]$/;

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  onLinkClick?: (title: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { title: string }) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

export const WikiLink = Mark.create<WikiLinkOptions>({
  name: "wikiLink",

  addOptions() {
    return {
      HTMLAttributes: {},
      onLinkClick: undefined,
    };
  },

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-title"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-title": attributes.title,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link="true"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-wiki-link": "true",
        class:
          "wiki-link text-primary hover:text-primary/80 cursor-pointer font-medium underline decoration-primary/50 hover:decoration-primary",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes: { title: string }) =>
        ({ commands }: { commands: { setMark: (name: string, attrs: { title: string }) => boolean } }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetWikiLink:
        () =>
        ({ commands }: { commands: { unsetMark: (name: string) => boolean } }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: wikiLinkInputRuleRegex,
        type: this.type,
        getAttributes: (match) => {
          return { title: match[1] };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const onLinkClick = this.options.onLinkClick;

    return [
      new Plugin({
        key: new PluginKey("wikiLinkClick"),
        props: {
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement;
            if (target.hasAttribute("data-wiki-link")) {
              const title = target.getAttribute("data-title");
              if (title && onLinkClick) {
                onLinkClick(title);
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

// Helper to extract wiki links from text or HTML content
export function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  
  // Extract from raw [[text]] patterns
  const rawRegex = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = rawRegex.exec(content)) !== null) {
    links.push(match[1]);
  }
  
  // Also extract from HTML data-title attributes (TipTap saves as HTML)
  const htmlRegex = /data-title="([^"]+)"/g;
  while ((match = htmlRegex.exec(content)) !== null) {
    if (!links.includes(match[1])) {
      links.push(match[1]);
    }
  }
  
  return links;
}

// Convert plain text with [[links]] to HTML with wiki-link marks
export function convertWikiLinksToHTML(text: string): string {
  return text.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span data-wiki-link="true" data-title="$1" class="wiki-link text-primary hover:text-primary/80 cursor-pointer font-medium underline decoration-primary/50 hover:decoration-primary">[[$1]]</span>'
  );
}
