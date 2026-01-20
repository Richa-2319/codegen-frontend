import { useMemo } from "react";
import { FileCode, Loader2 } from "lucide-react";

interface CodeEditorProps {
  content: string;
  filePath: string | null;
  isLoading?: boolean;
}

// Simple syntax highlighting for common patterns
function highlightCode(code: string, filePath: string): React.ReactNode[] {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const isJsTs = ["js", "jsx", "ts", "tsx"].includes(ext);
  const isJson = ext === "json";
  const isCss = ["css", "scss"].includes(ext);

  const lines = code.split("\n");
  
  return lines.map((line, index) => {
    let highlighted = line;
    
    if (isJsTs) {
      // Keywords
      highlighted = highlighted.replace(
        /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|async|await|try|catch|throw|new|this|extends|implements|default|switch|case|break|continue)\b/g,
        '<span class="text-syntax-keyword">$1</span>'
      );
      
      // Strings
      highlighted = highlighted.replace(
        /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,
        '<span class="text-syntax-string">$&</span>'
      );
      
      // Numbers
      highlighted = highlighted.replace(
        /\b(\d+\.?\d*)\b/g,
        '<span class="text-syntax-number">$1</span>'
      );
      
      // Comments
      highlighted = highlighted.replace(
        /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
        '<span class="text-syntax-comment">$1</span>'
      );
      
      // Functions
      highlighted = highlighted.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
        '<span class="text-syntax-function">$1</span>('
      );
    } else if (isJson) {
      // Keys
      highlighted = highlighted.replace(
        /"([^"]+)":/g,
        '"<span class="text-syntax-keyword">$1</span>":'
      );
      
      // Strings
      highlighted = highlighted.replace(
        /:\s*"([^"]*)"/g,
        ': "<span class="text-syntax-string">$1</span>"'
      );
      
      // Numbers
      highlighted = highlighted.replace(
        /:\s*(\d+)/g,
        ': <span class="text-syntax-number">$1</span>'
      );
    } else if (isCss) {
      // Selectors
      highlighted = highlighted.replace(
        /^([.#]?[a-zA-Z_-][a-zA-Z0-9_-]*)/gm,
        '<span class="text-syntax-keyword">$1</span>'
      );
      
      // Properties
      highlighted = highlighted.replace(
        /([a-z-]+):/g,
        '<span class="text-syntax-function">$1</span>:'
      );
      
      // Values
      highlighted = highlighted.replace(
        /:\s*([^;]+);/g,
        ': <span class="text-syntax-string">$1</span>;'
      );
    }
    
    return (
      <div key={index} className="code-line flex">
        <span className="w-12 text-right pr-4 text-muted-foreground select-none shrink-0">
          {index + 1}
        </span>
        <span
          className="flex-1"
          dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }}
        />
      </div>
    );
  });
}

export function CodeEditor({ content, filePath, isLoading }: CodeEditorProps) {
  const highlightedLines = useMemo(() => {
    if (!content || !filePath) return null;
    return highlightCode(content, filePath);
  }, [content, filePath]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <FileCode className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-muted-foreground">No file selected</h3>
        <p className="text-sm text-muted-foreground/70">
          Select a file from the tree to view its contents
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background/50 font-mono text-sm">
      <div className="p-4 min-w-fit">
        {highlightedLines}
      </div>
    </div>
  );
}
