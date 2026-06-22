import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { billingApi, consumerApi } from '../utils/api';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Button, CircularProgress } from '@mui/material';
import { GetApp as DownloadIcon, Visibility as ViewIcon } from '@mui/icons-material';

const ConsumerBills = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consumerId, setConsumerId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const profRes = await consumerApi.get('/consumers/me');
        const consumerData = profRes.data;
        if (!consumerData || !consumerData.id) {
          setLoading(false);
          return;
        }
        setConsumerId(consumerData.id);
        
        const billsRes = await billingApi.get(`/bills/consumer/${consumerData.id}`);
        const data = billsRes.data;
        const billsData = Array.isArray(data) ? data : (data?.bills || []);
        setBills(billsData);
      } catch (error) {
        console.error('Error fetching bills:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBills();
  }, []);

  const handleDownload = async (billId, fileName) => {
    try {
      const response = await billingApi.get(`/bills/my-bills/${billId}/download`, { responseType: 'blob' });
      
      // Perform Frontend Validation on PDF content
      if (response.headers['content-type'] !== 'application/pdf') {
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
      link.setAttribute('download', fileName || `bill_${billId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Download Error", error);
      alert("Failed to generate bill PDF.");
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Outfit', fontWeight: 700, color: '#26C6DA' }}>
          My Billing History
        </Typography>
      </Box>

      <Card>
        <CardContent>
          {bills.length === 0 ? (
            <Typography sx={{ color: '#B0BEC5' }}>No Bills Available</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell>Units Used</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bills.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell><strong>{b.billing_month}</strong></TableCell>
                      <TableCell>{parseFloat(b.units_used).toFixed(2)} kWh</TableCell>
                      <TableCell>₹{parseFloat(b.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip label={b.status} color="success" size="small" />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton color="primary" onClick={() => navigate(`/consumer/bills/${b.id}`)} title="View Details">
                          <ViewIcon />
                        </IconButton>
                        <IconButton color="secondary" onClick={() => handleDownload(b.id, b.pdf_path)} title="Download PDF">
                          <DownloadIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ConsumerBills;
