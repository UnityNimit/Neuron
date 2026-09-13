// frontend/src/hooks/useAiStudio.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export function useAiStudio({
  wsRef,
  isWsConnected = false,
  settings,
  addNotification,
  activeFile,
  fileContent,
  onApplyCode
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeModelId, setActiveModelId] = useState(() => {
    return settings?.defaultAiModel || 'gemini-3.8-flash';
  });

  // Streaming states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingThought, setStreamingThought] = useState("");
  const [streamingDelta, setStreamingDelta] = useState("");
  const [streamingSteps, setStreamingSteps] = useState([]); // [{ step: string, status: 'running'|'done' }]
  const [pendingApproval, setPendingApproval] = useState(null); // { action_id, tool, args, description, conversation_id }

  const streamingThoughtRef = useRef("");
  const streamingDeltaRef = useRef("");
  const streamingStepsRef = useRef([]);
  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.id === activeConversationId) || conversations[0] || null;
  }, [conversations, activeConversationId]);

  // Sync default model from settings
  useEffect(() => {
    if (settings?.defaultAiModel && !activeModelId) {
      setActiveModelId(settings.defaultAiModel);
    }
  }, [settings?.defaultAiModel]);

  // Request initial conversations on connect / reconnect
  useEffect(() => {
    const ws = wsRef?.current;
    if (ws && ws.readyState === WebSocket.OPEN && isWsConnected) {
      ws.send(JSON.stringify({ event: 'AI_LIST_CONVERSATIONS' }));
    }
  }, [wsRef, isWsConnected]);

  // Disconnect recovery: safely reset streaming states if connection drops mid-flight
  useEffect(() => {
    if (!isWsConnected && isStreaming) {
      setIsStreaming(false);
      streamingThoughtRef.current = "";
      streamingDeltaRef.current = "";
      streamingStepsRef.current = [];
      setStreamingThought("");
      setStreamingDelta("");
      setStreamingSteps([]);
      setPendingApproval(null);
      addNotification?.('error', 'Connection Lost', 'Backend connection was interrupted during AI generation.', 'ai');
    }
  }, [isWsConnected, isStreaming, addNotification]);

  // WebSocket message handler
  useEffect(() => {
    const ws = wsRef?.current;
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const evt = data.event;
        const currentActiveId = activeConversationIdRef.current;
        const isCurrentConv = !data.conversation_id || data.conversation_id === currentActiveId || !currentActiveId;

        if (evt === 'AI_CONVERSATIONS_LIST') {
          const list = data.payload || [];
          setConversations(list);
          if (list.length > 0 && !activeConversationIdRef.current) {
            setActiveConversationId(list[0].id);
          }
        }
        else if (evt === 'AI_CONVERSATION_CREATED') {
          const newConv = data.payload;
          if (newConv) {
            setConversations(prev => [newConv, ...prev.filter(c => c.id !== newConv.id)]);
            setActiveConversationId(newConv.id);
          }
        }
        else if (evt === 'AI_CONVERSATION_DATA') {
          const conv = data.payload;
          if (conv) {
            setConversations(prev => {
              const idx = prev.findIndex(c => c.id === conv.id);
              if (idx !== -1) {
                const next = [...prev];
                next[idx] = conv;
                return next;
              }
              return [conv, ...prev];
            });
          }
        }
        else if (evt === 'AI_CHAT_STEP') {
          if (isCurrentConv) {
            const stepItem = { step: data.step, status: data.status };
            setStreamingSteps(prev => {
              const existingIdx = prev.findIndex(s => s.step === data.step);
              let updated;
              if (existingIdx !== -1) {
                updated = [...prev];
                updated[existingIdx] = stepItem;
              } else {
                updated = [...prev, stepItem];
              }
              streamingStepsRef.current = updated;
              return updated;
            });
          }
        }
        else if (evt === 'AI_CHAT_THOUGHT') {
          if (isCurrentConv) {
            streamingThoughtRef.current += data.thought || "";
            setStreamingThought(streamingThoughtRef.current);
          }
        }
        else if (evt === 'AI_APPROVAL_REQUIRED') {
          if (isCurrentConv) {
            setPendingApproval({
              actionId: data.action_id,
              tool: data.tool,
              args: data.args || {},
              description: data.description || "",
              conversationId: data.conversation_id
            });
          }
        }
        else if (evt === 'AI_CHAT_DELTA') {
          if (isCurrentConv) {
            streamingDeltaRef.current += data.delta || "";
            setStreamingDelta(streamingDeltaRef.current);
          }
        }
        else if (evt === 'AI_CHAT_DONE') {
          setPendingApproval(null);
          const fullContent = data.content || streamingDeltaRef.current;
          const refactor = data.refactor || null;
          const thoughts = streamingThoughtRef.current;
          const steps = streamingStepsRef.current;

          setConversations(prev => {
            return prev.map(c => {
              if (c.id === (data.conversation_id || activeConversationIdRef.current)) {
                const assistantMsg = {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: fullContent,
                  thoughts: thoughts || null,
                  steps: steps || [],
                  refactor: refactor,
                  timestamp: new Date().toISOString()
                };
                const updatedMessages = [...(c.messages || []).filter(m => m.id !== assistantMsg.id), assistantMsg];
                return { ...c, messages: updatedMessages, updated_at: new Date().toISOString() };
              }
              return c;
            });
          });

          // Reset streaming buffers
          setIsStreaming(false);
          streamingThoughtRef.current = "";
          streamingDeltaRef.current = "";
          streamingStepsRef.current = [];
          setStreamingThought("");
          setStreamingDelta("");
          setStreamingSteps([]);
        }
        else if (evt === 'AI_CHAT_STOPPED') {
          setPendingApproval(null);
          setIsStreaming(false);
          streamingThoughtRef.current = "";
          streamingDeltaRef.current = "";
          streamingStepsRef.current = [];
          setStreamingThought("");
          setStreamingDelta("");
          setStreamingSteps([]);
          addNotification?.('info', 'Generation Stopped', 'Autonomous agent stopped by user.', 'ai');
        }
        else if (evt === 'AI_ROLLBACK_SUCCESS') {
          const restored = data.payload || [];
          addNotification?.('success', 'Changes Rolled Back', `Restored ${restored.length} file(s) to original state.`, 'ai');
        }
        else if (evt === 'AI_CHAT_ERROR') {
          setPendingApproval(null);
          setIsStreaming(false);
          streamingThoughtRef.current = "";
          streamingDeltaRef.current = "";
          streamingStepsRef.current = [];
          setStreamingThought("");
          setStreamingDelta("");
          setStreamingSteps([]);
          const errorMsg = data.error || 'Failed to complete AI request.';
          setConversations(prev => {
            return prev.map(c => {
              if (c.id === (data.conversation_id || activeConversationIdRef.current)) {
                const assistantMsg = {
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  content: `### Antigravity Alert\n\n${errorMsg}\n\n*Please verify your Gemini API key in **Settings > AI & Models**.*`,
                  timestamp: new Date().toISOString()
                };
                const updatedMessages = [...(c.messages || []), assistantMsg];
                return { ...c, messages: updatedMessages, updated_at: new Date().toISOString() };
              }
              return c;
            });
          });
          addNotification?.('error', 'Antigravity Error', errorMsg, 'ai');
        }
      } catch (e) {}
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [wsRef, addNotification, isWsConnected]);

  // Select conversation with backend sync
  const handleSelectConversation = useCallback((convId) => {
    if (isStreaming) {
      addNotification?.('warning', 'Agent Busy', 'Please wait for current generation to finish or click Stop before switching conversations.', 'ai');
      return;
    }
    setActiveConversationId(convId);
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_SELECT_CONVERSATION',
        conversation_id: convId
      }));
    }
  }, [wsRef, isStreaming, addNotification]);

  // Send message
  const handleSendMessage = useCallback((promptText) => {
    if (!promptText || isStreaming) return;

    let targetConvId = activeConversationId;
    if (!targetConvId) {
      targetConvId = `conv_${Date.now()}`;
      setActiveConversationId(targetConvId);
    }

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: promptText,
      timestamp: new Date().toISOString()
    };

    // Optimistic UI update
    setConversations(prev => {
      const exists = prev.some(c => c.id === targetConvId);
      if (!exists) {
        const newConv = {
          id: targetConvId,
          title: promptText.slice(0, 32),
          model: activeModelId,
          messages: [userMsg],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return [newConv, ...prev];
      }
      return prev.map(c => {
        if (c.id === targetConvId) {
          const newTitle = (!c.messages || c.messages.length <= 1) ? promptText.slice(0, 32) : c.title;
          const updatedMessages = [...(c.messages || []), userMsg];
          return { ...c, title: newTitle, messages: updatedMessages, updated_at: new Date().toISOString() };
        }
        return c;
      });
    });

    setIsStreaming(true);
    setStreamingThought("");
    setStreamingDelta("");
    setStreamingSteps([]);
    setPendingApproval(null);
    streamingThoughtRef.current = "";
    streamingDeltaRef.current = "";
    streamingStepsRef.current = [];

    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_CHAT_STREAM',
        prompt: promptText,
        conversation_id: targetConvId,
        model: activeModelId,
        api_key: settings?.antigravityApiKey || "",
        approval_mode: settings?.requireRefactorApproval ? 'manual' : 'auto',
        context_code: fileContent || "",
        file_path: activeFile || ""
      }));
    } else {
      setIsStreaming(false);
      const offlineMsg = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `**Backend Engine Reconnecting**\n\nThe WebSocket connection to the Neuron backend engine is temporarily offline. Please verify that Neuron backend is active on port 8000.`,
        timestamp: new Date().toISOString()
      };
      setConversations(prev => prev.map(c => {
        if (c.id === targetConvId) {
          return { ...c, messages: [...(c.messages || []), offlineMsg], updated_at: new Date().toISOString() };
        }
        return c;
      }));
      addNotification?.('error', 'Connection Offline', 'Neuron backend is not connected.', 'ai');
    }
  }, [activeConversationId, isStreaming, activeModelId, settings?.antigravityApiKey, settings?.requireRefactorApproval, fileContent, activeFile, wsRef, addNotification]);

  // Stop generation mid-flight
  const handleStopGeneration = useCallback(() => {
    if (wsRef?.current?.readyState === WebSocket.OPEN && activeConversationId) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_STOP_GENERATION',
        conversation_id: activeConversationId
      }));
    }
    setIsStreaming(false);
    setPendingApproval(null);
  }, [wsRef, activeConversationId]);

  // Interactive tool execution approval handlers
  const handleApproveAction = useCallback((actionId) => {
    if (wsRef?.current?.readyState === WebSocket.OPEN && activeConversationId) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_APPROVE_ACTION',
        conversation_id: activeConversationId,
        action_id: actionId,
        approved: true
      }));
    }
    setPendingApproval(null);
  }, [wsRef, activeConversationId]);

  const handleRejectAction = useCallback((actionId, feedback = "") => {
    if (wsRef?.current?.readyState === WebSocket.OPEN && activeConversationId) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_APPROVE_ACTION',
        conversation_id: activeConversationId,
        action_id: actionId,
        approved: false,
        feedback: feedback || "User denied approval for this action."
      }));
    }
    setPendingApproval(null);
  }, [wsRef, activeConversationId]);

  // Rollback modified files
  const handleRollback = useCallback(() => {
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_ROLLBACK_CHANGES'
      }));
    }
  }, [wsRef]);

  // Create conversation
  const handleCreateConversation = useCallback(() => {
    if (isStreaming) {
      addNotification?.('warning', 'Agent Busy', 'Please wait for current generation to finish or click Stop before creating a new conversation.', 'ai');
      return;
    }
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_CREATE_CONVERSATION',
        title: 'New Conversation',
        model: activeModelId
      }));
    }
  }, [wsRef, activeModelId, isStreaming, addNotification]);

  // Delete conversation
  const handleDeleteConversation = useCallback((convId) => {
    if (isStreaming) {
      addNotification?.('warning', 'Agent Busy', 'Cannot delete conversation while generation is active.', 'ai');
      return;
    }
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_DELETE_CONVERSATION',
        conversation_id: convId
      }));
    }
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversationId === convId) {
      const remaining = conversations.filter(c => c.id !== convId);
      setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [wsRef, activeConversationId, conversations, isStreaming, addNotification]);

  // Apply refactor
  const handleApplyRefactor = useCallback((refactor) => {
    if (!refactor) return;
    const { filePath, proposedCode } = refactor;
    onApplyCode?.(filePath, proposedCode);
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        event: 'AI_APPLY_REFACTOR',
        filePath,
        proposedCode
      }));
    }
  }, [onApplyCode, wsRef]);

  // Guard model selection during generation
  const handleSelectModel = useCallback((modelId) => {
    if (isStreaming) {
      addNotification?.('warning', 'Agent Busy', 'Cannot change AI model while generation is active.', 'ai');
      return;
    }
    setActiveModelId(modelId);
  }, [isStreaming, addNotification]);

  return {
    conversations,
    setConversations,
    activeConversationId,
    setActiveConversationId: handleSelectConversation,
    handleSelectConversation,
    activeConversation,
    activeModelId,
    setActiveModelId: handleSelectModel,
    isStreaming,
    streamingThought,
    streamingDelta,
    streamingSteps,
    pendingApproval,
    handleApproveAction,
    handleRejectAction,
    handleSendMessage,
    handleStopGeneration,
    handleRollback,
    handleCreateConversation,
    handleDeleteConversation,
    handleApplyRefactor
  };
}
