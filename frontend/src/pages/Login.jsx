import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authActions } from '../store';
import { authApi } from '../utils/api';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  FlashOn as FlashIcon
} from '@mui/icons-material';

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authApi.post('/auth/login', { email, password });
      const { token, user } = res.data;
      
      dispatch(authActions.loginSuccess({ token, user }));
      
      // Dynamic routing based on user role
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'STAFF') {
        navigate('/staff');
      } else {
        navigate('/consumer');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Invalid credentials or connection issue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        backgroundColor: '#0A1920'
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 450, py: 2, px: 1 }}>
        <CardContent>
          {/* Logo Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <FlashIcon sx={{ color: '#00B7C2', fontSize: 36, mr: 1 }} />
              <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 800, color: '#FFFFFF' }}>
                Smart<span style={{ color: '#00B7C2' }}>Grid</span>
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#B0BEC5', fontWeight: 400 }}>
              Utility Management Platform Login
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Info Banner showing Unified Sign-In */}
          <Alert severity="info" sx={{ mb: 2, backgroundColor: '#0d202a', color: '#B0BEC5', border: '1px solid rgba(0, 183, 194, 0.2)', '& .MuiAlert-icon': { color: '#00B7C2' }, '& .MuiAlert-message': { fontSize: '11.5px', fontFamily: 'Outfit' } }}>
            <strong>Unified Portal:</strong> Supports all system roles (Consumer, Staff, Supervisor, Admin). Redirection is automatic.
          </Alert>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'rgba(38, 198, 218, 0.7)' }} />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'rgba(38, 198, 218, 0.7)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, mb: 2, fontSize: '16px', fontWeight: 'bold' }}
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </Button>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Typography variant="body2" sx={{ color: '#B0BEC5' }}>
                Are you a consumer?{' '}
                <Link to="/register" style={{ fontWeight: 'bold', color: '#00B7C2' }}>
                  Register here
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
