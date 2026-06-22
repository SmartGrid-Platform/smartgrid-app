import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { authActions } from '../store';
import { consumerApi, meterApi, billingApi, alertApi } from '../utils/api';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  AccountBalanceWallet as WalletIcon,
  FlashOn as ConsumptionIcon,
  Layers as MeterIcon,
  Payment as RechargeIcon,
  GetApp as DownloadIcon,
  Timeline as ChartIcon,
  CheckCircle as ConnectedIcon,
  Cancel as DisconnectedIcon
} from '@mui/icons-material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const ConsumerDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  const [profile, setProfile] = useState(null);
  const [meters, setMeters] = useState([]);
  const [bills, setBills] = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [readingsData, setReadingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Recharge states
  const [openRecharge, setOpenRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeError, setRechargeError] = useState('');
  const [rechargeSuccess, setRechargeSuccess] = useState('');
  const [recharging, setRecharging] = useState(false);
  
  // Profile update states
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const ensureArray = (data, key) => {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      if (Array.isArray(data.data)) {
        return data.data;
      }
      if (key && Array.isArray(data[key])) {
        return data[key];
      }
      const firstArray = Object.values(data).find(val => Array.isArray(val));
      if (firstArray) {
        return firstArray;
      }
    }
    return [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch consumer profile
      const profRes = await consumerApi.get('/consumers/me');
      const consumerData = profRes.data;
      console.log('[DEBUG] Consumer Dashboard Profile Response:', consumerData);
      
      setProfile(consumerData);
      setPhone(consumerData ? consumerData.phone || '' : '');
      setAddress(consumerData ? consumerData.address || '' : '');

      const consumerId = consumerData ? consumerData.id : null;

      if (consumerId) {
        // Fetch meters
        const meterRes = await meterApi.get(`/meters/consumer/${consumerId}`);
        console.log('[DEBUG] Consumer Dashboard Meters Response:', meterRes.data);
        const meterList = ensureArray(meterRes.data, 'meters');
        setMeters(meterList);

        // Fetch bills
        const billsRes = await billingApi.get(`/bills/consumer/${consumerId}`);
        console.log('[DEBUG] Consumer Dashboard Bills Response:', billsRes.data);
        setBills(ensureArray(billsRes.data, 'bills'));

        // Fetch recharges
        const rechargeRes = await billingApi.get(`/recharges/consumer/${consumerId}`);
        console.log('[DEBUG] Consumer Dashboard Recharges Response:', rechargeRes.data);
        setRecharges(ensureArray(rechargeRes.data, 'recharges'));

        // Fetch readings for chart (from first meter if available)
        if (meterList.length > 0) {
          const readingsRes = await meterApi.get(`/meters/${meterList[0].id}/readings`);
          console.log('[DEBUG] Consumer Dashboard Readings Response:', readingsRes.data);
          const readingsList = ensureArray(readingsRes.data, 'readings');
          const formattedReadings = readingsList
            .slice(0, 15) // take latest 15
            .reverse() // show in chronological order
            .map((r) => ({
              date: new Date(r.reading_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
              units: parseFloat(r.units_consumed || 0)
            }));
          setReadingsData(formattedReadings);
        } else {
          setReadingsData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRechargeSubmit = async () => {
    if (!rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      setRechargeError('Please enter a valid recharge amount.');
      return;
    }
    setRechargeError('');
    setRechargeSuccess('');
    setRecharging(true);

    try {
      const res = await billingApi.post('/recharges', {
        consumer_id: profile.id,
        amount: parseFloat(rechargeAmount)
      });
      setRechargeSuccess(res.data.message);
      setRechargeAmount('');
      
      // Update profile locally & refetch data
      setProfile({
        ...profile,
        balance: res.data.newBalance,
        connection_status: res.data.connectionStatus
      });
      
      // Dispatch updating the user session info
      dispatch(authActions.updateUserProfile({ connection_status: res.data.connectionStatus }));

      setTimeout(() => {
        setOpenRecharge(false);
        setRechargeSuccess('');
        fetchData();
      }, 1500);
    } catch (err) {
      console.error(err);
      setRechargeError(err.response?.data?.error || 'Recharge failed.');
    } finally {
      setRecharging(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    try {
      const res = await consumerApi.put(`/consumers/${profile.id}`, { phone, address });
      setProfileSuccess(res.data.message);
      setProfile(res.data.consumer);
    } catch (err) {
      console.error(err);
      setProfileError('Failed to update profile details.');
    }
  };

  const handleBillDownload = async (billId, fileName) => {
    try {
      const response = await billingApi.get(`/bills/${billId}/download`, { responseType: 'blob' });
      
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
      console.error('Error downloading bill:', error);
      alert('Failed to generate bill PDF.');
    }
  };

  if (loading || !profile || !profile.id) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* 1. Statistics Cards */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%', borderLeft: `6px solid ${(profile?.connection_status || 'DISCONNECTED') === 'CONNECTED' ? '#00B7C2' : '#d32f2f'}` }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Account Balance
              </Typography>
              <WalletIcon sx={{ color: '#00B7C2', fontSize: 28 }} />
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 1, fontFamily: 'Outfit' }}>
              ₹{parseFloat(profile?.balance ?? 0).toFixed(2)}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Chip
                icon={(profile?.connection_status || 'DISCONNECTED') === 'CONNECTED' ? <ConnectedIcon /> : <DisconnectedIcon />}
                label={profile?.connection_status || 'DISCONNECTED'}
                color={(profile?.connection_status || 'DISCONNECTED') === 'CONNECTED' ? 'success' : 'error'}
                size="small"
                sx={{ fontWeight: 'bold' }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<RechargeIcon />}
                onClick={() => setOpenRecharge(true)}
              >
                Recharge
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Meter Information
              </Typography>
              <MeterIcon sx={{ color: '#00B7C2', fontSize: 28 }} />
            </Box>
            {!Array.isArray(meters) || meters.length === 0 ? (
              <Typography variant="body1" sx={{ color: '#B0BEC5', mt: 2 }}>No meter assigned yet.</Typography>
            ) : (
              meters.map(m => (
                <Box key={m?.id} sx={{ mb: 1.5, p: 1.5, borderRadius: 2, border: '1px dashed rgba(0, 183, 194, 0.2)' }}>
                  <Typography variant="subtitle1" color="secondary" sx={{ fontWeight: 700 }}>
                    #{m?.meter_number}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Status:{' '}
                    <span style={{ color: m?.status === 'ACTIVE' ? '#2e7d32' : '#d32f2f', fontWeight: 'bold' }}>
                      {m?.status || 'INACTIVE'}
                    </span>
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Assigned: {m?.installation_date || 'N/A'}
                  </Typography>
                </Box>
              ))
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                Profile & Details
              </Typography>
              <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>
                #{profile?.consumer_number || 'N/A'}
              </Typography>
            </Box>
            <Box component="form" onSubmit={handleUpdateProfile} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              {profileSuccess && <Alert severity="success" sx={{ py: 0, px: 1 }}>{profileSuccess}</Alert>}
              {profileError && <Alert severity="error" sx={{ py: 0, px: 1 }}>{profileError}</Alert>}
              <TextField
                size="small"
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                multiline
                rows={2}
                fullWidth
              />
              <Button type="submit" variant="outlined" size="small" fullWidth>
                Update Details
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 2. Consumption Graph */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontFamily: 'Outfit', fontWeight: 700, color: '#26C6DA' }}>
                Usage & Consumption Patterns (kWh)
              </Typography>
              <ChartIcon sx={{ color: '#26C6DA' }} />
            </Box>
            {readingsData.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: '#B0BEC5' }}>
                  No usage readings reported yet. Consumption reports will appear here.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ height: 280, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={readingsData}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00B7C2" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#00B7C2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(38, 198, 218, 0.05)" />
                    <XAxis dataKey="date" stroke="#B0BEC5" fontSize={11} />
                    <YAxis stroke="#B0BEC5" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#102733', border: '1px solid rgba(0, 183, 194, 0.3)' }} />
                    <Area type="monotone" dataKey="units" stroke="#00B7C2" strokeWidth={2} fillOpacity={1} fill="url(#colorUnits)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* 3. Recharge logs */}
      <Grid item xs={12}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontFamily: 'Outfit', fontWeight: 700, color: '#26C6DA' }}>
              Recent Recharges
            </Typography>
            {recharges.length === 0 ? (
              <Typography variant="body2" sx={{ color: '#B0BEC5', py: 2 }}>No recharge logs found.</Typography>
            ) : (
              <List>
                {(Array.isArray(recharges) ? recharges : []).map((r) => (
                  <React.Fragment key={r?.id}>
                    <ListItem sx={{ py: 1, px: 0 }}>
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            + ₹{parseFloat(r?.amount ?? 0).toFixed(2)} Balance Added
                          </Typography>
                        }
                        secondary={(r?.createdAt || r?.created_at) ? new Date(r.createdAt || r.created_at).toLocaleString() : '-'}
                      />
                      <Chip label="Success" color="success" size="small" variant="outlined" />
                    </ListItem>
                    <Divider sx={{ backgroundColor: 'rgba(38, 198, 218, 0.08)' }} />
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Recharge Dialog Modal */}
      <Dialog open={openRecharge} onClose={() => setOpenRecharge(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733', borderBottom: '1px solid rgba(0, 183, 194, 0.2)' }}>
          Recharge Account Balance
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 3, minWidth: 320 }}>
          {rechargeError && <Alert severity="error" sx={{ mb: 2 }}>{rechargeError}</Alert>}
          {rechargeSuccess && <Alert severity="success" sx={{ mb: 2 }}>{rechargeSuccess}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Recharge Amount (₹)"
            type="number"
            fullWidth
            variant="outlined"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(e.target.value)}
            disabled={recharging}
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733', borderTop: '1px solid rgba(0, 183, 194, 0.12)' }}>
          <Button onClick={() => setOpenRecharge(false)} color="inherit" disabled={recharging}>
            Cancel
          </Button>
          <Button onClick={handleRechargeSubmit} color="secondary" variant="contained" disabled={recharging}>
            {recharging ? 'Processing...' : 'Submit Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default ConsumerDashboard;
