const BASE_URL = "http://localhost:8090";

export const getAuthToken = () => localStorage.getItem("auth_token");

export const setAuthToken = (token: string) => localStorage.setItem("auth_token", token);

export const removeAuthToken = () => localStorage.removeItem("auth_token");

export const isAuthenticated = () => !!getAuthToken();

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  projectId: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface DeployResponse {
  previewUrl: string;
}

export interface ChatHistoryMessage {
  id: number;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}

// LocalStorage keys
export const PREVIEW_URL_KEY = "preview_url";
export const OPEN_TABS_KEY = "open_tabs";
export const ACTIVE_TAB_KEY = "active_tab";

// API response format for files endpoint
interface FilesApiResponse {
  files: { path: string }[];
}

// Convert flat file paths to nested tree structure
function buildFileTree(paths: { path: string }[]): FileNode[] {
  const root: FileNode[] = [];
  const nodeMap = new Map<string, FileNode>();

  // Sort paths to ensure directories come before their children
  const sortedPaths = [...paths].sort((a, b) => a.path.localeCompare(b.path));

  for (const { path } of sortedPaths) {
    const parts = path.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      // Skip if node already exists
      if (nodeMap.has(currentPath)) continue;

      const isFile = i === parts.length - 1;
      const node: FileNode = {
        name: part,
        path: currentPath,
        type: isFile ? "file" : "directory",
        children: isFile ? undefined : [],
      };

      nodeMap.set(currentPath, node);

      if (parentPath) {
        const parent = nodeMap.get(parentPath);
        if (parent && parent.children) {
          parent.children.push(node);
        }
      } else {
        root.push(node);
      }
    }
  }

  // Sort each level: directories first, then alphabetically
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === "directory" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "directory") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };

  sortNodes(root);
  return root;
}

export const api = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Login failed");
    }
    
    return response.json();
  },

  async getFiles(projectId: string): Promise<FileNode[]> {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}/files`, {
      headers: { ...getAuthHeaders() },
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch files");
    }
    
    const data: FilesApiResponse = await response.json();
    return buildFileTree(data.files);
  },

  async getFileContent(projectId: string, path: string): Promise<string> {
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/files/content?path=${path}`, 
      {
        headers: { ...getAuthHeaders() },
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`Error fetching file: ${response.status} ${response.statusText}`);
      throw new Error("Failed to fetch file content");
    }

    return data.content;
  },

  async deploy(projectId: string): Promise<DeployResponse> {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}/deploy`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
    });
    
    if (!response.ok) {
      throw new Error("Deployment failed");
    }
    
    return response.json();
  },

  async getChatHistory(projectId: string): Promise<ChatHistoryMessage[]> {
    const response = await fetch(`${BASE_URL}/api/chat/projects/${projectId}`, {
      headers: { ...getAuthHeaders() },
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch chat history");
    }
    
    return response.json();
  },

  streamChat(
    projectId: string, 
    message: string, 
    onChunk: (chunk: string) => void, 
    onFile: (path: string, content: string) => void, 
    onComplete: () => void, 
    onError: (error: Error) => void
  ) {
    const controller = new AbortController();
    
    fetch(`${BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ message, projectId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Chat stream failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");
        
        const decoder = new TextDecoder();
        let buffer = "";
        let insideMessage = false;
        let insideFile = false;
        let currentFilePath = "";
        let fileContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process buffer character by character for streaming
          while (buffer.length > 0) {
            // Check for file start tag
            const fileStartMatch = buffer.match(/^<file path="([^"]+)">/);
            if (fileStartMatch) {
              insideFile = true;
              currentFilePath = fileStartMatch[1];
              fileContent = "";
              buffer = buffer.slice(fileStartMatch[0].length);
              continue;
            }

            // Check for file end tag
            if (insideFile && buffer.startsWith("</file>")) {
              onFile(currentFilePath, fileContent);
              insideFile = false;
              currentFilePath = "";
              buffer = buffer.slice(7); // "</file>".length
              continue;
            }

            // Check for message start tag
            if (buffer.startsWith("<message>")) {
              insideMessage = true;
              buffer = buffer.slice(9); // "<message>".length
              continue;
            }

            // Check for message end tag
            if (insideMessage && buffer.startsWith("</message>")) {
              insideMessage = false;
              buffer = buffer.slice(10); // "</message>".length
              continue;
            }

            // Handle content inside tags
            if (insideFile) {
              // For files, accumulate content but don't stream it
              fileContent += buffer[0];
              buffer = buffer.slice(1);
            } else if (insideMessage) {
              // For messages, stream each character
              onChunk(buffer[0]);
              buffer = buffer.slice(1);
            } else {
              // Outside any tag, check if we might be starting a tag
              if (buffer[0] === "<") {
                // Might be a tag, wait for more data
                break;
              }
              // Discard unknown content
              buffer = buffer.slice(1);
            }
          }
        }

        onComplete();
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          onError(error);
        }
      });

    return () => controller.abort();
  }
};
