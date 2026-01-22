/**
 * Main Chat Application Component
 * 
 * Integrates the chat interface with WebSocket service and handles
 * user authentication, conversation management, and action processing.
 * 
 * Requirements: 2.3, 2.4
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import ChatInterface from './ChatInterface';
import { WebSocketService, WebSocketServiceFactory } from '../services/websocketService';

// Types
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface SuggestedAction {
  type: string;
  description: string;
  requires_approval: boolean;
  data?: any;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: Date;
}

interface ChatAppProps {
  user: User;
  onLogout?: () => void;
}

// Theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
});

export const ChatApp: React.FC<ChatAppProps> = ({ user, onLogout }) => {
  // State
  const [conversationId, setConversationId] = useState<string>();
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [pendingAction, setPendingAction] = useState<SuggestedAction | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WebSocket service
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
    const service = WebSocketServiceFactory.getInstance({
      url: wsUrl,
      userId: user.id,
      conversationId: conversationId
    });

    setWsService(service);

    // Set up event listeners
    service.on('connected', () => {
      setIsConnected(true);
      addNotification('success', 'Connected to DeFi Assistant');
    });

    service.on('disconnected', () => {
      setIsConnected(false);
      addNotification('warning', 'Disconnected from DeFi Assistant');
    });

    service.on('error', (error) => {
      console.error('WebSocket error:', error);
      addNotification('error', 'Connection error occurred');
    });

    service.on('message', (message) => {
      // Handle incoming messages (processed by ChatInterface)
      console.log('Received message:', message);
    });

    service.on('agent_status', (status) => {
      console.log('Agent status update:', status);
    });

    service.on('action_result', (result) => {
      handleActionResult(result);
    });

    service.on('notification', (notification) => {
      addNotification(notification.type, notification.message);
    });

    // Connect
    service.connect().catch(error => {
      console.error('Failed to connect:', error);
      addNotification('error', 'Failed to connect to DeFi Assistant');
    });

    return () => {
      service.disconnect();
    };
  }, [user.id, conversationId]);

  // Add notification
  const addNotification = useCallback((type: Notification['type'], message: string) => {
    const notification: Notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date()
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  // Handle message sent
  const handleMessageSent = useCallback((message: string) => {
    if (wsService) {
      wsService.sendUserMessage(message);
    }
  }, [wsService]);

  // Handle action approval
  const handleActionApproved = useCallback((action: SuggestedAction) => {
    if (action.requires_approval) {
      setPendingAction(action);
      setShowActionDialog(true);
    } else {
      executeAction(action);
    }
  }, []);

  // Handle action rejection
  const handleActionRejected = useCallback((action: SuggestedAction) => {
    if (wsService) {
      wsService.sendActionApproval('', false, action);
    }
    addNotification('info', 'Action rejected');
  }, [wsService, addNotification]);

  // Execute action
  const executeAction = useCallback(async (action: SuggestedAction) => {
    setIsLoading(true);
    
    try {
      if (wsService) {
        wsService.sendActionApproval('', true, action);
      }
      
      addNotification('success', `Executing ${action.type}...`);
      
    } catch (error) {
      console.error('Action execution failed:', error);
      addNotification('error', 'Action execution failed');
    } finally {
      setIsLoading(false);
      setShowActionDialog(false);
      setPendingAction(null);
    }
  }, [wsService, addNotification]);

  // Handle action result
  const handleActionResult = useCallback((result: any) => {
    if (result.success) {
      addNotification('success', result.message || 'Action completed successfully');
    } else {
      addNotification('error', result.message || 'Action failed');
    }
  }, [addNotification]);

  // Handle menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Handle logout
  const handleLogout = () => {
    handleMenuClose();
    if (wsService) {
      wsService.disconnect();
    }
    onLogout?.();
  };

  // Confirm action dialog
  const renderActionDialog = () => (
    <Dialog
      open={showActionDialog}
      onClose={() => setShowActionDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Confirm Action</DialogTitle>
      <DialogContent>
        {pendingAction && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to execute this action?
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Type:</strong> {pendingAction.type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Description:</strong> {pendingAction.description}
            </Typography>
            {pendingAction.data && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Details:</strong>
                </Typography>
                <pre style={{ fontSize: '12px', marginTop: '8px' }}>
                  {JSON.stringify(pendingAction.data, null, 2)}
                </pre>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowActionDialog(false)}>
          Cancel
        </Button>
        <Button
          onClick={() => pendingAction && executeAction(pendingAction)}
          variant="contained"
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : null}
        >
          {isLoading ? 'Executing...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* App Bar */}
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              DeFi Assistant
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="inherit">
                {isConnected ? 'Connected' : 'Connecting...'}
              </Typography>
              
              <IconButton
                size="large"
                edge="end"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenuOpen}
                color="inherit"
              >
                <Avatar
                  src={user.avatar}
                  alt={user.name}
                  sx={{ width: 32, height: 32 }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleMenuClose}>
                  <AccountIcon sx={{ mr: 1 }} />
                  Profile
                </MenuItem>
                <MenuItem onClick={handleMenuClose}>
                  <HistoryIcon sx={{ mr: 1 }} />
                  Chat History
                </MenuItem>
                <MenuItem onClick={handleMenuClose}>
                  <SettingsIcon sx={{ mr: 1 }} />
                  Settings
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Main Content */}
        <Container maxWidth="lg" sx={{ flex: 1, py: 2 }}>
          <ChatInterface
            userId={user.id}
            conversationId={conversationId}
            onMessageSent={handleMessageSent}
            onActionApproved={handleActionApproved}
            onActionRejected={handleActionRejected}
          />
        </Container>

        {/* Action Confirmation Dialog */}
        {renderActionDialog()}

        {/* Notifications */}
        {notifications.map((notification) => (
          <Snackbar
            key={notification.id}
            open={true}
            autoHideDuration={5000}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert severity={notification.type} variant="filled">
              {notification.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ThemeProvider>
  );
};

export default ChatApp;