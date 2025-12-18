import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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

// Input rule to convert [[text]] to wiki link
export const wikiLinkInputRegex = /\[\[([^\]]+)\]\]$/;

// Helper to extract wiki links from text
export function extractWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
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
