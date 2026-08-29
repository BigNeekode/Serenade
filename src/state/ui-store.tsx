import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface SupervisorChatState {
  messages: { id: number; role: "operator" | "supervisor"; text: string }[];
  createdTitles: string[];
  counter: number;
}

export interface SupervisorChatMessage {
  role: "operator" | "supervisor";
  text: string;
}

interface UiState {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  supervisorChats: Record<string, SupervisorChatState>;
  getSupervisorChat: (scope: string) => SupervisorChatState;
  setSupervisorChat: (scope: string, state: SupervisorChatState) => void;
  markSupervisorTaskCreated: (scope: string, title: string) => void;
  /** Functional append — safe from async callbacks because it never reads a stale snapshot. */
  appendSupervisorMessage: (scope: string, message: SupervisorChatMessage) => void;
}

const UiContext = createContext<UiState | null>(null);

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — session-only is fine
  }
}

export function UiStoreProvider({ children }: { children: ReactNode }) {
  const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(() =>
    readStored("serenade.ui.selectedProjectId", null),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    readStored("serenade.ui.sidebarCollapsed", false),
  );
  const [panelWidth, setPanelWidthState] = useState(() => readStored("serenade.ui.panelWidth", 360));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [supervisorChats, setSupervisorChats] = useState<Record<string, SupervisorChatState>>({});

  useEffect(() => persist("serenade.ui.selectedProjectId", selectedProjectId), [selectedProjectId]);
  useEffect(() => persist("serenade.ui.sidebarCollapsed", sidebarCollapsed), [sidebarCollapsed]);
  useEffect(() => persist("serenade.ui.panelWidth", panelWidth), [panelWidth]);

  const setSelectedProjectId = useCallback((id: string | null) => setSelectedProjectIdState(id), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);
  const setPanelWidth = useCallback((w: number) => setPanelWidthState(Math.min(640, Math.max(280, w))), []);

  const getSupervisorChat = useCallback(
    (scope: string): SupervisorChatState =>
      supervisorChats[scope] ?? { messages: [], createdTitles: [], counter: 0 },
    [supervisorChats],
  );
  const setSupervisorChat = useCallback((scope: string, state: SupervisorChatState) => {
    setSupervisorChats((chats) => ({ ...chats, [scope]: state }));
  }, []);

  const appendSupervisorMessage = useCallback((scope: string, message: SupervisorChatMessage) => {
    setSupervisorChats((chats) => {
      const chat = chats[scope] ?? { messages: [], createdTitles: [], counter: 0 };
      return {
        ...chats,
        [scope]: {
          ...chat,
          messages: [...chat.messages, { id: chat.counter + 1, ...message }],
          counter: chat.counter + 1,
        },
      };
    });
  }, []);

  const markSupervisorTaskCreated = useCallback((scope: string, title: string) => {
    setSupervisorChats((chats) => {
      const chat = chats[scope] ?? { messages: [], createdTitles: [], counter: 0 };
      if (chat.createdTitles.includes(title)) return chats;
      return {
        ...chats,
        [scope]: {
          ...chat,
          createdTitles: [...chat.createdTitles, title],
        },
      };
    });
  }, []);

  const selectTask = useCallback((id: string | null) => {
    setSelectedTaskId(id);
    if (id) setSelectedAgentId(null);
  }, []);
  const selectAgent = useCallback((id: string | null) => {
    setSelectedAgentId(id);
    if (id) setSelectedTaskId(null);
  }, []);

  return (
    <UiContext.Provider
      value={{
        selectedProjectId,
        setSelectedProjectId,
        sidebarCollapsed,
        toggleSidebar,
        panelWidth,
        setPanelWidth,
        selectedTaskId,
        selectTask,
        selectedAgentId,
        selectAgent,
        paletteOpen,
        setPaletteOpen,
        supervisorChats,
        getSupervisorChat,
        setSupervisorChat,
        markSupervisorTaskCreated,
        appendSupervisorMessage,
      }}
    >
      {children}
    </UiContext.Provider>
  );
}

export function useUiStore(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUiStore must be used within UiStoreProvider");
  return ctx;
}
