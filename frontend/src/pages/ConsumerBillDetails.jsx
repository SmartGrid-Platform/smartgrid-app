import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingApi, assistantApi } from '../utils/api';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Divider, Alert, Grid } from '@mui/material';
import { SmartToy as BotIcon, ArrowBack as BackIcon, GetApp as DownloadIcon } from '@mui/icons-material';

const ConsumerBillDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiExplanation, setAiExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await billingApi.get(`/bills/my-bills/${id}`);
        setBill(res.data);
      } catch (err) {
        console.error(err);
        setError('Failed to load bill details');
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [id]);

  const handleDownload = async () => {
    try {
      const response = await billingApi.get(`/bills/my-bills/${id}/download`, { responseType: 'blob' });
      
      // Perform Frontend Validation on PDF content
      if (response.data.type !== 'application/pdf') {
        const text = await response.data.text();
        let errMsg = 'Failed to generate bill PDF.';
        try {
          const errObj = JSON.parse(text);
          errMsg = errObj.error || errMsg;
        } catch (e) {}
        alert(errMsg);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', bill?.pdf_path || `bill_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      alert('Failed to generate bill PDF.');
    }
  };

  const handleExplain = async () => {
    setExplaining(true);
    setAiExplanation('');
    try {
      const res = await assistantApi.post('/assistant/explain-bill', { billId: id });
      setAiExplanation(res.data.explanation);
    } catch (err) {
      console.error(err);
      setAiExplanation('Failed to generate AI explanation. Please try again.');
    } finally {
      setExplaining(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!bill) return <Typography>No bill found.</Typography>;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/consumer/bills')} sx={{ mb: 2, color: '#B0BEC5' }}>
        Back to Bills
      </Button>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontFamily: 'Outfit', fontWeight: 700, color: '#26C6DA' }}>
          Bill Statement: {bill.billing_month}
        </Typography>
        <Button variant="contained" color="secondary" startIcon={<DownloadIcon />} onClick={handleDownload}>
          Download PDF
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography color="textSecondary">Units Used</Typography>
              <Typography variant="h6">{parseFloat(bill.units_used).toFixed(2)} kWh</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography color="textSecondary">Total Amount</Typography>
              <Typography variant="h6" color="primary">₹{parseFloat(bill.amount).toFixed(2)}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography color="textSecondary">Status</Typography>
              <Typography variant="subtitle1" color="success.main" fontWeight="bold">{bill.status}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography color="textSecondary">Generated On</Typography>
              <Typography variant="subtitle1">{new Date(bill.createdAt).toLocaleDateString()}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ backgroundColor: '#0D202D', border: '1px solid rgba(0, 183, 194, 0.2)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <BotIcon sx={{ color: '#00B7C2', fontSize: 32, mr: 2 }} />
            <Typography variant="h6" sx={{ fontFamily: 'Outfit', color: '#fff' }}>
              AI Bill Explanation
            </Typography>
          </Box>
          <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
          
          {!aiExplanation && !explaining && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ color: '#B0BEC5', mb: 2 }}>
                Want to understand this bill better? Our AI can analyze your charges, compare with past usage, and suggest energy saving tips.
              </Typography>
              <Button variant="outlined" color="primary" onClick={handleExplain}>
                Explain My Bill
              </Button>
            </Box>
          )}

          {explaining && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={30} sx={{ mr: 2 }} />
              <Typography sx={{ color: '#00B7C2' }}>Analyzing your bill and history...</Typography>
            </Box>
          )}

          {aiExplanation && (
            <Box sx={{ p: 2, backgroundColor: '#102733', borderRadius: 2, color: '#fff', whiteSpace: 'pre-wrap' }}>
              <Typography variant="body1" sx={{ fontFamily: 'Inter', lineHeight: 1.6 }}>
                {aiExplanation}
              </Typography>
              <Box sx={{ mt: 3, textAlign: 'right' }}>
                <Button size="small" variant="text" color="primary" onClick={handleExplain}>
                  Regenerate Explanation
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConsumerBillDetails;
