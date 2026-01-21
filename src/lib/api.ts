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
    // Use a template string to append the path as a query parameter
    const response = await fetch(
      `${BASE_URL}/api/projects/${projectId}/files/content?path=${path}`, 
      {
        headers: { ...getAuthHeaders() },
      }
    );

    const data = await response.json();

    console.log("API Response Data:", data); // Debugging line
    
    if (!response.ok) {
      // Optional: Log the status code to help debugging
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

  // streamChat(projectId: string, message: string, onMessage: (text: string) => void, onFile: (path: string, content: string) => void, onComplete: () => void, onError: (error: Error) => void) {
  //   const controller = new AbortController();
    
  //   fetch(`${BASE_URL}/api/chat/stream`, {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       ...getAuthHeaders(),
  //     },
  //     body: JSON.stringify({ message, projectId }),
  //     signal: controller.signal,
  //   })
  //     .then(async (response) => {
  //       if (!response.ok) {
  //         throw new Error("Chat stream failed");
  //       }

  //       const reader = response.body?.getReader();
  //       if (!reader) {
  //         throw new Error("No reader available");
  //       }

  //       const decoder = new TextDecoder();
  //       let buffer = "";

  //       while (true) {
  //         const { done, value } = await reader.read();
  //         if (done) break;

  //         buffer += decoder.decode(value, { stream: true });
          
  //         // Parse message tags
  //         const messageRegex = /<message>([\s\S]*?)<\/message>/g;
  //         let messageMatch;
  //         while ((messageMatch = messageRegex.exec(buffer)) !== null) {
  //           onMessage(messageMatch[1]);
  //           buffer = buffer.replace(messageMatch[0], "");
  //         }

  //         // Parse file tags
  //         const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  //         let fileMatch;
  //         while ((fileMatch = fileRegex.exec(buffer)) !== null) {
  //           onFile(fileMatch[1], fileMatch[2]);
  //           buffer = buffer.replace(fileMatch[0], "");
  //         }

  //         // Handle partial message content for streaming effect
  //         const partialMessageStart = buffer.indexOf("<message>");
  //         if (partialMessageStart !== -1) {
  //           const partialContent = buffer.slice(partialMessageStart + 9);
  //           if (partialContent && !partialContent.includes("</message>")) {
  //             onMessage(partialContent);
  //           }
  //         }
  //       }

  //       onComplete();
  //     })
  //     .catch((error) => {
  //       if (error.name !== "AbortError") {
  //         onError(error);
  //       }
  //     });

  //   return () => controller.abort();
  // },

  async streamChat(projectId: string, message: string, onMessage: (text: string) => void, onFile: (path: string, content: string) => void, onComplete: () => void, onError: (error: Error) => void) {
    const controller = new AbortController();
    
    try {
      const response = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ message, projectId }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Chat stream failed");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 1. Process Completed Files (Files should be processed only when complete)
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let fileMatch;
        while ((fileMatch = fileRegex.exec(buffer)) !== null) {
          onFile(fileMatch[1], fileMatch[2]);
          // Only replace the completed file block
          buffer = buffer.replace(fileMatch[0], "");
          fileRegex.lastIndex = 0; // Reset regex state after string mutation
        }

        // 2. Process Streaming Message Content
        // We look for content between <message> and </message> or after a <message> tag
        const messageStartTag = "<message>";
        const messageEndTag = "</message>";
        
        const startIndex = buffer.indexOf(messageStartTag);
        const endIndex = buffer.indexOf(messageEndTag);

        if (startIndex !== -1) {
          if (endIndex !== -1) {
            // Full message block found
            const fullContent = buffer.substring(startIndex + messageStartTag.length, endIndex);
            onMessage(fullContent);
            // Remove the full message block from buffer
            buffer = buffer.substring(endIndex + messageEndTag.length);
          } else {
            // Message is still streaming
            const partialContent = buffer.substring(startIndex + messageStartTag.length);
            onMessage(partialContent);
          }
        }
      }
      onComplete();
    } catch (error: any) {
      if (error.name !== "AbortError") onError(error);
    }
    return () => controller.abort();
  }
};
