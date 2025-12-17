import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a helpful assistant in a personal knowledge management system called Memex.
You help the user organize their thoughts, explore ideas, and make connections between concepts.
Be concise but thorough. When relevant, suggest connections to previous topics discussed.`,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
