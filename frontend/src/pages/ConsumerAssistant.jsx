import React, { useState, useRef, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, IconButton, Paper, CircularProgress, Button, Grid } from '@mui/material';
import { Send as SendIcon, SmartToy as BotIcon, Person as UserIcon, AttachFile as AttachFileIcon } from '@mui/icons-material';
import { assistantApi } from '../utils/api';

const suggestedPrompts = [
  "Analyze My Bill",
  "Explain my latest bill",
  "How much balance do I have?",
  "When should I recharge?",
  "How can I reduce my electricity cost?"
];

const ConsumerAssistant = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your SmartGrid AI Assistant. How can I help you with your electricity account today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (text) => {
    const msg = text || input;
    if (!msg.trim()) return;

    const userMsg = { role: 'user', content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await assistantApi.post('/assistant/chat', { 
        message: msg,
        sessionId
      });
      if (res.data.sessionId) setSessionId(res.data.sessionId);
      
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    setSelectedFile(file.name);

    const userMsg = { role: 'user', content: `[Attached PDF: ${file.name}] Please analyze this bill.` };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('billPdf', file);
      if (sessionId) formData.append('sessionId', sessionId);

      const res = await assistantApi.post('/assistant/upload-bill', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.sessionId) setSessionId(res.data.sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (error) {
      console.error('Upload error:', error);
      const errMsg = error.response?.data?.error || 'Sorry, there was an error processing your PDF.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setLoading(false);
      event.target.value = ''; // Reset input
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2, fontFamily: 'Outfit', fontWeight: 700, color: '#26C6DA' }}>
        SmartGrid AI Assistant
      </Typography>

      <Box sx={{ mb: 2, p: 2, backgroundColor: '#102733', borderRadius: 2, border: '1px dashed rgba(0, 183, 194, 0.5)' }}>
        <Button 
          variant="contained" 
          component="label" 
          disabled={loading} 
          startIcon={<AttachFileIcon />} 
          sx={{ mr: 2, backgroundColor: '#00B7C2', color: '#102733', '&:hover': { backgroundColor: '#26C6DA' }, fontWeight: 'bold' }}
        >
          Upload Bill PDF
          <input type="file" hidden accept="application/pdf" onChange={handleFileUpload} />
        </Button>
        {selectedFile && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: '#B0BEC5', display: 'block' }}>
              Selected File:
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 'bold' }}>
              {selectedFile}
            </Typography>
          </Box>
        )}
      </Box>
      
      <Card sx={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, overflowY: 'auto', p: 2, backgroundColor: '#0A1929' }}>
          {messages.map((m, i) => (
            <Box key={i} sx={{ display: 'flex', mb: 2, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <BotIcon sx={{ color: '#00B7C2', mr: 1, mt: 1 }} />
              )}
              <Paper sx={{
                p: 1.5,
                maxWidth: '75%',
                backgroundColor: m.role === 'user' ? '#00B7C2' : '#102733',
                color: '#fff',
                borderRadius: 2,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                <Typography variant="body2" sx={{ fontFamily: 'Inter' }}>
                  {m.content}
                </Typography>
              </Paper>
              {m.role === 'user' && (
                <UserIcon sx={{ color: '#00B7C2', ml: 1, mt: 1 }} />
              )}
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: 'flex', mb: 2, justifyContent: 'flex-start' }}>
               <BotIcon sx={{ color: '#00B7C2', mr: 1, mt: 1 }} />
               <Paper sx={{ p: 1.5, backgroundColor: '#102733', color: '#fff', borderRadius: 2 }}>
                 <CircularProgress size={20} sx={{ color: '#00B7C2' }} />
               </Paper>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        
        <Box sx={{ p: 2, backgroundColor: '#102733', borderTop: '1px solid rgba(0, 183, 194, 0.2)' }}>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {suggestedPrompts.map((p, i) => (
              <Grid item key={i}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => handleSend(p)}
                  disabled={loading}
                  sx={{ color: '#26C6DA', borderColor: 'rgba(38, 198, 218, 0.3)', textTransform: 'none' }}
                >
                  {p}
                </Button>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Ask me anything about your account..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSend()}
              disabled={loading}
              sx={{ 
                mr: 1, 
                input: { color: '#fff' },
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgba(0, 183, 194, 0.3)' },
                  '&:hover fieldset': { borderColor: '#00B7C2' },
                }
              }}
            />
            <IconButton color="secondary" onClick={() => handleSend()} disabled={loading || !input.trim()}>
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default ConsumerAssistant;
