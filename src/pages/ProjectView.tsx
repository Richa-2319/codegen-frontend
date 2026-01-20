import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Code, Eye, Sparkles, LogOut } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatPanel, ChatMessage } from "@/components/ChatPanel";
import { CodePanel } from "@/components/CodePanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { Button } from "@/components/ui/button";
import { api, isAuthenticated, removeAuthToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type ViewMode = "code" | "preview";

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("code");
  const [updatedFiles, setUpdatedFiles] = useState<Map<string, string>>(new Map());

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    removeAuthToken();
    navigate("/login");
  };

  const handleSendMessage = useCallback((content: string) => {
    if (!projectId) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);

    // Create placeholder for AI response
    const aiMessageId = (Date.now() + 1).toString();
    const aiMessage: ChatMessage = {
      id: aiMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };
    
    setMessages((prev) => [...prev, aiMessage]);

    let streamedContent = "";

    const cleanup = api.streamChat(
      projectId,
      content,
      (text) => {
        // Update streaming message
        streamedContent = text;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: streamedContent, isStreaming: true }
              : msg
          )
        );
      },
      (path, fileContent) => {
        // Update file content
        setUpdatedFiles((prev) => new Map(prev).set(path, fileContent));
        toast({
          title: "File updated",
          description: path,
        });
      },
      () => {
        // Stream complete
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
          )
        );
        setIsStreaming(false);
      },
      (error) => {
        // Handle error
        toast({
          title: "Chat error",
          description: error.message,
          variant: "destructive",
        });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: "Sorry, an error occurred.", isStreaming: false }
              : msg
          )
        );
        setIsStreaming(false);
      }
    );

    return cleanup;
  }, [projectId, toast]);

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid project ID</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border/50 bg-panel flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold gradient-text">Lovable</span>
          <span className="text-muted-foreground text-sm">/ {projectId}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode("code")}
              className={`tab-button ${viewMode === "code" ? "active" : ""}`}
            >
              <Code className="w-4 h-4 mr-2 inline-block" />
              Code
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`tab-button ${viewMode === "preview" ? "active" : ""}`}
            >
              <Eye className="w-4 h-4 mr-2 inline-block" />
              Preview
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
            <div className="h-full glass-panel border-r border-border/50">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isStreaming={isStreaming}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-border/50 hover:bg-primary/50 transition-colors" />

          {/* Code/Preview Panel */}
          <ResizablePanel defaultSize={60} minSize={40} maxSize={75}>
            <div className="h-full">
              {viewMode === "code" ? (
                <CodePanel projectId={projectId} updatedFiles={updatedFiles} />
              ) : (
                <PreviewPanel projectId={projectId} />
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
