import React, { useState, useEffect } from 'react';
import { consumerApi, meterApi, billingApi, authApi } from '../utils/api';
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  MenuItem,
  Chip,
  IconButton
} from '@mui/material';
import {
  People as PeopleIcon,
  FlashOn as ReadingsIcon,
  Receipt as BillIcon,
  AccountBalanceWallet as RechargeIcon,
  AssignmentTurnedIn as AssignIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';

const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [consumers, setConsumers] = useState([]);
  const [meters, setMeters] = useState([]);
  const [bills, setBills] = useState([]);
  const [recharges, setRecharges] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals visibility states
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, type: '', id: null, message: '' });
  const [openRegisterConsumer, setOpenRegisterConsumer] = useState(false);
  const [openAssignMeter, setOpenAssignMeter] = useState(false);
  const [openCreateMeter, setOpenCreateMeter] = useState(false);
  const [openAddReading, setOpenAddReading] = useState(false);
  const [openGenerateBill, setOpenGenerateBill] = useState(false);
  const [openRecharge, setOpenRecharge] = useState(false);

  // Form Inputs
  const [newConsumer, setNewConsumer] = useState({ name: '', email: '', password: '', address: '', phone: '' });
  const [assignMeterData, setAssignMeterData] = useState({ consumerId: '', meterId: '', tariffId: '', date: '' });
  const [newMeterNumber, setNewMeterNumber] = useState('');
  const [newMeterType, setNewMeterType] = useState('SMART');
  const [newMeterInstallationDate, setNewMeterInstallationDate] = useState(new Date().toISOString().split('T')[0]);
  const [newMeterStatus, setNewMeterStatus] = useState('ACTIVE');
  const [newMeterTariffId, setNewMeterTariffId] = useState('');
  const [newReading, setNewReading] = useState({ meterId: '', units: '' });
  const [newBillData, setNewBillData] = useState({ consumerId: '', month: '' });
  const [newRechargeData, setNewRechargeData] = useState({ consumerId: '', amount: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const cRes = await consumerApi.get('/consumers');
      console.log('[DEBUG] StaffDashboard Consumers Response:', cRes.data);
      setConsumers(Array.isArray(cRes.data) ? cRes.data : []);
      
      const mRes = await meterApi.get('/meters');
      console.log('[DEBUG] StaffDashboard Meters Response:', mRes.data);
      setMeters(Array.isArray(mRes.data) ? mRes.data : []);
      
      const bRes = await billingApi.get('/bills');
      console.log('[DEBUG] StaffDashboard Bills Response:', bRes.data);
      setBills(Array.isArray(bRes.data) ? bRes.data : []);
      
      const rRes = await billingApi.get('/recharges');
      console.log('[DEBUG] StaffDashboard Recharges Response:', rRes.data);
      setRecharges(Array.isArray(rRes.data) ? rRes.data : []);

      const tRes = await billingApi.get('/tariffs');
      console.log('[DEBUG] StaffDashboard Tariffs Response:', tRes.data);
      setTariffs(Array.isArray(tRes.data) ? tRes.data : []);
    } catch (err) {
      console.error('[ERROR] StaffDashboard fetchData error:', err);
      setError('Failed to fetch platform records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError('');
    setSuccess('');
  };

  // 1. Register Consumer
  const handleRegisterConsumer = async () => {
    if (!newConsumer.name || !newConsumer.email || !newConsumer.password || !newConsumer.address || !newConsumer.phone) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    try {
      await authApi.post('/auth/register', { ...newConsumer, role: 'CONSUMER' });
      setSuccess('Consumer registered successfully!');
      setNewConsumer({ name: '', email: '', password: '', address: '', phone: '' });
      fetchData();
      setTimeout(() => {
        setOpenRegisterConsumer(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  // 2. Provision / Create Meter
  const handleCreateMeter = async () => {
    if (!newMeterNumber) {
      setError('Meter number is required.');
      return;
    }
    setError('');
    try {
      await meterApi.post('/meters', {
        meter_number: newMeterNumber,
        meter_type: newMeterType,
        installation_date: newMeterInstallationDate,
        status: newMeterStatus,
        tariff_id: newMeterTariffId ? parseInt(newMeterTariffId, 10) : null
      });
      setSuccess('Meter provisioned successfully!');
      setNewMeterNumber('');
      setNewMeterType('SMART');
      setNewMeterInstallationDate(new Date().toISOString().split('T')[0]);
      setNewMeterStatus('ACTIVE');
      setNewMeterTariffId('');
      fetchData();
      setTimeout(() => {
        setOpenCreateMeter(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Meter creation failed.');
    }
  };

  // 3. Assign Meter
  const handleAssignMeter = async () => {
    if (!assignMeterData.consumerId || !assignMeterData.meterId) {
      setError('Please select consumer and meter.');
      return;
    }
    setError('');
    try {
      await consumerApi.post('/consumers/assign-meter', {
        consumerId: parseInt(assignMeterData.consumerId, 10),
        meterId: parseInt(assignMeterData.meterId, 10)
      });
      setSuccess('Meter assigned successfully!');
      setAssignMeterData({ consumerId: '', meterId: '', tariffId: '', date: '' });
      fetchData();
      setTimeout(() => {
        setOpenAssignMeter(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Meter assignment failed.');
    }
  };

  // Download PDF Bill
  const handleDownloadBill = async (billId) => {
    try {
      const res = await billingApi.get(`/bills/${billId}/download`);
      if (res.data.downloadUrl) {
        window.open(res.data.downloadUrl, '_blank');
      } else {
        alert("Failed to get download URL");
      }
    } catch (error) {
      console.error("Download Error", error);
      alert("Download failed");
    }
  };

  // 4. Add Reading
  const handleAddReading = async () => {
    if (!newReading.meterId || !newReading.units || parseFloat(newReading.units) <= 0) {
      setError('Please provide a valid meter selection and positive units consumed.');
      return;
    }
    setError('');
    try {
      const res = await meterApi.post(`/meters/${newReading.meterId}/readings`, {
        units_consumed: parseFloat(newReading.units)
      });
      setSuccess(res.data.message || 'Reading saved successfully!');
      setNewReading({ meterId: '', units: '' });
      fetchData();
      setTimeout(() => {
        setOpenAddReading(false);
        setSuccess('');
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit meter reading.');
    }
  };

  // 5. Generate Monthly Bill
  const handleGenerateBill = async () => {
    if (!newBillData.consumerId || !newBillData.month) {
      setError('Please select consumer and enter billing month (YYYY-MM).');
      return;
    }
    setError('');
    try {
      await billingApi.post('/bills/generate', {
        consumerId: parseInt(newBillData.consumerId, 10),
        billingMonth: newBillData.month
      });
      setSuccess('Bill generated and invoice stored successfully!');
      setNewBillData({ consumerId: '', month: '' });
      fetchData();
      setTimeout(() => {
        setOpenGenerateBill(false);
        setSuccess('');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate monthly bill statement.');
    }
  };

  // 6. Record Offline Recharge
  const handleRecharge = async () => {
    if (!newRechargeData.consumerId || !newRechargeData.amount || parseFloat(newRechargeData.amount) <= 0) {
      setError('Please select a consumer and enter a valid positive amount.');
      return;
    }
    setError('');
    try {
      await billingApi.post('/recharges', {
        consumer_id: parseInt(newRechargeData.consumerId, 10),
        amount: parseFloat(newRechargeData.amount)
      });
      setSuccess('Balance recharged successfully!');
      setNewRechargeData({ consumerId: '', amount: '' });
      fetchData();
      setTimeout(() => {
        setOpenRecharge(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to recharge account.');
    }
  };

  // Delete dialog trigger helper
  const triggerDeleteConfirm = (type, id, message) => {
    setDeleteConfirm({ open: true, type, id, message });
  };

  const handleConfirmDelete = async () => {
    const { type, id } = deleteConfirm;
    setDeleteConfirm({ open: false, type: '', id: null, message: '' });
    setError('');
    setSuccess('');
    try {
      if (type === 'consumer') {
        await consumerApi.delete(`/consumers/${id}`);
        setSuccess('Consumer profile deleted successfully.');
      } else if (type === 'meter') {
        await meterApi.delete(`/meters/${id}`);
        setSuccess('Smart meter deleted successfully.');
      } else if (type === 'bill') {
        await billingApi.delete(`/bills/${id}`);
        setSuccess('Bill deleted successfully.');
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to delete ${type}.`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontFamily: 'Outfit', fontWeight: 800 }}>
        Utility Staff Management Portal
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} textColor="secondary" indicatorColor="secondary">
          <Tab label="Consumers" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Meters & Readings" icon={<ReadingsIcon />} iconPosition="start" />
          <Tab label="Billing Logs" icon={<BillIcon />} iconPosition="start" />
          <Tab label="Recharge Logs" icon={<RechargeIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      
      {/* 1. CONSUMERS PANEL */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
            <Button variant="outlined" color="secondary" startIcon={<AssignIcon />} onClick={() => setOpenAssignMeter(true)}>
              Assign Meter
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenRegisterConsumer(true)}>
              Register Consumer
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Consumer #</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Prepaid Balance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(consumers) ? consumers : []).map((c) => (
                  <TableRow key={c?.id}>
                    <TableCell>{c?.id}</TableCell>
                    <TableCell><strong>{c?.consumer_number}</strong></TableCell>
                    <TableCell>{c?.user?.name || '-'}</TableCell>
                    <TableCell>{c?.user?.email || '-'}</TableCell>
                    <TableCell>{c?.phone}</TableCell>
                    <TableCell>{c?.address}</TableCell>
                    <TableCell>
                      <Chip label={c?.connection_status || 'DISCONNECTED'} color={c?.connection_status === 'CONNECTED' ? 'success' : 'error'} size="small" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{parseFloat(c?.balance ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('consumer', c?.id, 'Are you sure you want to permanently delete this consumer profile and their login user account?')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 2. METERS & READINGS PANEL */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
            <Button variant="outlined" color="secondary" startIcon={<ReadingsIcon />} onClick={() => setOpenAddReading(true)}>
              Add Reading
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpenCreateMeter(true)}>
              Provision Meter
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Meter Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Installation Date</TableCell>
                  <TableCell>Consumer #</TableCell>
                  <TableCell>Consumer Name</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(meters) ? meters : []).map((m) => (
                  <TableRow key={m?.id}>
                    <TableCell>{m?.id}</TableCell>
                    <TableCell><strong>{m?.meter_number}</strong></TableCell>
                    <TableCell>
                      <Chip label={m?.status || 'INACTIVE'} color={m?.status === 'ACTIVE' ? 'success' : m?.status === 'TAMPERED' ? 'error' : 'default'} size="small" />
                    </TableCell>
                    <TableCell>{m?.installation_date || 'N/A'}</TableCell>
                    <TableCell>{m?.consumer ? m.consumer.consumer_number : 'Unassigned'}</TableCell>
                    <TableCell>{m?.consumer && m.consumer.user ? m.consumer.user.name : '-'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('meter', m?.id, 'Are you sure you want to permanently delete this smart meter and its reading history?')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 3. BILLING PANEL */}
      {activeTab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button variant="contained" color="primary" startIcon={<BillIcon />} onClick={() => setOpenGenerateBill(true)}>
              Generate Statement
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Bill ID</TableCell>
                  <TableCell>Consumer Number</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Billing Month</TableCell>
                  <TableCell>Units Used</TableCell>
                  <TableCell>Tariff Rate</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(bills) ? bills : []).map((b) => (
                  <TableRow key={b?.id}>
                    <TableCell>{b?.id}</TableCell>
                    <TableCell><strong>{b?.consumer ? b.consumer.consumer_number : 'N/A'}</strong></TableCell>
                    <TableCell>{b?.consumer && b.consumer.user ? b.consumer.user.name : 'N/A'}</TableCell>
                    <TableCell>{b?.billing_month}</TableCell>
                    <TableCell>{parseFloat(b?.units_used ?? 0).toFixed(2)} kWh</TableCell>
                    <TableCell>₹{((parseFloat(b?.amount ?? 0)) / (parseFloat(b?.units_used ?? 0) || 1)).toFixed(2)}</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>₹{parseFloat(b?.amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip label={b?.status || 'PENDING'} color="success" size="small" sx={{ fontWeight: 'bold' }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton color="secondary" onClick={() => handleDownloadBill(b?.id)} title="Download PDF" sx={{ mr: 1, color: '#26C6DA' }}>
                        <DownloadIcon />
                      </IconButton>
                      <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} onClick={() => triggerDeleteConfirm('bill', b?.id, 'Are you sure you want to delete this bill? This will also remove the statement HTML file from S3 bucket.')}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 4. RECHARGES PANEL */}
      {activeTab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button variant="contained" color="primary" startIcon={<RechargeIcon />} onClick={() => setOpenRecharge(true)}>
              Record Cash Payment
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Recharge ID</TableCell>
                  <TableCell>Consumer Number</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Recharge Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(recharges) ? recharges : []).map((r) => (
                  <TableRow key={r?.id}>
                    <TableCell>{r?.id}</TableCell>
                    <TableCell><strong>{r?.consumer ? r.consumer.consumer_number : 'N/A'}</strong></TableCell>
                    <TableCell>{r?.consumer && r.consumer.user ? r.consumer.user.name : 'N/A'}</TableCell>
                    <TableCell>{(r?.createdAt || r?.created_at) ? new Date(r.createdAt || r.created_at).toLocaleString() : '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: '#26C6DA' }}>
                      ₹{parseFloat(r?.amount ?? 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* MODALS SECTION */}

      {/* 1. Register Consumer Dialog */}
      <Dialog open={openRegisterConsumer} onClose={() => setOpenRegisterConsumer(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Register Consumer Profile</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 360 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField label="Full Name" value={newConsumer.name} onChange={(e) => setNewConsumer({ ...newConsumer, name: e.target.value })} fullWidth />
          <TextField label="Email Address" value={newConsumer.email} onChange={(e) => setNewConsumer({ ...newConsumer, email: e.target.value })} fullWidth />
          <TextField label="Password" type="password" value={newConsumer.password} onChange={(e) => setNewConsumer({ ...newConsumer, password: e.target.value })} fullWidth />
          <TextField label="Phone Number" value={newConsumer.phone} onChange={(e) => setNewConsumer({ ...newConsumer, phone: e.target.value })} fullWidth />
          <TextField label="Physical Address" multiline rows={2} value={newConsumer.address} onChange={(e) => setNewConsumer({ ...newConsumer, address: e.target.value })} fullWidth />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenRegisterConsumer(false)} color="inherit">Cancel</Button>
          <Button onClick={handleRegisterConsumer} color="secondary" variant="contained">Register</Button>
        </DialogActions>
      </Dialog>

      {/* 2. Provision Meter Dialog */}
      <Dialog open={openCreateMeter} onClose={() => setOpenCreateMeter(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Provision New Smart Meter</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField label="Meter Serial Number" placeholder="e.g. MTR-9840294" value={newMeterNumber} onChange={(e) => setNewMeterNumber(e.target.value)} fullWidth />
          <TextField
            select
            label="Meter Type"
            value={newMeterType}
            onChange={(e) => setNewMeterType(e.target.value)}
            fullWidth
          >
            <MenuItem value="SMART">SMART</MenuItem>
            <MenuItem value="PREPAID">PREPAID</MenuItem>
            <MenuItem value="BI-DIRECTIONAL">BI-DIRECTIONAL</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="Installation Date"
            InputLabelProps={{ shrink: true }}
            value={newMeterInstallationDate}
            onChange={(e) => setNewMeterInstallationDate(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Status"
            value={newMeterStatus}
            onChange={(e) => setNewMeterStatus(e.target.value)}
            fullWidth
          >
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="INACTIVE">INACTIVE</MenuItem>
          </TextField>
          <TextField
            select
            label="Tariff Plan"
            value={newMeterTariffId}
            onChange={(e) => setNewMeterTariffId(e.target.value)}
            fullWidth
          >
            <MenuItem value=""><em>None</em></MenuItem>
            {tariffs.map((t) => (
              <MenuItem key={t.id} value={t.id}>{t.tariff_name} (₹{parseFloat(t.rate_per_unit).toFixed(2)}/kWh)</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenCreateMeter(false)} color="inherit">Cancel</Button>
          <Button onClick={handleCreateMeter} color="secondary" variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* 3. Assign Meter Dialog */}
      <Dialog open={openAssignMeter} onClose={() => setOpenAssignMeter(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Assign Meter to Consumer</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            select
            label="Consumer Profile"
            value={assignMeterData.consumerId}
            onChange={(e) => setAssignMeterData({ ...assignMeterData, consumerId: e.target.value })}
            fullWidth
          >
            {(Array.isArray(consumers) ? consumers : []).map((c) => (
              <MenuItem key={c?.id} value={c?.id}>
                {c?.consumer_number} - {c?.user?.name || ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Available Meter"
            value={assignMeterData.meterId}
            onChange={(e) => setAssignMeterData({ ...assignMeterData, meterId: e.target.value })}
            fullWidth
          >
            {(Array.isArray(meters) ? meters : []).filter(m => !m?.consumer_id).map((m) => (
              <MenuItem key={m?.id} value={m?.id}>
                {m?.meter_number} (Unassigned)
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenAssignMeter(false)} color="inherit">Cancel</Button>
          <Button onClick={handleAssignMeter} color="secondary" variant="contained">Assign</Button>
        </DialogActions>
      </Dialog>

      {/* 4. Add Reading Dialog */}
      <Dialog open={openAddReading} onClose={() => setOpenAddReading(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Submit Meter Reading</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            select
            label="Select Active Meter"
            value={newReading.meterId}
            onChange={(e) => setNewReading({ ...newReading, meterId: e.target.value })}
            fullWidth
          >
            {(Array.isArray(meters) ? meters : []).filter(m => m?.consumer_id && m?.status === 'ACTIVE').map((m) => (
              <MenuItem key={m?.id} value={m?.id}>
                {m?.meter_number} - {m?.consumer ? m.consumer.consumer_number : 'Unassigned'}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Units Consumed (kWh)"
            type="number"
            value={newReading.units}
            onChange={(e) => setNewReading({ ...newReading, units: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenAddReading(false)} color="inherit">Cancel</Button>
          <Button onClick={handleAddReading} color="secondary" variant="contained">Submit Reading</Button>
        </DialogActions>
      </Dialog>

      {/* 5. Generate Bill Dialog */}
      <Dialog open={openGenerateBill} onClose={() => setOpenGenerateBill(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Generate Billing Statement</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            select
            label="Consumer Profile"
            value={newBillData.consumerId}
            onChange={(e) => setNewBillData({ ...newBillData, consumerId: e.target.value })}
            fullWidth
          >
            {(Array.isArray(consumers) ? consumers : []).map((c) => (
              <MenuItem key={c?.id} value={c?.id}>
                {c?.consumer_number} - {c?.user?.name || ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Billing Month (YYYY-MM)"
            placeholder="e.g. 2026-06"
            value={newBillData.month}
            onChange={(e) => setNewBillData({ ...newBillData, month: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenGenerateBill(false)} color="inherit">Cancel</Button>
          <Button onClick={handleGenerateBill} color="secondary" variant="contained">Generate</Button>
        </DialogActions>
      </Dialog>

      {/* 6. Record Offline Recharge Dialog */}
      <Dialog open={openRecharge} onClose={() => setOpenRecharge(false)}>
        <DialogTitle sx={{ backgroundColor: '#102733' }}>Record Offline / Cash Recharge</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 340 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <TextField
            select
            label="Consumer Profile"
            value={newRechargeData.consumerId}
            onChange={(e) => setNewRechargeData({ ...newRechargeData, consumerId: e.target.value })}
            fullWidth
          >
            {(Array.isArray(consumers) ? consumers : []).map((c) => (
              <MenuItem key={c?.id} value={c?.id}>
                {c?.consumer_number} - {c?.user?.name || ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Recharge Amount (₹)"
            type="number"
            value={newRechargeData.amount}
            onChange={(e) => setNewRechargeData({ ...newRechargeData, amount: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733' }}>
          <Button onClick={() => setOpenRecharge(false)} color="inherit">Cancel</Button>
          <Button onClick={handleRecharge} color="secondary" variant="contained">Record Payment</Button>
        </DialogActions>
      </Dialog>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ ...deleteConfirm, open: false })}>
        <DialogTitle sx={{ backgroundColor: '#102733', fontFamily: 'Outfit', fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#102733', minWidth: 320, pt: 1 }}>
          <Typography variant="body1" sx={{ fontFamily: 'Outfit', color: '#B0BEC5' }}>
            {deleteConfirm.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#102733', pb: 2, px: 3 }}>
          <Button onClick={() => setDeleteConfirm({ ...deleteConfirm, open: false })} color="inherit">Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default StaffDashboard;
