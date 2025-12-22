import Firecrawl from "@mendable/firecrawl-js";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const firecrawl = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    const result = await firecrawl.scrape(url, {
      formats: ["markdown"],
    });

    if (!result.markdown) {
      return NextResponse.json(
        { error: "Failed to scrape URL - no content returned" },
        { status: 500 }
      );
    }

    const title = result.metadata?.title || new URL(url).hostname;
    const content = `# ${title}\n\n${result.markdown}\n\n---\nSource: ${url}`;

    return NextResponse.json({
      title,
      content,
      metadata: result.metadata,
      sourceUrl: url,
    });
  } catch (error) {
    console.error("URL import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
