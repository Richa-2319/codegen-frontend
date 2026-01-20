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
    
    return response.json();
  },

  async getFileContent(projectId: string, path: string): Promise<string> {
    const response = await fetch(`${BASE_URL}/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
      headers: { ...getAuthHeaders() },
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch file content");
    }
    
    return response.text();
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

  streamChat(projectId: string, message: string, onMessage: (text: string) => void, onFile: (path: string, content: string) => void, onComplete: () => void, onError: (error: Error) => void) {
    const controller = new AbortController();
    
    fetch(`${BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message, projectId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Chat stream failed");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No reader available");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Parse message tags
          const messageRegex = /<message>([\s\S]*?)<\/message>/g;
          let messageMatch;
          while ((messageMatch = messageRegex.exec(buffer)) !== null) {
            onMessage(messageMatch[1]);
            buffer = buffer.replace(messageMatch[0], "");
          }

          // Parse file tags
          const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
          let fileMatch;
          while ((fileMatch = fileRegex.exec(buffer)) !== null) {
            onFile(fileMatch[1], fileMatch[2]);
            buffer = buffer.replace(fileMatch[0], "");
          }

          // Handle partial message content for streaming effect
          const partialMessageStart = buffer.indexOf("<message>");
          if (partialMessageStart !== -1) {
            const partialContent = buffer.slice(partialMessageStart + 9);
            if (partialContent && !partialContent.includes("</message>")) {
              onMessage(partialContent);
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
  },
};
