import React from 'react';
import { Box, Card, CardContent, Typography, Button, Container } from '@mui/material';
import { Warning as WarningIcon, Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React Error Boundary Caught Error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh',
            backgroundColor: '#0A1920',
            py: 4
          }}
        >
          <Container maxWidth="sm">
            <Card
              sx={{
                border: '1px solid rgba(239, 83, 80, 0.4)',
                boxShadow: '0px 12px 30px rgba(239, 83, 80, 0.15)',
                '&:hover': {
                  borderColor: 'rgba(239, 83, 80, 0.6)'
                }
              }}
            >
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <WarningIcon sx={{ color: '#ef5350', fontSize: 64, mb: 2 }} />
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: 'Outfit',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    mb: 1
                  }}
                >
                  Portal Render Error
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                  An unexpected error occurred while rendering this component. Defensive safeguards have intercepted the failure to prevent page freezing.
                </Typography>

                {this.state.error && (
                  <Box
                    sx={{
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      p: 2,
                      borderRadius: 2,
                      mb: 4,
                      textAlign: 'left',
                      maxHeight: 120,
                      overflowY: 'auto',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        color: '#ef5350',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {this.state.error.toString()}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    onClick={this.handleReload}
                    sx={{
                      background: 'linear-gradient(135deg, #008B8B 0%, #00B7C2 100%)',
                      '&:hover': {
                        boxShadow: '0px 4px 12px rgba(0, 183, 194, 0.3)'
                      }
                    }}
                  >
                    Retry Loading
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<HomeIcon />}
                    onClick={this.handleGoHome}
                  >
                    Go to Home
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
