import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#008B8B', // Dark Cyan
      light: '#00B7C2', // Secondary
      dark: '#005f5f'
    },
    secondary: {
      main: '#00B7C2', // Light Cyan
      light: '#26C6DA', // Accent
      dark: '#008b96'
    },
    background: {
      default: '#0A1920', // Background
      paper: '#102733' // Cards
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5'
    },
    divider: 'rgba(38, 198, 218, 0.15)',
    action: {
      hover: 'rgba(0, 183, 194, 0.08)'
    }
  },
  typography: {
    fontFamily: '"Outfit", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
    subtitle1: { fontWeight: 400 },
    body1: { fontWeight: 300 }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 10px rgba(0, 183, 194, 0.25)'
          }
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #008B8B 0%, #00B7C2 100%)',
          color: '#FFFFFF'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#102733',
          backgroundImage: 'none',
          borderRadius: 12,
          border: '1px solid rgba(0, 183, 194, 0.12)',
          boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)',
          transition: 'transform 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: 'rgba(38, 198, 218, 0.4)',
            boxShadow: '0px 12px 30px rgba(38, 198, 218, 0.15)'
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(38, 198, 218, 0.1)'
        },
        head: {
          color: '#26C6DA',
          fontWeight: 600,
          backgroundColor: '#0d202a'
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#102733',
          borderBottom: '1px solid rgba(38, 198, 218, 0.12)',
          backgroundImage: 'none',
          boxShadow: 'none'
        }
      }
    }
  }
});

export default theme;
