/* GENERATED from packages/ai/src/templates-ai-assistant.stories.tsx by pnpm gen — do not edit. */
/* Full-screen ai-assistant template (single source of truth: the Storybook story). */

/**
 * AI assistant template — the canonical full-screen AI assistant composition:
 * app-shell nav, an immersive `ChatShell` (transcript scrolls behind a floating
 * `Composer`, one centred reading column) and the `ContextPanel` right rail. This story is the
 * single source of truth: `pnpm gen` derives the consumer template
 * source (`docs/playbooks/templates/ai-assistant.tsx`) from it.
 * Verify across both themes with globals=theme:<slug>.
 */
import { useState } from "react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  Button,
  NavUser,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@elabs-ai/components-ui";
import {
  AssetPreview,
  ChatShell,
  Composer,
  ContextPanel,
  ContextPanelBody,
  ContextPanelDetail,
  ContextPanelHeader,
  ContextPanelProvider,
  ContextPanelSection,
  ContextPanelTrigger,
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  ProducedAssetTree,
  useContextPanel,
  type ContextAsset,
} from "@elabs-ai/components-ai";
import { Bot, History, Home, MessageSquare, Settings } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const nav = [
  { id: "chat", label: "Chat", icon: Bot },
  { id: "history", label: "History", icon: History },
  { id: "home", label: "Home", icon: Home },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Right rail root — what the assistant produced; selecting one drills in. */
function ContextRailRoot({ assets }: { assets: ContextAsset[] }) {
  const { state, actions } = useContextPanel();
  return (
    <ContextPanelSection label="Produced assets">
      <ProducedAssetTree
        assets={assets}
        selectedId={state.selectedAsset?.id}
        onSelect={actions.openDetail}
      />
    </ContextPanelSection>
  );
}

/** Right rail detail — the focused asset, with Back in the panel header. */
function ContextRailDetail() {
  const { state } = useContextPanel();
  return (
    <ContextPanelDetail>
      {state.selectedAsset ? <AssetPreview asset={state.selectedAsset} /> : null}
    </ContextPanelDetail>
  );
}

function AiAssistantTemplate() {
  const [active, setActive] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  // Files the assistant produced — wire to your runtime's tool outputs.
  const [assets] = useState<ContextAsset[]>([]);

  function send(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
    setStatus("submitted");
    const reply = "This is a placeholder response. Connect this to your model runtime.";
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
    setStatus("ready");
  }

  return (
    // The provider wraps the whole shell so the header trigger and the right
    // rail share one open/closed state.
    <ContextPanelProvider>
      <SidebarProvider className="h-svh min-h-0">
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-2">
            <div className="flex items-center gap-2">
              <AppIcon height={20} aria-hidden />
              <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
                Assistant
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        isActive={active === n.id}
                        tooltip={n.label}
                        onClick={() => setActive(n.id)}
                      >
                        <n.icon aria-hidden="true" />
                        <span>{n.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <NavUser user={{ name: "Avery Rao", email: "avery@acme.co" }} />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex min-w-0 flex-col overflow-hidden">
          <header className="flex h-header shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <h1 className="text-body font-medium">AI Assistant</h1>
            <ContextPanelTrigger className="ms-auto" />
          </header>
          {/* `bare`: the transcript scrolls behind the floating composer and
              both share one centred reading column. */}
          <div className="min-h-0 flex-1">
            <ChatShell
              variant="bare"
              composer={
                <Composer
                  placeholder="Send a message…"
                  status={status === "submitted" ? "Generating…" : "Awaiting your input"}
                  sendStatus={status}
                  onSubmit={(message) => {
                    const text = message.text?.trim();
                    if (text) send(text);
                  }}
                />
              }
            >
              <Conversation className="flex-1">
                <ConversationContent>
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      icon={<MessageSquare className="size-8" aria-hidden="true" />}
                      title="Start the conversation"
                      description="Ask anything to begin."
                      actions={
                        <>
                          <Button
                            onClick={() => send("What can you help me with?")}
                            size="sm"
                            variant="outline"
                          >
                            What can you help me with?
                          </Button>
                          <Button
                            onClick={() => send("Summarize my recent activity")}
                            size="sm"
                            variant="outline"
                          >
                            Summarize my recent activity
                          </Button>
                        </>
                      }
                    />
                  ) : (
                    messages.map((m) => (
                      <Message from={m.role} key={m.id}>
                        <MessageContent>
                          <MessageResponse>{m.text}</MessageResponse>
                        </MessageContent>
                      </Message>
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </ChatShell>
          </div>
        </SidebarInset>
        <ContextPanel>
          <ContextPanelHeader title="Context" />
          <ContextPanelBody
            root={<ContextRailRoot assets={assets} />}
            detail={<ContextRailDetail />}
          />
        </ContextPanel>
      </SidebarProvider>
    </ContextPanelProvider>
  );
}
