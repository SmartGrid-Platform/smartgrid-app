import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { authActions } from '../store';
import { alertApi } from '../utils/api';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Container,
  Divider,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  ExitToApp as LogoutIcon,
  FlashOn as FlashIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  
  const [anchorElNotifications, setAnchorElNotifications] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      let res;
      if (user.role === 'CONSUMER') {
        res = await alertApi.get(`/alerts/user/${user.id}`);
      } else {
        res = await alertApi.get('/alerts');
      }
      const data = res.data;
      console.log('[DEBUG] Layout Notifications Response:', data);
      const alerts = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.data) ? data.data : []);
      setNotifications(alerts);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    dispatch(authActions.logout());
    navigate('/login');
  };

  const handleNotificationsOpen = (event) => {
    setAnchorElNotifications(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setAnchorElNotifications(null);
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'ADMIN': return 'error';
      case 'STAFF': return 'info';
      default: return 'success';
    }
  };

  if (!isAuthenticated) return <>{children}</>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#0A1920' }}>
      <AppBar position="static">
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            {/* Logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <FlashIcon sx={{ color: '#00B7C2', mr: 1, fontSize: 30 }} />
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontFamily: 'Outfit',
                  fontWeight: 700,
                  letterSpacing: '.1rem',
                  color: '#FFFFFF',
                  textTransform: 'uppercase'
                }}
              >
                Smart<span style={{ color: '#00B7C2' }}>Grid</span>
              </Typography>
            </Box>

            {/* Profile & Notifications */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {user && (
                <Chip
                  label={user.role}
                  color={getRoleColor(user.role)}
                  size="small"
                  sx={{ fontFamily: 'Outfit', fontWeight: 600 }}
                />
              )}
              
              {user && (
                <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, color: '#B0BEC5' }}>
                  Welcome, <strong>{user.name}</strong>
                </Typography>
              )}

              {user && user.role === 'CONSUMER' && (
                <Box sx={{ display: 'flex', gap: 1, ml: 2, mr: 2 }}>
                  <Button size="small" sx={{ color: '#fff' }} onClick={() => navigate('/consumer')}>
                    Dashboard
                  </Button>
                  <Button size="small" sx={{ color: '#fff' }} onClick={() => navigate('/consumer/bills')}>
                    My Bills
                  </Button>
                  <Button size="small" sx={{ color: '#fff' }} onClick={() => navigate('/consumer/assistant')}>
                    AI Assistant
                  </Button>
                </Box>
              )}

              {/* Notifications Icon */}
              <IconButton color="inherit" onClick={handleNotificationsOpen}>
                <Badge badgeContent={Array.isArray(notifications) ? notifications.length : 0} color="secondary">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
              
              <Menu
                anchorEl={anchorElNotifications}
                open={Boolean(anchorElNotifications)}
                onClose={handleNotificationsClose}
                PaperProps={{
                  sx: {
                    maxHeight: 350,
                    width: 320,
                    backgroundColor: '#102733',
                    border: '1px solid rgba(0, 183, 194, 0.2)',
                    borderRadius: '8px'
                  }
                }}
              >
                <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: '#26C6DA', fontWeight: 600 }}>
                  Notifications ({Array.isArray(notifications) ? notifications.length : 0})
                </Typography>
                <Divider sx={{ backgroundColor: 'rgba(0, 183, 194, 0.15)' }} />
                {!Array.isArray(notifications) || notifications.length === 0 ? (
                  <MenuItem onClick={handleNotificationsClose}>
                    <Typography variant="body2" sx={{ color: '#B0BEC5', py: 1 }}>No new alerts</Typography>
                  </MenuItem>
                ) : (
                  notifications.map((n) => (
                    <Box key={n.id}>
                      <MenuItem onClick={handleNotificationsClose} sx={{ py: 1, whiteSpace: 'normal', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="subtitle2" color="secondary" sx={{ fontSize: '12px', fontWeight: 'bold' }}>
                          {n.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#FFFFFF', fontSize: '11px', mt: 0.5 }}>
                          {n.message}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#777', fontSize: '9px', mt: 0.5 }}>
                          {new Date(n.createdAt || n.created_at).toLocaleString()}
                        </Typography>
                      </MenuItem>
                      <Divider sx={{ backgroundColor: 'rgba(38, 198, 218, 0.08)' }} />
                    </Box>
                  ))
                )}
              </Menu>

              {/* Logout */}
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
                sx={{ fontFamily: 'Outfit' }}
              >
                Logout
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, py: 4 }}>
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 3, textAlign: 'center', backgroundColor: '#061116', borderTop: '1px solid rgba(38, 198, 218, 0.1)' }}>
        <Typography variant="caption" color="textSecondary">
          &copy; {new Date().getFullYear()} SmartGrid Utility Management Platform. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default Layout;
