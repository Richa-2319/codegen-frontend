import { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Bot, Plus, Bookmark, MoreHorizontal, ThumbsUp, ThumbsDown, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  createdAt?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isStreaming: boolean;
  isLoading?: boolean;
}

export function ChatPanel({ messages, onSendMessage, isStreaming, isLoading }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    onSendMessage(input.trim());
    setInput("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-medium mb-1">Start a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe what you want to build or modify
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map((message, index) => (
              <div key={message.id}>
                {/* Message card container */}
                <div className={`p-4 bg-background`}>
                  {/* User message styling */}
                  {message.role === "user" ? (
                    <div className="space-y-2">
                      {/* Timestamp for user messages */}
                      {message.createdAt && (
                        <div className="text-xs text-muted-foreground text-center mb-2">
                          {format(new Date(message.createdAt), "d MMM 'at' HH:mm")}
                        </div>
                      )}
                      <div className="bg-muted/50 rounded-lg p-3 max-w-[80%] ml-auto flex justify-between items-start gap-2">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words align-right">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant message styling */
                    <div className="space-y-3">
                      {/* Message content */}
                      {message.content && (
                        <div className="text-sm leading-relaxed break-words text-muted-foreground prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                          {message.isStreaming && <span className="streaming-cursor inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse" />}
                        </div>
                      )}
                      {/* Action buttons for user message */}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-border/50 bg-panel">
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="min-h-[48px] max-h-[200px] pr-12 resize-none bg-muted/30 border-border/30 focus:border-primary/50 rounded-xl text-sm"
            disabled={isStreaming}
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-30"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        
        {/* Bottom toolbar */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
              <Plus className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 flex items-center justify-center">✨</span>
                Visual edits
              </span>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 flex items-center justify-center">💬</span>
                Chat
              </span>
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {isStreaming && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Thinking...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
