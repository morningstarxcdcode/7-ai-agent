/**
 * Main Application Component
 * 
 * Demo application showing the chat interface integration
 * with authentication and user management.
 */

import React, { useState, useEffect } from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import ChatApp from './components/ChatApp';

// Mock user for demo purposes
const mockUser = {
  id: 'demo_user_123',
  name: 'Demo User',
  email: 'demo@example.com',
  avatar: undefined
};

interface AppState {
  isAuthenticated: boolean;
  user: typeof mockUser | null;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    isAuthenticated: false,
    user: null
  });

  // Mock authentication for demo
  const handleLogin = () => {
    setAppState({
      isAuthenticated: true,
      user: mockUser
    });
  };

  const handleLogout = () => {
    setAppState({
      isAuthenticated: false,
      user: null
    });
  };

  // Auto-login for demo
  useEffect(() => {
    // In a real app, check for existing auth token
    const autoLogin = setTimeout(() => {
      if (!appState.isAuthenticated) {
        handleLogin();
      }
    }, 1000);

    return () => clearTimeout(autoLogin);
  }, [appState.isAuthenticated]);

  if (!appState.isAuthenticated || !appState.user) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            DeFi Assistant
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Your intelligent companion for decentralized finance operations.
            Get personalized advice, execute transactions safely, and learn
            about DeFi protocols with AI-powered assistance.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={handleLogin}
            sx={{ mt: 2 }}
          >
            Connect with Google
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ height: '100vh' }}>
      <ChatApp
        user={appState.user}
        onLogout={handleLogout}
      />
    </Box>
  );
};

export default App;