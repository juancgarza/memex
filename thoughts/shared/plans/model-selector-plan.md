# Model Selector Implementation Plan

## Overview

Add a simple dropdown to select between AI models (Claude Opus 4.5, Claude Sonnet 4, GPT-5 Pro) in the chat interface. The selected model will be passed to the API route and used for generating responses.

## Current State Analysis

- **Chat API**: `src/app/api/chat/route.ts` - hardcoded `anthropic("claude-sonnet-4-20250514")`
- **Chat UI**: `src/components/chat/ChatInterface.tsx` - uses `useChat` with `DefaultChatTransport`
- **SDKs installed**: `@ai-sdk/anthropic`, `@ai-sdk/openai` (both already in package.json)
- **UI Components**: Only `Switch` component exists, no Select/Dropdown

### Key Discoveries:
- AI SDK supports dynamic model selection via `body` option in `sendMessage()` (`src/components/chat/ChatInterface.tsx:133`)
- Both Anthropic and OpenAI SDKs are already installed (`package.json:12-13`)
- `@radix-ui/react-select` is not installed but patterns exist in tiptap-templates

## Desired End State

- User can select from 3 models via a dropdown in the chat header/input area
- Selected model persists across messages in the same session
- API route dynamically uses the selected model
- Default model is Claude Sonnet 4 (current behavior)

## What We're NOT Doing

- Per-message model switching (model applies to whole conversation)
- Model selection for concept extraction (stays on Claude Sonnet)
- Persisting model preference to database
- Model-specific UI (reasoning tokens display, etc.)

## Implementation Approach

Use Radix UI Select component (consistent with existing Switch), pass model in request body, handle dynamically on server.

---

## Phase 1: Add Select UI Component

### Overview
Create a reusable Select component using Radix UI, matching the existing Switch component pattern.

### Changes Required:

#### 1. Install Radix Select
```bash
pnpm add @radix-ui/react-select
```

#### 2. Create Select Component
**File**: `src/components/ui/select.tsx`

```tsx
"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
        position === "popper" && "translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build`
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [x] Select component can be imported and used

---

## Phase 2: Add Model Selector to Chat Interface

### Overview
Add model state and dropdown UI to the chat interface, pass model in sendMessage body.

### Changes Required:

#### 1. Define Models Configuration
**File**: `src/lib/models.ts` (new file)

```typescript
export type ModelId = 
  | "claude-sonnet-4-20250514"
  | "claude-opus-4-5-20251124"
  | "gpt-5-pro";

export interface Model {
  id: ModelId;
  name: string;
  provider: "anthropic" | "openai";
}

export const MODELS: Model[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
  },
  {
    id: "claude-opus-4-5-20251124",
    name: "Claude Opus 4.5",
    provider: "anthropic",
  },
  {
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    provider: "openai",
  },
];

export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-20250514";
```

#### 2. Update ChatInterface
**File**: `src/components/chat/ChatInterface.tsx`

Add imports:
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MODELS, DEFAULT_MODEL, type ModelId } from "@/lib/models";
```

Add state:
```typescript
const [selectedModel, setSelectedModel] = useState<ModelId>(DEFAULT_MODEL);
```

Update sendMessage call (~line 133):
```typescript
sendMessage({ text: messageWithContext }, {
  body: { model: selectedModel },
});
```

Add dropdown UI in the input area (before the Send button):
```tsx
<Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelId)}>
  <SelectTrigger className="w-[140px] h-9 text-xs">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {MODELS.map((model) => (
      <SelectItem key={model.id} value={model.id}>
        {model.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build`
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Model dropdown appears in chat input area
- [ ] Model selection changes state correctly
- [ ] Selected model persists during conversation

---

## Phase 3: Update API Route for Dynamic Model Selection

### Overview
Modify the chat API route to accept model from request body and instantiate the correct provider.

### Changes Required:

#### 1. Update Chat Route
**File**: `src/app/api/chat/route.ts`

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { MODELS, DEFAULT_MODEL, type ModelId } from "@/lib/models";

export const maxDuration = 30;

function getModel(modelId: ModelId) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    // Fallback to default
    return anthropic(DEFAULT_MODEL);
  }
  
  if (model.provider === "anthropic") {
    return anthropic(modelId);
  } else {
    return openai(modelId);
  }
}

export async function POST(req: Request) {
  const { messages, model: modelId }: { messages: UIMessage[]; model?: ModelId } = await req.json();

  const result = streamText({
    model: getModel(modelId || DEFAULT_MODEL),
    system: `You are a helpful assistant in a personal knowledge management system called Memex.
You help the user organize their thoughts, explore ideas, and make connections between concepts.
Be concise but thorough. When relevant, suggest connections to previous topics discussed.`,
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build`
- [x] TypeScript compiles: `npx tsc --noEmit`

#### Manual Verification:
- [ ] Chat works with Claude Sonnet 4 (default)
- [ ] Chat works with Claude Opus 4.5
- [ ] Chat works with GPT-5 Pro
- [ ] Responses are visibly different between models (test with a complex question)

---

## Testing Strategy

### Unit Tests:
- N/A for this feature (no business logic to test)

### Manual Testing Steps:
1. Open chat view
2. Verify dropdown shows "Claude Sonnet 4" by default
3. Send a message, verify response works
4. Change to "Claude Opus 4.5", send message, verify different model responds
5. Change to "GPT-5 Pro", send message, verify OpenAI model responds
6. Refresh page, verify default model is selected (no persistence)

## Performance Considerations

- Model instantiation is lightweight (just creates provider wrapper)
- No additional API calls for model switching
- Consider adding model indicator to message metadata later

## References

- AI SDK Chatbot docs: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
- Radix UI Select: https://www.radix-ui.com/primitives/docs/components/select
- Current chat route: `src/app/api/chat/route.ts`
- Current chat UI: `src/components/chat/ChatInterface.tsx`
