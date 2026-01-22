/**
 * Chat Interface Component
 * 
 * WhatsApp/Messenger-like UI with agent status indicators,
 * transaction approval cards with Y/N buttons, and real-time
 * messaging with WebSocket connections.
 * 
 * Requirements: 2.3, 2.4
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Avatar, 
  Chip, 
  Card, 
  CardContent, 
  CardActions,
  IconButton,
  Badge,
  Divider,
  Alert,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingIcon,
  AccountBalance as WalletIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { format } from 'date-fns';

// Types
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'approval_card' | 'educational' | 'warning';
  metadata?: {
    intent?: string;
    confidence?: number;
    requires_approval?: boolean;
    risk_level?: 'low' | 'medium' | 'high';
    suggested_actions?: SuggestedAction[];
    educational_content?: string;
    risk_warnings?: string[];
  };
}

interface SuggestedAction {
  type: string;
  description: string;
  requires_approval: boolean;
  data?: any;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline';
  activity: string;
  icon: React.ReactNode;
}

interface ChatInterfaceProps {
  userId: string;
  conversationId?: string;
  onMessageSent?: (message: string) => void;
  onActionApproved?: (action: SuggestedAction) => void;
  onActionRejected?: (action: SuggestedAction) => void;
}

// Styled Components
const ChatContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  maxHeight: '800px',
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  boxShadow: theme.shadows[3]
}));

const MessagesContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1),
  backgroundColor: '#f5f5f5',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: '#f1f1f1',
  },
  '&::-webkit-scrollbar-thumb': {
    background: '#888',
    borderRadius: '3px',
  },
}));

const MessageBubble = styled(Paper)<{ sender: 'user' | 'assistant' }>(({ theme, sender }) => ({
  padding: theme.spacing(1.5),
  margin: theme.spacing(0.5, 0),
  maxWidth: '70%',
  alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
  backgroundColor: sender === 'user' ? theme.palette.primary.main : theme.palette.background.paper,
  color: sender === 'user' ? theme.palette.primary.contrastText : theme.palette.text.primary,
  borderRadius: sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
  wordBreak: 'break-word'
}));

const InputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  alignItems: 'flex-end',
  gap: theme.spacing(1)
}));

const AgentStatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${theme.palette.divider}`,
  overflowX: 'auto',
  gap: theme.spacing(1)
}));

const ApprovalCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  border: `2px solid ${theme.palette.warning.main}`,
  backgroundColor: theme.palette.warning.light + '20'
}));

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  userId,
  conversationId,
  onMessageSent,
  onActionApproved,
  onActionRejected
}) => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([
    {
      id: 'intent-router',
      name: 'Intent Router',
      status: 'online',
      activity: 'Ready',
      icon: <BotIcon />
    },
    {
      id: 'defi-strategist',
      name: 'DeFi Strategist',
      status: 'online',
      activity: 'Analyzing markets',
      icon: <TrendingIcon />
    },
    {
      id: 'security-guardian',
      name: 'Security Guardian',
      status: 'online',
      activity: 'Monitoring',
      icon: <SecurityIcon />
    },
    {
      id: 'wallet-manager',
      name: 'Wallet Manager',
      status: 'online',
      activity: 'Ready',
      icon: <WalletIcon />
    }
  ]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
      const ws = new WebSocket(`${wsUrl}/${userId}/${conversationId || 'new'}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      websocketRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [userId, conversationId]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message_response':
        const newMessage: Message = {
          id: data.response_id,
          content: data.message,
          sender: 'assistant',
          timestamp: new Date(data.timestamp),
          type: data.requires_approval ? 'approval_card' : 'text',
          metadata: {
            intent: data.intent_analysis?.primary_intent,
            confidence: data.intent_analysis?.confidence,
            requires_approval: data.requires_approval,
            suggested_actions: data.suggested_actions,
            educational_content: data.educational_content,
            risk_warnings: data.risk_warnings
          }
        };
        setMessages(prev => [...prev, newMessage]);
        setIsLoading(false);
        break;

      case 'agent_status_update':
        setAgentStatuses(prev => 
          prev.map(agent => 
            agent.id === data.agent_id 
              ? { ...agent, status: data.status, activity: data.activity }
              : agent
          )
        );
        break;

      case 'typing_indicator':
        // Handle typing indicators
        break;

      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send via WebSocket
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'user_message',
        message: inputValue,
        user_id: userId,
        conversation_id: conversationId,
        timestamp: new Date().toISOString()
      }));
    }

    // Call callback
    onMessageSent?.(inputValue);
    setInputValue('');
  }, [inputValue, isLoading, userId, conversationId, onMessageSent]);

  // Handle key press
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // Handle action approval
  const handleActionApproval = (action: SuggestedAction, approved: boolean) => {
    if (approved) {
      onActionApproved?.(action);
    } else {
      onActionRejected?.(action);
    }

    // Send approval status via WebSocket
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'action_approval',
        action,
        approved,
        user_id: userId,
        conversation_id: conversationId,
        timestamp: new Date().toISOString()
      }));
    }
  };

  // Render message content
  const renderMessageContent = (message: Message) => {
    switch (message.type) {
      case 'approval_card':
        return (
          <Box>
            <Typography variant="body1" gutterBottom>
              {message.content}
            </Typography>
            
            {message.metadata?.risk_warnings && message.metadata.risk_warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {message.metadata.risk_warnings.join(' ')}
                </Typography>
              </Alert>
            )}

            {message.metadata?.suggested_actions?.map((action, index) => (
              <ApprovalCard key={index}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <WarningIcon color="warning" />
                    <Typography variant="h6">
                      Action Approval Required
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {action.description}
                  </Typography>
                  <Typography variant="body2">
                    Type: {action.type}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ApproveIcon />}
                    onClick={() => handleActionApproval(action, true)}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<RejectIcon />}
                    onClick={() => handleActionApproval(action, false)}
                  >
                    Reject
                  </Button>
                </CardActions>
              </ApprovalCard>
            ))}

            {message.metadata?.educational_content && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  💡 {message.metadata.educational_content}
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 'educational':
        return (
          <Box>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <InfoIcon color="info" />
              <Typography variant="subtitle2">Educational Content</Typography>
            </Box>
            <Typography variant="body1">
              {message.content}
            </Typography>
          </Box>
        );

      case 'warning':
        return (
          <Alert severity="warning">
            <Typography variant="body1">
              {message.content}
            </Typography>
          </Alert>
        );

      default:
        return (
          <Typography variant="body1">
            {message.content}
          </Typography>
        );
    }
  };

  // Render agent status
  const renderAgentStatus = (agent: AgentStatus) => {
    const statusColor = {
      online: 'success',
      busy: 'warning',
      offline: 'error'
    }[agent.status] as 'success' | 'warning' | 'error';

    return (
      <Tooltip key={agent.id} title={`${agent.name}: ${agent.activity}`}>
        <Chip
          avatar={
            <Badge
              color={statusColor}
              variant="dot"
              overlap="circular"
            >
              <Avatar sx={{ width: 24, height: 24 }}>
                {agent.icon}
              </Avatar>
            </Badge>
          }
          label={agent.name}
          variant="outlined"
          size="small"
        />
      </Tooltip>
    );
  };

  return (
    <ChatContainer>
      {/* Agent Status Bar */}
      <AgentStatusBar>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Agents:
          </Typography>
          {agentStatuses.map(renderAgentStatus)}
          <Chip
            label={isConnected ? 'Connected' : 'Connecting...'}
            color={isConnected ? 'success' : 'warning'}
            size="small"
            variant="outlined"
          />
        </Box>
      </AgentStatusBar>

      {/* Messages Container */}
      <MessagesContainer>
        {messages.length === 0 && (
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            justifyContent="center" 
            height="100%"
            textAlign="center"
            p={3}
          >
            <BotIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Welcome to DeFi Assistant
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask me anything about DeFi, portfolio management, or crypto operations.
              I'll help you navigate the decentralized finance world safely.
            </Typography>
          </Box>
        )}

        {messages.map((message) => (
          <Box
            key={message.id}
            display="flex"
            flexDirection="column"
            alignItems={message.sender === 'user' ? 'flex-end' : 'flex-start'}
            mb={1}
          >
            <MessageBubble sender={message.sender}>
              {renderMessageContent(message)}
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                <Typography variant="caption" color="text.secondary">
                  {format(message.timestamp, 'HH:mm')}
                </Typography>
                
                {message.metadata?.confidence && (
                  <Chip
                    label={`${Math.round(message.metadata.confidence * 100)}% confident`}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            </MessageBubble>
          </Box>
        ))}

        {isLoading && (
          <Box display="flex" alignItems="center" gap={1} p={2}>
            <Avatar sx={{ width: 32, height: 32 }}>
              <BotIcon />
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Assistant is thinking...
              </Typography>
              <LinearProgress />
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </MessagesContainer>

      {/* Input Container */}
      <InputContainer>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Ask about DeFi, trading, or portfolio management..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading || !isConnected}
          variant="outlined"
          size="small"
        />
        <IconButton
          color="primary"
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading || !isConnected}
          sx={{ p: 1 }}
        >
          <SendIcon />
        </IconButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatInterface;