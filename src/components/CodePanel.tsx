import { useState, useEffect } from "react";
import { FileTree } from "./FileTree";
import { CodeEditor } from "./CodeEditor";
import { api, FileNode } from "@/lib/api";

interface CodePanelProps {
  projectId: string;
  updatedFiles: Map<string, string>;
}

// Helper to find a file by path in the tree
function findFileInTree(files: FileNode[], targetPath: string): boolean {
  for (const node of files) {
    if (node.path === targetPath) return true;
    if (node.children && findFileInTree(node.children, targetPath)) return true;
  }
  return false;
}

export function CodePanel({ projectId, updatedFiles }: CodePanelProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Load file tree
  useEffect(() => {
    const loadFiles = async () => {
      setIsLoadingTree(true);
      try {
        const fileTree = await api.getFiles(projectId);
        setFiles(fileTree);
        
        // Default to pages/Index.tsx or src/pages/Index.tsx if exists
        const defaultPaths = ["src/pages/Index.tsx", "pages/Index.tsx"];
        for (const defaultPath of defaultPaths) {
          if (findFileInTree(fileTree, defaultPath)) {
            setSelectedPath(defaultPath);
            break;
          }
        }
      } catch (error) {
        console.error("Failed to load files:", error);
      } finally {
        setIsLoadingTree(false);
      }
    };

    loadFiles();
  }, [projectId]);

  // Load file content when selected
  useEffect(() => {
    if (!selectedPath) {
      setFileContent("");
      return;
    }

    // Check if we have an updated version from streaming
    if (updatedFiles.has(selectedPath)) {
      setFileContent(updatedFiles.get(selectedPath)!);
      return;
    }

    const loadContent = async () => {
      setIsLoadingFile(true);
      try {
        const content = await api.getFileContent(projectId, selectedPath);
        setFileContent(content);
      } catch (error) {
        console.error("Failed to load file:", error);
        setFileContent("// Error loading file");
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadContent();
  }, [projectId, selectedPath, updatedFiles]);

  // Update content when streaming updates arrive
  useEffect(() => {
    if (selectedPath && updatedFiles.has(selectedPath)) {
      setFileContent(updatedFiles.get(selectedPath)!);
    }
  }, [selectedPath, updatedFiles]);

  const handleSelectFile = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <div className="flex h-full">
      {/* File Tree */}
      <div className="w-56 shrink-0 border-r border-border/50 overflow-y-auto bg-panel">
        <div className="panel-header">
          <span className="text-sm font-medium">Files</span>
        </div>
        <FileTree
          files={files}
          selectedPath={selectedPath}
          onSelectFile={handleSelectFile}
          isLoading={isLoadingTree}
        />
      </div>

      {/* Code Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedPath && (
          <div className="panel-header shrink-0">
            <span className="text-sm text-muted-foreground truncate">
              {selectedPath}
            </span>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            content={fileContent}
            filePath={selectedPath}
            isLoading={isLoadingFile}
          />
        </div>
      </div>
    </div>
  );
}
